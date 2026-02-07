# WebHub Adapter Usage Guide

How to use the WebHub Adapter with automatic performance degradation.

## Overview

The WebHub Adapter supports **graceful degradation** from high performance to low performance:

| Mode | Performance | Latency | Use Case |
|------|-------------|---------|-----------|
| **WebSocket** | ⭐⭐⭐⭐⭐ Highest | Real-time | High-frequency messaging |
| **SSE** | ⭐⭐⭐⭐ High | ~100ms | Receiving messages only |
| **Polling** | ⭐ Lowest | 5s+ | Low-resource environments |

The adapter automatically tries WebSocket first, falls back to SSE, then Polling.

## Quick Start

### 1. Install

```bash
npm install @openclaw/channel-sdk
```

### 2. Basic Usage

```typescript
import { WebHubAdapter, createWebHubFactory } from '@openclaw/channel-sdk/adapters/webhub';

const adapter = new WebHubAdapter({
  baseUrl: 'http://localhost:3000',
  channelId: 'wh_ch_xxx',
  secret: 'wh_secret_xxx',
});

// Listen for messages
adapter.onMessage((message) => {
  console.log('Received:', message);
});

// Listen for status changes
adapter.onStatusChange((status, error) => {
  console.log('Status:', status, 'Mode:', adapter.mode);
});

// Connect (auto selects best mode)
await adapter.connect();

// Send messages
await adapter.send({
  target: { type: 'user', id: 'user-123' },
  content: { text: 'Hello!' },
});

// Get connection stats
const stats = await adapter.getStats();
console.log('Mode:', stats.mode);

// Disconnect
await adapter.disconnect();
```

### 3. Using Factory with Custom Mode

```typescript
import { createWebHubFactory } from '@openclaw/channel-sdk/adapters/webhub';

// Force specific mode or configure degradation
const factory = createWebHubFactory('http://localhost:3000', {
  preferred: 'websocket',  // Try WebSocket first
  websocket: {
    maxRetries: 3,
    retryInterval: 1000,
  },
  sse: {
    maxRetries: 2,
  },
  polling: {
    interval: 5000,  // Poll every 5 seconds
  },
});

const adapter = factory.createConnectionAdapter({
  channelId: 'wh_ch_xxx',
  secret: 'wh_secret_xxx',
});
```

## Performance Degradation Flow

```
connect()
    ↓
try WebSocket ✓ → connected (websocket mode)
    ↓ ✗
try SSE ✓ → connected (sse mode)
    ↓ ✗
fallback Polling → connected (polling mode)
```

## API Reference

### WebHubAdapter

```typescript
const adapter = new WebHubAdapter({
  baseUrl: 'http://localhost:3000',
  channelId: 'wh_ch_xxx',
  secret: 'wh_secret_xxx',
  preferredMode: 'websocket',  // Force preferred mode
  wsPath: '/ws',                // Custom WebSocket path
  ssePath: '/api/channel/events', // Custom SSE path
  pollInterval: 5000,           // Polling interval (ms)
  heartbeatInterval: 30000,      // Heartbeat interval (ms)
  maxReconnectAttempts: 3,      // Max reconnection attempts
});

// Properties
adapter.status;   // 'connected' | 'disconnected' | 'error'
adapter.mode;      // 'websocket' | 'sse' | 'polling'

// Methods
await adapter.connect();
await adapter.send(message);
await adapter.disconnect();
adapter.onMessage(callback);
adapter.onStatusChange(callback);
const stats = await adapter.getStats();
```

### PerformanceModeConfig

```typescript
const config: PerformanceModeConfig = {
  preferred: 'websocket',  // Try WebSocket first
  
  websocket: {
    maxRetries: 3,        // Max WebSocket retry attempts
    retryInterval: 1000,   // Retry interval (ms)
  },
  
  sse: {
    maxRetries: 2,        // Max SSE retry attempts
  },
  
  polling: {
    interval: 5000,       // Poll interval (ms)
  },
};
```

## Message Flow by Mode

### WebSocket Mode (Real-time Bidirectional)

```
Website ↔ WebSocket ↔ WebHub Backend ↔ OpenClaw

- Bidirectional real-time communication
- Lowest latency (~10ms)
- Single connection for send/receive
```

### SSE Mode (HTTP Push + HTTP Send)

```
Website → HTTP POST → WebHub Backend ↔ OpenClaw
Website ← SSE ← WebHub Backend

- Server-Sent Events for receiving
- HTTP POST for sending
- Good for receiving-only scenarios
```

### Polling Mode (HTTP Only)

```
Website → HTTP POST → WebHub Backend ↔ OpenClaw
Website ← HTTP GET ← WebHub Backend

- Simple HTTP requests
- Higher latency (poll interval)
- Works in restrictive environments
```

## Mode Detection

You can detect and respond to mode changes:

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
        console.log('Low performance, polling mode');
        console.log('Consider enabling WebSocket support');
        break;
    }
  }
});
```

## Error Handling

```typescript
try {
  await adapter.connect();
} catch (error) {
  console.error('Connection failed:', error);
}

// Reconnection with mode detection
adapter.onStatusChange((status, error) => {
  if (status === 'disconnected') {
    // Auto-reconnect will be attempted
    console.log('Disconnected, mode:', adapter.mode);
    
    if (adapter.mode === 'polling') {
      console.log('Consider checking WebSocket support');
    }
  }
});
```

## Configuration Examples

### High Performance (Prefer WebSocket)

```typescript
const adapter = new WebHubAdapter({
  baseUrl: 'http://localhost:3000',
  channelId: 'wh_ch_xxx',
  secret: 'wh_secret_xxx',
  preferredMode: 'websocket',
  heartbeatInterval: 30000,
  maxReconnectAttempts: 5,
});
```

### Balanced (Allow All Modes)

```typescript
const adapter = new WebHubAdapter({
  baseUrl: 'http://localhost:3000',
  channelId: 'wh_ch_xxx',
  secret: 'wh_secret_xxx',
  preferredMode: 'websocket',
  heartbeatInterval: 30000,
  pollInterval: 5000,
});
```

### Low Resource (Force Polling)

```typescript
const adapter = new WebHubAdapter({
  baseUrl: 'http://localhost:3000',
  channelId: 'wh_ch_xxx',
  secret: 'wh_secret_xxx',
  preferredMode: 'polling',  // Force polling
  heartbeatInterval: 60000, // Longer heartbeat
  pollInterval: 10000,      // Slower polling
});
```

## WebHub Backend API

The adapter calls these WebHub Backend APIs:

| Method | Endpoint | Used By | Description |
|--------|----------|---------|-------------|
| POST | `/api/channel/register` | All | Register channel |
| POST | `/api/channel/connect` | All | Connect to hub |
| POST | `/api/channel/disconnect` | All | Disconnect |
| POST | `/api/channel/messages` | All | Send message |
| GET | `/api/channel/events` | SSE | Subscribe to events |
| WS | `/ws` | WebSocket | Real-time connection |
| POST | `/api/channel/webhook` | Polling | Poll for messages |
| POST | `/api/channel/heartbeat` | All | Send heartbeat |

See [Channel API Docs](https://github.com/chatu-ai/chatu-web-hub-service/docs/api/channel-api.en.md) for details.

## Related Documentation

- [Channel SDK Overview](../01-overview.md)
- [Message Schema](../02-message-schema.md)
- [WebHub Backend API](https://github.com/chatu-ai/chatu-web-hub-service/docs/api/channel-api.en.md)
