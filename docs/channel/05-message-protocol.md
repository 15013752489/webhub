# Chatu Channel Plugin - 消息协议规范

> **上一节**：[04-api-reference.md](04-api-reference.md)  
> **下一节**：[06-security.md](06-security.md)

本文档描述 Chatu 插件与 WebHub 后端之间交换的消息格式。

---

## 1. 入站消息格式（WebHub 后端 → 插件）

通过 WebSocket 推送给插件的消息格式：

```typescript
interface InboundMessage {
  /** 消息唯一 ID */
  id: string;

  /** 消息文本内容 */
  content: {
    text: string;
    format?: string;
  };

  /** 发送者信息 */
  sender: {
    id: string;
    displayName?: string;
  };

  /** 消息时间戳（毫秒） */
  timestamp: number;

  /** 消息角色（可选，'agent' 表示来自人工操作员） */
  role?: 'agent' | string;

  /** 媒体附件（可选） */
  media?: Array<{
    type: string;
    url: string;
  }>;
}
```

### 示例

```json
{
  "id": "msg-abc123",
  "content": {
    "text": "你好，我有一个问题"
  },
  "sender": {
    "id": "user-456",
    "displayName": "张三"
  },
  "timestamp": 1708139100000
}
```

### `role: 'agent'` 的处理

当 `role` 为 `"agent"` 时，消息来源为 WebHub 前端的人工操作员，插件会以 sender ID `webhub-agent` 派发到 OpenClaw AI。普通用户消息 `role` 字段为空。

---

## 2. 出站消息格式（AI → WebHub 后端）

插件调用 `POST /api/channel/messages` 发送 AI 回复：

```typescript
interface OutboundMessage {
  /** 插件生成的消息 ID（格式：msg_{timestamp}_{random}） */
  messageId: string;

  /** 目标接收者 */
  target: {
    type: 'user';
    id: string;  // 用户 ID（与入站 sender.id 对应）
  };

  /** 消息内容 */
  content: {
    text: string;
    format: 'plain';  // 当前固定为 plain
  };

  /** 消息时间戳（毫秒） */
  timestamp: number;

  /** 消息角色（固定为 'ai'） */
  role: 'ai';

  /** 回复引用（可选） */
  replyTo?: {
    id: string;  // 被回复的消息 ID
  };

  /** 媒体附件（可选） */
  media?: Array<{
    type: string;  // 如 'image', 'file'
    url: string;
  }>;

  /** 消息类型（可选，由后端扩展使用） */
  messageType?: string;

  /** 元数据（可选，用于去重等） */
  metadata?: {
    dedupId?: string;   // OpenClaw 内部消息 ID，用于跨频道去重
    [key: string]: unknown;
  };
}
```

### 示例

```json
{
  "messageId": "msg_1708139100000_a3f7b",
  "target": {
    "type": "user",
    "id": "user-456"
  },
  "content": {
    "text": "您好！我来为您解答。",
    "format": "plain"
  },
  "timestamp": 1708139102000,
  "role": "ai",
  "replyTo": {
    "id": "msg-abc123"
  }
}
```

---

## 3. 流式消息格式

当 AI 以流式方式生成回复时，插件通过以下两个端点分块发送：

### 3.1 单个分块（`POST /api/channel/stream/chunk`）

```json
{
  "messageId": "msg_1708139100000_a3f7b",
  "seq": 1,
  "delta": "您好！"
}
```

| 字段 | 说明 |
|------|------|
| `messageId` | 本次流式回复的消息 ID（全程保持不变） |
| `seq` | 分块序号，从 1 开始递增 |
| `delta` | 本次分块的文本增量 |

### 3.2 流式完成（`POST /api/channel/stream/done`）

```json
{
  "messageId": "msg_1708139100000_a3f7b",
  "totalSeq": 5
}
```

---

## 4. 会话 Key 推导规则

OpenClaw 通过以下规则将 `senderId` 映射到唯一会话 Key，相同 `senderId` + `accountId` + `channelId` 始终映射到同一会话：

```
sessionKey = resolveAgentRoute({
  channel: 'chatu',
  accountId: accountId,
  peer: { kind: 'direct', id: senderId }
})
```

这意味着：
- 同一用户（`senderId` 相同）在同一账户下始终共享同一 AI 会话
- 重置会话就是删除该 `sessionKey` 对应的 transcript 文件

---

## 5. Slash 命令授权规则

消息文本以 `/` 开头时，OpenClaw 会将其标记为授权命令（`CommandAuthorized: true`），允许执行 agent slash-commands。普通消息不授权命令执行。

---

*最后更新: 2026-02-25*
