// What the match list is built from: the sandbox's rows, turned into entries
// the kit's Dropdown can hold, and the words and badges each row shows.

/** @typedef {"high" | "medium" | "low"} Confidence */
/** @typedef {"file" | "page" | "selection"} Scope */
/** @typedef {{ label: string; value: Scope }} ScopeOption */
/**
 * @typedef {{
 *   label: string;
 *   value: string;
 *   group: string;
 *   section: string;
 *   confidence: Confidence | null;
 *   badge?: { text: string; variant: string };
 *   selected?: boolean;
 * }} TargetEntry
 */
/**
 * @typedef {{
 *   sourceComponentId: string;
 *   sourceName: string;
 *   suggestedTargetId: string | null;
 *   candidates: { id: string; score: number; confidence: Confidence }[];
 *   score: number;
 *   confidence: Confidence;
 *   uses: number;
 *   pages: number;
 * }} SandboxRow
 */
/**
 * @typedef {SandboxRow & {
 *   entries: TargetEntry[];
 *   target: TargetEntry | null;
 * }} Row
 */

/** @type {{ key: Confidence; label: string }[]} */
export const CONFIDENCE = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

/** @type {Record<Confidence, string>} */
const BADGE_VARIANT = { high: "success", medium: "warning", low: "danger" };
/** @type {Record<Confidence, string>} */
const BADGE_TEXT = { high: "High", medium: "Medium", low: "Low" };

/** @param {Confidence} confidence */
export const confidenceBadge = (confidence) => ({
  text: BADGE_TEXT[confidence],
  variant: BADGE_VARIANT[confidence],
});

// Long enough to be worth narrowing by typing.
export const SEARCH_FROM = 9;

/**
 * A row's menu: the suggestions first, each with its confidence badge, then
 * every other icon in the target collection. Each row gets its own entries —
 * the kit's Dropdown writes `selected` onto the ones it is given.
 *
 * @param {SandboxRow} row
 * @param {{ id: string; name: string }[]} targets
 * @returns {TargetEntry[]}
 */
export function menuEntries(row, targets) {
  const names = new Map(targets.map((t) => [t.id, t.name]));
  const suggested = new Set(row.candidates.map((c) => c.id));
  /** @type {TargetEntry[]} */
  const entries = row.candidates.map((c) => ({
    label: names.get(c.id) ?? c.id,
    value: c.id,
    group: "Suggested",
    section: "Suggested",
    confidence: c.confidence,
    badge: confidenceBadge(c.confidence),
  }));
  for (const t of targets) {
    if (suggested.has(t.id)) continue;
    entries.push({
      label: t.name,
      value: t.id,
      group: "All icons",
      section: "All icons",
      confidence: null,
    });
  }
  return entries;
}

/**
 * @param {SandboxRow} row
 * @param {{ id: string; name: string }[]} targets
 * @returns {Row}
 */
export function toRow(row, targets) {
  const entries = menuEntries(row, targets);
  const target = entries.find((e) => e.value === row.suggestedTargetId) ?? null;
  return { ...row, entries, target };
}

// Whether the row's target is someone's own pick rather than the suggestion.
/** @param {Row} row */
export const isPicked = (row) =>
  row.target !== null && row.target.value !== row.suggestedTargetId;

// The badge on the target: the chosen icon's confidence, or "Picked" for an
// icon from outside the suggestions. Not drawn on a dropdown still showing its
// placeholder, which already says a choice is wanted.
/** @param {Row} row */
export function targetBadge(row) {
  if (!row.target) return "";
  if (row.target.confidence) return confidenceBadge(row.target.confidence);
  return { text: "Picked", variant: "default" };
}

/** @param {Row} row */
export function describeUses(row) {
  const uses = `${row.uses} use${row.uses === 1 ? "" : "s"}`;
  return row.pages > 1 ? `${uses} on ${row.pages} pages` : uses;
}

/**
 * @param {Row} row
 * @param {string} search
 */
export function matchesSearch(row, search) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    row.sourceName.toLowerCase().includes(q) ||
    (row.target?.label.toLowerCase().includes(q) ?? false)
  );
}
