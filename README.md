# OpenClaw Chatu Channel Plugin

Official OpenClaw channel plugin for connecting to any website via HTTP/WebSocket.

## What is Chatu Channel?

Chatu is a flexible channel plugin that enables OpenClaw to communicate with any HTTP/WebSocket-based messaging service. It provides a universal interface for connecting OpenClaw to custom web applications.

## Quick Start

### 1. Install

```bash
openclaw plugins install @openclaw/chatu
```

### 2. Configure

Add to your OpenClaw configuration:

```json
{
  "channels": {
    "chatu": {
      "enabled": true,
      "apiUrl": "https://your-api.example.com",
      "accessToken": "your-access-token"
    }
  }
}
```

### 3. Use

The channel will automatically handle message routing once configured.

## Features

- 🔌 Universal HTTP/WebSocket connectivity
- 🔐 Secure token-based authentication
- 📝 Support for text, images, and file attachments
- 👥 Direct messages and group chat support
- 🔄 Message editing and deletion
- 💬 Reply threading

## Configuration

### Basic Configuration

```json
{
  "channels": {
    "chatu": {
      "enabled": true,
      "apiUrl": "https://api.example.com",
      "accessToken": "your-token",
      "timeout": 30000
    }
  }
}
```

### Multi-Account Configuration

```json
{
  "channels": {
    "chatu": {
      "accounts": {
        "work": {
          "accountId": "work",
          "apiUrl": "https://work-api.example.com",
          "accessToken": "work-token"
        },
        "personal": {
          "accountId": "personal",
          "apiUrl": "https://personal-api.example.com",
          "accessToken": "personal-token"
        }
      }
    }
  }
}
```

## Documentation

For detailed documentation, see:
- [Installation Guide](INSTALL.md)
- [Channel Documentation](docs/channel/README.md)
- [OpenClaw Plugin Docs](https://docs.openclaw.ai/plugin)

## License

MIT
