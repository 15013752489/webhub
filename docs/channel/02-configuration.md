# Chatu Channel Plugin - 配置说明

> **上一节**：[01-overview.md](01-overview.md)  
> **下一节**：[03-capabilities.md](03-capabilities.md)

---

## 1. 配置项完整列表

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `enabled` | boolean | 否 | `true` | 是否启用此频道 |
| `apiUrl` | string | **是** | — | WebHub 后端服务的 HTTP 地址 |
| `channelId` | string | **是** | — | 频道 ID（从 WebHub 后端管理页获取，如 `wh_ch_xxxxx`） |
| `secret` | string | 二选一 | — | 频道密钥（`wh_secret_xxx`），用于初次注册 |
| `accessToken` | string | 二选一 | — | 访问凭证（`wh_xxxxxxx`），注册后自动写入或手动填写 |
| `timeout` | number | 否 | `30000` | HTTP/WS 请求超时时间（毫秒） |

> **说明**：`secret` 和 `accessToken` 二选一。建议通过 WebHub 管理界面获取 `accessToken` 后直接配置，`secret` 仅在需要通过 API 注册时使用。

---

## 2. CLI 快速配置

```bash
# 设置 WebHub 后端地址
openclaw config set channels.chatu.apiUrl "https://your-webhub.example.com"

# 设置频道 ID
openclaw config set channels.chatu.channelId "wh_ch_xxxxxx"

# 设置访问凭证（推荐）
openclaw config set channels.chatu.accessToken "wh_xxxxxxxxxxxxxxxx"

# 或者设置密钥（用于自动注册）
openclaw config set channels.chatu.secret "wh_secret_xxxxxxxxxx"

# 重启网关使配置生效
openclaw gateway restart
```

---

## 3. 配置文件示例

编辑 `~/.openclaw/openclaw.json`：

### 3.1 单账户配置（推荐）

```json
{
  "channels": {
    "chatu": {
      "enabled": true,
      "apiUrl": "https://your-webhub.example.com",
      "channelId": "wh_ch_xxxxxx",
      "accessToken": "wh_xxxxxxxxxxxxxxxx",
      "timeout": 30000
    }
  }
}
```

### 3.2 多账户配置

当需要同时连接多个 WebHub 服务时：

```json
{
  "channels": {
    "chatu": {
      "accounts": {
        "site-a": {
          "accountId": "site-a",
          "apiUrl": "https://webhub-a.example.com",
          "channelId": "wh_ch_aaaaaa",
          "accessToken": "wh_aaaaaaaaaaaaaaa"
        },
        "site-b": {
          "accountId": "site-b",
          "apiUrl": "https://webhub-b.example.com",
          "channelId": "wh_ch_bbbbbb",
          "accessToken": "wh_bbbbbbbbbbbbbbb"
        }
      }
    }
  }
}
```

配置优先级：账户级 > 频道级（`channels.chatu.*`）> 插件级（`plugins.entries.chatu.config.*`）

---

## 4. 环境变量（快速注册）

如果需要在部署时自动完成频道注册，可以使用环境变量：

| 变量名 | 说明 |
|--------|------|
| `CHATU_KEY` | 注册密钥（由 WebHub 后端提供） |
| `CHATU_URL` | WebHub 后端地址（与 `apiUrl` 等效） |
| `CHATU_API_URL` | 同上，备用名 |
| `CHATU_CACHE_MAX` | 本地缓存队列最大容量（默认 1000） |
| `CHATU_CACHE_FILE` | 缓存文件路径前缀（用于持久化未送达消息） |

当 `CHATU_KEY` 和 `CHATU_URL` 都设置时，插件启动时自动调用 `POST /api/channel/quick-register` 获取 `channelId` 和 `accessToken`，无需手动配置。

```bash
export CHATU_KEY="your-registration-key"
export CHATU_URL="https://your-webhub.example.com"
openclaw gateway restart
```

---

## 5. 验证配置

```bash
# 查看当前 chatu 配置
openclaw config get channels.chatu

# 查看插件加载状态
openclaw plugins list | grep chatu

# 检查连接状态
openclaw health
```

期望输出（插件已正确加载）：

```
│ Chatu │ chatu │ loaded │ .../dist/index.js │ 0.1.0 │
```

---

*最后更新: 2026-02-25*
