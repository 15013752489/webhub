# Chatu Channel Plugin - 安全说明

> **上一节**：[05-message-protocol.md](05-message-protocol.md)  
> **返回**：[README.md](README.md)

---

## 1. 认证机制

Chatu 插件使用基于 Token 的简单认证，无签名验证要求。

### 1.1 主要认证方式

大多数 API 请求使用以下请求头：

```http
X-Channel-Token: {accessToken}
X-Channel-ID: {channelId}
```

### 1.2 连接时认证

连接通知和断开通知使用：

```http
x-access-token: {accessToken}
```

### 1.3 流式接口认证

流式输出相关接口使用标准 Bearer 令牌：

```http
Authorization: Bearer {accessToken}
```

### 1.4 跨频道中继认证

```http
X-Access-Token: {accessToken}
```

---

## 2. Token 获取方式

| 方式 | 说明 |
|------|------|
| **手动配置** | 从 WebHub 管理界面获取 `accessToken` 后直接写入 OpenClaw 配置 |
| **环境变量注册** | 设置 `CHATU_KEY` + `CHATU_URL`，插件启动时自动调用 `/api/channel/quick-register` 获取 |
| **密钥注册** | 配置 `secret`（`wh_secret_xxx`），用于自动注册 |

---

## 3. 安全最佳实践

### 3.1 Token 保护

- 不要将 `accessToken` 或 `secret` 提交到版本控制
- 使用环境变量方式（`CHATU_KEY`）代替硬编码凭证
- 定期轮换 Access Token

### 3.2 网络安全

- **生产环境务必使用 HTTPS/WSS**，避免 Token 在传输层泄露
- `apiUrl` 使用 `https://` 时，WebSocket 自动升级为 `wss://`

### 3.3 SSRF 防护

由于 `apiUrl` 来自用户配置，WebHub 后端应验证 OpenClaw 侧的请求来源合法性。OpenClaw 平台本身也内置了 SSRF 防护机制。

---

## 4. 配置文件安全

OpenClaw 配置存储在 `~/.openclaw/openclaw.json`，包含 `accessToken` 等敏感字段。建议：

- 确保该文件权限为 `600`（仅所有者可读）
- 不要将 `~/.openclaw/` 目录内容共享或纳入版本控制

---

*最后更新: 2026-02-25*
