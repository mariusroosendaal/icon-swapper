<script>
  import { onMount } from "svelte";
  import { Badge, Button, Dropdown, Switch, Text, Tooltip } from "figma-ui3-kit-svelte";
  import {
    PluginLayout,
    FieldGroup,
    Footer,
    EmptyState,
    sendToPlugin,
    createMessageHandler,
  } from "figma-plugin-utilities";

  let collections = [];
  let collectionOptions = [];
  let selectedSource = null;
  let selectedTarget = null;
  let matches = [];
  let targetOptions = [];
  let targetMenuItems = [];
  let error = "";
  let isLoading = false;
  let onlyInsideComponents = true;

  function pickDefaultTarget(defaultSourceId) {
    if (!collectionOptions.length) return null;
    return (
      collectionOptions.find((option) => option.value !== defaultSourceId) ||
      collectionOptions[0]
    );
  }

  function requestMatches() {
    if (!selectedSource || !selectedTarget) return;
    isLoading = true;
    error = "";
    sendToPlugin("get-matches", {
      sourceCollectionId: selectedSource.value,
      targetCollectionId: selectedTarget.value,
      onlyInsideComponents,
    });
  }

  function buildMapping() {
    const mapping = {};
    for (const row of matches) {
      if (row.targetOption?.value) {
        mapping[row.sourceComponentId] = row.targetOption.value;
      }
    }
    return mapping;
  }

  function swapIcons() {
    if (!selectedSource) return;
    const mapping = buildMapping();
    error = "";
    sendToPlugin("swap-icons", {
      sourceCollectionId: selectedSource.value,
      mapping,
      onlyInsideComponents,
    });
  }

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
    selectedTarget = pickDefaultTarget(selectedSource?.value) || null;
    requestMatches();
  }

  function handleMatches(payload) {
    targetOptions = payload.targetOptions || [];
    targetMenuItems = targetOptions.map((option) => ({
      label: option.name,
      value: option.id,
    }));
    matches = (payload.matches || []).map((row) => ({
      ...row,
      targetOption:
        targetMenuItems.find(
          (option) => option.value === row.suggestedTargetId,
        ) || null,
    }));
    isLoading = false;
  }

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
      },
      error: (payload) => {
        error = payload.message || "Something went wrong.";
        isLoading = false;
      },
    });
    sendToPlugin("ui-ready");
  });
</script>

<div class="plugin-container">
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
        <Text variant="body-medium-strong">Matches</Text>
        <Button
          variant="secondary"
          on:click={requestMatches}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      {#if error}
        <div class="error" role="alert">
          <Text variant="body-small">{error}</Text>
        </div>
      {/if}

      <div class="table" aria-live="polite" aria-atomic="false">
        {#if matches.length === 0}
          <EmptyState message="No matches to show." size="small" />
        {:else}
          {#each matches as row}
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
                menuItems={targetMenuItems}
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
      <Tooltip label="Load matches to enable swapping" direction="TopRight" disabled={!!matches.length}>
        <Button variant="primary" on:click={swapIcons} disabled={!matches.length}>
          Swap icons
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

  .collections-row {
    display: flex;
    gap: var(--size-xxsmall);
  }

  .collections-row :global(.field-group) {
    flex: 1;
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
