# Chatu Channel Plugin - 架构概述

> **下一节**：[02-configuration.md](02-configuration.md)

---

## 1. 什么是 Chatu 插件？

Chatu 是一个 OpenClaw 频道插件，让 OpenClaw AI 能与任意基于 HTTP/WebSocket 的 **WebHub 后端服务**通信。典型场景是将网站聊天窗口接入 OpenClaw AI。

### 角色说明

| 角色 | 说明 |
|------|------|
| **Browser / 前端** | 用户所在的网页，发送消息的源 |
| **WebHub 后端服务** | 中间层，管理频道和消息队列，需要开发者实现 |
| **Chatu 插件** | OpenClaw 内运行，连接 WebHub 后端服务 |
| **OpenClaw AI** | 处理消息、生成回复 |

---

## 2. 系统架构

```
Browser (用户)
    │  POST /api/webhub/channels/:id/messages
    ▼
WebHub 后端服务
    │  WebSocket ws://...  /api/channel/ws
    │  (或 HTTP 轮询 fallback)
    ▼
Chatu 插件 (本插件)
    │  调用 OpenClaw AI 流水线
    ▼
OpenClaw AI
    │  POST /api/channel/messages  (AI 回复)
    ▼
WebHub 后端服务
    │  WebSocket push
    ▼
Browser (用户收到 AI 回复)
```

---

## 3. 消息流向

### 3.1 入站（用户 → AI）

1. 浏览器发消息到 WebHub 后端
2. WebHub 后端通过 WebSocket 推送消息到 Chatu 插件
3. 插件解析消息，调用 OpenClaw AI 流水线
4. AI 生成回复，插件通过 `POST /api/channel/messages` 回传给 WebHub
5. WebHub 通过 WebSocket 将 AI 回复推送给浏览器

### 3.2 出站（AI → 用户）

AI 回复通过以下 HTTP 请求发送：

```http
POST {apiUrl}/api/channel/messages
X-Channel-Token: {accessToken}
X-Channel-ID: {channelId}
Content-Type: application/json

{
  "messageId": "msg_1234567_abc",
  "target": { "type": "user", "id": "user-123" },
  "content": { "text": "AI 回复内容", "format": "plain" },
  "timestamp": 1708139100000,
  "role": "ai"
}
```

---

## 4. 连接机制

### 4.1 主连接：WebSocket

插件优先使用 WebSocket 实时连接：

- 连接地址：`{apiUrl}/api/channel/ws`（自动将 http 转为 ws）
- 认证：请求头携带 `accessToken` 和 `channelId`
- 断线自动重连（指数退避，最大 30 秒）
- 重连后自动重发断线期间缓存的未送达回复

### 4.2 兜底：HTTP 轮询（已废弃）

早期版本使用 HTTP 轮询（`GET /api/channel/messages/pending`，每 2 秒），当前版本已切换为 WebSocket，轮询逻辑保留仅供参考。

---

## 5. 生命周期

插件通过 OpenClaw 的 Gateway 生命周期管理连接：

1. **启动**：通过 `quick-register`（环境变量方式）或手动配置获取凭证，然后调用 `POST /api/channel/connect` 通知后端
2. **运行**：维持 WebSocket 长连接，持续接收消息并派发给 AI
3. **停止**：调用 `POST /api/channel/disconnect` 通知后端，断开 WebSocket

---

## 6. 快速注册（环境变量方式）

如果设置了以下环境变量，插件启动时会自动向 WebHub 后端注册：

| 环境变量 | 说明 |
|----------|------|
| `CHATU_KEY` | 注册密钥 |
| `CHATU_URL` 或 `CHATU_API_URL` | WebHub 后端地址 |

自动注册调用：`POST {apiUrl}/api/channel/quick-register`，获取 `channelId` 和 `accessToken` 后写入配置。

---

*最后更新: 2026-02-25*
