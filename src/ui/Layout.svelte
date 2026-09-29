<!--
  The panel, as the Vitrine audit plugin draws it: a bar that stays put, a
  scrolling body that may open with a bar of its own for whatever narrows the
  list, a status strip, and a footer — what it lists on the left, what it does
  on the right.
-->
<script>
  // Whether the `status` strip shows. A prop rather than the slot's presence:
  // a slot filled with nothing still counts as filled, and would draw an empty
  // strip with its border.
  export let status = false;
  // Same, for the `toolbar` bar the body opens with.
  export let toolbar = false;
</script>

{#if $$slots.top}<header><slot name="top" /></header>{/if}
<main>
  <!-- Full width and the top bar's height, so it reads as chrome rather than as
       the first row of the list it narrows. -->
  {#if toolbar}<div class="toolbar"><slot name="toolbar" /></div>{/if}
  <slot />
</main>
<!-- Between the scrolling body and the footer, so it stays put while the list moves. -->
{#if status}<div class="status"><slot name="status" /></div>{/if}
<footer>
  <slot name="lead" />
  <div class="actions"><slot name="actions" /></div>
</footer>

<style>
  header {
    display: flex;
    align-items: center;
    gap: var(--size-xxsmall);
    flex: 0 0 var(--size-large);
    min-width: 0;
    padding: 0 var(--size-xxsmall);
    border-bottom: 1px solid var(--figma-color-border);
    user-select: none;
  }
  /* Out to the body's edges and up against the bar above it: the margin undoes
     main's own padding. */
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--size-xxsmall);
    flex: 0 0 auto;
    height: var(--size-large);
    min-width: 0;
    margin: calc(-1 * var(--size-xsmall)) calc(-1 * var(--size-xsmall)) 0;
    padding: 0 var(--size-xxsmall);
    border-bottom: 1px solid var(--figma-color-border);
  }
  /* Positioned, so the kit Checkbox's absolutely placed input belongs to this
     scroll area rather than the document. */
  main {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--size-xsmall);
    display: flex;
    flex-direction: column;
    gap: var(--size-small);
  }
  .status {
    flex: 0 0 auto;
    padding: var(--size-xxsmall) var(--size-xsmall);
    border-top: 1px solid var(--figma-color-border);
  }
  footer {
    display: flex;
    align-items: center;
    gap: var(--size-xxsmall);
    flex: 0 0 var(--size-large);
    min-width: 0;
    padding: var(--size-xxsmall);
    border-top: 1px solid var(--figma-color-border);
  }
  /* Right whether or not anything was put on the left. */
  .actions {
    display: flex;
    align-items: center;
    gap: var(--size-xxsmall);
    margin-left: auto;
    flex: 0 0 auto;
  }
  main :global(section) {
    display: flex;
    flex-direction: column;
    gap: var(--size-xxsmall);
  }
</style>
