<!--
  What the match list shows, as the Vitrine audit plugin's Fix toolbar does:
  the confidence toggles, the scope, and the text every row is matched against.
  Opened, the search field takes the whole bar, with the button that closes it
  where search was.
-->
<script>
  import {
    Dropdown,
    IconButton,
    Input,
    ToggleButton,
  } from "figma-ui3-kit-svelte";
  import { IconCloseSmall, IconSearch } from "figma-ui3-kit-svelte/icons";
  import { CONFIDENCE } from "./matches.js";

  /** @typedef {import("./matches.js").Confidence} Confidence */
  /** @typedef {import("./matches.js").ScopeOption} ScopeOption */

  // Which confidences are listed, and how many rows each holds.
  /** @type {Set<Confidence>} */
  export let showing;
  /** @type {Map<Confidence, number>} */
  export let counts;
  // The kit's Dropdown hands back the whole entry and writes `selected` onto
  // the ones it was given, so the list is built once by the panel and held.
  /** @type {ScopeOption[]} */
  export let scopes;
  /** @type {ScopeOption} */
  export let scopeChoice;
  export let search = "";
  // Closing clears what was typed: a collapsed field still filtering would
  // leave a short list with nothing on screen saying why.
  export let searching = false;

  const closeSearch = () => {
    search = "";
    searching = false;
  };
  /** @param {KeyboardEvent} event */
  const onSearchKey = (event) => {
    if (event.key === "Escape") closeSearch();
  };
  // Left open while it holds a filter — the list below is short because of it.
  const onSearchBlur = () => {
    if (!search.trim()) searching = false;
  };
  /** @param {Confidence} key */
  const toggleConfidence = (key) => () => {
    const next = new Set(showing);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    showing = next;
  };
  /** @param {HTMLElement} node */
  const takeFocus = (node) => {
    node.querySelector("input")?.focus();
  };
</script>

{#if searching}
  <div class="search" use:takeFocus>
    <Input
      iconName={IconSearch}
      bind:value={search}
      placeholder="Icon name"
      ariaLabel="Filter by icon name"
      on:keydown={onSearchKey}
      on:blur={onSearchBlur}
    />
  </div>
  <IconButton
    iconName={IconCloseSmall}
    ariaLabel="Close search"
    on:click={closeSearch}
  />
{:else}
  <div class="toggles" role="group" aria-label="Show rows by match confidence">
    {#each CONFIDENCE as c (c.key)}
      <ToggleButton
        pressed={showing.has(c.key)}
        label={c.label}
        badge={String(counts.get(c.key) ?? 0)}
        on:change={toggleConfidence(c.key)}
      />
    {/each}
  </div>
  <!-- With the rest of the narrowing: it changes what is listed, and so what
       Swap counts. -->
  <div class="scope">
    <Dropdown
      class="scope-select"
      menuItems={scopes}
      bind:value={scopeChoice}
      on:change
      ariaLabel="Where to swap icons"
    />
  </div>
  <IconButton
    iconName={IconSearch}
    ariaLabel="Search by icon name"
    on:click={() => (searching = true)}
  />
{/if}

<style>
  /* The toolbar is one row of fixed height. Whichever of the two is up takes
     the bar's slack, which puts the icon button at its right end either way. */
  .toggles {
    display: flex;
    flex: 1 1 auto;
    gap: var(--size-xxxsmall);
    min-width: 0;
  }
  .search {
    flex: 1 1 auto;
    min-width: 0;
  }
  .scope {
    display: flex;
    align-items: center;
    min-width: 0;
  }
  /* The kit's Dropdown draws a full-width button inside a wrapper it gives no
     width of its own, so in a flex row it has to be told one. */
  .scope :global(.scope-select) {
    flex: 0 0 6.5rem;
  }
</style>
