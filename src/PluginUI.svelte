<script>
  import { onMount } from "svelte";
  import {
    Badge,
    Button,
    Dropdown,
    Switch,
    Text,
    Tooltip,
  } from "figma-ui3-kit-svelte";
  import {
    PluginLayout,
    FieldGroup,
    Footer,
    EmptyState,
    sendToPlugin,
    createMessageHandler,
  } from "figma-plugin-utilities";

  // CQ5: JSDoc types so editors and tsc can catch shape mismatches
  /** @typedef {{ label: string; value: string }} CollectionOption */
  /** @typedef {{ label: string; value: string }} TargetMenuOption */
  /**
   * @typedef {{
   *   sourceComponentId: string;
   *   sourceName: string;
   *   suggestedTargetId: string | null;
   *   score: number;
   *   confidence: "high" | "medium" | "low";
   *   targetOption: TargetMenuOption | null;
   *   menuItems: TargetMenuOption[];
   * }} MatchRow
   */

  /** @type {{ id: string; name: string; componentCount: number }[]} */
  let collections = [];
  /** @type {CollectionOption[]} */
  let collectionOptions = [];
  /** @type {CollectionOption | null} */
  let selectedSource = null;
  /** @type {CollectionOption | null} */
  let selectedTarget = null;
  /** @type {MatchRow[]} */
  let matches = [];
  /** @type {{ name: string; id: string }[]} */
  let targetOptions = [];
  /** @type {TargetMenuOption[]} */
  let targetMenuItems = [];
  let error = "";
  let statusMessage = "";
  let isLoading = false;
  let onlyInsideComponents = true;

  /** @param {string | null} defaultSourceId */
  function pickDefaultTarget(defaultSourceId) {
    if (!collectionOptions.length) return null;
    return (
      collectionOptions.find((option) => option.value !== defaultSourceId) ||
      collectionOptions[0]
    );
  }

  function requestMatches() {
    if (!selectedSource || !selectedTarget) return;
    // UX1: block same-collection selection early with clear feedback
    if (selectedSource.value === selectedTarget.value) {
      error = "Source and target collections must be different.";
      matches = [];
      return;
    }
    isLoading = true;
    error = "";
    sendToPlugin("get-matches", {
      sourceCollectionId: selectedSource.value,
      targetCollectionId: selectedTarget.value,
      onlyInsideComponents,
    });
  }

  function buildMapping() {
    /** @type {Record<string, string>} */
    const mapping = {};
    for (const row of matches) {
      if (row.targetOption?.value && row.targetOption.value !== "__none__") {
        mapping[row.sourceComponentId] = row.targetOption.value;
      }
    }
    return mapping;
  }

  function swapIcons() {
    if (!selectedSource) return;
    // CQ4: catch empty mapping before dispatching
    const mapping = buildMapping();
    if (!Object.keys(mapping).length) {
      error = "Assign at least one target icon to swap.";
      return;
    }
    error = "";
    // CQ3/UX2: signal loading so the button is disabled and AT gets feedback
    isLoading = true;
    statusMessage = "Swapping icons, please wait.";
    sendToPlugin("swap-icons", {
      sourceCollectionId: selectedSource.value,
      mapping,
      onlyInsideComponents,
    });
  }

  /**
   * @param {{ collections: { id: string; name: string; componentCount: number }[]; defaultSourceId: string | null }} payload
   */
  function handleCollections(payload) {
    collections = payload.collections || [];
    collectionOptions = collections.map((collection) => ({
      label: `${collection.name} (${collection.componentCount})`,
      value: collection.id,
    }));
    const defaultSourceId = payload.defaultSourceId;
    selectedSource =
      collectionOptions.find((option) => option.value === defaultSourceId) ||
      collectionOptions[0] ||
      null;
    selectedTarget = pickDefaultTarget(selectedSource?.value ?? null) || null;
    requestMatches();
  }

  /**
   * @param {{ targetOptions: { name: string; id: string }[]; matches: { sourceComponentId: string; sourceName: string; suggestedTargetId: string | null; score: number; confidence: "high" | "medium" | "low" }[] }} payload
   */
  function handleMatches(payload) {
    targetOptions = payload.targetOptions || [];
    targetMenuItems = targetOptions.map((option) => ({
      label: option.name,
      value: option.id,
    }));
    matches = (payload.matches || []).map((row) => {
      // Each row gets its own copy of the menu items so the Dropdown component's
      // item.selected mutation doesn't bleed across rows via the shared array.
      const rowMenuItems = [
        { label: "None", value: "__none__" },
        ...targetMenuItems.map((item) => ({ ...item })),
      ];
      const matched =
        rowMenuItems.find((item) => item.value === row.suggestedTargetId) ||
        null;
      return { ...row, menuItems: rowMenuItems, targetOption: matched };
    });
    isLoading = false;
  }

  /** @param {MatchRow["confidence"]} confidence */
  function badgeVariant(confidence) {
    if (confidence === "high") return "success";
    if (confidence === "medium") return "warning";
    return "danger";
  }

  onMount(() => {
    window.onmessage = createMessageHandler({
      collections: handleCollections,
      matches: handleMatches,
      "swap-complete": () => {
        error = "";
        isLoading = false;
        statusMessage = "Swap complete.";
      },
      error: (/** @type {{ message?: string }} */ payload) => {
        error = payload.message || "Something went wrong.";
        isLoading = false;
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

  <PluginLayout>
    <div class="collections-row">
      <FieldGroup label="Source collection">
        <Dropdown
          placeholder="Select source collection"
          menuItems={collectionOptions}
          bind:value={selectedSource}
          on:change={requestMatches}
          ariaLabel="Source collection"
        />
      </FieldGroup>
      <FieldGroup label="Target collection">
        <Dropdown
          placeholder="Select target collection"
          menuItems={collectionOptions}
          bind:value={selectedTarget}
          on:change={requestMatches}
          ariaLabel="Target collection"
        />
      </FieldGroup>
    </div>

    <div class="matches-section">
      <div class="section-header">
        <Text variant="body-medium-strong">
          Matches{matches.length ? ` (${matches.length})` : ""}
        </Text>
        <Button
          variant="secondary"
          on:click={requestMatches}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      <!-- {#if error}
        <div class="error" role="alert">
          <Text variant="body-small">{error}</Text>
        </div>
      {/if} -->

      <div class="table" aria-live="polite" aria-atomic="false">
        {#if matches.length === 0}
          <EmptyState message="No matches to show." size="small" />
        {:else}
          {#each matches as row (row.sourceComponentId)}
            <div class="row">
              <div class="row-text">
                <Text variant="body-medium">{row.sourceName}</Text>
                <Badge
                  variant={badgeVariant(row.confidence)}
                  text={row.confidence}
                />
              </div>
              <Dropdown
                placeholder="Select target icon"
                menuItems={row.menuItems}
                bind:value={row.targetOption}
                on:change={() => (matches = [...matches])}
                ariaLabel="{row.sourceName} — target icon"
              />
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </PluginLayout>

  <Footer variant="split">
    <svelte:fragment slot="left">
      <Switch bind:checked={onlyInsideComponents} on:change={requestMatches}>
        Only swap in components
      </Switch>
    </svelte:fragment>
    <svelte:fragment slot="right">
      <Tooltip
        label="Load matches to enable swapping"
        direction="TopRight"
        disabled={!!matches.length}
      >
        <Button
          variant="primary"
          on:click={swapIcons}
          ariaDisabled={!matches.length || isLoading}
        >
          {isLoading ? "Working…" : "Swap icons"}
        </Button>
      </Tooltip>
    </svelte:fragment>
  </Footer>
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

  .collections-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--size-xxsmall);
  }

  .matches-section {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--size-xxsmall);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .table {
    display: flex;
    flex-direction: column;
    gap: var(--size-xxsmall);
    padding: var(--size-xxsmall);
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    border: 1px solid var(--figma-color-border);
    border-radius: var(--border-radius-medium);
  }

  .row {
    display: grid;
    grid-template-columns: 1fr minmax(0, 1fr);
    gap: var(--size-xxsmall);
    align-items: center;
  }

  .row-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .row-text :global(.badge) {
    align-self: flex-start;
  }

  .error {
    color: var(--figma-color-text-danger);
  }
</style>
