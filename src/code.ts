// This file runs in the Figma plugin sandbox and has access to the Figma Plugin API

// Show the UI when the plugin is launched
figma.showUI(__html__, {
  width: 300,
  height: 400,
  themeColors: true,
});

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === "create-rectangle") {
    const rect = figma.createRectangle();
    rect.x = 0;
    rect.y = 0;
    rect.resize(100, 100);
    rect.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.5, b: 1 } }];
    figma.currentPage.appendChild(rect);
    figma.currentPage.selection = [rect];
    figma.viewport.scrollAndZoomIntoView([rect]);
  }

  if (msg.type === "create-circle") {
    const circle = figma.createEllipse();
    circle.x = 0;
    circle.y = 0;
    circle.resize(100, 100);
    circle.fills = [{ type: "SOLID", color: { r: 1, g: 0.3, b: 0.5 } }];
    figma.currentPage.appendChild(circle);
    figma.currentPage.selection = [circle];
    figma.viewport.scrollAndZoomIntoView([circle]);
  }

  if (msg.type === "create-text") {
    try {
      // Load the Inter font first
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });

      const text = figma.createText();
      text.x = 0;
      text.y = 0;
      text.characters = msg.text || "Hello Figma!";
      text.fontSize = 24;
      text.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
      figma.currentPage.appendChild(text);
      figma.currentPage.selection = [text];
      figma.viewport.scrollAndZoomIntoView([text]);
    } catch (error) {
      console.error("Error creating text:", error);
      figma.notify("Error creating text element", { error: true });
    }
  }

  if (msg.type === "close-plugin") {
    figma.closePlugin();
  }
};
