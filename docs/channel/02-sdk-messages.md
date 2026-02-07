# OpenClaw Channel SDK - 消息接收机制

> **上一节**：[02-message-schema.md](02-message-schema.md)  
> **下一节**：[03-capabilities.md](03-capabilities.md)

---
## 1. SDK 消息接收概览



### 1.1 消息流向



```

┌─────────────────────────────────────────────────────────────┐

│                  Channel SDK 消息流向                       │

├─────────────────────────────────────────────────────────────┤

│                                                              │

│  Website [WebHub] ←──── WebHub Plugin ────→ Agent         │

│                                                              │

└─────────────────────────────────────────────────────────────┘

```



### 1.2 SDK 接收的消息类型



| 类型 | 说明 | 方向 |

|------|------|------|

| **InboundMessage** | 从 Website 接收的标准化消息 | Website → SDK |

| **OutboundParams** | 发送给 Website 的参数 | SDK → Website |

| **Message Actions** | 消息操作（react, poll 等） | SDK 处理 |

| **Gateway Events** | 生命周期事件 | SDK 管理 |
| 类型 | 说明 | 方向 |
|------|------|------|
| **InboundMessage** | 从 Website 接收的标准化消息 | Website → SDK |
| **OutboundParams** | 发送给 Website 的参数 | SDK → Website |
| **Message Actions** | 消息操作（react, poll 等） | SDK 处理 |
| **Gateway Events** | 生命周期事件 | SDK 管理 |

---

## 2. 核心消息接口

### 2.1 InboundMessage（SDK 标准入站消息）

```typescript
/**
 * SDK 标准入站消息 [Channel SDK 标准]
 * 
 * WebHubInboundMessage ◄── 映射 ──► InboundMessage
 */
interface InboundMessage {
  /** 消息唯一 ID [Channel SDK 标准] */
  id: string;
  
  /** 通道标识 [Channel SDK 标准] */
  channel: string;
  
  /** 发送者 ID [Channel SDK 标准] */
  authorId: string;
  
  /** 发送者显示名 [Channel SDK 标准] */
  authorDisplayName?: string;
  
  /** 消息文本内容 [Channel SDK 标准] */
  content: string;
  
  /** 时间戳 [Channel SDK 标准] */
  timestamp: number;
  
  /** 媒体附件 [SDK 标准 - 扩展为 WebHubMedia] */
  media?: Media[];
  
  /** 回复的消息 ID [Channel SDK 标准] */
  replyTo?: string;
}
```

### 2.2 OutboundParams（SDK 标准出站参数）

```typescript
/**
 * SDK 标准出站参数 [Channel SDK 标准]
 * 
 * WebHubOutboundParams ◄── 实现 ──► OutboundParams
 */
interface OutboundParams {
  /** 目标 [SDK 标准 - 修改为 WebHubTarget] */
  target: {
    type: "user" | "group";
    id: string;
  };
  
  /** 消息内容 [Channel SDK 标准] */
  content: string;
  
  /** 媒体附件 [SDK 标准 - 扩展为 WebHubMedia] */
  media?: Media[];
  
  /** 回复目标 [Channel SDK 标准] */
  replyTo?: string;
  
  /** 引用文本 [Channel SDK 标准] */
  quoteText?: string;
}
```

---

## 3. Channel Messaging Adapter（消息接收适配器）

> **Website 推送消息 → SDK 标准格式的桥梁**

```typescript
/**
 * Channel Messaging Adapter [Channel SDK 标准]
 * 
 * 职责：接收 Website 推送的消息并转换为 SDK 标准格式
 */
interface ChannelMessagingAdapter {
  
  /**
   * 规范化目标格式 [Channel SDK 标准]
   * 
   * 将 Website 原始目标字符串转换为标准格式
   * 
   * @param raw - Website 返回的原始目标 ID
   * @returns 规范化后的目标 ID
   */
  normalizeTarget?: (raw: string) => string | undefined;
  
  /**
   * 目标解析器 [Channel SDK 标准]
   * 
   * 验证目标 ID 格式是否正确
   */
  targetResolver?: {
    /**
     * 检查是否像有效的目标 ID
     */
    looksLikeId?: (raw: string, normalized?: string) => boolean;
    
    /**
     * 提示用户如何输入目标
     */
    hint?: string;
  };
  
  /**
   * 格式化目标显示 [Channel SDK 标准]
   * 
   * 将目标 ID 转换为友好的显示名称
   */
  formatTargetDisplay?: (params: {
    target: string;
    display?: string;
    kind?: "user" | "group" | "channel";
  }) => string;
}
```

### 3.1 WhatsApp 实现示例

```typescript
/**
 * WhatsApp Messaging Adapter [SDK 标准 - WhatsApp 实现]
 */
messaging: {
  // 规范化目标格式
  normalizeTarget: normalizeWhatsAppMessagingTarget,
  
  // 目标解析器
  targetResolver: {
    looksLikeId: looksLikeWhatsAppTargetId,
    hint: "<E.164|group JID>",
  },
},
```

### 3.2 WebHub 实现示例

```typescript
/**
 * WebHub Messaging Adapter [WebHub SDK - 实现 SDK 标准]
 */
messaging: {
  /**
   * 规范化目标格式
   * 
   * Website 返回: "user_12345"
   * 转换为: "user_12345"
   */
  normalizeTarget: (raw: string) => {
    return raw.trim();
  },
  
  /**
   * 验证目标 ID 格式
   */
  targetResolver: {
    looksLikeId: (raw: string) => {
      // 检查是否匹配 user_XXX 或 group_XXX 格式
      return /^user_\d+$/.test(raw) || /^group_\d+$/.test(raw);
    },
    hint: "<user_ID> 或 <group_ID>",
  },
},
```

---

## 4. Channel Outbound Adapter（消息发送适配器）

> **SDK 标准格式 → Website API 的桥梁**

```typescript
/**
 * Channel Outbound Adapter [Channel SDK 标准]
 * 
 * 职责：处理发送给 Website 的消息
 */
interface ChannelOutboundAdapter {
  
  /**
   * 目标模式 [Channel SDK 标准]
   * 
   * - explicit: 明确指定目标（用户必须提供）
   * - implicit: 隐式目标（使用默认）
   * - heartbeat: 心跳模式
   */
  mode?: "explicit" | "implicit" | "heartbeat";
  
  /**
   * 发送负载 [Channel SDK 标准]
   * 
   * 主要发送方法，处理完整的消息负载
   */
  sendPayload?: (ctx: ChannelOutboundPayloadContext) => Promise<OutboundDeliveryResult>;
  
  /**
   * 发送纯文本 [Channel SDK 标准]
   * 
   * @param ctx - 发送上下文
   * @returns 发送结果
   */
  sendText?: (ctx: ChannelOutboundContext) => Promise<OutboundDeliveryResult>;
  
  /**
   * 发送媒体消息 [Channel SDK 标准]
   * 
   * @param ctx - 发送上下文
   * @returns 发送结果
   */
  sendMedia?: (ctx: ChannelOutboundContext) => Promise<OutboundDeliveryResult>;
}

/**
 * 发送上下文 [Channel SDK 标准]
 */
interface ChannelOutboundContext {
  /** 目标 [SDK 标准 - WebHub 修改] */
  to: {
    type: "user" | "group" | "channel";
    id: string;
  };
  
  /** 文本内容 [Channel SDK 标准] */
  text: string;
  
  /** 媒体 URL [Channel SDK 标准] */
  mediaUrl?: string;
  
  /** 附件 [Channel SDK 标准] */
  attachments?: string[];
  
  /** 回复的消息 ID [Channel SDK 标准] */
  replyTo?: string;
}

/**
 * 发送结果 [Channel SDK 标准]
 */
interface OutboundDeliveryResult {
  /** 消息 ID [Channel SDK 标准] */
  messageId: string;
  
  /** 时间戳 [Channel SDK 标准] */
  timestamp: number;
  
  /** 错误信息 [Channel SDK 标准] */
  error?: {
    code: string;
    message: string;
  };
}
```

### 4.1 WhatsApp 实现示例

```typescript
/**
 * WhatsApp Outbound Adapter [SDK 标准 - WhatsApp 实现]
 */
outbound: {
  deliveryMode: "gateway",
  
  // 文本分块器
  chunker: (text, limit) => getWhatsAppRuntime().channel.text.chunkText(text, limit),
  chunkerMode: "text",
  textChunkLimit: 4000,
  
  // 投票最大选项数
  pollMaxOptions: 12,
  
  // 解析目标
  resolveTarget: ({ to, allowFrom, mode }) => {
    const trimmed = to?.trim() ?? "";
    const normalizedTo = normalizeWhatsAppTarget(trimmed);
    return { ok: true, to: normalizedTo };
  },
  
  // 发送文本
  sendText: async ({ to, text, accountId }) => {
    const result = await runtime.sendMessage(to, text);
    return { channel: "whatsapp", ...result };
  },
  
  // 发送媒体
  sendMedia: async ({ to, text, mediaUrl, accountId }) => {
    const result = await runtime.sendMessage(to, text, { mediaUrl });
    return { channel: "whatsapp", ...result };
  },
},
```

### 4.2 WebHub 实现示例

```typescript
/**
 * WebHub Outbound Adapter [WebHub SDK - 实现 SDK 标准]
 */
outbound: {
  deliveryMode: "gateway",
  
  // 目标模式
  mode: "explicit",
  
  // 解析目标
  resolveTarget: ({ to, allowFrom, mode }) => {
    if (!to) {
      return {
        ok: false,
        error: { code: "MISSING_TARGET", message: "目标不能为空" },
      };
    }
    
    return {
      ok: true,
      to: {
        type: to.startsWith("group_") ? "group" : "user",
        id: to,
      },
    };
  },
  
  // 发送文本消息
  sendText: async ({ to, text, replyTo }) => {
    const response = await fetch(`${config.api.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.api.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: {
          type: to.type,
          id: to.id,
        },
        content: {
          text,
          format: "markdown",
        },
        replyTo: replyTo ? { messageId: replyTo } : undefined,
      }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error.message);
    }
    
    return {
      messageId: result.messageId,
      timestamp: result.timestamp,
    };
  },
},
```

---

## 5. Message Actions（消息操作）

> **SDK 定义的标准消息操作动作**

### 5.1 支持的动作类型

```typescript
/**
 * SDK 定义的消息动作名称 [Channel SDK 标准]
 */
const CHANNEL_MESSAGE_ACTION_NAMES = [
  "send",           // 发送消息
  "broadcast",       // 广播消息
  "poll",           // 发送投票
  "react",          // 添加反应
  "reactions",      // 管理反应
  "read",           // 标记已读
  "edit",           // 编辑消息
  "unsend",         // 删除消息
  "reply",          // 回复消息
  "sendWithEffect", // 发送特效消息
  // ... 更多操作
] as const;
```

### 5.2 Channel Message Action Adapter

```typescript
/**
 * Channel Message Action Adapter [Channel SDK 标准]
 * 
 * 职责：处理消息操作（react, poll, edit 等）
 */
interface ChannelMessageActionAdapter {
  
  /**
   * 列出支持的动作 [Channel SDK 标准]
   */
  listActions?: (params: {
    cfg: OpenClawConfig;
  }) => ChannelMessageActionName[];
  
  /**
   * 检查是否支持某个动作 [Channel SDK 标准]
   */
  supportsAction?: (params: {
    action: ChannelMessageActionName;
  }) => boolean;
  
  /**
   * 检查是否支持按钮 [Channel SDK 标准]
   */
  supportsButtons?: (params: {
    cfg: OpenClawConfig;
  }) => boolean;
  
  /**
   * 检查是否支持卡片 [Channel SDK 标准]
   */
  supportsCards?: (params: {
    cfg: OpenClawConfig;
  }) => boolean;
  
  /**
   * 提取工具发送目标 [Channel SDK 标准]
   */
  extractToolSend?: (params: {
    args: Record<string, unknown>;
  }) => {
    to: string;
    accountId?: string | null;
  } | null;
  
  /**
   * 处理动作 [Channel SDK 标准]
   * 
   * 核心方法：执行消息操作
   */
  handleAction?: (ctx: ChannelMessageActionContext) => Promise<AgentToolResult<unknown>>;
}
```

### 5.3 WhatsApp Actions 实现示例

```typescript
/**
 * WhatsApp Actions [SDK 标准 - WhatsApp 实现]
 */
actions: {
  // 列出支持的动作
  listActions: ({ cfg }) => {
    if (!cfg.channels?.whatsapp) {
      return [];
    }
    
    const actions = new Set<ChannelMessageActionName>();
    
    if (gate("reactions")) {
      actions.add("react");
    }
    if (gate("polls")) {
      actions.add("poll");
    }
    
    return Array.from(actions);
  },
  
  // 检查是否支持动作
  supportsAction: ({ action }) => action === "react" || action === "poll",
  
  // 处理动作
  handleAction: async ({ action, params, cfg, accountId }) => {
    if (action === "react") {
      const messageId = readStringParam(params, "messageId", { required: true });
      const emoji = readStringParam(params, "emoji", { allowEmpty: true });
      const remove = params.remove;
      
      await runtime.handleWhatsAppAction({
        action: "react",
        chatJid: readStringParam(params, "chatJid") ?? readStringParam(params, "to", { required: true }),
        messageId,
        emoji,
        remove,
        participant: readStringParam(params, "participant"),
        accountId: accountId ?? undefined,
      });
      
      return jsonResult({ success: true });
    }
    
    throw new Error(`Action ${action} not supported`);
  },
},
```

---

## 6. Channel Gateway Adapter（生命周期适配器）

> **管理 Channel Plugin 的生命周期**

```typescript
/**
 * Channel Gateway Adapter [Channel SDK 标准]
 * 
 * 职责：管理账号的连接、登录、登出等生命周期
 */
interface ChannelGatewayAdapter<ResolvedAccount = unknown> {
  
  /**
   * 启动账号监听 [Channel SDK 标准]
   * 
   * 开始监听 Website 的消息事件
   */
  startAccount?: (ctx: ChannelGatewayContext<ResolvedAccount>) => Promise<unknown>;
  
  /**
   * 停止账号监听 [Channel SDK 标准]
   * 
   * 停止监听并清理资源
   */
  stopAccount?: (ctx: ChannelGatewayContext<ResolvedAccount>) => Promise<void>;
  
  /**
   * 二维码登录开始 [Channel SDK 标准]
   */
  loginWithQrStart?: (params: {
    accountId: string;
    force?: boolean;
    timeoutMs?: number;
    verbose?: boolean;
  }) => Promise<void>;
  
  /**
   * 二维码登录等待 [Channel SDK 标准]
   */
  loginWithQrWait?: (params: {
    accountId: string;
    timeoutMs?: number;
  }) => Promise<void>;
  
  /**
   * 退出登录 [Channel SDK 标准]
   */
  logoutAccount?: (ctx: ChannelLogoutContext<ResolvedAccount>) => Promise<ChannelLogoutResult>;
}

/**
 * Gateway 上下文 [Channel SDK 标准]
 */
interface ChannelGatewayContext<ResolvedAccount = unknown> {
  /** 账号信息 [Channel SDK 标准] */
  account: ResolvedAccount;
  
  /** 账号 ID [Channel SDK 标准] */
  accountId: string;
  
  /** 日志 [Channel SDK 标准] */
  log?: Logger;
  
  /** 运行时 [Channel SDK 标准] */
  runtime?: unknown;
  
  /** 取消信号 [Channel SDK 标准] */
  abortSignal?: AbortSignal;
}
```

### 6.1 WhatsApp Gateway 实现示例

```typescript
/**
 * WhatsApp Gateway Adapter [SDK 标准 - WhatsApp 实现]
 */
gateway: {
  // 启动账号监听
  startAccount: async (ctx) => {
    const { e164, jid } = runtime.readWebSelfId(ctx.account.authDir);
    ctx.log?.info(`[${ctx.accountId}] starting provider`);
    
    return runtime.monitorWebChannel(
      runtime.shouldLogVerbose(),
      undefined,
      true,
      undefined,
      ctx.runtime,
      ctx.abortSignal,
      {
        statusSink: (next) => ctx.setStatus({ accountId: ctx.accountId, ...next }),
        accountId: ctx.accountId,
      },
    );
  },
  
  // 二维码登录开始
  loginWithQrStart: async ({ accountId, force, timeoutMs, verbose }) => {
    await runtime.startWebLoginWithQr({
      accountId,
      force,
      timeoutMs,
      verbose,
    });
  },
  
  // 等待登录完成
  loginWithQrWait: async ({ accountId, timeoutMs }) => {
    await runtime.waitForWebLogin({ accountId, timeoutMs });
  },
  
  // 退出登录
  logoutAccount: async ({ account, runtime }) => {
    const cleared = await runtime.logoutWeb({
      authDir: account.authDir,
      isLegacyAuthDir: account.isLegacyAuthDir,
      runtime,
    });
    
    return { cleared, loggedOut: cleared };
  },
},
```

---

## 7. 消息接收完整流程



### 7.1 时序图



![消息接收流程](images/diagram-sdk-inbound-flow.png)



### 7.2 流程说明



```

Website Event (用户发送消息)

         │

         ▼

┌──────────────────────────────┐

│  Website Webhook            │  ← Website 推送消息

│  POST /webhub/webhook       │

│  {                          │

│    id: "msg_001",          │

│    sender: {...},           │

│    content: {...}           │

│  }                          │

└──────────────────────────────┘

         │

         ▼

┌──────────────────────────────┐

│  WebHub onMessage Handler   │  ← 消息处理入口
│  messagingAdapter.onMessage  │

└──────────────────────────────┘

         │

         ▼

┌──────────────────────────────┐

│  消息规范化                 │  ← ChannelMessagingAdapter
│  - normalizeTarget()        │
│  - validateTarget()        │
│  - formatTargetDisplay()    │

└──────────────────────────────┘

         │

         ▼

┌──────────────────────────────┐

│  转换为 SDK 格式             │  ← 格式映射
│  WebHubInboundMessage       │
│         ↓                   │
│  InboundMessage            │
│  {                         │

│    id: "msg_001",          │

│    authorId: "user_123",   │

│    content: "Hello",       │

│    timestamp: 1707210000    │

│  }                         │

└──────────────────────────────┘

         │

         ▼

   SDK Gateway (路由到 Agent)

```

## 8. 消息发送完整流程



### 8.1 时序图



![消息发送流程](images/diagram-sdk-outbound-flow.png)



### 8.2 流程说明



```

   SDK Agent Session

         │

         ▼

┌──────────────────────────────┐

│  message tool               │  ← 用户发送消息

│  to: "user_123",          │

│  message: "Hello!"         │

└──────────────────────────────┘

         │

         ▼

┌──────────────────────────────┐

│  SDK Gateway              │  ← 消息路由
│  - 验证目标               │
│  - 构建 OutboundParams    │

└──────────────────────────────┘

         │

         ▼

┌──────────────────────────────┐

│  Channel Outbound Adapter   │  ← 发送适配器
│  outbound.sendText()      │
│  - resolveTarget()       │
│  - chunkText()          │

└──────────────────────────────┘

         │

         ▼

┌──────────────────────────────┐

│  转换为 Website 格式         │  ← 格式映射
│  OutboundParams            │
│         ↓                 │
│  WebHubOutboundMessage   │
│  {                       │

│    messageId: "msg_001",  │

│    target: {              │

│      type: "user",       │

│      id: "user_123"      │

│    },                    │

│    content: {           │

│      text: "Hello!",    │

│      format: "markdown"  │

│    }                     │

│  }                       │

└──────────────────────────────┘

         │

         ▼

┌──────────────────────────────┐

│  Website REST API            │  ← HTTP 请求
│  POST /api/webhub/messages │

└──────────────────────────────┘

```


---
```

---

## 9. 适配器完整列表

| 适配器 | 职责 | 关键方法 |
|--------|------|----------|
| **messaging** | 接收消息规范化 | `normalizeTarget`, `targetResolver` |
| **outbound** | 发送消息处理 | `sendPayload`, `sendText`, `sendMedia` |
| **gateway** | 生命周期管理 | `startAccount`, `stopAccount`, `login*`, `logout*` |
| **actions** | 消息操作处理 | `handleAction`, `supportsAction`, `listActions` |
| **heartbeat** | 心跳检测 | `checkReady`, `resolveRecipients` |
| **status** | 状态收集 | `collectStatusIssues`, `buildAccountSnapshot` |
| **security** | 安全策略 | `resolveDmPolicy`, `collectWarnings` |
| **directory** | 用户/群组目录 | `self`, `listPeers`, `listGroups` |
| **groups** | 群组管理 | `resolveRequireMention`, `resolveToolPolicy` |
| **mentions** | @提及处理 | `stripPatterns` |
| **config** | 配置适配 | `listAccountIds`, `resolveAccount`, `defaultAccountId` |
| **onboarding** | 引导流程 | 实现登录/配对引导 |
| **pairing** | 配对管理 | `idLabel` 等 |
| **commands** | 命令处理 | `enforceOwnerForCommands` |
| **setup** | 账号设置 | `resolveAccountId`, `applyAccountName` |

---

## 10. 快速参考

### 10.1 消息类型速查

| 场景 | 类型 | 来源 | 目标 |
|------|------|------|------|
| 接收消息 | `InboundMessage` | Website | SDK 标准 |
| 发送参数 | `OutboundParams` | SDK | Website |
| Website 格式 | `WebHubInboundMessage` | Website | WebHub |
| Website 格式 | `WebHubOutboundMessage` | WebHub | Website |

### 10.2 适配器速查

| 适配器 | 方向 | 必需 | 主要方法 |
|--------|------|------|----------|
| **config** | 配置 | ✅ | `listAccountIds`, `resolveAccount` |
| **messaging** | 接收 | ✅ | `normalizeTarget` |
| **outbound** | 发送 | ✅ | `sendText`, `sendMedia` |
| **gateway** | 生命周期 | ❌ | `startAccount`, `stopAccount` |
| **actions** | 操作 | ❌ | `handleAction` |
| **heartbeat** | 心跳 | ❌ | `checkReady` |
| **status** | 状态 | ❌ | `buildAccountSnapshot` |

---

## 11. 图片索引

| 图片 | 说明 | 位置 |
|------|------|------|
| ![消息接收流程](images/diagram-sdk-inbound-flow.png) | 消息从 Website 接收的完整流程 | docs/images/diagram-sdk-inbound-flow.png |
| ![消息发送流程](images/diagram-sdk-outbound-flow.png) | 消息发送给 Website 的完整流程 | docs/images/diagram-sdk-outbound-flow.png |

---

*最后更新: 2026-02-06*
