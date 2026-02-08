# OpenClaw Plugin Implementation Fixes

## Version 0.1.1 (2026-02-08)

### Issue: "chatu-webhub missing register/activate export"

**Problem**: When running `openclaw plugins install .`, the installation failed with:
```
17:29:50 [plugins] chatu-webhub missing register/activate export
[openclaw] Failed to start CLI: Error: Config validation failed: plugins.entries.webhub: plugin not found: webhub
```

**Root Cause**: The plugin was exporting a plugin object instead of the required `activate` function. Based on OpenClaw's plugin system documentation and examples, plugins must export an `activate` (or `register`) function that:
1. Receives the `PluginAPI` as a parameter
2. Calls `api.registerChannel()` to register the channel
3. Returns lifecycle handlers (dispose, etc.)

**Solution**: Refactored the plugin to follow the correct OpenClaw plugin pattern:

#### Before (Incorrect)
```typescript
// ❌ INCORRECT - Exporting a plugin object
const WebHubPlugin = {
  slot: 'channel',
  id: 'chatu-webhub',
  schema: ConfigSchema,
  metadata: { ... },
  async init(config, api) { ... }
};

export default WebHubPlugin;
export const register = WebHubPlugin;
export const activate = WebHubPlugin;
```

#### After (Correct)
```typescript
// ✅ CORRECT - Exporting an activate function
export async function activate(api: PluginAPI) {
  const channelId = 'webhub';
  
  await api.registerChannel({
    id: channelId,
    meta: { ... },
    capabilities: { ... },
    config: { ... },
    outbound: { ... },
  });
  
  return {
    name: 'webhub-channel',
    async dispose() {
      // cleanup
    },
  };
}

export const register = activate;
export default activate;
```

### Changes Made

1. **Removed plugin object pattern**: Replaced the plugin object with a direct `activate` function export
2. **Removed TypeBox dependency**: Configuration schema is now managed by OpenClaw through `openclaw.plugin.json`
3. **Simplified exports**: Now exports `activate`, `register`, and `default` all pointing to the activation function
4. **Fixed channel ID**: Changed from 'chatu-webhub' to 'webhub' to match the `openclaw.plugin.json` channels array
5. **Fixed config access**: Moved config parameter into the `sendText` function signature

### Files Modified

- `src/index.ts` - Complete rewrite to use function-based activation pattern
- Built output in `dist/index.js` - Regenerated with correct exports

### Testing

After the fix, installation should succeed:

```bash
# Method A: Auto-build install (recommended)
openclaw plugins install .

# Method B: Manual build install
npm install
npm run build
openclaw plugins install .
```

The plugin will now be registered correctly and the channel 'webhub' will be available in OpenClaw.

### References

- [OpenClaw Plugin Documentation](https://docs.openclaw.ai/plugin)
- [Extension Channels](https://deepwiki.com/moltbook/openclaw/8.3-extension-channels)
- [Building a Channel Plugin for OpenClaw](https://wemble.com/2026/01/31/building-an-openclaw-plugin.html)

---

## Version 0.1.0 - Previous Implementation

For historical context, see the git history for the previous plugin object-based implementation.

---

*Last updated: 2026-02-08*
