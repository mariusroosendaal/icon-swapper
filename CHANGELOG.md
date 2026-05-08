# Changelog

## [0.5.2] - 2026-05-08

### Fixed

- Cache icon collection scan across plugin messages — eliminates redundant page traversals (CQ1/P2)
- Avoid double `getMainComponentAsync()` calls during swap by reusing scan results (P1)
- Remove dead size-string filter in `normalizeName` — pure-digit tokens already removed earlier (CQ2)
- Validate `mapping` payload shape before swap to prevent malformed messages acting on the document (S1)
- Validate target node IDs are non-empty strings before calling `getNodeByIdAsync` (S2)
- Prevent swapping when source and target collections are the same (UX1)
- Set loading state during swap — button disabled and "Working…" label while in progress (CQ3/UX2)
- Guard against empty mapping before dispatching swap with actionable error message (CQ4)
- Add JSDoc types to all Svelte state variables and function parameters (CQ5)
- Distinguish zero-swap result from success with a specific error notification (UX3)
- Include "Press Cmd+Z to undo" in the success notification after a bulk swap (UX5)
- Add `aria-live="polite"` status region so screen readers announce swap start and completion

## [0.5.1] - 2026-05-08

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
