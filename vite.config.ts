import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import type { OutputBundle, OutputOptions, OutputAsset, OutputChunk } from "rollup";
import { svelte } from "@sveltejs/vite-plugin-svelte";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ui3InlineSvg(): Plugin {
  return {
    name: "ui3-inline-svg",
    enforce: "pre",
    load(id) {
      if (!id.includes("figma-ui3-kit-svelte")) return;
      if (!id.includes(".svg")) return;
      const filePath = id.split("?")[0];
      if (!filePath.endsWith(".svg")) return;
      const svg = readFileSync(filePath, "utf-8");
      return `export default ${JSON.stringify(svg)};`;
    },
  };
}

function inlineFigmaHtml(): Plugin {
  return {
    name: "inline-figma-html",
    apply: "build",
    enforce: "post",
    generateBundle(_options: OutputOptions, bundle: OutputBundle) {
      const htmlKey =
        Object.keys(bundle).find((key) => key.endsWith("index.html")) ?? "";
      const htmlAsset = htmlKey ? bundle[htmlKey] : undefined;
      if (!htmlAsset || htmlAsset.type !== "asset") return;

      let html = String(htmlAsset.source);

      html = html.replace(
        /<link\s+[^>]*rel=["']modulepreload["'][^>]*>/gi,
        ""
      );

      // Inline UI CSS into HTML and remove CSS assets.
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== "asset") continue;
        if (!fileName.endsWith(".css")) continue;
        const css = String(asset.source ?? "");
        const hrefPattern = new RegExp(
          `<link[^>]+rel=["']stylesheet["'][^>]+href=["'](?:\\./|/|\\.\\./)?${escapeRegExp(
            fileName
          )}["'][^>]*>`,
          "i"
        );
        if (hrefPattern.test(html)) {
          html = html.replace(hrefPattern, `<style>${css}</style>`);
          delete bundle[fileName];
        }
      }

      // Inline UI JS into HTML and remove the UI chunk.
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk") continue;
        const scriptPattern = new RegExp(
          `<script[^>]+src=["'](?:\\./|/|\\.\\./)?${escapeRegExp(
            fileName
          )}["'][^>]*></script>`,
          "i"
        );
        if (scriptPattern.test(html)) {
          html = html.replace(
            scriptPattern,
            `<script type="module">${chunk.code}</script>`
          );
          html = html.replace(
            new RegExp(
              `<link[^>]+rel=["']modulepreload["'][^>]+href=["'](?:\\./|/|\\.\\./)?${escapeRegExp(
                fileName
              )}["'][^>]*>`,
              "gi"
            ),
            ""
          );
          delete bundle[fileName];
        }
      }

      (htmlAsset as OutputAsset).source = html;
      if (htmlKey !== "index.html") {
        delete bundle[htmlKey];
        (htmlAsset as OutputAsset).fileName = "index.html";
        bundle["index.html"] = htmlAsset as OutputAsset;
      }

      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.name === "code") {
          (chunk as OutputChunk).code = chunk.code.replace(
            /__html__/g,
            JSON.stringify(html)
          );
        }
      }

      // Emit manifest into dist.
      const manifestPath = resolve(__dirname, "src/manifest.json");
      const manifestSource = readFileSync(manifestPath, "utf-8");
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: manifestSource,
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [ui3InlineSvg(), svelte(), inlineFigmaHtml()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        ui: resolve(__dirname, "src/index.html"),
        code: resolve(__dirname, "src/code.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === "code" ? "code.js" : "[name].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[name]-[hash][extname]",
      },
    },
  },
});
