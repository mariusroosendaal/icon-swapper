# Changelog

## [Unreleased]

### Added

- Scope picker next to the matches list: whole file, this page, or selection. The last choice is remembered
- Whole-file scope finds icons on every page without loading them, then loads one page at a time to swap, with progress shown for long runs
- Each match shows how many times the icon is used, and on how many pages
- Matches refresh when the selection changes (selection scope) or the current page changes (page scope)
- Empty results say where the plugin looked, with a "Search whole file" action
- Source → target layout from the Vitrine audit plugin: collections in the top bar, a toolbar with confidence toggles, scope and search, a tick for every row shown, and one row per icon with a tick, the source (click to select its instances) and the target
- Target dropdowns show the match confidence as a badge; their menus list the top five suggestions, each with its badge, then every icon in the target collection, searchable
- Ticks choose which rows swap; only high-confidence matches start ticked. The Swap button counts the instances it will change
- A recolored icon keeps its color when swapped between a set drawn with fills and one drawn with strokes, or between sets whose layers are named differently. The color goes on whichever of fills or strokes the new icon draws with — as a color, a bound variable or a color style — including on icons colored from the instance they sit in. Layers in another color, such as a duotone icon's second tone, keep theirs
- Collection dropdowns show each collection's icon count as an outlined badge
- The default collections prefer frames named like an icon set ("icons", "Icons (feather)") over the next frame on the page, so a logo or social set is no longer picked as the target

### Changed

- The window is 400×560 so a source → target row fits
- Picking a target ticks its row, replacing the "None" option; untick a row to skip it
- Errors show in a banner instead of only as a notification
- Instances inside the icon collection frames are never swapped
- Icons inside main components are swapped before their nested copies, so instances follow the main component instead of getting an override
- The match list refreshes after a swap
- The success notification names the number of pages and reports icons that couldn't be swapped

## [0.5.1] - 2026-05-08

### Added

- "None" option in every target dropdown to explicitly exclude an icon from the swap
- Match count shown in section header once matches are loaded

### Fixed

- Per-row target dropdowns now each own their menu item objects — the Dropdown component's `item.selected` mutation no longer bleeds across rows, so the correct item is highlighted when any dropdown opens
- Keyed `{#each}` loop for match rows prevents Svelte from reusing Dropdown DOM nodes between rows
- Swap button is disabled and shows "Working…" during an in-progress swap; resets correctly on completion
- "Swap icons" now shows an error if no target mappings are selected rather than silently sending an empty mapping
- Zero-swap result reports an error notification explaining no icons were found on the page
- Success notification now includes "Press Cmd+Z to undo" after a bulk swap
- `mapping` payload validated as a non-null object before acting on the document
- Target node IDs validated as non-empty strings before calling `getNodeByIdAsync`
- Dead size-string filter removed from `normalizeName` — pure-digit tokens are already stripped by the preceding filter
- Collection dropdowns are now fixed-width with ellipsis overflow, matching the per-row icon selectors
- `aria-live="polite"` status region added so screen readers announce swap progress and completion
- JSDoc types added to all Svelte state variables and function parameters

### Changed

- Disabled Swap icons button now shows a tooltip when no matches are loaded
- Match list announces updates when matches are refreshed
- Error message correctly marked as an alert for assistive technology
- Source, target, and per-row match dropdowns have accessible names

## [0.5.0] - 2026-04-17

### Added

- Swap icon instances between collections with token-based name matching (`arrow-left-circle` style paths)
- Synonym recognition for common icon naming (e.g. view/eye, close/x, check/checkmark)
- Size-agnostic matching (ignores 12, 16, 20, 24, etc. in names)
- Confidence scoring for suggested matches (high / medium / low)
- Option to limit swaps to icons inside components only

### Changed

- UI — Updated to Figma UI3
