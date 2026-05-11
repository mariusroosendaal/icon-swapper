# Changelog

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
