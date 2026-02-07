# WebHub Adapter Usage Guide

Connect your website to WebHub Backend with just **two parameters**.

## Overview

The WebHub Adapter connects a website to the WebHub Backend using:

| Parameter | Description | Required |
|-----------|-------------|----------|
| `webhubUrl` | WebHub Backend deployment URL | ✅ Yes |
| `accessToken` | Channel secret/key | ✅ Yes |
| `channelId` | Channel identifier | ✅ Yes |

**One WebHub Backend → Multiple Channels**

```
WebHub Backend (https://webhub.xiaolai.com)
├── Channel #1 (channelId: wh_001, secret: xxx) → Website A
├── Channel #2 (channelId: wh_002, secret: yyy) → Website B
└── Channel #3 (channelId: wh_003, secret: zzz) → Website C
```

## Quick Start

### 1. Install

```bash
npm install @openclaw/channel-sdk
```

### 2. Connect to WebHub

```typescript
import { Channel, ChannelConfig } from '@openclaw/channel-sdk';
import { WebHubAdapter } from '@openclaw/channel-sdk/adapters/webhub';

// Required: webhubUrl + accessToken (secret)
const channel = new Channel({
  webhubUrl: 'https://webhub.xiaolai.com',  // WebHub deployment URL
  channelId: 'wh_ch_xxx',                    // Channel ID from admin panel
  accessToken: 'secret_from_channel_page',   // Secret from admin panel
});

// Listen for messages
channel.onMessage((message) => {
  console.log('Received:', message);
});

// Connect
await channel.connect();

// Send message
await channel.send({
  target: { type: 'user', id: 'user-123' },
  content: { text: 'Hello!' },
});

// Disconnect
await channel.disconnect();
```

## Configuration

### Required Parameters

```typescript
interface ConnectionConfig {
  /** WebHub Backend URL - required */
  webhubUrl: string;
  
  /** Channel ID - required */
  channelId: string;
  
  /** Channel secret/key - required */
  accessToken: string;
}
```

### Optional Parameters

```typescript
interface ConnectionConfig {
  // ... required parameters above
  
  // Optional
  preferredMode?: 'websocket' | 'sse' | 'polling';
  wsPath?: string;
  ssePath?: string;
  pollInterval?: number;
  heartbeatInterval?: number;
  maxReconnectAttempts?: number;
}
```

## Architecture

```
Website SDK                    WebHub Backend
     │                              │
     │  1. register                 │
     │ ──────────────────────────────→│
     │  (channelId + secret)         │
     │                              │
     │  2. connect                   │
     │ ──────────────────────────────→│
     │                              │
     │  3. send messages             │
     │ ──────────────────────────────→│
     │                              │
     │  4. receive messages          │
     │ ←─────────────────────────────│
     │  (WebSocket / SSE / Polling)  │
```

## API Reference

### WebHubAdapter

```typescript
const adapter = new WebHubAdapter({
  webhubUrl: 'https://webhub.xiaolai.com',  // REQUIRED
  channelId: 'wh_ch_xxx',                     // REQUIRED
  accessToken: 'secret_xxx',                  // REQUIRED
  
  // Optional
  preferredMode: 'websocket',
  wsPath: '/ws',
  ssePath: '/api/channel/events',
  pollInterval: 5000,
  heartbeatInterval: 30000,
  maxReconnectAttempts: 3,
});
```

### Properties

```typescript
adapter.status;  // 'connected' | 'disconnected' | 'error'
adapter.mode;     // 'websocket' | 'sse' | 'polling'
```

### Methods

```typescript
await adapter.connect();              // Connect (auto-selects best mode)
await adapter.send(message);           // Send message
await adapter.disconnect();            // Disconnect
adapter.onMessage(callback);          // Subscribe to messages
adapter.onStatusChange(callback);     // Subscribe to status changes
const stats = await adapter.getStats(); // Get statistics
```

## Performance Degradation Flow

```
connect()
    ↓
try WebSocket ✓ → connected (websocket mode) ← Best
    ↓ ✗
try SSE ✓ → connected (sse mode) ← Good
    ↓ ✗
fallback Polling → connected (polling mode) ← Basic
```

## Mode Detection

```typescript
adapter.onStatusChange((status, error) => {
  if (status === 'connected') {
    console.log(`Connected using ${adapter.mode} mode`);
    
    switch (adapter.mode) {
      case 'websocket':
        console.log('Best performance!');
        break;
      case 'sse':
        console.log('Good performance, SSE mode');
        break;
      case 'polling':
        console.log('Basic performance, polling mode');
        break;
    }
  }
});
```

## WebHub Backend API

The adapter calls these APIs using `{webhubUrl}`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `{webhubUrl}/api/channel/register` | Register channel |
| POST | `{webhubUrl}/api/channel/connect` | Connect to hub |
| POST | `{webhubUrl}/api/channel/disconnect` | Disconnect |
| POST | `{webhubUrl}/api/channel/messages` | Send message |
| WS | `{webhubUrl}/ws` | WebSocket connection |
| GET | `{webhubUrl}/api/channel/events` | SSE events |
| POST | `{webhubUrl}/api/channel/webhook` | Poll for messages |
| POST | `{webhubUrl}/api/channel/heartbeat` | Heartbeat |

## Related Documentation

- [Channel SDK Overview](../01-overview.md)
- [Message Schema](../02-message-schema.md)
- [WebHub Backend API](https://github.com/chatu-ai/chatu-web-hub-service/docs/api/channel-api.en.md)
