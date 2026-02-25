# Chatu Channel Installation Guide

> This guide covers installing the Chatu channel to connect OpenClaw with any Website.

---

## 1. Installation Methods

### 1.1 From npm (Recommended)

```bash
# Install as OpenClaw plugin
openclaw plugins install @openclaw/chatu

# Or using npm directly (if publishing to npm)
npm install -g @openclaw/chatu
```

### 1.2 From Source

**Method A: Auto-build Install (Recommended)**

```bash
# Clone the repository
git clone https://github.com/chatu-ai/openclaw-web-hub-channel.git
cd openclaw-web-hub-channel

# Install as plugin (will auto-build via prepare script)
openclaw plugins install .
```

**Method B: Manual Build Install**

```bash
# Clone the repository
git clone https://github.com/chatu-ai/openclaw-web-hub-channel.git
cd openclaw-web-hub-channel

# Build the plugin
npm install
npm run build

# Install locally
openclaw plugins install .
```

### 1.3 Development Mode

```bash
# Link for development (with hot reload)
openclaw plugins install -l .
cd /path/to/openclaw-web-hub-channel
npm run watch
```

---

## 2. Configuration

### 2.1 Quick Setup

```bash
# Enable the channel
openclaw config set channels.chatu.enabled true

# Set Chatu service API URL (provided by your WebHub backend)
openclaw config set channels.chatu.apiUrl "https://your-website.com"

# Set channel ID (from WebHub admin panel)
openclaw config set channels.chatu.channelId "wh_ch_xxxxxx"

# Set access token (provided by your WebHub backend)
openclaw config set channels.chatu.accessToken "wh_eyJhbGciOiJIUzI1NiIs..."

# Apply changes
openclaw gateway restart
```

### 2.2 Full Configuration

```json5
{
  channels: {
    chatu: {
      enabled: true,
      
      // WebHub service base URL [Required]
      apiUrl: "https://your-website.com",
      
      // Channel ID from WebHub admin panel [Required]
      channelId: "wh_ch_xxxxxx",
      
      // Access token [Required unless using secret]
      accessToken: "wh_eyJhbGciOiJIUzI1NiIs...",
      
      // Channel secret for registration [Alternative to accessToken]
      // secret: "wh_secret_xxxxxxxxxx",
      
      // Request timeout (ms) [Optional]
      timeout: 30000,
    }
  }
}
```

### 2.3 Environment Variables (Quick Register)

If your WebHub backend supports auto-registration, you can skip manual credential setup:

```bash
# Set registration key and service URL
export CHATU_KEY="your-registration-key"
export CHATU_URL="https://your-website.com"

# Restart gateway to trigger auto-registration
openclaw gateway restart
```

The plugin will automatically call `POST /api/channel/quick-register` and save the returned `channelId` and `accessToken` to config.

---

## 3. Verify Installation

### 3.1 Check Plugin Status

```bash
# Verify plugin is loaded
openclaw plugins list | grep chatu

# Expected output:
# │ Chatu │ chatu │ loaded │ .../dist/index.js │ 0.1.0 │
```

### 3.2 Check Configuration

```bash
# View current chatu config
openclaw config get channels.chatu
```

### 3.3 View Logs

```bash
# Check connection logs
openclaw logs
```

---

## 4. Uninstall

### 4.1 Disable Channel

```bash
# Disable the channel
openclaw config set channels.chatu.enabled false

# Or remove entirely
openclaw config unset channels.chatu
```

### 4.2 Remove Plugin

```bash
# Remove from OpenClaw
openclaw plugins uninstall @openclaw/chatu
```

---

## 5. Troubleshooting

### 5.1 Common Issues

| Issue | Solution |
|-------|----------|
| Connection timeout | Check `apiUrl` is correct and accessible |
| 401 Unauthorized | Verify `accessToken` is valid |
| Plugin not loading | Run `openclaw plugins list \| grep chatu`; ensure `dist/` exists after build |
| Messages not arriving | Check WebSocket connection in logs; verify `channelId` is correct |
| Messages not sending | Confirm `accessToken` and `channelId` are configured |

### 5.2 Debug Commands

```bash
# View gateway logs
openclaw logs

# Check plugin status
openclaw plugins list | grep chatu

# View current config
openclaw config get channels.chatu

# Test backend health
curl https://your-website.com/health
```

### 5.3 Get Help

```bash
# Check OpenClaw documentation
openclaw help
```

---

## 6. Update

### 6.1 Update Plugin

```bash
# Update to latest version
openclaw plugins update @openclaw/chatu
```

### 6.2 Check Version

```bash
# View installed version
openclaw plugins list | grep chatu
```

---

## Related Documentation

- [Channel Documentation](docs/channel/README.md) - Architecture, API reference, message protocol
- [OpenClaw Configuration](https://docs.openclaw.ai/gateway/configuration) - Official docs

---

*Last updated: 2026-02-25*

---

## Plugin Version Detection

After installing or upgrading the plugin, you can verify the active version without restarting openclaw by querying the service version endpoint:

```bash
# Check active plugin version
curl http://localhost:3000/api/channel/version
```

Expected response:

```json
{
  "success": true,
  "data": {
    "serviceVersion": "1.0.0",
    "nodeVersion": "20.11.0",
    "pluginVersion": "0.1.0",
    "buildTime": null
  }
}
```

`pluginVersion` reflects the version reported by the plugin when it last connected. If it shows `null`, the plugin has not yet connected after the most recent service restart.

---

## Reloading the Plugin After an Upgrade

Use the included reload script to rebuild and get guided reload instructions:

```bash
./scripts/reload-plugin.sh
```

The script will:
1. Run `npm run build` to compile the plugin
2. Print the new version
3. Check the service version endpoint
4. Show step-by-step instructions for clearing the cached `accessToken` and restarting the openclaw account so the new build takes effect

To reload without rebuilding:

```bash
./scripts/reload-plugin.sh --no-build
```
