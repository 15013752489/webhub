# WebHub Adapter Usage Guide

How to use the WebHub HTTP Adapter to connect to WebHub Backend.

## Quick Start

### 1. Install

```bash
npm install @openclaw/channel-sdk
```

### 2. Create a Channel with WebHub Adapter

```typescript
import { Channel, ChannelConfig } from '@openclaw/channel-sdk';
import { WebHubHttpAdapter, createWebHubFactory } from '@openclaw/channel-sdk/adapters/webhub';

interface MyConfig extends ChannelConfig {
  /** WebHub Backend URL */
  baseUrl: string;
  /** Channel ID */
  channelId: string;
  /** Channel Secret */
  secret: string;
}

class MyChannel extends Channel<MyConfig> {
  protected createConnectionAdapter(config: MyConfig) {
    const factory = createWebHubFactory(config.baseUrl);
    return factory.createConnectionAdapter(config);
  }
}
```

### 3. Register and Connect

```typescript
const channel = new MyChannel({
  baseUrl: 'http://localhost:3000',
  channelId: 'wh_ch_xxx',
  secret: 'wh_secret_xxx',
});

// Connect to WebHub
await channel.connect();

// Send messages
await channel.send({
  target: { type: 'user', id: 'user-123' },
  content: { text: 'Hello from WebHub!' },
});

// Listen for messages
channel.onMessage((message) => {
  console.log('Received:', message);
});

// Disconnect
await channel.disconnect();
```

## API Reference

### WebHubHttpAdapter

```typescript
const adapter = new WebHubHttpAdapter({
  baseUrl: 'http://localhost:3000',
  channelId: 'wh_ch_xxx',
  secret: 'wh_secret_xxx',
  accessToken: 'wh_xxx', // Optional, will be obtained via register
  heartbeatInterval: 30000,
  maxReconnectAttempts: 3,
});

// Events
adapter.onMessage((message) => {
  console.log('Received:', message);
});

adapter.onStatusChange((status, error) => {
  console.log('Status:', status, error);
});

// Connect
await adapter.connect();

// Send message
const result = await adapter.send({
  target: { type: 'user', id: 'user-123' },
  content: { text: 'Hello!' },
});

// Get stats
const stats = await adapter.getStats();

// Disconnect
await adapter.disconnect();
```

### WebHubAdapterFactory

```typescript
const factory = createWebHubFactory('http://localhost:3000');

// Create connection adapter
const adapter = factory.createConnectionAdapter({
  channelId: 'wh_ch_xxx',
  secret: 'wh_secret_xxx',
});

// Create other adapters
const messageAdapter = factory.createMessageAdapter();
const heartbeatAdapter = factory.createHeartbeatAdapter();
const authAdapter = factory.createAuthAdapter();
const capabilitiesAdapter = factory.createCapabilitiesAdapter();
const loggerAdapter = factory.createLoggerAdapter();
```

## WebHub Backend API

The adapter calls these WebHub Backend APIs:

| Method | Endpoint | Description |
|--------|
| POST ||----------|------------- `/api/channel/register` | Register channel |
| POST | `/api/channel/connect` | Connect to hub |
| POST | `/api/channel/disconnect` | Disconnect from hub |
| POST | `/api/channel/messages` | Send message to OpenClaw |
| POST | `/api/channel/webhook` | Receive messages (polling) |
| POST | `/api/channel/heartbeat` | Send heartbeat |

See [Channel API Docs](https://github.com/chatu-ai/chatu-web-hub-service/docs/api/channel-api.en.md) for details.

## Message Flow

```
Website Server → WebHubHttpAdapter → WebHub Backend → OpenClaw
                   ↑↓
              WebSocket/HTTP
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | string | `'http://localhost:3000'` | WebHub Backend URL |
| `channelId` | string | Required | Channel ID |
| `secret` | string | Required | Channel secret |
| `accessToken` | string | `undefined` | Access token (auto-obtained) |
| `heartbeatInterval` | number | `30000` | Heartbeat interval (ms) |
| `maxReconnectAttempts` | number | `3` | Max reconnection attempts |

## Example: Full Channel Implementation

```typescript
import { Channel, ChannelConfig, OutboundMessage, InboundMessage } from '@openclaw/channel-sdk';
import { WebHubHttpAdapter } from '@openclaw/channel-sdk/adapters/webhub';

interface WebHubChannelConfig extends ChannelConfig {
  baseUrl: string;
  channelId: string;
  secret: string;
}

export class WebHubChannel extends Channel<WebHubChannelConfig> {
  protected createConnectionAdapter(config: WebHubChannelConfig): WebHubHttpAdapter {
    return new WebHubHttpAdapter({
      ...config,
      baseUrl: config.baseUrl || 'http://localhost:3000',
    });
  }

  async onConnect(): Promise<void> {
    console.log('Connected to WebHub');
  }

  async onDisconnect(): Promise<void> {
    console.log('Disconnected from WebHub');
  }

  async onMessage(message: InboundMessage): Promise<void> {
    console.log('Message received:', message);
  }

  async onError(error: Error): Promise<void> {
    console.error('Error:', error);
  }
}

// Usage
const channel = new WebHubChannel({
  baseUrl: process.env.WEBHUB_URL || 'http://localhost:3000',
  channelId: process.env.CHANNEL_ID || 'wh_ch_xxx',
  secret: process.env.CHANNEL_SECRET || 'wh_secret_xxx',
  autoReconnect: true,
});

channel.onMessage(async (message) => {
  // Process message
  await channel.send({
    target: message.sender,
    content: { text: `Echo: ${message.content.text}` },
  });
});

await channel.connect();
```

## Related Documentation

- [Channel SDK Overview](../01-overview.md)
- [Message Schema](../02-message-schema.md)
- [WebHub Backend API](https://github.com/chatu-ai/chatu-web-hub-service/docs/api/channel-api.en.md)
