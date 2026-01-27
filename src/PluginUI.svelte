<script>
  import { onMount } from "svelte";
  import { Badge, Button, Dropdown, Text, Label } from "figma-ui3-kit-svelte";

  let collections = [];
  let collectionOptions = [];
  let selectedSource = null;
  let selectedTarget = null;
  let matches = [];
  let targetOptions = [];
  let targetMenuItems = [];
  let status = "";
  let error = "";
  let isLoading = false;

  function sendMessage(type, data = {}) {
    parent.postMessage({ pluginMessage: { type, ...data } }, "*");
  }

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
    status = "Scanning current page...";
    error = "";
    sendMessage("get-matches", {
      sourceCollectionId: selectedSource.value,
      targetCollectionId: selectedTarget.value,
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
    status = "Swapping icons...";
    error = "";
    sendMessage("swap-icons", {
      sourceCollectionId: selectedSource.value,
      mapping,
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
    status = matches.length ? "" : "No used icons found on this page.";
  }

  function badgeVariant(confidence) {
    if (confidence === "high") return "success";
    if (confidence === "medium") return "warning";
    return "danger";
  }

  function handleSwapComplete(payload) {
    status = `Swapped ${payload.swappedCount} icons.`;
    error = "";
  }

  function handleError(payload) {
    error = payload.message || "Something went wrong.";
    status = "";
    isLoading = false;
  }

  onMount(() => {
    window.onmessage = (event) => {
      const message = event.data.pluginMessage;
      if (!message) return;
      if (message.type === "collections") handleCollections(message);
      if (message.type === "matches") handleMatches(message);
      if (message.type === "swap-complete") handleSwapComplete(message);
      if (message.type === "error") handleError(message);
    };
    sendMessage("ui-ready");
  });
</script>

<div class="wrapper">
  <div class="section collections-row">
    <div class="collection-field">
      <Label>Source collection</Label>
      <Dropdown
        placeholder="Select source collection"
        menuItems={collectionOptions}
        bind:value={selectedSource}
        on:change={requestMatches}
      />
    </div>
    <div class="collection-field">
      <Label>Target collection</Label>
      <Dropdown
        placeholder="Select target collection"
        menuItems={collectionOptions}
        bind:value={selectedTarget}
        on:change={requestMatches}
      />
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <Text variant="heading-small">Matches</Text>
      <Button
        variant="secondary"
        on:click={requestMatches}
        disabled={isLoading}
      >
        Refresh
      </Button>
    </div>

    {#if error}
      <div class="error">
        <Text variant="body-small">{error}</Text>
      </div>
    {:else if status}
      <div class="status">
        <Text variant="body-small">{status}</Text>
      </div>
    {/if}

    <div class="table">
      {#if matches.length === 0}
        <div class="muted">
          <Text variant="body-small">No matches to show.</Text>
        </div>
      {:else}
        {#each matches as row, index}
          <div class="row">
            <div class="row-text">
              <Text variant="body-small">{row.sourceName}</Text>
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
            />
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <div class="footer">
    <Button variant="primary" on:click={swapIcons} disabled={!matches.length}>
      Swap icons
    </Button>
  </div>
</div>

<style>
  .wrapper {
    color: var(--figma-color-text);
    font-family: var(--figma-font-stack);
    padding: var(--size-xxsmall);
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--size-xxsmall);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--size-xxsmall);
    padding: 0 var(--size-xxsmall);
  }

  .collections-row {
    flex-direction: row;
    gap: var(--size-xxsmall);
  }

  .collection-field {
    display: flex;
    flex-direction: column;
    gap: var(--size-xxsmall);
    flex: 1;
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
    padding: var(--size-xxsmall) 0;
    max-height: 220px;
    overflow-y: auto;
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
    justify-self: flex-start;
  }

  .footer {
    margin-top: auto;
    padding: var(--size-xxsmall);
  }

  .muted {
    color: var(--figma-color-text-secondary);
  }

  .status {
    color: var(--figma-color-text-secondary);
  }

  .error {
    color: var(--figma-color-text-danger);
  }
</style>
