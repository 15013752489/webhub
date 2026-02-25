# Chatu Channel Plugin - API 接口参考

> **上一节**：[03-capabilities.md](03-capabilities.md)  
> **下一节**：[05-message-protocol.md](05-message-protocol.md)

本文档描述 Chatu 插件**调用 WebHub 后端**的所有 HTTP/WebSocket 接口。WebHub 后端开发者需要实现这些接口。

---

## 认证方式（通用规则）

大多数接口通过以下请求头认证：

```http
X-Channel-Token: {accessToken}
X-Channel-ID: {channelId}
```

部分接口使用：

```http
x-access-token: {accessToken}
```

或：

```http
Authorization: Bearer {accessToken}
```

具体认证头见各接口说明。

---

## 1. 健康检查

### `GET /health`

检查后端服务是否可达（心跳探测使用）。

**请求头**：无

**响应示例**：
```json
{ "status": "ok", "timestamp": "2026-02-25T10:00:00.000Z" }
```

---

## 2. 注册 / 连接管理

### `POST /api/channel/quick-register`

环境变量方式自动注册，获取频道凭证。

**请求头**：无

**请求体**：
```json
{
  "key": "your-registration-key",
  "url": "https://your-webhub.example.com"
}
```

**响应**：
```json
{
  "data": {
    "channelId": "wh_ch_xxxxxx",
    "accessToken": "wh_xxxxxxxxxxxxxxxx"
  }
}
```

---

### `POST /api/channel/connect`

插件启动时通知后端建立连接。

**请求头**：
```http
x-access-token: {accessToken}
```

**请求体**：
```json
{
  "channelId": "wh_ch_xxxxxx",
  "pluginVersion": "0.1.0",
  "workingDir": "/home/user"
}
```

---

### `POST /api/channel/disconnect`

插件停止时通知后端断开连接。

**请求头**：
```http
x-access-token: {accessToken}
```

**请求体**：
```json
{
  "channelId": "wh_ch_xxxxxx"
}
```

---

## 3. 实时连接（WebSocket）

### `GET /api/channel/ws` ← WebSocket 升级

插件主连接方式，通过 WebSocket 实时接收用户消息。

**协议**：`ws://` 或 `wss://`（由 `apiUrl` 的 http/https 自动转换）

**认证**：连接时携带 `accessToken` 和 `channelId`（具体参数由后端实现决定）

**后端推送消息格式**：见 [05-message-protocol.md](05-message-protocol.md)

---

## 4. 消息收发

### `POST /api/channel/messages`

插件向后端发送 AI 回复。

**请求头**：
```http
Content-Type: application/json
X-Channel-Token: {accessToken}
X-Channel-ID: {channelId}
```

**请求体**：见 [05-message-protocol.md#出站消息格式](05-message-protocol.md#2-出站消息格式ai--webhub-后端)

**响应**：
```json
{
  "success": true,
  "messageId": "msg_1234567_abc",
  "id": "internal-db-id",
  "deliveredAt": "2026-02-25T10:00:00.000Z"
}
```

---

### `POST /api/channel/messages/:messageId/ack`

确认消息已被插件处理（HTTP 轮询模式使用）。

**请求头**：
```http
Content-Type: application/json
X-Channel-Token: {accessToken}
```

---

## 5. 流式输出

### `POST /api/channel/stream/chunk`

发送流式 AI 回复的单个分块。

**请求头**：
```http
Content-Type: application/json
Authorization: Bearer {accessToken}
```

**请求体**：
```json
{
  "messageId": "msg_1234567_abc",
  "seq": 1,
  "delta": "Hello, "
}
```

---

### `POST /api/channel/stream/done`

通知后端流式回复已完成。

**请求头**：
```http
Content-Type: application/json
Authorization: Bearer {accessToken}
```

**请求体**：
```json
{
  "messageId": "msg_1234567_abc",
  "totalSeq": 5
}
```

---

## 6. 状态查询

### `GET /api/channel/status`

查询频道在后端的状态。

**请求头**：
```http
x-access-token: {accessToken}
X-Channel-ID: {channelId}
```

**响应**：
```json
{
  "data": {
    "status": "active"
  }
}
```

---

## 7. 输入中状态

### `POST /api/channel/typing`

通知后端 AI 正在处理（显示"正在输入"提示）。

**请求头**：
```http
Content-Type: application/json
X-Channel-Token: {accessToken}
```

**请求体**：
```json
{
  "channelId": "wh_ch_xxxxxx"
}
```

---

## 8. 会话命令

### `GET /api/channel/commands`

轮询获取后端下发的会话管理命令（在 HTTP 轮询模式末尾调用）。

**请求头**：
```http
X-Channel-Token: {accessToken}
X-Channel-ID: {channelId}
```

**查询参数**：`channelId={channelId}`

**响应**：
```json
{
  "data": {
    "commands": [
      {
        "id": "cmd_001",
        "commandType": "reset",
        "senderId": "user-123",
        "payload": null
      },
      {
        "id": "cmd_002",
        "commandType": "switch",
        "senderId": "user-456",
        "payload": {
          "targetSessionKey": "session_key_abc",
          "reason": "restore"
        }
      }
    ]
  }
}
```

命令类型：

| 类型 | 说明 |
|------|------|
| `reset` | 清空该用户的 OpenClaw 会话历史（删除 transcript 文件） |
| `switch` | 将用户切换到指定历史会话 |

---

### `POST /api/channel/commands/:commandId/ack`

确认命令执行结果。

**请求头**：
```http
Content-Type: application/json
X-Channel-Token: {accessToken}
```

**请求体**：
```json
{
  "success": true,
  "error": null,
  "channelId": "wh_ch_xxxxxx"
}
```

---

## 9. 跨频道中继

### `POST /api/channel/cross-channel-messages`

将来自其他 OpenClaw 频道的消息同步到 WebHub 前端显示。

**请求头**：
```http
Content-Type: application/json
X-Access-Token: {accessToken}
```

**请求体**：
```json
{
  "sourceChannel": "whatsapp",
  "direction": "inbound",
  "sender": {
    "id": "user-123",
    "name": "张三"
  },
  "content": "消息内容",
  "sessionKey": "session_key_xxx",
  "dedupId": "openclaw-msg-id"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `sourceChannel` | string | 来源频道 ID（如 `whatsapp`、`tui`） |
| `direction` | `"inbound"` \| `"outbound"` | `inbound` = AI 回复，`outbound` = 用户消息 |
| `sender.id` | string | 发送者 ID（可选） |
| `sender.name` | string | 发送者显示名 |
| `content` | string | 消息文本 |
| `sessionKey` | string | 来源频道的会话 Key |
| `dedupId` | string | OpenClaw 内部消息 ID（去重用，可选） |

---

## 10. HTTP 轮询（已废弃，仅参考）

### `GET /api/channel/messages/pending`

获取待处理的用户消息列表。当前版本使用 WebSocket 代替，此接口仅供参考。

**请求头**：
```http
X-Channel-Token: {accessToken}
X-Channel-ID: {accountId}
```

**查询参数**：`channelId={channelId}&after={isoTimestamp}`

**响应**：
```json
{
  "data": [
    {
      "id": "msg_001",
      "content": "用户消息内容",
      "sender": { "id": "user-123", "name": "张三" },
      "createdAt": "2026-02-25T10:00:00.000Z"
    }
  ]
}
```

---

*最后更新: 2026-02-25*
