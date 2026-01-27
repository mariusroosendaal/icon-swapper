# Figma Plugin Boilerplate - Svelte + UI3 Kit

A modern Figma plugin boilerplate built with Svelte and the Figma UI3 Kit components.

## Features

- ✅ **Svelte Framework** - Modern, reactive UI framework
- ✅ **UI3 Kit Components** - Official Figma UI components
- ✅ **TypeScript Support** - Full type safety
- ✅ **Hot Reload Development** - Fast development workflow
- ✅ **Shape Creation** - Create rectangles and circles
- ✅ **Text Creation** - Add custom text elements
- ✅ **Tabbed Interface** - Clean, organized UI
- ✅ **Menu Components** - Interactive dropdown menus

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone or download this boilerplate
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Import the plugin in Figma:
   - Open Figma
   - Go to `Plugins > Development > Import Plugin from Manifest`
   - Select the `manifest.json` file from this directory

### Development

For development with hot reload:

```bash
npm run dev
```

Then enable "Hot reload plugin" in Figma's Plugin Development menu.

## Plugin Structure

```
├── src/
│   ├── code.ts          # Plugin logic (runs in Figma sandbox)
│   ├── main.js          # Entry point for UI
│   ├── PluginUI.svelte  # Main UI component
│   └── template.html    # HTML template
├── public/              # Built files (generated)
├── manifest.json        # Plugin configuration
└── package.json         # Dependencies and scripts
```

## Available UI Components

This boilerplate demonstrates several UI3 Kit components:

- **Button** - Primary and secondary buttons
- **IconButton** - Icon-only buttons
- **Tabs** - Tabbed navigation
- **Menu** - Dropdown menus
- **Input** - Text input fields

## Customization

### Adding New Features

1. **UI Changes**: Edit `src/PluginUI.svelte`
2. **Plugin Logic**: Modify `src/code.ts`
3. **Styling**: Update the `<style>` section in the Svelte component

### Adding New UI Components

Import additional components from the UI3 Kit:

```javascript
import { NewComponent } from 'figma-ui3-kit-svelte';
```

### Communication Between UI and Plugin

The UI communicates with the plugin code via messages:

```javascript
// In UI (PluginUI.svelte)
function sendMessage(type, data = {}) {
    parent.postMessage({ pluginMessage: { type, ...data } }, '*');
}

// In plugin code (code.ts)
figma.ui.onmessage = async (msg) => {
    if (msg.type === 'your-action') {
        // Handle the action
    }
};
```

### Font Loading for Text Elements

When creating text elements in Figma, you must load the font first:

```javascript
// Load font before creating text
await figma.loadFontAsync({ family: "Inter", style: "Regular" });

const text = figma.createText();
text.characters = "Your text here";
```

## Building for Production

```bash
npm run build
```

This creates optimized files in the `public/` directory ready for distribution.

## License

MIT License - feel free to use this boilerplate for your own Figma plugins!
