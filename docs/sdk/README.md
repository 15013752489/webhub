# OpenClaw Channel SDK 讨论

> **状态**: 讨论中  
> **基于**: openclaw-web-hub-channel

---

## 1. 背景

Channel SDK 用于帮助开发者构建自定义的 OpenClaw 通道插件。

## 2. 现有结构

```
openclaw-web-hub-channel/
├── docs/
│   ├── channel/           # WebHub Channel 文档
│   ├── webhub/            # WebHub API 设计
│   └── frontend/          # WebHub Manager 前端
└── src/                   # (待添加 SDK 代码)
```

## 3. Channel SDK 应该包含什么？

### 3.1 核心接口

```typescript
interface ChannelPlugin {
  /** 通道 ID */
  id: string;
  
  /** 发送消息 */
  send(message: OutboundMessage): Promise<SendResult>;
  
  /** 接收消息 */
  onMessage(callback: MessageCallback): void;
  
  /** 生命周期 */
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

### 3.2 消息类型

```typescript
interface InboundMessage {
  id: string;
  channel: string;
  authorId: string;
  authorName?: string;
  content: string;
  timestamp: number;
  media?: Media[];
}

interface OutboundMessage {
  target: string;
  content: string;
  media?: Media[];
}
```

## 4. 讨论问题

### Q1: SDK 应该放在哪个目录？

**方案 A**: `src/sdk/`
```
src/
├── sdk/           # Channel SDK
├── channel/      # WebHub Channel 实现
└── ...
```

**方案 B**: 独立包 `@openclaw/channel-sdk`
```
packages/
├── sdk/          # @openclaw/channel-sdk
└── webhub/       # @openclaw/webhub
```

### Q2: SDK 依赖关系？

- **方案 A**: 无依赖，独立使用
- **方案 B**: 依赖 `@openclaw/core`
- **方案 C**: 作为插件模板

### Q3: 需要哪些扩展点？

| 扩展点 | 说明 |
|--------|------|
| `beforeSend` | 发送前处理 |
| `afterSend` | 发送后回调 |
| `messageParse` | 消息解析 |
| `errorHandler` | 错误处理 |

## 5. 建议结构

```
openclaw-web-hub-channel/
├── src/
│   ├── sdk/                      # Channel SDK
│   │   ├── index.ts              # 入口
│   │   ├── types/               # 类型定义
│   │   │   ├── channel.ts       # 通道接口
│   │   │   ├── message.ts       # 消息类型
│   │   │   └── config.ts        # 配置类型
│   │   │
│   │   ├── core/                # 核心类
│   │   │   ├── Channel.ts      # 通道基类
│   │   │   ├── Message.ts      # 消息处理
│   │   │   └── Plugin.ts       # 插件基类
│   │   │
│   │   ├── adapters/           # 适配器
│   │   │   ├── HttpAdapter.ts  # HTTP 适配
│   │   │   ├── WebSocketAdapter.ts
│   │   │   └── StorageAdapter.ts
│   │   │
│   │   └── utils/              # 工具函数
│   │
│   ├── channel/                 # WebHub Channel 实现
│   │   └── ...
│   │
│   └── index.ts
│
├── docs/
│   ├── sdk/                    # SDK 文档
│   └── ...
│
└── package.json
```

## 6. 开发计划

- [ ] 确定 SDK 目录结构
- [ ] 定义核心类型
- [ ] 实现基类
- [ ] 添加适配器
- [ ] 编写文档

---

## 反馈

请提出你的建议！
