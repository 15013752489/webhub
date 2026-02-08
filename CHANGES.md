# OpenClaw Plugin Implementation Fixes

## Summary

This document describes the fixes applied to correct the OpenClaw plugin implementation in this repository.

## Issues Identified

### 1. Incorrect Plugin Registration Pattern

**Problem**: The plugin was using an incorrect registration pattern:
```typescript
// ❌ INCORRECT - Old pattern
export default function registerWebHubChannel(api: any) {
  api.registerChannel({ ... });
}
```

**Root Cause**: This pattern was from an older version of OpenClaw or a misunderstanding of the plugin API.

**Solution**: Updated to use the correct plugin object export pattern:
```typescript
// ✅ CORRECT - New pattern
export default {
  slot: 'channel',
  id: 'webhub',
  schema: ConfigSchema,
  metadata: { ... },
  async init(config, api) { ... }
}
```

### 2. Missing Plugin Metadata

**Problem**: The plugin was missing critical metadata fields:
- `slot`: Identifies the plugin type (channel, tool, provider, memory)
- `id`: Unique plugin identifier
- `schema`: Configuration validation schema (using TypeBox)
- `metadata`: Plugin information (name, description, version, etc.)

**Solution**: Added all required metadata fields with proper TypeBox schema validation.

### 3. TypeScript Type Issues

**Problems**:
- Using `any` type for API parameter
- Missing TypeScript types for browser APIs
- Incorrect timer types (NodeJS.Timer)
- Type-only imports used where values are needed (enums)

**Solutions**:
- Added DOM lib to tsconfig.json for browser APIs
- Replaced `NodeJS.Timer` with `ReturnType<typeof setInterval/setTimeout>`
- Separated enum imports from type imports
- Added missing fields to interfaces (metadata, mode)

### 4. SDK Adapter Issues

**Problems**:
- Missing metadata field in OutboundMessage interface
- Missing mode field in ChannelStats interface
- Invalid wsPath property in WebHubAdapterConfig
- Duplicate condition in WebSocket connection attempt
- Capabilities using string arrays instead of proper enums

**Solutions**:
- Added metadata field to OutboundMessage
- Added mode field to ChannelStats
- Removed invalid wsPath property
- Fixed duplicate condition
- Used MessageType and TargetType enums properly

## Files Modified

### Core Plugin Files
- `src/index.ts` - Complete rewrite to use correct plugin pattern
- `package.json` - Added @sinclair/typebox dependency

### Configuration
- `tsconfig.json` - Added DOM lib to support browser APIs

### SDK Type Definitions
- `src/sdk/types/channel.ts` - Added metadata and mode fields

### SDK Adapters
- `src/sdk/adapters/webhub.ts` - Fixed types, enums, and configuration
- `src/sdk/adapters/websocket.ts` - Fixed timer types

## Testing

After installing dependencies with `npm install`, verify the changes:

```bash
# Method A: Auto-build install (recommended)
openclaw plugins install .

# Method B: Manual build install
npm run check  # Type check
npm run build  # Build
openclaw plugins install ./dist
```

**Note:** Since v0.1.0, the plugin includes a `prepare` script that automatically installs dependencies and compiles code when running `openclaw plugins install .`

## References

- [OpenClaw Plugin Documentation](https://docs.openclaw.ai/plugin)
- [Creating Custom Plugins](https://deepwiki.com/openclaw/openclaw/10.3-creating-custom-plugins)
- [Extension Channels](https://deepwiki.com/moltbook/openclaw/8.3-extension-channels)
- [TypeBox Schema Validation](https://github.com/sinclair/typebox)

## Migration Guide

If you have existing OpenClaw plugins using the old pattern, update them as follows:

### Before (Incorrect)
```typescript
export default function registerPlugin(api: any) {
  api.registerChannel({
    id: 'my-channel',
    // ...
  });
}
```

### After (Correct)
```typescript
import { Type } from '@sinclair/typebox';

export default {
  slot: 'channel' as const,
  id: 'my-channel',
  schema: Type.Object({
    enabled: Type.Boolean({ default: true }),
    // ... other config fields
  }),
  metadata: {
    name: 'My Channel',
    description: 'Channel description',
    version: '1.0.0',
  },
  async init(config, api) {
    await api.registerChannel({
      id: 'my-channel',
      // ...
    });
    
    return {
      name: 'my-channel',
      async dispose() {
        // cleanup
      },
    };
  },
};
```

## Key Takeaways

1. ✅ Always use the plugin object export pattern with `slot`, `id`, `schema`, `metadata`, and `init`
2. ✅ Use TypeBox for configuration schema validation
3. ✅ The `init` function receives validated config and PluginAPI
4. ✅ Return lifecycle handlers (dispose, etc.) from `init`
5. ✅ Use proper TypeScript types throughout
6. ✅ Avoid using `any` types
7. ✅ Use enums instead of string literals where appropriate

---

*Last updated: 2026-02-08*
