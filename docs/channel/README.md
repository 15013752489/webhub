# Chatu Channel Plugin - 文档目录

本目录包含 OpenClaw Chatu 频道插件的技术文档。Chatu 通过 WebSocket（主）和 HTTP 轮询（兜底）与任意 WebHub 后端服务通信。

---

## 目录结构

| 文档 | 内容 |
|------|------|
| [01-overview.md](01-overview.md) | 架构概述、消息流向、工作原理 |
| [02-configuration.md](02-configuration.md) | 配置项说明、多账户配置、环境变量 |
| [03-capabilities.md](03-capabilities.md) | 插件支持的功能矩阵 |
| [04-api-reference.md](04-api-reference.md) | 插件调用的 WebHub API 端点 |
| [05-message-protocol.md](05-message-protocol.md) | 入站/出站消息格式规范 |
| [06-security.md](06-security.md) | 认证方式与安全说明 |

---

## 快速导航

- **新接入 WebHub 后端？** → [01-overview.md](01-overview.md)
- **配置插件？** → [02-configuration.md](02-configuration.md)
- **实现 WebHub 后端服务？** → [04-api-reference.md](04-api-reference.md) 和 [05-message-protocol.md](05-message-protocol.md)
- **了解支持的消息类型？** → [03-capabilities.md](03-capabilities.md)
- **Auth/Token 问题？** → [06-security.md](06-security.md)

---

*最后更新: 2026-02-25*
