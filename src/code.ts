figma.showUI(__html__, {
  width: 400,
  height: 560,
  themeColors: true,
});

const ICONS_PAGE_NAME = "└ icons";
const SYNONYMS: Record<string, string> = {
  view: "eye",
  eye: "view",
  close: "x",
  x: "close",
  remove: "trash",
  trash: "remove",
  checkmark: "check",
  check: "checkmark",
  overflow: "more",
  more: "overflow",
  warning: "alert",
  alert: "warning",
};

type IconCollection = {
  id: string;
  name: string;
  frameId: string;
  componentIds: string[];
};

type IconComponent = {
  id: string;
  name: string;
  collectionId: string;
};

type MatchRow = {
  sourceComponentId: string;
  sourceName: string;
  suggestedTargetId: string | null;
  score: number;
  confidence: "high" | "medium" | "low";
  // The best-scoring targets, best first; the UI lists them as suggestions.
  candidates: {
    id: string;
    score: number;
    confidence: MatchRow["confidence"];
  }[];
  uses: number;
  pages: number;
};

const CANDIDATE_LIMIT = 5;

type CollectionScan = {
  collections: IconCollection[];
  components: IconComponent[];
  componentById: Map<string, IconComponent>;
  componentByCollection: Map<string, IconComponent[]>;
};

// Where swaps happen: the whole file, the current page, or inside the selection.
type Scope = "file" | "page" | "selection";
const SCOPES: Scope[] = ["file", "page", "selection"];
const SCOPE_STORAGE_KEY = "scope";
const SCOPE_PHRASE: Record<Scope, string> = {
  file: "in this file",
  page: "on this page",
  selection: "in the selection",
};

function parseScope(value: unknown): Scope {
  return SCOPES.includes(value as Scope) ? (value as Scope) : "page";
}

type IconUse = {
  instance: InstanceNode;
  component: IconComponent;
  pageId: string;
};

type UsageScan = {
  uses: IconUse[];
  usageByCollection: Map<string, number>;
  usageByComponent: Map<string, { count: number; pageIds: Set<string> }>;
};

type UsageScanOptions = {
  scope: Scope;
  onlyInsideComponents: boolean;
  // Whole file only: the components whose instances to look up. Each lookup
  // costs a call, so callers pass only the collection they need.
  components?: IconComponent[];
  onProgress?: (done: number, total: number) => void;
  // Whole file only: stops the lookup once a newer request has replaced it.
  isStale?: () => boolean;
};

const PROGRESS_STEP = 25;

// One walk up the tree answers every placement question for an instance.
function locate(node: SceneNode, collectionFrameIds: Set<string>) {
  let insideComponent = false;
  let insideCollection = false;
  let pageId = "";
  let current: BaseNode | null = node.parent;
  while (current) {
    if (current.type === "COMPONENT" || current.type === "COMPONENT_SET") {
      insideComponent = true;
    }
    if (collectionFrameIds.has(current.id)) insideCollection = true;
    if (current.type === "PAGE") pageId = current.id;
    current = current.parent;
  }
  return { insideComponent, insideCollection, pageId };
}

// Instances nested in other instances have ids like "I1:2;3:4"; the count of
// ";" is how deep they sit.
function nestingDepth(node: SceneNode) {
  return node.id.split(";").length - 1;
}

function normalizeName(name: string, collectionName?: string) {
  let normalized = name.toLowerCase();
  if (collectionName) {
    const prefix = collectionName.toLowerCase();
    if (normalized.startsWith(`${prefix}/`)) {
      normalized = normalized.slice(prefix.length + 1);
    }
    if (normalized.startsWith(`${prefix} `)) {
      normalized = normalized.slice(prefix.length + 1);
    }
    if (normalized.startsWith(`${prefix}-`)) {
      normalized = normalized.slice(prefix.length + 1);
    }
  }

  normalized = normalized
    .replace(/[_/\\]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");

  // CQ2: the digit filter already covers all size strings (12, 16, 20, …)
  const tokens = normalized
    .split("-")
    .filter((token) => token.length > 0)
    .filter((token) => !/^\d+$/.test(token));

  return tokens.join("-");
}

function expandTokens(tokens: string[]) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    const synonym = SYNONYMS[token];
    if (synonym) {
      expanded.add(synonym);
    }
  }
  return [...expanded];
}

function scoreNames(sourceName: string, targetName: string) {
  if (!sourceName || !targetName) return 0;
  if (sourceName === targetName) return 1;
  const sourceTokens = expandTokens(sourceName.split("-").filter(Boolean));
  const targetTokens = expandTokens(targetName.split("-").filter(Boolean));
  const targetSet = new Set(targetTokens);
  const intersection = sourceTokens.filter((token) => targetSet.has(token));
  const denom = Math.max(sourceTokens.length, targetTokens.length, 1);
  return intersection.length / denom;
}

function confidenceFromScore(score: number): MatchRow["confidence"] {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

function getIconsPage() {
  const exactMatch = figma.root.children.find(
    (page) => page.name === ICONS_PAGE_NAME,
  );
  if (exactMatch) return exactMatch;
  const partialMatch = figma.root.children.find((page) =>
    page.name.toLowerCase().includes("icons"),
  );
  return partialMatch || null;
}

async function scanCollections(): Promise<CollectionScan> {
  const iconsPage = getIconsPage();
  const collections: IconCollection[] = [];
  const components: IconComponent[] = [];
  const componentById = new Map<string, IconComponent>();
  const componentByCollection = new Map<string, IconComponent[]>();

  if (!iconsPage) {
    return { collections, components, componentById, componentByCollection };
  }

  await iconsPage.loadAsync();
  const frames = iconsPage.children.filter(
    (node): node is FrameNode => node.type === "FRAME",
  );

  for (const frame of frames) {
    const frameComponents = frame.findAll(
      (node): node is ComponentNode => node.type === "COMPONENT",
    );
    const componentIds = frameComponents.map((component) => component.id);
    const collection: IconCollection = {
      id: frame.id,
      name: frame.name,
      frameId: frame.id,
      componentIds,
    };
    collections.push(collection);

    const collectionComponents = frameComponents.map((component) => {
      const entry: IconComponent = {
        id: component.id,
        name: component.name,
        collectionId: frame.id,
      };
      components.push(entry);
      componentById.set(component.id, entry);
      return entry;
    });
    componentByCollection.set(frame.id, collectionComponents);
  }

  return { collections, components, componentById, componentByCollection };
}

// The current page or the selection: walk the loaded page and resolve each
// instance's main component.
async function findPageUses(
  componentById: Map<string, IconComponent>,
  scope: "page" | "selection",
) {
  await figma.currentPage.loadAsync();
  const found = new Map<string, InstanceNode>();
  const roots: readonly SceneNode[] =
    scope === "selection" ? figma.currentPage.selection : [];
  if (scope === "page") {
    for (const node of figma.currentPage.findAllWithCriteria({
      types: ["INSTANCE"],
    })) {
      found.set(node.id, node);
    }
  }
  for (const root of roots) {
    if (root.type === "INSTANCE") found.set(root.id, root);
    if ("findAllWithCriteria" in root) {
      for (const node of root.findAllWithCriteria({ types: ["INSTANCE"] })) {
        found.set(node.id, node);
      }
    }
  }

  const uses: { instance: InstanceNode; component: IconComponent }[] = [];
  for (const instance of found.values()) {
    const mainComponent = await instance.getMainComponentAsync();
    const component = mainComponent && componentById.get(mainComponent.id);
    if (component) uses.push({ instance, component });
  }
  return uses;
}

// The whole file: ask each component for its instances. Under dynamic-page
// this reaches every page without loading them, where walking all pages would
// load the whole file into memory.
async function findFileUses(
  components: IconComponent[],
  onProgress?: UsageScanOptions["onProgress"],
  isStale?: UsageScanOptions["isStale"],
) {
  const uses: { instance: InstanceNode; component: IconComponent }[] = [];
  for (let i = 0; i < components.length; i++) {
    if (isStale?.()) break;
    const component = components[i];
    const node = await figma.getNodeByIdAsync(component.id);
    if (node && node.type === "COMPONENT") {
      for (const instance of await node.getInstancesAsync()) {
        uses.push({ instance, component });
      }
    }
    if ((i + 1) % PROGRESS_STEP === 0) onProgress?.(i + 1, components.length);
  }
  return uses;
}

async function scanUsage(
  scan: CollectionScan,
  options: UsageScanOptions,
): Promise<UsageScan> {
  const found =
    options.scope === "file"
      ? await findFileUses(
          options.components ?? scan.components,
          options.onProgress,
          options.isStale,
        )
      : await findPageUses(scan.componentById, options.scope);

  // Instances inside the collection frames are the icon library itself, never
  // a place to swap.
  const collectionFrameIds = new Set(scan.collections.map((c) => c.frameId));
  const uses: IconUse[] = [];
  const usageByCollection = new Map<string, number>();
  const usageByComponent: UsageScan["usageByComponent"] = new Map();

  for (const { instance, component } of found) {
    const where = locate(instance, collectionFrameIds);
    if (where.insideCollection) continue;
    if (options.onlyInsideComponents && !where.insideComponent) continue;
    uses.push({ instance, component, pageId: where.pageId });
    usageByCollection.set(
      component.collectionId,
      (usageByCollection.get(component.collectionId) || 0) + 1,
    );
    const entry = usageByComponent.get(component.id) || {
      count: 0,
      pageIds: new Set<string>(),
    };
    entry.count += 1;
    entry.pageIds.add(where.pageId);
    usageByComponent.set(component.id, entry);
  }

  return { uses, usageByCollection, usageByComponent };
}

function pickDefaultSource(usageByCollection: Map<string, number>) {
  let bestId: string | null = null;
  let bestCount = -1;
  for (const [collectionId, count] of usageByCollection.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestId = collectionId;
    }
  }
  return bestId;
}

function buildMatches(
  sourceCollectionId: string,
  targetCollectionId: string,
  scan: CollectionScan,
  usage: UsageScan,
) {
  const { componentByCollection } = scan;
  const sourceComponents = componentByCollection.get(sourceCollectionId) || [];
  const targetComponents = componentByCollection.get(targetCollectionId) || [];
  const sourceComponentsUsed = sourceComponents.filter((component) =>
    usage.usageByComponent.has(component.id),
  );

  const targetOptions = targetComponents.map((component) => ({
    id: component.id,
    name: component.name,
  }));

  const matches: MatchRow[] = sourceComponentsUsed.map((source) => {
    const sourceNormalized = normalizeName(source.name);
    // Ties keep collection order, so the first best match stays the suggestion.
    const candidates = targetComponents
      .map((target) => ({
        id: target.id,
        score: scoreNames(sourceNormalized, normalizeName(target.name)),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, CANDIDATE_LIMIT)
      .map((candidate) => ({
        ...candidate,
        confidence: confidenceFromScore(candidate.score),
      }));
    const best = candidates[0];
    const bestScore = best?.score ?? 0;

    const used = usage.usageByComponent.get(source.id);
    return {
      sourceComponentId: source.id,
      sourceName: source.name,
      suggestedTargetId: best?.id ?? null,
      candidates,
      score: bestScore,
      confidence: confidenceFromScore(bestScore),
      uses: used?.count ?? 0,
      pages: used?.pageIds.size ?? 0,
    };
  });

  return { matches, targetOptions };
}

// ── Icon color ──────────────────────────────────────────────────────────────
//
// An icon set drawn with fills and one drawn with strokes keep their color on
// different fields, so swapping between them loses a recolored icon's color:
// the override sits on fills the new icon never paints, or on layers it does
// not have. So the color is read before the swap and put back after it, on
// whichever of fills or strokes the new icon draws with.

type Channel = "fills" | "strokes";
type IconColor = { paint: SolidPaint; styleId: string };

const SHAPE_TYPES = new Set<NodeType>([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "STAR",
  "LINE",
  "ELLIPSE",
  "POLYGON",
  "RECTANGLE",
  "TEXT",
]);

function visibleSolid(paints: readonly Paint[] | PluginAPI["mixed"]) {
  if (!Array.isArray(paints)) return null;
  return (
    paints.find(
      (p): p is SolidPaint =>
        p.type === "SOLID" && p.visible !== false && (p.opacity ?? 1) > 0,
    ) ?? null
  );
}

function colorOn(node: SceneNode, channel: Channel): IconColor | null {
  if (!(channel in node)) return null;
  const shape = node as GeometryMixin & MinimalFillsMixin & MinimalStrokesMixin;
  const paint = visibleSolid(shape[channel]);
  if (!paint) return null;
  const styleId = channel === "fills" ? shape.fillStyleId : shape.strokeStyleId;
  return { paint, styleId: typeof styleId === "string" ? styleId : "" };
}

// The icon's color: the first visible solid fill or stroke on a shape inside
// it. The icon's own frame is left out — a background is not its color.
function iconColor(root: InstanceNode | ComponentNode): IconColor | null {
  let found: IconColor | null = null;
  root.findOne((node) => {
    if (!SHAPE_TYPES.has(node.type) || !node.visible) return false;
    found = colorOn(node, "fills") ?? colorOn(node, "strokes");
    return found !== null;
  });
  return found;
}

function sameColor(a: IconColor, b: IconColor) {
  if (a.styleId || b.styleId) return a.styleId === b.styleId;
  const va = a.paint.boundVariables?.color?.id;
  const vb = b.paint.boundVariables?.color?.id;
  if (va || vb) return va === vb;
  const close = (x: number, y: number) => Math.abs(x - y) < 1 / 512;
  return (
    close(a.paint.color.r, b.paint.color.r) &&
    close(a.paint.color.g, b.paint.color.g) &&
    close(a.paint.color.b, b.paint.color.b) &&
    close(a.paint.opacity ?? 1, b.paint.opacity ?? 1)
  );
}

// The color someone gave this instance — directly or from an instance it sits
// in — or null when it shows its main component's own.
function recolored(instance: InstanceNode, main: ComponentNode) {
  const own = iconColor(instance);
  const base = iconColor(main);
  if (!own || !base || sameColor(own, base)) return null;
  return own;
}

// Paint the swapped-in icon: every layer drawn in the new icon's own color, on
// whichever of fills or strokes it uses. Layers in another color — a duotone
// icon's second tone — keep theirs.
async function applyIconColor(
  instance: InstanceNode,
  color: IconColor,
  base: IconColor,
) {
  const shapes = instance.findAll(
    (node) => SHAPE_TYPES.has(node.type) && node.visible,
  );
  for (const node of shapes) {
    for (const channel of ["fills", "strokes"] as const) {
      const current = colorOn(node, channel);
      if (!current || !sameColor(current, base)) continue;
      const shape = node as MinimalFillsMixin & MinimalStrokesMixin;
      if (color.styleId) {
        if (channel === "fills") await shape.setFillStyleIdAsync(color.styleId);
        else await shape.setStrokeStyleIdAsync(color.styleId);
      } else {
        shape[channel] = [color.paint];
      }
    }
  }
}

async function swapIcons(
  sourceCollectionId: string,
  mapping: Record<string, string>,
  scan: CollectionScan,
  options: Pick<UsageScanOptions, "scope" | "onlyInsideComponents">,
) {
  // Resolve each mapped target once, and only to icons from the scanned
  // collections — the mapping comes from the UI.
  const targets = new Map<string, ComponentNode>();
  const sourceNodes = new Map<string, ComponentNode>();
  for (const source of scan.componentByCollection.get(sourceCollectionId) ||
    []) {
    const targetId = mapping[source.id];
    if (typeof targetId !== "string" || !scan.componentById.has(targetId)) {
      continue;
    }
    const targetNode = await figma.getNodeByIdAsync(targetId);
    const sourceNode = await figma.getNodeByIdAsync(source.id);
    if (targetNode?.type === "COMPONENT" && sourceNode?.type === "COMPONENT") {
      targets.set(source.id, targetNode);
      sourceNodes.set(source.id, sourceNode);
    }
  }

  const sources = [...targets.keys()].map((id) => scan.componentById.get(id)!);
  const usage = await scanUsage(scan, {
    ...options,
    components: sources,
    onProgress: (done, total) =>
      postProgress(`Finding icons… ${done} of ${total}`),
  });

  // Outer instances first: swapping an icon inside a main component also swaps
  // it in every instance of that component, and those nested copies are then
  // skipped below instead of getting an override. Grouped by page after that,
  // so each page is loaded once.
  const uses = usage.uses
    .filter((use) => targets.has(use.component.id))
    .sort(
      (a, b) =>
        nestingDepth(a.instance) - nestingDepth(b.instance) ||
        a.pageId.localeCompare(b.pageId),
    );

  // Each target's own color, read once: the layers that carry it are the ones
  // a recolored icon's color goes on.
  const targetColors = new Map<string, IconColor | null>();
  for (const target of targets.values()) {
    targetColors.set(target.id, iconColor(target));
  }

  // Writes need the page loaded. Load it, never switch to it: a page made
  // current stays resident and drags the viewport along.
  const loadedPages = new Set<string>([figma.currentPage.id]);
  const loadPage = async (pageId: string) => {
    if (loadedPages.has(pageId)) return;
    const page = await figma.getNodeByIdAsync(pageId);
    if (page && page.type === "PAGE") await page.loadAsync();
    loadedPages.add(pageId);
  };

  // Every recolored icon's color, read before anything is swapped: an icon
  // inside a main component takes its copies with it when it is swapped, and
  // a copy colored by the instance it sits in would lose that color unread.
  const colors = new Map<string, IconColor>();
  for (let i = 0; i < uses.length; i++) {
    const { instance, component, pageId } = uses[i];
    await loadPage(pageId);
    if ((i + 1) % PROGRESS_STEP === 0) {
      postProgress(`Reading icon colors… ${i + 1} of ${uses.length}`);
    }
    const main = sourceNodes.get(component.id);
    if (!main || instance.removed) continue;
    const color = recolored(instance, main);
    if (color) colors.set(instance.id, color);
  }

  const swappedPages = new Set<string>();
  let swapped = 0;
  let failed = 0;

  for (let i = 0; i < uses.length; i++) {
    const { instance, component, pageId } = uses[i];
    await loadPage(pageId);
    if ((i + 1) % PROGRESS_STEP === 0) {
      postProgress(`Swapping icons… ${i + 1} of ${uses.length}`);
    }
    if (instance.removed) continue;
    const mainComponent = await instance.getMainComponentAsync();
    const target = targets.get(component.id)!;
    const color = colors.get(instance.id);
    if (mainComponent?.id === component.id) {
      try {
        instance.swapComponent(target);
      } catch {
        failed += 1;
        continue;
      }
      swapped += 1;
      swappedPages.add(pageId);
    } else if (mainComponent?.id !== target.id || !color) {
      // Already swapped with the main component it sits in, and nothing of
      // its own to put back — or no longer the icon it was.
      continue;
    }
    const base = targetColors.get(target.id);
    if (color && base) {
      try {
        await applyIconColor(instance, color, base);
      } catch {
        // The swap stands; the icon shows the new icon's own color.
      }
    }
  }

  return { swapped, failed, pages: swappedPages.size };
}

function postError(message: string) {
  figma.ui.postMessage({ type: "error", message });
  figma.notify(message, { error: true });
}

function postProgress(message: string, requestId?: number) {
  figma.ui.postMessage({ type: "progress", message, requestId });
}

// Set while `reveal` selects a row's icons, so that selection is not taken as
// a new one to list: in selection scope it would narrow the list to that row.
let revealing = false;

function postWhereabouts() {
  figma.ui.postMessage({
    type: "whereabouts",
    selectionCount: figma.currentPage.selection.length,
    pageId: figma.currentPage.id,
  });
}

figma.on("selectionchange", () => {
  if (revealing) {
    revealing = false;
    return;
  }
  postWhereabouts();
});
figma.on("currentpagechange", postWhereabouts);

// Select a row's icons and put them on screen. A selection cannot span pages,
// so the current page's are shown when it has any, otherwise the first page
// that does — the one place the plugin switches pages, because it was asked to.
async function reveal(
  componentId: string,
  scan: CollectionScan,
  options: Pick<UsageScanOptions, "scope" | "onlyInsideComponents">,
) {
  const component = scan.componentById.get(componentId);
  if (!component) return;
  const usage = await scanUsage(scan, { ...options, components: [component] });
  const uses = usage.uses.filter((use) => use.component.id === componentId);
  if (uses.length === 0) {
    figma.notify("Those icons aren't there any more. Refresh the list.");
    return;
  }
  const pageId = uses.some((use) => use.pageId === figma.currentPage.id)
    ? figma.currentPage.id
    : uses[0].pageId;
  const page = await figma.getNodeByIdAsync(pageId);
  if (page && page.type === "PAGE" && page.id !== figma.currentPage.id) {
    await figma.setCurrentPageAsync(page);
  }
  const nodes = uses
    .filter((use) => use.pageId === pageId && !use.instance.removed)
    .map((use) => use.instance);
  const before = new Set(figma.currentPage.selection.map((node) => node.id));
  revealing =
    before.size !== nodes.length || nodes.some((node) => !before.has(node.id));
  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);
}

// The newest get-matches request; a whole-file lookup still running for an
// older one stops early rather than finish work nobody will see.
let latestMatchRequest = 0;

figma.ui.onmessage = async (msg) => {
  if (msg.type === "ui-ready") {
    const scan = await scanCollections();
    if (scan.collections.length === 0) {
      postError(`No icon collections found on page: ${ICONS_PAGE_NAME}`);
      return;
    }
    const scope = parseScope(
      await figma.clientStorage.getAsync(SCOPE_STORAGE_KEY),
    );
    // Guess the source from what is used nearby. For the whole file that
    // would mean a lookup per icon in every collection, so the page stands in.
    const usage = await scanUsage(scan, {
      scope: scope === "file" ? "page" : scope,
      onlyInsideComponents: true,
    });
    const defaultSourceId = pickDefaultSource(usage.usageByCollection);
    figma.ui.postMessage({
      type: "collections",
      collections: scan.collections.map((collection) => ({
        id: collection.id,
        name: collection.name,
        componentCount: collection.componentIds.length,
      })),
      defaultSourceId,
      scope,
      selectionCount: figma.currentPage.selection.length,
      pageId: figma.currentPage.id,
    });
  }

  if (msg.type === "get-matches") {
    const {
      sourceCollectionId,
      targetCollectionId,
      onlyInsideComponents,
      requestId,
    } = msg;
    if (!sourceCollectionId || !targetCollectionId) {
      postError("Choose both source and target collections.");
      return;
    }
    const scope = parseScope(msg.scope);
    latestMatchRequest = Number(requestId) || 0;
    await figma.clientStorage.setAsync(SCOPE_STORAGE_KEY, scope);
    const scan = await scanCollections();
    const usage = await scanUsage(scan, {
      scope,
      onlyInsideComponents: Boolean(onlyInsideComponents),
      components: scan.componentByCollection.get(sourceCollectionId) || [],
      onProgress: (done, total) =>
        postProgress(`Finding icons… ${done} of ${total}`, requestId),
      isStale: () => latestMatchRequest !== (Number(requestId) || 0),
    });
    const { matches, targetOptions } = buildMatches(
      sourceCollectionId,
      targetCollectionId,
      scan,
      usage,
    );
    figma.ui.postMessage({
      type: "matches",
      matches,
      targetOptions,
      requestId,
    });
  }

  if (msg.type === "reveal") {
    if (typeof msg.componentId !== "string") return;
    const scan = await scanCollections();
    await reveal(msg.componentId, scan, {
      scope: parseScope(msg.scope),
      onlyInsideComponents: Boolean(msg.onlyInsideComponents),
    });
  }

  if (msg.type === "swap-icons") {
    const { sourceCollectionId, mapping, onlyInsideComponents } = msg;
    // S1: validate shape of incoming payload before acting on it
    if (
      !sourceCollectionId ||
      typeof mapping !== "object" ||
      mapping === null ||
      Array.isArray(mapping)
    ) {
      postError("Missing source collection or mapping.");
      return;
    }
    const scope = parseScope(msg.scope);
    const scan = await scanCollections();
    const result = await swapIcons(sourceCollectionId, mapping, scan, {
      scope,
      onlyInsideComponents: Boolean(onlyInsideComponents),
    });

    const failedNote = result.failed
      ? ` ${result.failed} couldn't be swapped.`
      : "";
    if (result.swapped === 0) {
      figma.notify(
        `No icons swapped — check that source icons appear ${SCOPE_PHRASE[scope]}.${failedNote}`,
        { error: true },
      );
    } else {
      const icons = `${result.swapped} icon${result.swapped === 1 ? "" : "s"}`;
      const pages = result.pages > 1 ? ` on ${result.pages} pages` : "";
      figma.notify(
        `Swapped ${icons}${pages}.${failedNote} Press Ctrl/Cmd+Z to undo.`,
      );
    }
    figma.ui.postMessage({
      type: "swap-complete",
      swappedCount: result.swapped,
    });
  }
};
