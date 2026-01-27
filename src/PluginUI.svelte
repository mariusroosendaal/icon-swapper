<script>
  //import some Svelte Figma UI components
  import {
    Button,
    Dropdown,
    Tabs,
    Text,
    Input,
    Label,
  } from "figma-ui3-kit-svelte";

  let textInput = "Hello Figma!";
  let selectedTab = 0;

  // Tab configuration
  const tabs = ["Shapes", "Text"];

  const shapeOptions = [
    { label: "Rectangle", value: "rectangle" },
    { label: "Circle", value: "circle" },
  ];
  let selectedShape = shapeOptions[0];

  // Function to send messages to the plugin code
  function sendMessage(type, data = {}) {
    parent.postMessage({ pluginMessage: { type, ...data } }, "*");
  }

  function createShape() {
    if (selectedShape?.value === "circle") {
      sendMessage("create-circle");
      return;
    }
    sendMessage("create-rectangle");
  }

  function createText() {
    sendMessage("create-text", { text: textInput });
  }
</script>

<div class="wrapper">
  <Tabs {tabs} bind:selectedTab class="tabs" />

  <div class="content">
    {#if selectedTab === 0}
      <div class="section">
        <Text variant="heading-small">Create Shapes</Text>
        <Text variant="body-medium"
          >Select a shape and create it on your canvas:</Text
        >

        <div class="input-group">
          <Label>Shape</Label>
          <Dropdown
            placeholder="Select a shape"
            menuItems={shapeOptions}
            bind:value={selectedShape}
          />
          <Button variant="primary" on:click={createShape} class="shape-button">
            Create Shape
          </Button>
        </div>
      </div>
    {:else if selectedTab === 1}
      <div class="section">
        <Text variant="heading-small">Create Text</Text>
        <Text variant="body-medium"
          >Enter text and click the button to create a text element:</Text
        >

        <div class="input-group">
          <Label>Layer name</Label>
          <Input bind:value={textInput} placeholder="Enter your text here..." />
          <Button variant="primary" on:click={createText} class="text-button">
            Create Texts
          </Button>
        </div>
      </div>
    {/if}
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
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: var(--size-xxsmall);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--size-xxsmall);
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: var(--size-xxsmall);
  }
</style>
