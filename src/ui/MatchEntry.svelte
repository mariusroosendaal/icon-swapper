<!--
  One row of the match list, laid out like the Vitrine audit plugin's Fix rows:
  the tick, the source icon (which selects its instances), and the target — a
  dropdown of the suggestions, each with its confidence badge, then every other
  icon in the target collection.
-->
<script>
  import { createEventDispatcher } from "svelte";
  import { Checkbox, Dropdown, Icon } from "figma-ui3-kit-svelte";
  import { IconGoSmall } from "figma-ui3-kit-svelte/icons";
  import { MappingChip } from "figma-plugin-utilities";
  import {
    SEARCH_FROM,
    describeUses,
    isPicked,
    targetBadge,
  } from "./matches.js";

  /** @typedef {import("./matches.js").Row} Row */
  /** @typedef {import("./matches.js").TargetEntry} TargetEntry */

  /** @type {Row} */
  export let row;
  export let ticked = false;

  /**
   * @type {import("svelte").EventDispatcher<{
   *   tick: { id: string; on: boolean };
   *   choose: { id: string; entry: TargetEntry };
   *   reveal: { id: string };
   * }>}
   */
  const dispatch = createEventDispatcher();
  const id = row.sourceComponentId;

  /** @param {Event} event */
  const onTick = (event) =>
    dispatch("tick", {
      id,
      on: /** @type {HTMLInputElement} */ (event.currentTarget).checked,
    });
  /** @param {CustomEvent<TargetEntry>} event */
  const onChoose = (event) => dispatch("choose", { id, entry: event.detail });

  $: usesText = describeUses(row);
</script>

<!-- Source on the left, target on the right, in two equal columns, so a list
     of swaps lines up down the panel. -->
<div class="swap">
  <div class="pick">
    <!-- Every row has one of these, so the name says which row it is. -->
    <Checkbox
      ariaLabel="Swap {row.sourceName} → {row.target?.label ??
        'nothing chosen'} ({usesText})"
      checked={ticked && !!row.target}
      disabled={!row.target}
      on:change={onTick}
    />
  </div>
  <!-- The source is where the icons are, so it is the side that takes you
       there. -->
  <MappingChip
    label={row.sourceName}
    count={row.uses}
    tone="secondary"
    title="Select these icons — {usesText}"
    on:click={() => dispatch("reveal", { id })}
  />
  <span class="link">
    <Icon iconName={IconGoSmall} color="--figma-color-icon-tertiary" />
  </span>
  <!-- Named per row: every row's button would otherwise read alike. -->
  <Dropdown
    ariaLabel="Target for {row.sourceName}: {row.target?.label ??
      'none chosen'}"
    class="target-select{isPicked(row) ? ' chosen' : ''}"
    menuItems={row.entries}
    value={row.target}
    placeholder="Choose an icon…"
    badge={targetBadge(row)}
    showGroupLabels
    searchable={row.entries.length >= SEARCH_FROM}
    searchPlaceholder="Search icons"
    on:change={onChoose}
  />
</div>

<style>
  /* Tick, source, arrow, target: the two sides get equal columns whatever they
     hold. */
  .swap {
    display: grid;
    grid-template-columns:
      var(--size-small) minmax(0, 1fr) var(--size-small)
      minmax(0, 1fr);
    align-items: center;
    gap: var(--size-xxxsmall);
  }
  .pick,
  .link {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* The kit's Dropdown takes a class but draws its own button; a pick of the
     person's own is marked on that button's border. */
  .swap :global(.target-select) {
    min-width: 0;
  }
  .swap :global(.target-select.chosen > button) {
    border-color: var(--figma-color-border-selected);
  }
</style>
