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
npm link

# In your OpenClaw directory
npm link @openclaw/chatu
openclaw extensions install @openclaw/chatu
```

---

## 2. Configuration

### 2.1 Quick Setup

```bash
# Enable the channel
openclaw config set channels.chatu.enabled true

# Set Chatu service URL (provided by your Website)
openclaw config set channels.chatu.webhookUrl "https://your-website.com/chatu"

# Set access token (provided by your Website)
openclaw config set channels.chatu.accessToken "wh_eyJhbGciOiJIUzI1NiIs..."
```

### 2.2 Full Configuration

```json5
{
  channels: {
    chatu: {
      enabled: true,
      
      // Chatu service URL [Required]
      webhookUrl: "https://your-website.com/chatu",
      
      // Access token [Required]
      accessToken: "wh_eyJhbGciOiJIUzI1NiIs...",
      
      // Request timeout (ms) [Optional]
      timeout: 30000,
      
      // Retry settings [Optional]
      retry: {
        maxAttempts: 3,
        backoffMs: 1000
      },
      
      // Message settings [Optional]
      message: {
        maxLength: 10000,
        allowedFormats: ["plain", "markdown"]
      },
      
      // Security settings [Optional]
      security: {
        signatureKey: "your-webhook-secret",
        signatureAlgorithm: "sha256"
      }
    }
  }
}
```

### 2.3 Environment Variables

```bash
# Alternative: Use environment variables
export CHATU_WEBHOOK_URL="https://your-website.com/chatu"
export CHATU_ACCESS_TOKEN="wh_eyJhbGciOiJIUzI1NiIs..."

# Then configure
openclaw config set channels.chatu.enabled true
```

---

## 3. Verify Installation

### 3.1 Check Channel Status

```bash
# View channel status
openclaw channels status chatu

# Output example:
# Channel: chatu
# Status: enabled
# Webhook URL: https://your-website.com/chatu
# Connection: testing...
```

### 3.2 Test Connection

```bash
# Test connection to Chatu service
openclaw channels test chatu

# Output example:
# ✓ Chatu channel enabled
# ✓ Webhook URL: https://your-website.com/chatu
# ✓ Connection: OK
# ✓ Last ping: 2024-02-06 21:45:00
```

### 3.3 View Logs

```bash
# Check connection logs
openclaw logs --channel chatu --level debug
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

### 4.2 Remove Extension

```bash
# Remove from OpenClaw
openclaw extensions uninstall @openclaw/chatu

# If installed from npm
npm uninstall -g @openclaw/chatu
```

---

## 5. Troubleshooting

### 5.1 Common Issues

| Issue | Solution |
|-------|----------|
| Connection timeout | Check `webhookUrl` is correct and accessible |
| 401 Unauthorized | Verify `accessToken` is valid |
| 403 Forbidden | Check token permissions |
| Messages not arriving | Verify webhook endpoint is configured |
| Messages not sending | Check outbound permissions |

### 5.2 Debug Commands

```bash
# Enable debug logging
openclaw config set channels.chatu.debug true

# View detailed logs
openclaw logs --channel chatu --level debug

# Test webhook manually
curl -X POST https://your-website.com/chatu/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"test": true}'
```

### 5.3 Get Help

```bash
# View channel help
openclaw channels help chatu

# Check OpenClaw documentation
openclaw help
```

---

## 6. Update

### 6.1 Update Extension

```bash
# Update to latest version
openclaw extensions update @openclaw/chatu

# Or via npm
npm update -g @openclaw/chatu
```

### 6.2 Check Version

```bash
# View installed version
openclaw extensions list | grep chatu

# Check for updates
openclaw extensions update --check
```

---

## Related Documentation

- [Chatu Design Docs](../docs/chatu/README.md) - API design
- [OpenClaw Configuration](https://docs.openclaw.ai/gateway/configuration) - Official docs
- [Channel SDK](../docs/channel/README.md) - Developer guide

---

*Last updated: 2026-02-06*

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
