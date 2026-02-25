# OpenClaw Chatu Channel Plugin

**English | [中文](README.zh.md)**

Official OpenClaw channel plugin for connecting to any website via HTTP/WebSocket.

## What is Chatu Channel?

Chatu is a flexible channel plugin that enables OpenClaw to communicate with any HTTP/WebSocket-based messaging service. It provides a universal interface for connecting OpenClaw to custom web applications.

## Quick Start

### 1. Install

```bash
# From npm (recommended)
openclaw plugins install @chatu-ai/webhub

# Or from source (for development)
git clone https://github.com/chatu-ai/webhub.git
cd webhub
npm install
npm run build
openclaw plugins install -l .
```

### 2. Configure

```bash
# Enable and configure the channel
openclaw config set channels.chatu.enabled true
openclaw config set channels.chatu.apiUrl "https://your-api.example.com"
openclaw config set channels.chatu.channelId "wh_ch_xxxxxx"
openclaw config set channels.chatu.accessToken "your-access-token"

# Restart gateway to apply changes
openclaw gateway restart
```

### 3. Verify

```bash
# Check plugin status
openclaw plugins list | grep chatu

# View logs
openclaw logs
```

> 📖 For detailed setup instructions, see the [Setup & Configuration Guide](#setup--configuration-guide) below.

## Features

- 🔌 Universal HTTP/WebSocket connectivity
- 🔐 Secure token-based authentication
- 📝 Support for text, images, and file attachments
- 👥 Direct messages and group chat support
- 🔄 Message editing and deletion
- 💬 Reply threading

## Configuration Options

### Basic Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `enabled` | boolean | No | `true` | Enable/disable the channel |
| `apiUrl` | string | Yes | — | WebHub service base URL |
| `channelId` | string | Yes | — | Channel ID from WebHub (e.g. `wh_ch_xxxxx`) |
| `secret` | string | Either/Or | — | Channel secret (`wh_secret_xxx`) for registration |
| `accessToken` | string | Either/Or | — | Access token (`wh_xxxxxxx`) |
| `timeout` | number | No | `30000` | Request timeout in milliseconds |

### Example Configurations

**Single Account:**
```json
{
  "channels": {
    "chatu": {
      "enabled": true,
      "apiUrl": "https://api.example.com",
      "channelId": "wh_ch_xxxxxx",
      "accessToken": "your-token",
      "timeout": 30000
    }
  }
}
```

**Multiple Accounts:**
```json
{
  "channels": {
    "chatu": {
      "accounts": {
        "work": {
          "accountId": "work",
          "apiUrl": "https://work-api.example.com",
          "channelId": "wh_ch_aaaaaa",
          "accessToken": "work-token"
        },
        "personal": {
          "accountId": "personal",
          "apiUrl": "https://personal-api.example.com",
          "channelId": "wh_ch_bbbbbb",
          "accessToken": "personal-token"
        }
      }
    }
  }
}
```

> 💡 See the [Setup & Configuration Guide](#setup--configuration-guide) for step-by-step instructions.

## Setup & Configuration Guide

### Step 1: Verify Plugin Status

After installation, verify the plugin is loaded:

```bash
# Check plugin status
openclaw plugins list | grep chatu
```

Expected output:
```
│ Chatu   │ chatu  │ loaded  │ ~/path/to/webhub/dist/index.js  │ 0.1.0 │
```

### Step 2: Configure the Channel

#### Option A: Using CLI Commands (Recommended)

```bash
# Enable the channel
openclaw config set channels.chatu.enabled true

# Set API URL
openclaw config set channels.chatu.apiUrl "https://your-api.example.com"

# Set channel ID (from WebHub admin panel)
openclaw config set channels.chatu.channelId "wh_ch_xxxxxx"

# Set access token
openclaw config set channels.chatu.accessToken "your-access-token"

# Set timeout (optional, default: 30000ms)
openclaw config set channels.chatu.timeout 30000
```

#### Option B: Edit Configuration File Directly

Edit `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "chatu": {
      "enabled": true,
      "apiUrl": "https://your-api.example.com",
      "channelId": "wh_ch_xxxxxx",
      "accessToken": "your-access-token",
      "timeout": 30000
    }
  }
}
```

#### Option C: Multi-Account Configuration

For managing multiple accounts:

```bash
# Configure work account
openclaw config set channels.chatu.accounts.work.accountId "work"
openclaw config set channels.chatu.accounts.work.apiUrl "https://work-api.example.com"
openclaw config set channels.chatu.accounts.work.accessToken "work-token"

# Configure personal account
openclaw config set channels.chatu.accounts.personal.accountId "personal"
openclaw config set channels.chatu.accounts.personal.apiUrl "https://personal-api.example.com"
openclaw config set channels.chatu.accounts.personal.accessToken "personal-token"
```

### Step 3: Restart Gateway

After configuration, restart the OpenClaw gateway to load changes:

```bash
# Restart gateway
openclaw gateway restart

# Or stop and start manually
openclaw gateway stop
openclaw gateway start
```

### Step 4: Verify Configuration

```bash
# Check channel configuration
openclaw config get channels.chatu

# View gateway logs
openclaw logs | tail -50

# Check OpenClaw health status
openclaw health
```

### Development Mode Setup

For plugin development with hot-reload:

```bash
# 1. Install in development mode
cd /path/to/webhub
openclaw plugins install -l .

# 2. Start TypeScript watch mode (auto-compile on changes)
npm run watch

# 3. Configure as normal (see Step 2)

# 4. After code changes, restart gateway
openclaw gateway restart

# 5. View logs for debugging
openclaw logs
```

### Troubleshooting

**Plugin not loading?**
- Check if plugin is installed: `openclaw plugins list`
- Verify dist/ directory exists and contains compiled files
- Restart gateway after installation: `openclaw gateway restart`

**Configuration not taking effect?**
- Verify configuration: `openclaw config get channels.chatu`
- Check for syntax errors in `~/.openclaw/openclaw.json`
- View gateway logs for errors: `openclaw logs`

**Connection issues?**
- Verify apiUrl is accessible
- Check accessToken is valid
- Increase timeout if needed: `openclaw config set channels.chatu.timeout 60000`
- Check logs for detailed error messages

## Documentation

For detailed documentation, see:
- [Installation Guide](INSTALL.md) | [安装指南](INSTALL.zh.md)
- [Channel Documentation](docs/channel/README.md)
- [OpenClaw Plugin Docs](https://docs.openclaw.ai/plugin)

## Publishing to npm

This project uses GitHub Actions to automatically publish to npm. See the [publish workflow](.github/workflows/publish.yml) for details.

**Setting up the required npm Secret:**

1. Log in to [npmjs.com](https://www.npmjs.com) and generate an **Automation** Access Token
2. Add a Secret in your GitHub repository: `Settings → Secrets and variables → Actions → New repository secret`
3. Secret name: `NPM_TOKEN`, value: your npm Access Token

**How to publish a new version:**

```bash
# Bump patch version and publish (e.g. 0.1.0 → 0.1.1)
npm run release:patch

# Bump minor version and publish (e.g. 0.1.0 → 0.2.0)
npm run release:minor

# Bump major version and publish (e.g. 0.1.0 → 1.0.0)
npm run release:major
```

Running a `release:*` script bumps the version in `package.json`, creates a git tag, and pushes it — which triggers the GitHub Actions workflow to build and publish to npm.

## License

MIT
