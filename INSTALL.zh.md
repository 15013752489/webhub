# Chatu 频道安装指南

**[English](INSTALL.md) | 中文**

> 本指南介绍如何安装 Chatu 频道插件，将 OpenClaw 连接到任意网站。

---

## 1. 安装方式

### 1.1 从 npm 安装（推荐）

```bash
# 作为 OpenClaw 插件安装
openclaw plugins install @chatu-ai/webhub

# 或直接使用 npm 全局安装
npm install -g @chatu-ai/webhub
```

### 1.2 从源码安装

**方式 A：自动构建安装（推荐）**

```bash
# 克隆仓库
git clone https://github.com/chatu-ai/webhub.git
cd webhub

# 安装为插件（会通过 prepare 脚本自动构建）
openclaw plugins install .
```

**方式 B：手动构建安装**

```bash
# 克隆仓库
git clone https://github.com/chatu-ai/webhub.git
cd webhub

# 构建插件
npm install
npm run build

# 本地安装
openclaw plugins install .
```

### 1.3 开发模式

```bash
# 以热重载方式链接（开发用）
openclaw plugins install -l .
cd /path/to/webhub
npm run watch
```

---

## 2. 配置

### 2.1 快速配置

```bash
# 启用频道
openclaw config set channels.chatu.enabled true

# 设置 Chatu 服务 API URL（由 WebHub 后端提供）
openclaw config set channels.chatu.apiUrl "https://your-website.com"

# 设置频道 ID（从 WebHub 管理界面获取）
openclaw config set channels.chatu.channelId "wh_ch_xxxxxx"

# 设置访问凭证（由 WebHub 后端提供）
openclaw config set channels.chatu.accessToken "wh_eyJhbGciOiJIUzI1NiIs..."

# 应用更改
openclaw gateway restart
```

### 2.2 完整配置

```json5
{
  channels: {
    chatu: {
      enabled: true,
      
      // WebHub 服务基础 URL [必填]
      apiUrl: "https://your-website.com",
      
      // 频道 ID，从 WebHub 管理界面获取 [必填]
      channelId: "wh_ch_xxxxxx",
      
      // 访问凭证 [必填，与 secret 二选一]
      accessToken: "wh_eyJhbGciOiJIUzI1NiIs...",
      
      // 频道密钥，用于注册 [与 accessToken 二选一]
      // secret: "wh_secret_xxxxxxxxxx",
      
      // 请求超时时间（毫秒）[可选]
      timeout: 30000,
    }
  }
}
```

### 2.3 环境变量（快速注册）

如果 WebHub 后端支持自动注册，可以跳过手动凭证配置：

```bash
# 设置注册密钥和服务 URL
export CHATU_KEY="your-registration-key"
export CHATU_URL="https://your-website.com"

# 重启网关触发自动注册
openclaw gateway restart
```

插件会自动调用 `POST /api/channel/quick-register`，并将返回的 `channelId` 和 `accessToken` 保存到配置中。

---

## 3. 验证安装

### 3.1 检查插件状态

```bash
# 验证插件已加载
openclaw plugins list | grep chatu

# 预期输出：
# │ Chatu │ chatu │ loaded │ .../dist/index.js │ 0.1.0 │
```

### 3.2 检查配置

```bash
# 查看当前 chatu 配置
openclaw config get channels.chatu
```

### 3.3 查看日志

```bash
# 检查连接日志
openclaw logs
```

---

## 4. 卸载

### 4.1 禁用频道

```bash
# 禁用频道
openclaw config set channels.chatu.enabled false

# 或完全移除配置
openclaw config unset channels.chatu
```

### 4.2 移除插件

```bash
# 从 OpenClaw 中移除
openclaw plugins uninstall @chatu-ai/webhub
```

---

## 5. 故障排除

### 5.1 常见问题

| 问题 | 解决方案 |
|------|----------|
| 连接超时 | 检查 `apiUrl` 是否正确且可访问 |
| 401 未授权 | 验证 `accessToken` 是否有效 |
| 插件未加载 | 运行 `openclaw plugins list \| grep chatu`；确认构建后 `dist/` 目录存在 |
| 消息未到达 | 检查日志中的 WebSocket 连接状态；验证 `channelId` 是否正确 |
| 消息发送失败 | 确认 `accessToken` 和 `channelId` 已配置 |

### 5.2 调试命令

```bash
# 查看网关日志
openclaw logs

# 检查插件状态
openclaw plugins list | grep chatu

# 查看当前配置
openclaw config get channels.chatu

# 测试后端健康状态
curl https://your-website.com/health
```

### 5.3 获取帮助

```bash
# 查看 OpenClaw 文档
openclaw help
```

---

## 6. 更新

### 6.1 更新插件

```bash
# 更新到最新版本
openclaw plugins update @chatu-ai/webhub
```

### 6.2 检查版本

```bash
# 查看已安装版本
openclaw plugins list | grep chatu
```

---

## 相关文档

- [频道文档](docs/channel/README.md) - 架构、API 参考、消息协议
- [OpenClaw 配置文档](https://docs.openclaw.ai/gateway/configuration) - 官方文档

---

*最后更新：2026-02-25*

---

## 插件版本检测

安装或升级插件后，可通过查询服务版本端点来验证当前运行的版本，无需重启 openclaw：

```bash
# 检查活跃插件版本
curl http://localhost:3000/api/channel/version
```

预期响应：

```json
{
  "success": true,
  "data": {
    "serviceVersion": "1.0.0",
    "nodeVersion": "20.11.0",
    "pluginVersion": "0.1.0",
    "buildTime": null
  }
}
```

`pluginVersion` 反映插件最近一次连接时上报的版本号。如果显示 `null`，表示插件在最近一次服务重启后尚未连接。

---

## 升级后重载插件

使用内置的重载脚本来重新构建并获取重载引导说明：

```bash
./scripts/reload-plugin.sh
```

该脚本会：
1. 运行 `npm run build` 编译插件
2. 打印新版本号
3. 检查服务版本端点
4. 展示清除缓存 `accessToken` 并重启 openclaw 账户以使新构建生效的分步操作说明

如需跳过构建直接重载：

```bash
./scripts/reload-plugin.sh --no-build
```
