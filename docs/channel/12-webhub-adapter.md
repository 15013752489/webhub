# WebHub Adapter Usage Guide

How to use the WebHub Adapter with automatic performance degradation.

## Quick Start

### 1. Install

```bash
npm install @openclaw/channel-sdk
```

### 2. Configure Channel (Set webhubUrl in config)

```typescript
import { Channel, ChannelConfig } from '@openclaw/channel-sdk';
import { WebHubAdapter } from '@openclaw/channel-sdk/adapters/webhub';

interface MyConfig extends ChannelConfig {
  /** WebHub Backend URL - 配置时设置 */
  webhubUrl: string;
  /** Channel ID */
  channelId: string;
  /** Access Token */
  accessToken: string;
}

class MyChannel extends Channel<MyConfig> {
  protected createConnectionAdapter(config: MyConfig) {
    return new WebHubAdapter(config);
  }
}

// 使用时配置 webhubUrl
const channel = new MyChannel({
  webhubUrl: 'http://localhost:3000',  // 从配置获取
  channelId: 'wh_ch_xxx',
  accessToken: 'wh_xxx',
});
```

## Configuration (Set in config.webhubUrl)

**URL 从配置中获取，不要写死：**

```typescript
// ✅ 正确：从配置获取
const adapter = new WebHubAdapter({
  webhubUrl: config.webhubUrl,  // 从 config.webhubUrl 获取
  channelId: 'wh_ch_xxx',
  accessToken: 'token_xxx',
});

// ❌ 错误：不要写死 URL
const adapter = new WebHubAdapter({
  baseUrl: 'http://localhost:3000',  // 不要这样写
  channelId: 'wh_ch_xxx',
  accessToken: 'token_xxx',
});
```

## API Reference

### WebHubAdapterConfig

```typescript
const adapter = new WebHubAdapter({
  webhubUrl: 'http://localhost:3000',  // 从配置获取 URL
  channelId: 'wh_ch_xxx',
  accessToken: 'token_xxx',
  
  // 可选配置
  preferredMode: 'websocket',  // 首选模式
  wsPath: '/ws',               // WebSocket 路径
  ssePath: '/api/channel/events', // SSE 路径
  pollInterval: 5000,           // 轮询间隔 (ms)
  heartbeatInterval: 30000,      // 心跳间隔 (ms)
  maxReconnectAttempts: 3,      // 最大重连次数
});
```

### Properties

```typescript
adapter.status;  // 'connected' | 'disconnected' | 'error'
adapter.mode;     // 'websocket' | 'sse' | 'polling'
```

### Methods

```typescript
await adapter.connect();              // 连接 (自动选择最佳模式)
await adapter.send(message);           // 发送消息
await adapter.disconnect();            // 断开连接
adapter.onMessage(callback);          // 订阅消息
adapter.onStatusChange(callback);     // 订阅状态变化
const stats = await adapter.getStats(); // 获取统计
```

## Performance Degradation Flow

```
connect()
    ↓
try WebSocket ✓ → connected (websocket mode) ← 最佳
    ↓ ✗
try SSE ✓ → connected (sse mode) ← 中等
    ↓ ✗
fallback Polling → connected (polling mode) ← 基础
```

## Mode Detection

```typescript
adapter.onStatusChange((status, error) => {
  if (status === 'connected') {
    console.log(`Connected using ${adapter.mode} mode`);
    
    switch (adapter.mode) {
      case 'websocket':
        console.log('最佳性能!');
        break;
      case 'sse':
        console.log('良好性能，SSE 模式');
        break;
      case 'polling':
        console.log('基础性能，轮询模式');
        break;
    }
  }
});
```

## WebHub Backend API

The adapter calls these APIs (URL from config.webhubUrl):

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `{webhubUrl}/api/channel/register` | Register channel |
| POST | `{webhubUrl}/api/channel/connect` | Connect to hub |
| POST | `{webhubUrl}/api/channel/disconnect` | Disconnect |
| POST | `{webhubUrl}/api/channel/messages` | Send message |
| WS | `{webhubUrl}/ws` | WebSocket |
| GET | `{webhubUrl}/api/channel/events` | SSE |
| POST | `{webhubUrl}/api/channel/webhook` | Polling |
| POST | `{webhubUrl}/api/channel/heartbeat` | Heartbeat |

## Related Documentation

- [Channel SDK Overview](../01-overview.md)
- [Message Schema](../02-message-schema.md)
- [WebHub Backend API](https://github.com/chatu-ai/chatu-web-hub-service/docs/api/channel-api.en.md)
