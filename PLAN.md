# Icon Swapper — Implementation Plan

## Goal
Build a Figma plugin that:
- Finds all icon instances used across the file.
- Compares those instances to a target icon collection.
- Presents credible matches in a UI with editable mappings.
- Swaps all instances from the current collection to the mapped target collection.
- Uses `figma-ui3-kit-svelte` and native Figma CSS variables.

## Assumptions (confirmed)
- The icon collections page is named `└ icons` and collections live in top-level frames.
- Icons in a collection are components (not component sets).
- Used icons in designs are instances of those components.
- A single “source” collection is currently used in the file, but other collections exist.
- The user can stay on the current working page; the plugin accesses the `└ icons` page via API.

## High-level Architecture
- `code.ts` (plugin sandbox):
  - Scan file for icon instances.
  - Locate icon collections (frames on a designated page).
  - Normalize names for matching and scoring.
  - Produce a mapping table (source component → target component) with confidence.
  - Apply swaps by replacing instances.
- `PluginUI.svelte` (UI):
  - Wizard-style flow: Select source collection → Select target collection → Review matches → Execute swap.
  - Table for matches with dropdowns to override mapping.
  - CTA that triggers bulk swap.

## Data Model
- `IconCollection`:
  - `id`, `name`, `frameId`, `components[]` (component or component set IDs).
- `IconComponent`:
  - `id`, `name`, `normalizedName`, `keywords[]`, `variants?`.
- `IconInstanceUsage`:
  - `instanceId`, `componentId`, `componentName`, `pageId`, `nodePath` (optional).
- `MatchCandidate`:
  - `sourceComponentId`, `targetComponentId`, `score`, `reason`.
- `UserMapping`:
  - `sourceComponentId`, `targetComponentId` (overrides auto-match).

## Matching Strategy
1. Normalize names:
   - Lowercase, trim, replace `_`/`--`/`-`/`/` with a single `-`.
   - Remove common prefixes (e.g., `icon-`, collection name) and suffixes (e.g., size tokens).
2. Tokenize and compare:
   - Exact normalized match first.
   - Token overlap score (Jaccard or simple intersection ratio).
   - Synonym mapping (hardcoded list for now: `view`↔`eye`, `close`↔`x`, etc.).
3. Confidence tiers:
   - High: exact match or strong token overlap.
   - Medium: synonym-based + partial overlap.
   - Low: fallback list, shown but not auto-selected.

## Core Flow
1. Discover collections:
   - Scan a designated “Icon Collections” page and identify top-level frames.
2. Discover usage:
   - Scan the current page only and collect all instances whose main component belongs to any collection.
3. Determine active source collection:
   - Count usage per collection; highest count becomes default “source”.
4. Build match list:
   - For each source component used, find best target matches and preselect highest score.
5. UI review:
   - Show table with source icon → proposed target icon, dropdown to override.
6. Apply swap:
   - For each instance, swap to mapped target component using `instance.swapComponent()`.

## UI Layout (Svelte)
- Header: title + short guidance.
- Collection selectors: two dropdowns (source, target).
- Results table:
  - Rows: source icon name, confidence, target dropdown.
  - Inline search / filter by “low confidence”.
- CTA:
  - “Swap icons” button and status text.
  - Target dropdown includes all target component names to override any mismatch.

## Implementation Steps
1. Replace boilerplate in `code.ts` with scanning + messaging pipeline.
2. Build collection discovery helpers (page/frame lookup, component harvesting).
3. Build usage scanner for current page only (instances + main component lookup + collection association).
4. Implement name normalization + scoring.
5. Build UI in `PluginUI.svelte` with selection + mapping table + CTA.
6. Wire UI ↔ plugin messaging (get collections, get matches, apply mappings, progress updates).
7. Add small utility module(s) if needed (`src/lib/matching.ts`).
8. Polish: empty states, errors, and notifications.

## Open Questions
- Should we add an optional “scope” toggle later (current page vs entire file)?

## Risks / Edge Cases
- Instances that are detached or overridden.
- Icons not stored under the collections page (custom or ad-hoc components).
- Component sets with variants where names do not include the variant key.
- Naming mismatches that produce poor auto-matches.
