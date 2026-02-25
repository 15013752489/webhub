# Chatu Channel Plugin - 功能支持矩阵

> **上一节**：[02-configuration.md](02-configuration.md)  
> **下一节**：[04-api-reference.md](04-api-reference.md)

---

## 1. 核心能力

| 能力 | 支持状态 | 说明 |
|------|----------|------|
| 私聊（Direct Message） | ✅ 支持 | 与单个用户对话 |
| 群聊（Group） | ✅ 支持 | 多人会话 |
| 回复 | ✅ 支持 | 回复指定消息，携带 `replyTo` |
| 消息编辑 | ✅ 支持 | 编辑已发送的消息 |
| 消息撤回 | ✅ 支持 | 删除已发送的消息 |
| 表情反应 | ✅ 支持 | Emoji 反应（需后端实现） |
| 媒体附件 | ✅ 支持 | 图片、文件等（通过 URL 引用） |
| 消息线程 | ✅ 支持 | 将回复关联到原消息 |
| 流式输出 | ✅ 支持 | 分块推送 AI 回复（通过 `/stream/chunk` 端点） |
| 投票 | ❌ 不支持 | — |

---

## 2. 消息内容

| 内容类型 | 支持状态 | 说明 |
|----------|----------|------|
| 纯文本 | ✅ 支持 | `content.format = "plain"` |
| 媒体 URL | ✅ 支持 | 图片、文件以 URL 引用，`media[].url` |
| 回复引用 | ✅ 支持 | `replyTo.id` 携带被回复的消息 ID |

---

## 3. 会话管理

| 功能 | 支持状态 | 说明 |
|------|----------|------|
| 会话重置 | ✅ 支持 | 通过 WebHub 后端下发 `reset` 命令清空对话历史 |
| 会话切换 | ✅ 支持 | 通过 `switch` 命令切换到指定历史会话 |
| Slash 命令 | ✅ 支持 | 以 `/` 开头的消息自动授权为命令 |

---

## 4. 跨频道中继

| 功能 | 支持状态 | 说明 |
|------|----------|------|
| 跨频道消息同步 | ✅ 支持 | 将其他 OpenClaw 频道（如 WhatsApp、TUI）的消息同步显示到 WebHub 前端 |

通过 `POST /api/channel/cross-channel-messages` 实现，消息携带原始频道标识和方向（入站/出站）。

---

## 5. 连接可靠性

| 特性 | 说明 |
|------|------|
| 自动重连 | WebSocket 断线后指数退避重连（2s → 4s → 8s → … 上限 30s） |
| 失败重发 | 断线期间的未送达 AI 回复缓存在内存（可配置持久化到文件），重连后自动重发 |
| 消息去重 | 内存维护已处理消息 ID 集合，防止 same-ms 消息重复处理（容量 500） |
| 心跳探测 | 定期 `GET {apiUrl}/health` 检查后端可达性 |

---

## 6. 声明的能力（代码）

以下是插件向 OpenClaw 注册的 `capabilities` 声明（来自 `src/index.ts`）：

```typescript
capabilities: {
  chatTypes: ['direct', 'group'],
  reply: true,
  edit: true,
  unsend: true,
  reactions: true,
  polls: false,
  media: true,
  threads: true,
  blockStreaming: false,
}
```

---

*最后更新: 2026-02-25*
