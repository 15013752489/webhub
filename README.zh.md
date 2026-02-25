# OpenClaw Chatu 频道插件

**[English](README.md) | 中文**

官方 OpenClaw 频道插件，通过 HTTP/WebSocket 连接任意网站。

## 什么是 Chatu 频道？

Chatu 是一个灵活的频道插件，让 OpenClaw 能与任意基于 HTTP/WebSocket 的消息服务通信。它提供了一个通用接口，将 OpenClaw 接入自定义 Web 应用。

## 快速开始

### 1. 安装

```bash
# 从 npm 安装（推荐）
openclaw plugins install @chatu-ai/webhub

# 或从源码安装（用于开发）
git clone https://github.com/chatu-ai/openclaw-web-hub-channel.git
cd openclaw-web-hub-channel
npm install
npm run build
openclaw plugins install -l .
```

### 2. 配置

```bash
# 启用并配置频道
openclaw config set channels.chatu.enabled true
openclaw config set channels.chatu.apiUrl "https://your-api.example.com"
openclaw config set channels.chatu.channelId "wh_ch_xxxxxx"
openclaw config set channels.chatu.accessToken "your-access-token"

# 重启网关以应用更改
openclaw gateway restart
```

### 3. 验证

```bash
# 检查插件状态
openclaw plugins list | grep chatu

# 查看日志
openclaw logs
```

> 📖 详细配置说明请参见下方的[配置指南](#配置指南)。

## 功能特性

- 🔌 通用 HTTP/WebSocket 连接
- 🔐 基于 Token 的安全认证
- 📝 支持文本、图片和文件附件
- 👥 私信和群聊支持
- 🔄 消息编辑和撤回
- 💬 回复线程

## 配置选项

### 基础配置

| 选项 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `enabled` | boolean | 否 | `true` | 启用/禁用频道 |
| `apiUrl` | string | **是** | — | WebHub 服务基础 URL |
| `channelId` | string | **是** | — | WebHub 频道 ID（如 `wh_ch_xxxxx`） |
| `secret` | string | 二选一 | — | 频道密钥（`wh_secret_xxx`），用于注册 |
| `accessToken` | string | 二选一 | — | 访问凭证（`wh_xxxxxxx`） |
| `timeout` | number | 否 | `30000` | 请求超时时间（毫秒） |

### 配置示例

**单账户：**
```json
{
  "channels": {
    "chatu": {
      "enabled": true,
      "apiUrl": "https://api.example.com",
      "channelId": "wh_ch_xxxxxx",
      "accessToken": "your-token",
      "timeout": 30000
    }
  }
}
```

**多账户：**
```json
{
  "channels": {
    "chatu": {
      "accounts": {
        "work": {
          "accountId": "work",
          "apiUrl": "https://work-api.example.com",
          "channelId": "wh_ch_aaaaaa",
          "accessToken": "work-token"
        },
        "personal": {
          "accountId": "personal",
          "apiUrl": "https://personal-api.example.com",
          "channelId": "wh_ch_bbbbbb",
          "accessToken": "personal-token"
        }
      }
    }
  }
}
```

> 💡 分步配置说明请参见[配置指南](#配置指南)。

## 配置指南

### 第一步：验证插件状态

安装后，验证插件已加载：

```bash
# 检查插件状态
openclaw plugins list | grep chatu
```

预期输出：
```
│ Chatu   │ chatu  │ loaded  │ ~/path/to/openclaw-web-hub-channel/dist/index.js  │ 0.1.0 │
```

### 第二步：配置频道

#### 方式 A：使用 CLI 命令（推荐）

```bash
# 启用频道
openclaw config set channels.chatu.enabled true

# 设置 API URL
openclaw config set channels.chatu.apiUrl "https://your-api.example.com"

# 设置频道 ID（从 WebHub 管理界面获取）
openclaw config set channels.chatu.channelId "wh_ch_xxxxxx"

# 设置访问凭证
openclaw config set channels.chatu.accessToken "your-access-token"

# 设置超时时间（可选，默认 30000ms）
openclaw config set channels.chatu.timeout 30000
```

#### 方式 B：直接编辑配置文件

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "channels": {
    "chatu": {
      "enabled": true,
      "apiUrl": "https://your-api.example.com",
      "channelId": "wh_ch_xxxxxx",
      "accessToken": "your-access-token",
      "timeout": 30000
    }
  }
}
```

#### 方式 C：多账户配置

管理多个账户：

```bash
# 配置工作账户
openclaw config set channels.chatu.accounts.work.accountId "work"
openclaw config set channels.chatu.accounts.work.apiUrl "https://work-api.example.com"
openclaw config set channels.chatu.accounts.work.accessToken "work-token"

# 配置个人账户
openclaw config set channels.chatu.accounts.personal.accountId "personal"
openclaw config set channels.chatu.accounts.personal.apiUrl "https://personal-api.example.com"
openclaw config set channels.chatu.accounts.personal.accessToken "personal-token"
```

### 第三步：重启网关

配置完成后，重启 OpenClaw 网关以加载更改：

```bash
# 重启网关
openclaw gateway restart

# 或手动停止后启动
openclaw gateway stop
openclaw gateway start
```

### 第四步：验证配置

```bash
# 检查频道配置
openclaw config get channels.chatu

# 查看网关日志
openclaw logs | tail -50

# 检查 OpenClaw 健康状态
openclaw health
```

### 开发模式

使用热重载进行插件开发：

```bash
# 1. 以开发模式安装
cd /path/to/openclaw-web-hub-channel
openclaw plugins install -l .

# 2. 启动 TypeScript 监听模式（修改时自动编译）
npm run watch

# 3. 正常配置（参见第二步）

# 4. 代码更改后，重启网关
openclaw gateway restart

# 5. 查看调试日志
openclaw logs
```

### 故障排除

**插件未加载？**
- 检查插件是否已安装：`openclaw plugins list`
- 确认 dist/ 目录存在且包含编译后的文件
- 安装后重启网关：`openclaw gateway restart`

**配置未生效？**
- 验证配置：`openclaw config get channels.chatu`
- 检查 `~/.openclaw/openclaw.json` 中的语法错误
- 查看网关日志中的错误：`openclaw logs`

**连接问题？**
- 确认 apiUrl 可访问
- 检查 accessToken 是否有效
- 如需要可增加超时时间：`openclaw config set channels.chatu.timeout 60000`
- 查看日志获取详细错误信息

## 文档

详细文档请参见：
- [安装指南](INSTALL.zh.md)
- [频道文档](docs/channel/README.md)
- [OpenClaw 插件文档](https://docs.openclaw.ai/plugin)

## 发布到 npm

本项目使用 GitHub Actions 自动发布到 npm。详见[发布工作流说明](.github/workflows/publish.yml)。

**设置 npm 发布所需的 Secret：**

1. 登录 [npmjs.com](https://www.npmjs.com) 并生成一个 **Automation** 类型的 Access Token
2. 在 GitHub 仓库设置中添加 Secret：`Settings → Secrets and variables → Actions → New repository secret`
3. Secret 名称：`NPM_TOKEN`，值填入你的 npm Access Token

**发布方式：**

```bash
# 升级补丁版本并发布（如 0.1.0 → 0.1.1）
npm run release:patch

# 升级次要版本并发布（如 0.1.0 → 0.2.0）
npm run release:minor

# 升级主版本并发布（如 0.1.0 → 1.0.0）
npm run release:major
```

运行 `release:*` 脚本会自动更新 `package.json` 版本号、创建 git tag，并触发 GitHub Actions 发布到 npm。

## 许可证

MIT
