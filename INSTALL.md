# WebHub Channel Installation Guide

> This guide covers installing the WebHub channel to connect OpenClaw with any Website.

---

## 1. Installation Methods

### 1.1 From npm (Recommended)

```bash
# Install as OpenClaw extension
openclaw extensions install @openclaw/webhub

# Or using npm directly
npm install -g @openclaw/webhub
```

### 1.2 From Source

```bash
# Clone the repository
git clone https://github.com/chatu-ai/openclaw-web-hub-channel.git
cd openclaw-web-hub-channel

# Build the extension
npm install
npm run build

# Install locally
openclaw extensions install ./dist
```

### 1.3 As Plugin (Development)

```bash
# Link for development
cd /path/to/openclaw-web-hub-channel
npm link

# In your OpenClaw directory
npm link @openclaw/webhub
openclaw extensions install @openclaw/webhub
```

---

## 2. Configuration

### 2.1 Quick Setup

```bash
# Enable the channel
openclaw config set channels.webhub.enabled true

# Set WebHub service URL (provided by your Website)
openclaw config set channels.webhub.webhookUrl "https://your-website.com/webhub"

# Set access token (provided by your Website)
openclaw config set channels.webhub.accessToken "wh_eyJhbGciOiJIUzI1NiIs..."
```

### 2.2 Full Configuration

```json5
{
  channels: {
    webhub: {
      enabled: true,
      
      // WebHub service URL [Required]
      webhookUrl: "https://your-website.com/webhub",
      
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
export WEBHUB_WEBHOOK_URL="https://your-website.com/webhub"
export WEBHUB_ACCESS_TOKEN="wh_eyJhbGciOiJIUzI1NiIs..."

# Then configure
openclaw config set channels.webhub.enabled true
```

---

## 3. Verify Installation

### 3.1 Check Channel Status

```bash
# View channel status
openclaw channels status webhub

# Output example:
# Channel: webhub
# Status: enabled
# Webhook URL: https://your-website.com/webhub
# Connection: testing...
```

### 3.2 Test Connection

```bash
# Test connection to WebHub service
openclaw channels test webhub

# Output example:
# ✓ WebHub channel enabled
# ✓ Webhook URL: https://your-website.com/webhub
# ✓ Connection: OK
# ✓ Last ping: 2024-02-06 21:45:00
```

### 3.3 View Logs

```bash
# Check connection logs
openclaw logs --channel webhub --level debug
```

---

## 4. Uninstall

### 4.1 Disable Channel

```bash
# Disable the channel
openclaw config set channels.webhub.enabled false

# Or remove entirely
openclaw config unset channels.webhub
```

### 4.2 Remove Extension

```bash
# Remove from OpenClaw
openclaw extensions uninstall @openclaw/webhub

# If installed from npm
npm uninstall -g @openclaw/webhub
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
openclaw config set channels.webhub.debug true

# View detailed logs
openclaw logs --channel webhub --level debug

# Test webhook manually
curl -X POST https://your-website.com/webhub/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"test": true}'
```

### 5.3 Get Help

```bash
# View channel help
openclaw channels help webhub

# Check OpenClaw documentation
openclaw help
```

---

## 6. Update

### 6.1 Update Extension

```bash
# Update to latest version
openclaw extensions update @openclaw/webhub

# Or via npm
npm update -g @openclaw/webhub
```

### 6.2 Check Version

```bash
# View installed version
openclaw extensions list | grep webhub

# Check for updates
openclaw extensions update --check
```

---

## Related Documentation

- [WebHub Design Docs](../docs/webhub/README.md) - API design
- [OpenClaw Configuration](https://docs.openclaw.ai/gateway/configuration) - Official docs
- [Channel SDK](../docs/channel/README.md) - Developer guide

---

*Last updated: 2026-02-06*
