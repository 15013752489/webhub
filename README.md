# OpenClaw Channel SDK

Official SDK for building custom OpenClaw channel plugins with HTTP/WebSocket support.

## What is Channel SDK?

Channel SDK provides **TypeScript interfaces and base classes** for building OpenClaw channel plugins that communicate via HTTP and/or WebSocket protocols.

## Quick Start

### 1. Install

```bash
npm install @openclaw/channel-sdk
```

### 2. Create a Channel

```typescript
import { Channel, ChannelConfig } from '@openclaw/channel-sdk';

interface MyConfig extends ChannelConfig {
  webhookUrl: string;
  accessToken: string;
}

class MyChannel extends Channel<MyConfig> {
  async send(message: OutboundMessage): Promise<SendResult> {
    // Implement HTTP/WebSocket sending logic
  }
}
```

### 3. Register with OpenClaw

```typescript
ChannelRegistry.register('my-channel', MyChannel);
```

## Documentation

| Document | Description |
|----------|-------------|
| [INSTALL.md](INSTALL.md) | Installation guide |
| [docs/channel/README.md](docs/channel/README.md) | Channel SDK documentation |

## Project Structure

```
openclaw-web-hub-channel/
├── README.md              # This file
├── INSTALL.md            # Installation guide
├── openclaw.plugin.json  # Plugin metadata
├── package.json          # npm package config
├── src/
│   └── sdk/              # Channel SDK implementation
│       ├── index.ts      # Main entry
│       ├── core/         # Core classes (Channel, Message, etc.)
│       ├── adapters/     # Protocol adapters (HTTP, WebSocket)
│       └── types/       # TypeScript types
└── docs/
    ├── channel/          # Channel SDK docs
    └── sdk/              # SDK design discussions
```

## Related Projects

| Project | Description |
|---------|-------------|
| [chatu-web-hub-service](https://github.com/chatu-ai/chatu-web-hub-service) | Reference backend implementation |
| [chatu-web-hub-front](https://github.com/chatu-ai/chatu-web-hub-front) | Reference frontend UI |

## License

MIT
