# OpenClaw WebHub Channel - 频道能力声明

> **上一节**：[02-message-schema.md](02-message-schema.md)  
> **下一节**：[04-api-endpoints.md](04-api-endpoints.md)

---

## 1. 功能支持矩阵

![功能矩阵](images/diagram-03.png)

### 1.1 基础消息

| 功能 | 支持 | 备注 |
|------|------|------|
| 私聊 (DM) | ✅ | User-to-user messaging |
| 群聊 | ✅ | Multi-user conversations |
| 频道消息 | ✅ | Broadcast messages |

### 1.2 消息内容

| 功能 | 支持 | 备注 |
|------|------|------|
| 纯文本 | ✅ | Plain text |
| Markdown | ✅ | Rich formatting |
| HTML | ✅ | HTML formatting |
| @提及 | ✅ | @username mentions |
| 引用回复 | ✅ | Thread/quote replies |
| 消息编辑 | ✅ | Edit sent messages |
| 消息删除 | ✅ | Delete messages |

### 1.3 媒体

| 功能 | 支持 | 备注 |
|------|------|------|
| 图片 | ✅ | Image files |
| 视频 | ✅ | Video files |
| 音频 | ✅ | Audio files |
| 文件 | ✅ | Document files |
| 位置 | ✅ | GPS coordinates |

### 1.4 交互

| 功能 | 支持 | 备注 |
|------|------|------|
| 表情反应 | ✅ | Emoji reactions |
| 投票 | ✅ | Multi-choice polls |
| 按钮 | ✅ | Interactive buttons |
| 内联键盘 | ✅ | Inline keyboard |
| 快捷回复 | ✅ | Quick reply buttons |

### 1.5 群组

| 功能 | 支持 | 备注 |
|------|------|------|
| 创建群组 | ✅ | Create groups |
| 邀请成员 | ✅ | Invite members |
| 群主管理 | ✅ | Admin permissions |
| 群信息设置 | ✅ | Title/description |

### 1.6 高级

| 功能 | 支持 | 备注 |
|------|------|------|
| 消息线程 | ✅ | Message threading |
| 输入状态 | ✅ | Typing indicators |
| 在线状态 | ✅ | Presence (online/offline) |
| 已读回执 | ✅ | Read receipts |
| 定时消息 | ✅ | Scheduled messages |
| Webhook | ✅ | Incoming webhooks |
| 速率限制 | ✅ | Rate limiting |

---

## 2. 格式支持

| 格式标记 | 支持 | 示例 |
|---------|------|------|
| **粗体** | ✅ | `**text**` |
| *斜体* | ✅ | `*text*` |
| ~~删除线~~ | ✅ | `~~text~~` |
| `行内代码` | ✅ | `` `code` `` |
| ```代码块``` | ✅ | ```js\ncode\n``` |
| [链接](url) | ✅ | `[text](url)` |
| > 引用 | ✅ | `> quote` |
| - 无序列表 | ✅ | `- item` |
| 1. 有序列表 | ✅ | `1. item` |
| 表格 | ✅ | \|col1\|col2\| |
| --- 分割线 | ✅ | Horizontal rule |

---

## 3. 能力声明代码

```typescript
import type { ChannelCapabilities } from "openclaw/plugin-sdk";

export const capabilities: ChannelCapabilities = {
  /** 支持的聊天类型 */
  chatTypes: ["direct", "group"],
  
  /** 是否支持投票 */
  polls: true,
  
  /** 是否支持表情反应 */
  reactions: true,
  
  /** 是否支持消息编辑 */
  edit: true,
  
  /** 是否支持消息删除 */
  unsend: true,
  
  /** 是否支持消息回复 */
  reply: true,
  
  /** 是否支持特效 */
  effects: false,
  
  /** 是否支持群组管理 */
  groupManagement: true,
  
  /** 是否支持消息线程 */
  threads: true,
  
  /** 是否支持媒体消息 */
  media: true,
  
  /** 是否支持原生命令 */
  nativeCommands: false,
  
  /** 是否阻止流式传输 */
  blockStreaming: true,
};
```

---

## 4. 限制配置

```typescript
interface WebHubLimits {
  /** 最大消息长度 */
  maxMessageLength: number;           // 默认: 10000 字符
  
  /** 最大媒体文件大小 */
  maxMediaSize: number;                // 默认: 100MB
  
  /** 每条消息最大媒体数量 */
  maxMediaPerMessage: number;         // 默认: 10
  
  /** 单次发送最大接收者数量 */
  maxRecipients: number;               // 默认: 1
  
  /** 速率限制 */
  rateLimit: {
    messagesPerSecond: number;         // 默认: 10
    burstSize: number;                // 默认: 20
  };
}
```

---

*最后更新: 2026-02-06*
