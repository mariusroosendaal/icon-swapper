# Icon Swapper

Icon Swapper moves a file from one icon collection to another. It matches the icons by name, and you check every match before anything changes.

## Swap icons

![](icon-swapper-matches.svg)

Put each collection in its own frame of icon components, on a page whose name contains `icons`. Both collections must be in this file.

1. **The collections** — the one you're replacing on the left, the one you're moving to on the right.
2. **The toolbar** — **High**, **Medium**, and **Low** show or hide matches by confidence. The dropdown sets where to swap: the whole file, this page, or the selection.
3. **A match** — click the left icon to select its layers. To choose another icon, open the dropdown; your picks show **Picked**.
4. **Only in components** — swaps only icons inside your components, not icons placed directly in frames.

High-confidence matches start checked; check the others you agree with, or check **All icons**. Hidden rows aren't swapped. Click **Swap icons** to replace every checked icon. Press Ctrl/Cmd+Z to undo.

Swapped icons leave the list, so you can swap the matches you trust first, then pick icons for the rest.

If a match looks wrong, check the names. Matching ignores sizes such as `24` or `small`, and words most icons share, such as `icon`. It knows a few synonyms: `close` finds `x`. For any other icon, pick one from the dropdown.
