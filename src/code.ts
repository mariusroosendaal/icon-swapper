figma.showUI(__html__, {
  width: 320,
  height: 420,
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
};

type CollectionScan = {
  collections: IconCollection[];
  components: IconComponent[];
  componentById: Map<string, IconComponent>;
  componentByCollection: Map<string, IconComponent[]>;
};

type UsageScan = {
  instances: InstanceNode[];
  usageByCollection: Map<string, number>;
  usedComponentIds: Set<string>;
};

type UsageScanOptions = {
  onlyInsideComponents: boolean;
};

function isInsideComponentScope(node: SceneNode) {
  let current: BaseNode | null = node.parent;
  while (current) {
    if (current.type === "COMPONENT" || current.type === "COMPONENT_SET") {
      return true;
    }
    current = current.parent;
  }
  return false;
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

  const tokens = normalized
    .split("-")
    .filter((token) => token.length > 0)
    .filter((token) => !/^\d+$/.test(token))
    .filter(
      (token) => !["12", "16", "20", "24", "28", "32", "48"].includes(token),
    );

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

async function scanUsage(
  componentById: Map<string, IconComponent>,
  options: UsageScanOptions,
): Promise<UsageScan> {
  await figma.currentPage.loadAsync();
  const instances = figma.currentPage.findAll(
    (node) => node.type === "INSTANCE",
  ) as InstanceNode[];
  const usageByCollection = new Map<string, number>();
  const usedComponentIds = new Set<string>();

  for (const instance of instances) {
    if (options.onlyInsideComponents && !isInsideComponentScope(instance)) {
      continue;
    }
    const mainComponent = await instance.getMainComponentAsync();
    if (!mainComponent) continue;
    const component = componentById.get(mainComponent.id);
    if (!component) continue;
    usedComponentIds.add(component.id);
    usageByCollection.set(
      component.collectionId,
      (usageByCollection.get(component.collectionId) || 0) + 1,
    );
  }

  return { instances, usageByCollection, usedComponentIds };
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
    usage.usedComponentIds.has(component.id),
  );

  const targetOptions = targetComponents.map((component) => ({
    id: component.id,
    name: component.name,
  }));

  const matches: MatchRow[] = sourceComponentsUsed.map((source) => {
    const sourceNormalized = normalizeName(source.name);
    let bestTargetId: string | null = null;
    let bestScore = 0;

    for (const target of targetComponents) {
      const targetNormalized = normalizeName(target.name);
      const score = scoreNames(sourceNormalized, targetNormalized);
      if (score > bestScore) {
        bestScore = score;
        bestTargetId = target.id;
      }
    }

    return {
      sourceComponentId: source.id,
      sourceName: source.name,
      suggestedTargetId: bestTargetId,
      score: bestScore,
      confidence: confidenceFromScore(bestScore),
    };
  });

  return { matches, targetOptions };
}

async function swapIcons(
  sourceCollectionId: string,
  mapping: Record<string, string>,
  scan: CollectionScan,
  onlyInsideComponents: boolean,
) {
  const { componentById } = scan;
  const usage = await scanUsage(componentById, { onlyInsideComponents });
  let swapped = 0;

  for (const instance of usage.instances) {
    const mainComponent = await instance.getMainComponentAsync();
    if (!mainComponent) continue;
    const component = componentById.get(mainComponent.id);
    if (!component || component.collectionId !== sourceCollectionId) continue;

    const targetId = mapping[component.id];
    if (!targetId) continue;
    const targetNode = await figma.getNodeByIdAsync(targetId);
    if (targetNode && targetNode.type === "COMPONENT") {
      instance.swapComponent(targetNode);
      swapped += 1;
    }
  }

  return swapped;
}

function postError(message: string) {
  figma.ui.postMessage({ type: "error", message });
  figma.notify(message, { error: true });
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "ui-ready") {
    const scan = await scanCollections();
    if (scan.collections.length === 0) {
      postError(`No icon collections found on page: ${ICONS_PAGE_NAME}`);
      return;
    }
    const usage = await scanUsage(scan.componentById, {
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
    });
  }

  if (msg.type === "get-matches") {
    const { sourceCollectionId, targetCollectionId, onlyInsideComponents } =
      msg;
    const scan = await scanCollections();
    if (!sourceCollectionId || !targetCollectionId) {
      postError("Choose both source and target collections.");
      return;
    }
    const usage = await scanUsage(scan.componentById, {
      onlyInsideComponents: Boolean(onlyInsideComponents),
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
    });
  }

  if (msg.type === "swap-icons") {
    const { sourceCollectionId, mapping, onlyInsideComponents } = msg;
    const scan = await scanCollections();
    if (!sourceCollectionId || !mapping) {
      postError("Missing source collection or mapping.");
      return;
    }
    const swappedCount = await swapIcons(
      sourceCollectionId,
      mapping,
      scan,
      Boolean(onlyInsideComponents),
    );
    figma.notify(`Swapped ${swappedCount} icons.`);
    figma.ui.postMessage({ type: "swap-complete", swappedCount });
  }
};
