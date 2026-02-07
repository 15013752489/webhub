# OpenClaw WebHub Channel - 使用指南

> **上一节**：[02-sdk-messages.md](02-sdk-messages.md)  
> **下一节**：[04-capabilities.md](04-capabilities.md)

---

## 1. 消息发送方式

OpenClaw 提供三种消息发送方式：

| 方式 | 说明 | 使用场景 |
|------|------|----------|
| **Message Tool** | Agent 自动发送消息 | AI 对话回复 |
| **Message Actions** | 显式调用操作 | 投票、反应等 |
| **Control Commands** | 用户手动命令 | 管理员操作 |

---

## 2. Message Tool（推荐）

### 2.1 基本用法

Agent 在对话中自动使用，无需额外配置：

```json
{
  "action": "send",
  "channel": "webhub",
  "to": "user_12345",
  "message": "Hello! How can I help you?"
}
```

### 2.2 完整参数

```json
{
  "action": "send",
  "channel": "webhub",
  "to": "user_12345",
  "message": "Hello!",
  "replyTo": "msg_abc123",        // 可选：回复某条消息
  "media": ["https://example.com/image.jpg"],  // 可选：媒体附件
  "buttons": [                   // 可选：交互按钮
    {
      "text": "Yes",
      "callback_data": "yes"
    },
    {
      "text": "No", 
      "callback_data": "no"
    }
  ]
}
```

---

## 3. Message Actions

### 3.1 支持的操作

| 操作 | 说明 | 示例 |
|------|------|------|
| `send` | 发送消息 | `message tool` |
| `broadcast` | 广播消息 | 发送到多个目标 |
| `poll` | 发送投票 | 调查问卷 |
| `react` | 添加反应 | 表情回应 |
| `read` | 标记已读 | 确认消息已读 |
| `edit` | 编辑消息 | 修改已发送的消息 |
| `unsend` | 删除消息 | 撤回消息 |
| `reply` | 回复消息 | `[[reply_to_current]]` |

### 3.2 Poll 示例

```json
{
  "action": "poll",
  "channel": "webhub",
  "to": "group_12345",
  "question": "What time works best?",
  "options": ["9:00 AM", "10:00 AM", "11:00 AM"],
  "multiSelect": false
}
```

### 3.3 React 示例

```json
{
  "action": "react",
  "channel": "webhub",
  "to": "user_12345",
  "messageId": "msg_abc123",
  "emoji": "👍"
}
```

```json
{
  "action": "react",
  "channel": "webhub",
  "to": "user_12345", 
  "messageId": "msg_abc123",
  "emoji": "👍",
  "remove": true  // 移除反应
}
```

---

## 4. Control Commands

### 4.1 内置命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/send` | 发送消息 | `/send user_12345 Hello!` |
| `/broadcast` | 广播消息 | `/broadcast Hello everyone!` |
| `/reply` | 回复消息 | `/reply msg_abc123 OK!` |
| `/poll` | 创建投票 | `/poll "Question" "A" "B" "C"` |

### 4.2 命令配置

```json
{
  "commands": {
    "enabled": true,
    "prefix": "/",
    "adminOnly": ["broadcast", "config"]
  }
}
```

---

## 5. 目标指定方式

### 5.1 目标格式

WebHub 支持以下目标格式：

| 类型 | 格式 | 示例 |
|------|------|------|
| 用户 | `user_<ID>` | `user_12345` |
| 群组 | `group_<ID>` | `group_dev` |
| 频道 | `channel_<ID>` | `channel_announcements` |

### 5.2 目标解析

```typescript
// Channel Outbound Adapter 负责解析目标
resolveTarget: ({ to, allowFrom, mode }) => {
  // 验证目标格式
  if (!to || !to.trim()) {
    return { ok: false, error: "目标不能为空" };
  }
  
  // 转换为 WebHub 格式
  const normalized = to.startsWith("user_") 
    ? to 
    : `user_${to}`;
    
  return { ok: true, to: normalized };
}
```

---

## 6. 消息格式转换

### 6.1 OpenClaw → Website

```
OpenClaw Message
         │
         ▼
┌─────────────────────────────┐
│  Channel Outbound Adapter │
│  - 文本分块             │
│  - 格式化转换           │
│  - 目标解析             │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  WebHubOutboundMessage   │
│  {                      │
│    target: {...},        │
│    content: {            │
│      text,              │
│      format: "markdown"  │
│    }                      │
│  }                        │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Website REST API          │
└─────────────────────────────┘
```

### 6.2 格式化选项

```json
{
  "message": {
    "maxLength": 10000,              // 最大消息长度
    "chunkMode": "sentence",          // 分块模式: sentence/paragraph
    "chunkSize": 4000,                // 每块大小
    "allowedFormats": ["plain", "markdown"],  // 允许的格式
    "markdown": {
      "tables": true,                 // 表格
      "codeBlocks": true,             // 代码块
      "links": true                   // 链接
    }
  }
}
```

---

## 7. 媒体消息

### 7.1 发送媒体

```json
{
  "action": "send",
  "channel": "webhub",
  "to": "user_12345",
  "message": "Here is the file you requested:",
  "media": [
    {
      "type": "image",
      "url": "https://example.com/photo.jpg",
      "caption": "Photo description"
    }
  ]
}
```

### 7.2 支持的媒体类型

| 类型 | MIME 类型 | 最大大小 |
|------|-----------|----------|
| 图片 | `image/jpeg`, `image/png`, `image/gif`, `image/webp` | 100MB |
| 视频 | `video/mp4`, `video/webm` | 500MB |
| 音频 | `audio/mpeg`, `audio/wav`, `audio/ogg` | 100MB |
| 文件 | `application/pdf`, `application/zip` | 100MB |

### 7.3 媒体配置

```json
{
  "message": {
    "media": {
      "maxSize": 104857600,  // 100MB
      "allowedTypes": [
        "image/*",
        "video/mp4",
        "audio/*",
        "application/pdf"
      ],
      "downloadTimeout": 30000,      // 下载超时
      "uploadTimeout": 60000       // 上传超时
    }
  }
}
```

---

## 8. 交互式消息

### 8.1 Inline Keyboard

```json
{
  "action": "send",
  "channel": "webhub", 
  "to": "user_12345",
  "message": "请选择操作:",
  "keyboard": {
    "type": "inline_keyboard",
    "buttons": [
      [
        {
          "text": "✅ 确认",
          "callback_data": "confirm"
        },
        {
          "text": "❌ 取消",
          "callback_data": "cancel"
        }
      ],
      [
        {
          "text": "�详情",
          "url": "https://example.com/details"
        }
      ]
    ]
  }
}
```

### 8.2 Quick Reply Buttons

```json
{
  "action": "send",
  "channel": "webhub",
  "to": "user_12345",
  "message": "How was your experience?",
  "keyboard": {
    "type": "quick_reply",
    "buttons": [
      { "text": "👍 Great", "callback_data": "rating_great" },
      { "text": "👌 Good", "callback_data": "rating_good" },
      { "text": "👎 Bad", "callback_data": "rating_bad" }
    ]
  }
}
```

---

## 9. 回调处理

### 9.1 按钮回调

用户点击按钮后，Website 推送回调：

```typescript
interface ButtonCallback {
  eventType: "callback";
  callback: {
    buttonId: string;
    messageId: string;
    userId: string;
    data: string;
    timestamp: number;
  };
}
```

### 9.2 处理回调

```typescript
// Channel Message Action Adapter 处理回调
actions: {
  handleAction: async ({ action, params }) => {
    if (action === "callback") {
      const { buttonId, messageId, userId, data } = params;
      
      // 处理按钮点击
      await processButtonClick(buttonId, data);
      
      return { success: true };
    }
  }
}
```

---

## 10. 已读回执

### 10.1 发送已读

```json
{
  "action": "read",
  "channel": "webhub",
  "to": "user_12345",
  "messageId": "msg_abc123"
}
```

### 10.2 配置

```json
{
  "channels": {
    "webhub": {
      "readReceipts": {
        "enabled": true,
        "autoSend": true,     // 自动发送已读
        "delay": 1000        // 延迟发送（毫秒）
      }
    }
  }
}
```

---

## 11. 配置完整示例

```json
{
  "channels": {
    "webhub": {
      "enabled": true,
      
      "api": {
        "baseUrl": "https://your-website.com/api/webhub"
      },
      
      "webhook": {
        "path": "/webhook/webhub"
      },
      
      "message": {
        "maxLength": 10000,
        "chunkSize": 4000,
        "chunkMode": "sentence",
        "allowedFormats": ["plain", "markdown"],
        
        "media": {
          "maxSize": 104857600,
          "allowedTypes": ["image/*", "video/*", "audio/*", "application/pdf"],
          "downloadTimeout": 30000
        },
        
        "markdown": {
          "tables": true,
          "codeBlocks": true,
          "links": true
        }
      },
      
      "readReceipts": {
        "enabled": true,
        "autoSend": true,
        "delay": 1000
      },
      
      "actions": {
        "polls": true,
        "reactions": true,
        "buttons": true,
        "typing": true
      }
    }
  },
  
  "commands": {
    "enabled": true,
    "prefix": "/",
    "adminOnly": ["broadcast"]
  }
}
```

---

## 12. 快速参考

### 12.1 最小配置

```json
{
  "channels": {
    "webhub": {
      "enabled": true,
      "api": {
        "baseUrl": "https://your-website.com/api/webhub"
      }
    }
  }
}
```

### 12.2 发送消息速查

| 场景 | 方法 | 示例 |
|------|------|------|
| AI 回复 | Message Tool | 自动 |
| 投票 | `action: "poll"` | `/poll "Question" "A" "B"` |
| 反应 | `action: "react"` | `/react 👍` |
| 手动发送 | `/send` 命令 | `/send user_123 Hello!` |

---

## 13. 故障排除

### 13.1 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 消息发送失败 | 目标格式错误 | 检查 `to` 参数格式 |
| 媒体上传失败 | 超出大小限制 | 减小文件体积 |
| 按钮无响应 | 回调未配置 | 检查 Webhook 回调 |
| 表情反应失败 | Website 不支持 | 确认 Website API 支持 |

### 13.2 调试方法

```bash
# 启用详细日志
openclaw logs --level debug

# 查看消息发送日志
openclaw logs | grep "webhub.*send"

# 测试消息发送
openclaw channels test webhub --target user_123
```

---

*最后更新: 2026-02-06*
