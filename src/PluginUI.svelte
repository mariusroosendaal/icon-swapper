<script>
  import { onMount } from "svelte";
  import {
    Badge,
    Banner,
    Button,
    Checkbox,
    Dropdown,
    Icon,
    Switch,
    Text,
    Tooltip,
  } from "figma-ui3-kit-svelte";
  import { IconGoSmall } from "figma-ui3-kit-svelte/icons";
  import {
    EmptyState,
    LoadingState,
    sendToPlugin,
    createMessageHandler,
  } from "figma-plugin-utilities";
  import Layout from "./ui/Layout.svelte";
  import MatchEntry from "./ui/MatchEntry.svelte";
  import MatchToolbar from "./ui/MatchToolbar.svelte";
  import { CONFIDENCE, matchesSearch, toRow } from "./ui/matches.js";

  /** @typedef {import("./ui/matches.js").Confidence} Confidence */
  /** @typedef {import("./ui/matches.js").Scope} Scope */
  /** @typedef {import("./ui/matches.js").ScopeOption} ScopeOption */
  /** @typedef {import("./ui/matches.js").Row} Row */
  /** @typedef {import("./ui/matches.js").SandboxRow} SandboxRow */
  /** @typedef {import("./ui/matches.js").TargetEntry} TargetEntry */
  /**
   * @typedef {{
   *   label: string;
   *   value: string;
   *   badge: { text: string; variant: string };
   *   selected?: boolean;
   * }} CollectionOption
   */

  // The kit's Dropdown writes `selected` onto the entries it is given, so each
  // list is built once and held rather than derived — and the source and target
  // dropdowns each get their own.
  /** @type {ScopeOption[]} */
  const SCOPES = [
    { label: "Whole file", value: "file" },
    { label: "This page", value: "page" },
    { label: "Selection", value: "selection" },
  ];
  /** @type {Record<Scope, string>} */
  const SCOPE_PHRASE = {
    file: "in this file",
    page: "on this page",
    selection: "in the selection",
  };

  /** @type {{ id: string; name: string; componentCount: number }[]} */
  let collections = [];
  /** @type {CollectionOption[]} */
  let sourceOptions = [];
  /** @type {CollectionOption[]} */
  let targetOptions = [];
  /** @type {CollectionOption | null} */
  let selectedSource = null;
  /** @type {CollectionOption | null} */
  let selectedTarget = null;

  /** @type {Row[]} */
  let rows = [];
  // Ticks and picks by source icon, kept across refreshes of the same pair of
  // collections so a selection or page change does not undo someone's work.
  /** @type {Set<string>} */
  let ticked = new Set();
  /** @type {Map<string, string>} */
  let picks = new Map();
  /** @type {Set<string>} */
  let seen = new Set();

  /** @type {Set<Confidence>} */
  let showing = new Set(CONFIDENCE.map((c) => c.key));
  let search = "";
  let searching = false;

  let error = "";
  let statusMessage = "";
  // Loading from the start: until the collections arrive, an empty list would
  // read as "nothing found".
  let isLoading = true;
  let isSwapping = false;
  let progressMessage = "";
  let onlyInsideComponents = true;
  /** @type {ScopeOption} */
  let scopeChoice = SCOPES[1];
  let selectionCount = 0;
  let pageId = "";
  // Replies to an older get-matches request are dropped.
  let latestRequest = 0;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let refreshTimer;

  $: scope = scopeChoice?.value ?? "page";
  $: sourceName =
    collections.find((c) => c.id === selectedSource?.value)?.name ?? "source";
  $: counts = countByConfidence(rows);
  $: visible = rows.filter(
    (row) => showing.has(row.confidence) && matchesSearch(row, search),
  );
  // Only what is on screen is swapped: a tick on a row hidden by a filter is
  // kept, but writing a row nobody can see is how surprises happen.
  $: tickable = visible.filter((row) => row.target);
  $: toSwap = tickable.filter((row) => ticked.has(row.sourceComponentId));
  $: swapCount = toSwap.reduce((sum, row) => sum + row.uses, 0);
  $: emptyMessage = describeEmpty(
    scope,
    selectionCount,
    sourceName,
    onlyInsideComponents,
  );

  /** @param {Row[]} rows */
  function countByConfidence(rows) {
    /** @type {Map<Confidence, number>} */
    const counts = new Map();
    for (const row of rows) {
      counts.set(row.confidence, (counts.get(row.confidence) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * @param {Scope} scope
   * @param {number} selectionCount
   * @param {string} sourceName
   * @param {boolean} onlyInsideComponents
   */
  function describeEmpty(
    scope,
    selectionCount,
    sourceName,
    onlyInsideComponents,
  ) {
    if (scope === "selection" && selectionCount === 0) {
      return "Select layers to swap the icons inside them.";
    }
    const where = `${onlyInsideComponents ? "in components " : ""}${SCOPE_PHRASE[scope]}`;
    return `No ${sourceName} icons found ${where}.`;
  }

  const searchWholeFile = {
    label: "Search whole file",
    handler: () => {
      scopeChoice = SCOPES[0];
      requestMatches();
    },
  };
  const showAll = {
    label: "Show all icons",
    handler: () => {
      showing = new Set(CONFIDENCE.map((c) => c.key));
      search = "";
      searching = false;
    },
  };

  // Selection and page changes arrive in bursts; wait for them to settle.
  function scheduleMatches() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(requestMatches, 250);
  }

  // The icons page often holds other sets beside the icons — logos, social
  // marks — so a default pick prefers a frame named like an icon set, such as
  // "icons" or "Icons (feather)", over whichever frame comes next.
  /** @param {CollectionOption} option */
  const looksLikeIcons = (option) => /\bicons?\b/i.test(option.label);

  /** @param {{ id: string; name: string; componentCount: number }[]} list */
  const collectionEntries = (list) =>
    list.map((collection) => ({
      label: collection.name,
      value: collection.id,
      badge: {
        text: String(collection.componentCount),
        variant: "default",
      },
    }));

  // A new pair of collections starts afresh: ticks and picks name icons that
  // belong to the old pair.
  function changeCollections() {
    ticked = new Set();
    picks = new Map();
    seen = new Set();
    requestMatches();
  }

  function requestMatches() {
    // A swap in progress owns the list: a reply landing mid-swap would clear
    // `isLoading` and let a second swap start alongside the first.
    if (isSwapping || !selectedSource || !selectedTarget) return;
    // UX1: block same-collection selection early with clear feedback
    if (selectedSource.value === selectedTarget.value) {
      error = "Choose a target collection other than the source.";
      rows = [];
      isLoading = false;
      return;
    }
    // Read from the choice, not `scope`: handlers run before `$:` catches up.
    const scope = scopeChoice.value;
    latestRequest += 1;
    error = "";
    progressMessage = "";
    // Nothing to look in; the empty state asks for a selection.
    if (scope === "selection" && selectionCount === 0) {
      rows = [];
      isLoading = false;
      return;
    }
    isLoading = true;
    sendToPlugin("get-matches", {
      sourceCollectionId: selectedSource.value,
      targetCollectionId: selectedTarget.value,
      onlyInsideComponents,
      scope,
      requestId: latestRequest,
    });
  }

  function swapIcons() {
    if (!selectedSource || isLoading || isSwapping || !toSwap.length) return;
    clearTimeout(refreshTimer);
    /** @type {Record<string, string>} */
    const mapping = {};
    for (const row of toSwap) {
      if (row.target) mapping[row.sourceComponentId] = row.target.value;
    }
    error = "";
    // CQ3/UX2: signal loading so the button is disabled and AT gets feedback
    isLoading = true;
    isSwapping = true;
    progressMessage = "";
    statusMessage = "Swapping icons, please wait.";
    sendToPlugin("swap-icons", {
      sourceCollectionId: selectedSource.value,
      mapping,
      onlyInsideComponents,
      scope: scopeChoice.value,
    });
  }

  /** @param {CustomEvent<{ id: string; on: boolean }>} event */
  function onTick(event) {
    const next = new Set(ticked);
    if (event.detail.on) next.add(event.detail.id);
    else next.delete(event.detail.id);
    ticked = next;
  }

  /** @param {Event} event */
  function onTickAll(event) {
    const on = /** @type {HTMLInputElement} */ (event.currentTarget).checked;
    const next = new Set(ticked);
    for (const row of tickable) {
      if (on) next.add(row.sourceComponentId);
      else next.delete(row.sourceComponentId);
    }
    ticked = next;
  }

  // Choosing a target is asking for the swap, so it ticks the row too.
  /** @param {CustomEvent<{ id: string; entry: TargetEntry }>} event */
  function onChoose(event) {
    const { id, entry } = event.detail;
    picks = new Map(picks).set(id, entry.value);
    ticked = new Set(ticked).add(id);
    rows = rows.map((row) =>
      row.sourceComponentId === id ? { ...row, target: entry } : row,
    );
  }

  /** @param {CustomEvent<{ id: string }>} event */
  function onReveal(event) {
    sendToPlugin("reveal", {
      componentId: event.detail.id,
      scope: scopeChoice.value,
      onlyInsideComponents,
    });
  }

  /**
   * @param {{ collections: { id: string; name: string; componentCount: number }[]; defaultSourceId: string | null; scope?: Scope; selectionCount?: number; pageId?: string }} payload
   */
  function handleCollections(payload) {
    scopeChoice =
      SCOPES.find((option) => option.value === payload.scope) || scopeChoice;
    selectionCount = payload.selectionCount ?? 0;
    pageId = payload.pageId ?? "";
    collections = payload.collections || [];
    sourceOptions = collectionEntries(collections);
    targetOptions = collectionEntries(collections);
    selectedSource =
      sourceOptions.find((o) => o.value === payload.defaultSourceId) ||
      sourceOptions.find(looksLikeIcons) ||
      sourceOptions[0] ||
      null;
    const others = targetOptions.filter(
      (o) => o.value !== selectedSource?.value,
    );
    selectedTarget =
      others.find(looksLikeIcons) || others[0] || targetOptions[0] || null;
    changeCollections();
  }

  /**
   * @param {{ requestId?: number; targetOptions: { name: string; id: string }[]; matches: SandboxRow[] }} payload
   */
  function handleMatches(payload) {
    if (payload.requestId !== latestRequest) return;
    progressMessage = "";
    const targets = payload.targetOptions || [];
    const nextTicked = new Set(ticked);
    rows = (payload.matches || []).map((match) => {
      const row = toRow(match, targets);
      const id = row.sourceComponentId;
      const picked = picks.get(id);
      if (picked)
        row.target = row.entries.find((e) => e.value === picked) ?? row.target;
      // First sight of a row: tick it when the suggestion is worth trusting.
      if (!seen.has(id) && row.target && row.confidence === "high") {
        nextTicked.add(id);
      }
      return row;
    });
    seen = new Set([...seen, ...rows.map((row) => row.sourceComponentId)]);
    ticked = nextTicked;
    isLoading = false;
  }

  onMount(() => {
    window.onmessage = createMessageHandler({
      collections: handleCollections,
      matches: handleMatches,
      progress: (
        /** @type {{ message: string; requestId?: number }} */ payload,
      ) => {
        const current =
          payload.requestId == null
            ? isSwapping
            : payload.requestId === latestRequest;
        if (current) progressMessage = payload.message;
      },
      whereabouts: (
        /** @type {{ selectionCount: number; pageId: string }} */ payload,
      ) => {
        const pageChanged = payload.pageId !== pageId;
        selectionCount = payload.selectionCount;
        pageId = payload.pageId;
        if (isSwapping) return;
        const scope = scopeChoice.value;
        if (scope === "selection" || (scope === "page" && pageChanged)) {
          scheduleMatches();
        }
      },
      "swap-complete": () => {
        error = "";
        isLoading = false;
        isSwapping = false;
        progressMessage = "";
        statusMessage = "Swap complete.";
        // The swapped icons are gone from the list's source; show what is left.
        requestMatches();
      },
      error: (/** @type {{ message?: string }} */ payload) => {
        error = payload.message || "Something went wrong.";
        isLoading = false;
        isSwapping = false;
        progressMessage = "";
        statusMessage = "";
      },
    });
    sendToPlugin("ui-ready");
  });
</script>

<div class="plugin-container">
  <!-- Polite status region for swap progress/completion announcements -->
  <div aria-live="polite" aria-atomic="true" class="visually-hidden">
    {statusMessage}
  </div>

  <!-- The toolbar holds the scope, so it stays up when the list is empty:
       an empty selection is exactly when someone needs to change it. -->
  <Layout toolbar status={isLoading && (rows.length > 0 || isSwapping)}>
    <!-- Source → target, in the columns the rows below use. -->
    <div class="collections" slot="top">
      <Dropdown
        placeholder="Source collection"
        menuItems={sourceOptions}
        bind:value={selectedSource}
        badge={selectedSource?.badge ?? ""}
        on:change={changeCollections}
        ariaLabel="Source collection"
      />
      <span class="link">
        <Icon iconName={IconGoSmall} color="--figma-color-icon-tertiary" />
      </span>
      <Dropdown
        placeholder="Target collection"
        menuItems={targetOptions}
        bind:value={selectedTarget}
        badge={selectedTarget?.badge ?? ""}
        on:change={changeCollections}
        ariaLabel="Target collection"
      />
    </div>

    <svelte:fragment slot="toolbar">
      <MatchToolbar
        bind:showing
        bind:scopeChoice
        bind:search
        bind:searching
        {counts}
        scopes={SCOPES}
        disabled={isSwapping}
        on:change={requestMatches}
      />
    </svelte:fragment>

    {#if error}
      <div role="alert"><Banner variant="danger">{error}</Banner></div>
    {/if}

    {#if rows.length === 0}
      <section class="fill">
        {#if isLoading}
          <LoadingState message={progressMessage || "Finding icons…"} />
        {:else}
          <EmptyState
            message={emptyMessage}
            size="small"
            action={scope === "file" ||
            (scope === "selection" && selectionCount === 0)
              ? null
              : searchWholeFile}
          />
        {/if}
      </section>
    {:else if visible.length === 0}
      <section class="fill">
        <EmptyState
          message="No icons match these filters."
          size="small"
          action={showAll}
        />
      </section>
    {:else}
      {@const on = tickable.filter((row) =>
        ticked.has(row.sourceComponentId),
      ).length}
      <section>
        <!-- One list, so no section to open and close: just a tick for every
             row shown, in the column the rows put theirs in. -->
        <div class="all">
          <div class="tick">
            <Checkbox
              ariaLabel="Tick every icon shown"
              checked={tickable.length > 0 && on === tickable.length}
              mixed={on > 0 && on < tickable.length}
              disabled={tickable.length === 0}
              on:change={onTickAll}
            />
          </div>
          <Text variant="body-medium-strong">All icons</Text>
          <Badge variant="count-inactive" text={String(visible.length)} />
        </div>
        {#each visible as row (row.sourceComponentId)}
          <MatchEntry
            {row}
            ticked={ticked.has(row.sourceComponentId)}
            on:tick={onTick}
            on:choose={onChoose}
            on:reveal={onReveal}
          />
        {/each}
      </section>
    {/if}

    <svelte:fragment slot="status">
      <Text variant="body-small" color="--figma-color-text-secondary">
        {progressMessage || (isSwapping ? "Swapping icons…" : "Finding icons…")}
      </Text>
    </svelte:fragment>

    <svelte:fragment slot="lead">
      <Switch
        bind:checked={onlyInsideComponents}
        disabled={isSwapping}
        on:change={requestMatches}
      >
        Only in components
      </Switch>
    </svelte:fragment>

    <svelte:fragment slot="actions">
      <Tooltip
        label="Tick an icon with a target to swap it"
        direction="TopRight"
        disabled={swapCount > 0}
      >
        <Button
          variant="primary"
          on:click={swapIcons}
          ariaDisabled={swapCount === 0 || isLoading}
        >
          {#if isSwapping}
            Swapping…
          {:else}
            Swap {swapCount || ""} icon{swapCount === 1 ? "" : "s"}
          {/if}
        </Button>
      </Tooltip>
    </svelte:fragment>
  </Layout>
</div>

<style>
  .plugin-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  /* The rows' two columns and arrow, without the tick column: the bar is the
     choice every row follows from. */
  .collections {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--size-small) minmax(0, 1fr);
    align-items: center;
    gap: var(--size-xxxsmall);
    flex: 1;
    min-width: 0;
  }

  .link {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  section.fill {
    flex: 1;
  }

  .all {
    display: flex;
    align-items: center;
    gap: var(--size-xxxsmall);
    min-width: 0;
    height: var(--size-small);
  }

  .tick {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-small);
    flex: 0 0 auto;
  }
</style>
