# OpenClaw WebHub Channel - 消息模式设计

> **上一节**：[01-overview.md](01-overview.md)  
> **下一节**：[02-sdk-messages.md](02-sdk-messages.md)

---

## 0. 类型关系概览

### 0.1 三层类型架构

![类型层级总览](images/diagram-type-layers.png)

| 层级 | 名称 | 说明 | 类型前缀 |
|------|------|------|----------|
| **第三层** | WebHub | Website 需要实现的 JSON 格式 | 无 |
| **第二层** | WebHub SDK | WebHub Plugin 使用的适配类型 | `WebHub` |
| **第一层** | Channel SDK | OpenClaw SDK 标准类型，直接使用 | 无 |

### 0.2 类型继承关系

![类型继承关系](images/diagram-type-inheritance.png)

### 0.3 关系说明

| 符号 | 含义 | 说明 |
|------|------|------|
| **Website 实现** | Website 开发者需要提供和解析的类型 | JSON 格式 |
| **WebHub SDK 适配** | WebHub Plugin 内部使用的类型 | JavaScript/TypeScript |
| **Channel SDK 标准** | OpenClaw SDK 定义的接口 | 接口定义 |
| **Extends** | 继承自 SDK | WebHub 类型扩展 SDK |
| **Maps** | 映射自 SDK | WebHub 转换 SDK |
| **Modifies** | 修改自 SDK | WebHub 修改 SDK 结构 |

---

## 1. 类型命名空间

| 层级 | 命名空间 | 前缀 | 说明 |
|------|----------|------|------|
| **WebHub** | Website API | 无 | Website 开发者需要实现的 JSON 格式 |
| **WebHub SDK** | WebHub Types | `WebHub` | WebHub Plugin 内部使用的类型 |
| **Channel SDK** | SDK Types | 无 | SDK 标准类型，直接使用 |

---

## 2. Channel SDK 类型（标准层）

> **SDK 标准类型，WebHub 直接使用**
> 
> **关系标记**: `[Channel SDK 标准]`

### 2.1 核心 SDK 类型

```typescript
/**
 * Channel Plugin 主接口 [Channel SDK 标准]
 * 
 * 所有 Channel 插件必须实现此接口
 * 
 * WebHubPlugin ◄── 实现 ──► ChannelPlugin
 */
interface ChannelPlugin<T = ResolvedAccount> {
  /** 插件 ID [Channel SDK 标准] */
  id: string;
  
  /** 元信息 [Channel SDK 标准] */
  meta: ChannelMeta;
  
  /** 能力声明 [Channel SDK 标准] */
  capabilities: ChannelCapabilities;
  
  /** 配置适配器 [Channel SDK 标准] */
  config: ChannelConfigAdapter<T>;
  
  /** 消息适配器 [Channel SDK 标准] */
  messaging?: ChannelMessagingAdapter<T>;
  
  /** 发送适配器 [Channel SDK 标准] */
  outbound?: ChannelOutboundAdapter<T>;
  
  /** 网关适配器 [Channel SDK 标准] */
  gateway?: ChannelGatewayAdapter<T>;
  
  /** Agent 工具 [Channel SDK 标准] */
  agentTools?: () => AgentTool[];
  
  /** 安全适配器 [Channel SDK 标准] */
  security?: ChannelSecurityAdapter<T>;
  
  /** 状态适配器 [Channel SDK 标准] */
  status?: ChannelStatusAdapter<T>;
  
  /** 心跳适配器 [Channel SDK 标准] */
  heartbeat?: ChannelHeartbeatAdapter<T>;
  
  /** 群组适配器 [Channel SDK 标准] */
  groups?: ChannelGroupsAdapter<T>;
  
  /** 目录适配器 [Channel SDK 标准] */
  directory?: ChannelDirectoryAdapter<T>;
  
  /** 操作适配器 [Channel SDK 标准] */
  actions?: ChannelMessageActionAdapter<T>;
  
  /** @提及适配器 [Channel SDK 标准] */
  mentions?: ChannelMentionsAdapter<T>;
}

/**
 * 入站消息类型 [Channel SDK 标准]
 * 
 * WebHubInboundMessage ◄── 映射 ──► InboundMessage
 */
interface InboundMessage {
  /** 消息唯一 ID [Channel SDK 标准] */
  id: string;
  
  /** 通道标识 [Channel SDK 标准] */
  channel: string;
  
  /** 发送者对象 [Channel SDK 标准] */
  sender: {
    /** 发送者 ID */
    id: string;
    /** 发送者显示名 */
    displayName?: string;
    /** 头像 URL */
    avatarUrl?: string;
  };
  
  /** 消息文本内容 [Channel SDK 标准] */
  content: string;
  
  /** 时间戳 [Channel SDK 标准] */
  timestamp: number;
  
  /** 媒体附件 [Channel SDK 标准] */
  media?: Media[];
  
  /** 回复引用 [Channel SDK 标准] */
  replyTo?: {
    messageId: string;
    quotedText?: string;
  };
}

/**
 * 媒体类型 [Channel SDK 标准]
 * 
 * WebHubMedia ◄── 扩展 ──► Media
 */
interface Media {
  /** 媒体类型 [Channel SDK 标准] */
  type: "image" | "video" | "audio" | "file";
  
  /** 媒体 URL [Channel SDK 标准] */
  url: string;
  
  /** MIME 类型 [Channel SDK 标准] */
  mimeType?: string;
  
  /** 文件大小（字节）[Channel SDK 标准] */
  size?: number;
  
  /** 图片宽度（像素）[Channel SDK 标准] */
  width?: number;
  
  /** 图片高度（像素）[Channel SDK 标准] */
  height?: number;
  
  /** 音视频时长（秒）[Channel SDK 标准] */
  duration?: number;
}

/**
 * 消息目标类型 [Channel SDK 标准]
 * 
 * WebHubTarget ◄── 修改 ──► ChannelTarget
 */
interface ChannelTarget {
  /** 目标类型 [Channel SDK 标准] */
  type: "user" | "group";
  
  /** 目标 ID [Channel SDK 标准] */
  id: string;
}

/**
 * Channel Capabilities [Channel SDK 标准]
 */
interface ChannelCapabilities {
  /** 支持的聊天类型 [Channel SDK 标准] */
  chatTypes: ("direct" | "group")[];
  
  /** 是否支持投票 [Channel SDK 标准] */
  polls?: boolean;
  
  /** 是否支持表情反应 [Channel SDK 标准] */
  reactions?: boolean;
  
  /** 是否支持消息编辑 [Channel SDK 标准] */
  edit?: boolean;
  
  /** 是否支持消息删除 [Channel SDK 标准] */
  unsend?: boolean;
  
  /** 是否支持消息回复 [Channel SDK 标准] */
  reply?: boolean;
  
  /** 是否支持消息线程 [Channel SDK 标准] */
  threads?: boolean;
  
  /** 是否支持媒体消息 [Channel SDK 标准] */
  media?: boolean;
  
  /** 是否支持特效 [Channel SDK 标准] */
  effects?: boolean;
  
  /** 是否支持群组管理 [Channel SDK 标准] */
  groupManagement?: boolean;
  
  /** 是否支持原生命令 [Channel SDK 标准] */
  nativeCommands?: boolean;
  
  /** 是否阻止流式传输 [Channel SDK 标准] */
  blockStreaming?: boolean;
}

/**
 * Channel Messaging Adapter [Channel SDK 标准]
 * 
 * 负责接收和规范化消息
 */
interface ChannelMessagingAdapter {
  /** 规范化目标格式 [Channel SDK 标准] */
  normalizeTarget?: (raw: string) => string | undefined;
  
  /** 目标解析器 [Channel SDK 标准] */
  targetResolver?: {
    looksLikeId?: (raw: string, normalized?: string) => boolean;
    hint?: string;
  };
  
  /** 格式化目标显示 [Channel SDK 标准] */
  formatTargetDisplay?: (params: {
    target: string;
    display?: string;
    kind?: ChannelDirectoryEntryKind;
  }) => string;
}

/**
 * Channel Outbound Adapter [Channel SDK 标准]
 * 
 * 负责发送消息
 */
interface ChannelOutboundAdapter {
  /** 目标模式 [Channel SDK 标准] */
  mode?: "explicit" | "implicit" | "heartbeat";
  
  /** 发送负载 [Channel SDK 标准] */
  sendPayload?: (ctx: ChannelOutboundPayloadContext) => Promise<OutboundDeliveryResult>;
  
  /** 发送纯文本 [Channel SDK 标准] */
  sendText?: (ctx: ChannelOutboundContext) => Promise<OutboundDeliveryResult>;
  
  /** 发送媒体 [Channel SDK 标准] */
  sendMedia?: (ctx: ChannelOutboundContext) => Promise<OutboundDeliveryResult>;
}

/**
 * 发送上下文 [Channel SDK 标准] */
interface ChannelOutboundContext {
  /** 目标 [Channel SDK 标准] */
  to: {
    type: "user" | "group";
    id: string;
  };
  
  /** 文本内容 [Channel SDK 标准] */
  text: string;
  
  /** 媒体 URL [Channel SDK 标准] */
  mediaUrl?: string;
  
  /** 回复的消息 ID [Channel SDK 标准] */
  replyTo?: string;
  
  /** 引用文本 [Channel SDK 标准] */
  quoteText?: string;
}

/**
 * 发送结果 [Channel SDK 标准] */
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

/**
 * Channel Gateway Adapter [Channel SDK 标准]
 * 
 * 负责账号生命周期管理
 */
interface ChannelGatewayAdapter<ResolvedAccount = unknown> {
  /** 启动账号监听 [Channel SDK 标准] */
  startAccount?: (ctx: ChannelGatewayContext<ResolvedAccount>) => Promise<unknown>;
  
  /** 停止账号监听 [Channel SDK 标准] */
  stopAccount?: (ctx: ChannelGatewayContext<ResolvedAccount>) => Promise<void>;
  
  /** 二维码登录开始 [Channel SDK 标准] */
  loginWithQrStart?: (params: {
    accountId: string;
    force?: boolean;
    timeoutMs?: number;
    verbose?: boolean;
  }) => Promise<void>;
  
  /** 二维码登录等待 [Channel SDK 标准] */
  loginWithQrWait?: (params: {
    accountId: string;
    timeoutMs?: number;
  }) => Promise<void>;
  
  /** 退出登录 [Channel SDK 标准] */
  logoutAccount?: (ctx: ChannelLogoutContext<ResolvedAccount>) => Promise<ChannelLogoutResult>;
}

/**
 * Gateway 上下文 [Channel SDK 标准] */
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

/**
 * Channel Message Action Adapter [Channel SDK 标准]
 * 
 * 负责处理消息操作
 */
interface ChannelMessageActionAdapter {
  /** 列出支持的动作 [Channel SDK 标准] */
  listActions?: (params: {
    cfg: OpenClawConfig;
  }) => ChannelMessageActionName[];
  
  /** 检查是否支持动作 [Channel SDK 标准] */
  supportsAction?: (params: {
    action: ChannelMessageActionName;
  }) => boolean;
  
  /** 处理动作 [Channel SDK 标准] */
  handleAction?: (ctx: ChannelMessageActionContext) => Promise<AgentToolResult<unknown>>;
}

/**
 * 消息动作上下文 [Channel SDK 标准] */
interface ChannelMessageActionContext {
  /** 频道 ID [Channel SDK 标准] */
  channel: ChannelId;
  
  /** 动作名称 [Channel SDK 标准] */
  action: ChannelMessageActionName;
  
  /** 配置 [Channel SDK 标准] */
  cfg: OpenClawConfig;
  
  /** 参数 [Channel SDK 标准] */
  params: Record<string, unknown>;
  
  /** 账号 ID [Channel SDK 标准] */
  accountId?: string | null;
}

/**
 * Channel Config Adapter [Channel SDK 标准]
 * 
 * 负责配置管理
 */
interface ChannelConfigAdapter<T = ResolvedAccount> {
  /** 列出账号 ID [Channel SDK 标准] */
  listAccountIds: (cfg: FullConfig) => string[];
  
  /** 解析账号 [Channel SDK 标准] */
  resolveAccount: (cfg: FullConfig, accountId: string) => ResolvedAccount;
  
  /** 默认账号 ID [Channel SDK 标准] */
  defaultAccountId: (cfg: FullConfig) => string;
  
  /** 设置账号启用状态 [Channel SDK 标准] */
  setAccountEnabled?: (params: {
    cfg: FullConfig;
    accountId: string;
    enabled: boolean;
  }) => FullConfig;
  
  /** 删除账号 [Channel SDK 标准] */
  deleteAccount?: (params: {
    cfg: FullConfig;
    accountId: string;
  }) => FullConfig;
}

/**
 * Channel Security Adapter [Channel SDK 标准]
 * 
 * 负责安全策略
 */
interface ChannelSecurityAdapter<ResolvedAccount = unknown> {
  /** 解析 DM 策略 [Channel SDK 标准] */
  resolveDmPolicy?: (params: {
    cfg: OpenClawConfig;
    accountId?: string;
    account: ResolvedAccount;
  }) => {
    policy: "pairing" | "allowlist" | "open" | "disabled";
    allowFrom: string[];
    policyPath: string;
    allowFromPath: string;
    approveHint: string;
    normalizeEntry: (raw: string) => string;
  };
  
  /** 收集警告 [Channel SDK 标准] */
  collectWarnings?: (params: {
    account: ResolvedAccount;
    cfg: OpenClawConfig;
  }) => string[];
}

/**
 * Channel Status Adapter [Channel SDK 标准]
 * 
 * 负责状态收集
 */
interface ChannelStatusAdapter<ResolvedAccount = unknown> {
  /** 默认运行时状态 [Channel SDK 标准] */
  defaultRuntime?: {
    accountId: string;
    running: boolean;
    connected: boolean;
    reconnectAttempts: number;
    lastConnectedAt: number | null;
    lastDisconnect: number | null;
    lastMessageAt: number | null;
    lastEventAt: number | null;
    lastError: string | null;
  };
  
  /** 收集状态问题 [Channel SDK 标准] */
  collectStatusIssues?: (account: ResolvedAccount, snapshot: unknown, cfg: OpenClawConfig) => ChannelStatusIssue[];
  
  /** 构建账号快照 [Channel SDK 标准] */
  buildAccountSnapshot?: (params: {
    account: ResolvedAccount;
    runtime?: unknown;
  }) => Promise<ChannelAccountSnapshot>;
}

/**
 * Channel Heartbeat Adapter [Channel SDK 标准]
 * 
 * 负责心跳检测
 */
interface ChannelHeartbeatAdapter<ResolvedAccount = unknown> {
  /** 检查就绪状态 [Channel SDK 标准] */
  checkReady?: (params: {
    cfg: OpenClawConfig;
    accountId?: string;
    deps?: ChannelHeartbeatDeps;
  }) => Promise<{
    ok: boolean;
    reason?: string;
  }>;
  
  /** 解析心跳接收者 [Channel SDK 标准] */
  resolveRecipients?: (params: {
    cfg: OpenClawConfig;
    opts?: {
      recipients?: string[];
    };
  }) => string[];
}

/**
 * Channel Directory Adapter [Channel SDK 标准]
 * 
 * 负责用户/群组目录
 */
interface ChannelDirectoryAdapter<ResolvedAccount = unknown> {
  /** 获取自身信息 [Channel SDK 标准] */
  self?: (params: {
    cfg: OpenClawConfig;
    accountId?: string;
  }) => Promise<ChannelDirectoryEntry | null>;
  
  /** 列出用户 [Channel SDK 标准] */
  listPeers?: (params: {
    cfg: OpenClawConfig;
    accountId?: string;
  }) => Promise<ChannelDirectoryEntry[]>;
  
  /** 列出群组 [Channel SDK 标准] */
  listGroups?: (params: {
    cfg: OpenClawConfig;
    accountId?: string;
  }) => Promise<ChannelDirectoryEntry[]>;
}

/**
 * Channel Groups Adapter [Channel SDK 标准]
 * 
 * 负责群组管理
 */
interface ChannelGroupsAdapter<ResolvedAccount = unknown> {
  /** 解析是否需要 @提及 [Channel SDK 标准] */
  resolveRequireMention?: (params: {
    cfg: OpenClawConfig;
    groupId: string;
  }) => Promise<boolean>;
  
  /** 解析工具策略 [Channel SDK 标准] */
  resolveToolPolicy?: (params: {
    cfg: OpenClawConfig;
    groupId: string;
  }) => {
    allow?: string[];
    deny?: string[];
  };
}

/**
 * Channel Mentions Adapter [Channel SDK 标准]
 * 
 * 负责 @提及处理
 */
interface ChannelMentionsAdapter {
  /** 移除提及模式 [Channel SDK 标准] */
  stripPatterns?: (params: {
    ctx: {
      To?: string;
    };
  }) => string[];
}

/**
 * 目录条目 [Channel SDK 标准] */
interface ChannelDirectoryEntry {
  /** 条目类型 [Channel SDK 标准] */
  kind: "user" | "group" | "channel";
  
  /** 条目 ID [Channel SDK 标准] */
  id: string;
  
  /** 显示名称 [Channel SDK 标准] */
  name?: string;
  
  /** 处理 [Channel SDK 标准] */
  handle?: string;
  
  /** 头像 URL [Channel SDK 标准] */
  avatarUrl?: string;
  
  /** 排序优先级 [Channel SDK 标准] */
  rank?: number;
  
  /** 原始数据 [Channel SDK 标准] */
  raw?: unknown;
}

/**
 * Channel 插件运行时 [Channel SDK 标准] */
interface PluginRuntime {
  /** 插件 ID [Channel SDK 标准] */
  id: string;
  
  /** 工具列表 [Channel SDK 标准] */
  tools: AgentTool[];
}

/**
 * Channel 消息动作名称 [Channel SDK 标准] */
const CHANNEL_MESSAGE_ACTION_NAMES = [
  "send",
  "broadcast",
  "poll",
  "react",
  "reactions",
  "read",
  "edit",
  "unsend",
  "reply",
  "sendWithEffect",
  "renameGroup",
  "setGroupIcon",
  "addParticipant",
  "removeParticipant",
  "leaveGroup",
  "delete",
  "pin",
  "unpin",
  "thread-create",
  "thread-list",
  "thread-reply",
] as const;
```

---

## 3. WebHub SDK 类型（适配层）

> **WebHub Plugin 实现使用的类型**
> 
> **关系标记**: `[WebHub SDK]`

### 3.1 插件主类型

```typescript
/**
 * WebHub 插件主类型 [WebHub SDK]
 * 
 * 继承关系:
 * ChannelPlugin<T> ◄── 实现 ──► WebHubPlugin<T>
 */
interface WebHubPlugin<T = ResolvedWebHubAccount> extends ChannelPlugin<T> {
  /** 插件 ID [Channel SDK 标准] */
  id: "webhub";
  
  /** 元信息 [Channel SDK 标准] */
  meta: ChannelMeta;
  
  /** 能力声明 [Channel SDK 标准] */
  capabilities: ChannelCapabilities;
  
  /** 配置适配器 [Channel SDK 标准] */
  config: ChannelConfigAdapter<T>;
  
  /** 消息适配器 [WebHub SDK] */
  messaging?: ChannelMessagingAdapter;
  
  /** 发送适配器 [WebHub SDK] */
  outbound?: ChannelOutboundAdapter;
  
  /** 网关适配器 [WebHub SDK] */
  gateway?: ChannelGatewayAdapter<T>;
  
  /** Agent 工具 [WebHub SDK] */
  agentTools?: () => AgentTool[];
  
  /** 安全适配器 [WebHub SDK] */
  security?: ChannelSecurityAdapter<T>;
  
  /** 状态适配器 [WebHub SDK] */
  status?: ChannelStatusAdapter<T>;
  
  /** 心跳适配器 [WebHub SDK] */
  heartbeat?: ChannelHeartbeatAdapter<T>;
  
  /** 群组适配器 [WebHub SDK] */
  groups?: ChannelGroupsAdapter<T>;
  
  /** 目录适配器 [WebHub SDK] */
  directory?: ChannelDirectoryAdapter<T>;
  
  /** 操作适配器 [WebHub SDK] */
  actions?: ChannelMessageActionAdapter;
  
  /** @提及适配器 [WebHub SDK] */
  mentions?: ChannelMentionsAdapter;
}
```

### 3.2 配置类型

```typescript
import { z } from "zod";

/**
 * WebHub 配置类型 [WebHub SDK]
 * 
 * 继承关系:
 * ChannelConfig ◄── 扩展 ──► WebHubConfig
 */
interface WebHubConfig {
  
  /** API 配置 [WebHub SDK] */
  api: {
    /** API 基础 URL [WebHub SDK] */
    baseUrl: string;
    
    /** API 密钥 [WebHub SDK] */
    apiKey?: string;
    
    /** 访问令牌 [WebHub SDK] */
    accessToken?: string;
    
    /** Webhook 签名密钥 [WebHub SDK] */
    signatureKey?: string;
    
    /** 签名算法 [WebHub SDK] */
    signatureAlgorithm?: "sha256" | "sha512";
  };
  
  /** Webhook 配置 [WebHub SDK] */
  webhook: {
    /** Webhook 路径 [WebHub SDK] */
    path: string;
    
    /** Webhook 密钥 [WebHub SDK] */
    secret?: string;
  };
  
  /** 字段映射 [WebHub SDK] */
  mapping?: {
    userIdField?: string;
    messageIdField?: string;
    timestampFormat?: "unix" | "iso8601" | "milliseconds";
    textFormat?: "plain" | "markdown";
  };
  
  /** 速率限制 [Channel SDK 标准] */
  rateLimit?: {
    enabled?: boolean;
    requestsPerSecond?: number;
    burstSize?: number;
  };
  
  /** 超时配置 [WebHub SDK] */
  timeout?: {
    connect?: number;
    read?: number;
    write?: number;
  };
  
  /** 重试配置 [WebHub SDK] */
  retry?: {
    enabled?: boolean;
    maxAttempts?: number;
    backoffMs?: number;
  };
  
  /** 消息配置 [WebHub SDK] */
  message?: {
    maxLength?: number;
    allowedFormats?: ("plain" | "markdown" | "html")[];
    media?: {
      maxSize?: number;
      allowedTypes?: string[];
    };
  };
  
  /** 功能开关 [WebHub SDK] */
  features?: {
    polls?: boolean;
    reactions?: boolean;
    threads?: boolean;
    typing?: boolean;
    presence?: boolean;
    buttons?: boolean;
  };
}

/**
 * WebHub 配置 Schema [WebHub SDK]
 * 
 * 使用 Channel SDK 的 buildChannelConfigSchema 构建
 */
const WebHubConfigSchema = {
  api: {
    baseUrl: z.string().url(),
    apiKey: z.string().optional(),
    accessToken: z.string().optional(),
    signatureKey: z.string().optional(),
    signatureAlgorithm: z.enum(["sha256", "sha512"]).default("sha256"),
  },
  webhook: {
    path: z.string(),
    secret: z.string().optional(),
  },
  mapping: {
    userIdField: z.string().default("id"),
    messageIdField: z.string().default("id"),
    timestampFormat: z.enum(["unix", "iso8601", "milliseconds"]).default("unix"),
    textFormat: z.enum(["plain", "markdown"]).default("markdown"),
  },
  rateLimit: {
    enabled: z.boolean().default(true),
    requestsPerSecond: z.number().default(10),
    burstSize: z.number().default(20),
  },
  timeout: {
    connect: z.number().default(10000),
    read: z.number().default(30000),
    write: z.number().default(30000),
  },
  retry: {
    enabled: z.boolean().default(true),
    maxAttempts: z.number().default(3),
    backoffMs: z.number().default(1000),
  },
  message: {
    maxLength: z.number().default(10000),
    allowedFormats: z.array(z.enum(["plain", "markdown", "html"])).default(["plain", "markdown"]),
    media: {
      maxSize: z.number().default(104857600),
      allowedTypes: z.array(z.string()).default(["image/*", "video/*", "audio/*", "application/pdf"]),
    },
  },
  features: {
    polls: z.boolean().default(true),
    reactions: z.boolean().default(true),
    threads: z.boolean().default(true),
    typing: z.boolean().default(true),
    presence: z.boolean().default(true),
    buttons: z.boolean().default(true),
  },
};
```

---

## 4. WebHub 层（Website 实现层）

> **Website 开发者需要提供的 JSON 格式**
> 
> **关系标记**: `[Website 定义]`

### 4.1 发送消息（Website API → 接收）

```typescript
/**
 * WebHub 发送消息格式 [Website 定义]
 * 
 * Website 需要提供一个 REST API 端点来接收此格式的请求
 */
interface WebHubOutboundMessage {
  /** 消息唯一标识 [Website 定义] */
  messageId: string;
  
  /** 消息目标 [Website 定义] */
  target: {
    type: "user" | "group" | "channel";
    id: string;
    name?: string;
  };
  
  /** 消息内容 [Website 定义] */
  content: {
    text: string;
    format?: "plain" | "markdown" | "html";
    replyTo?: {
      messageId: string;
      quotedText?: string;
    };
  };
  
  /** 媒体附件 [Website 定义] */
  media?: Array<{
    type: "image" | "video" | "audio" | "file" | "location";
    url: string;
    filename?: string;
    mimeType?: string;
    size?: number;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    duration?: number;
    latitude?: number;
    longitude?: number;
    caption?: string;
  }>;
  
  /** 交互式键盘 [Website 定义] */
  keyboard?: {
    type: "buttons" | "inline_keyboard" | "quick_reply";
    buttons: Array<{
      id: string;
      text: string;
      style?: "default" | "primary" | "danger";
      action?: "reply" | "url" | "callback";
      value?: string;
      url?: string;
    }>;
  };
  
  /** 消息标记 [Website 定义] */
  flags?: {
    silent?: boolean;
    urgent?: boolean;
    noPreview?: boolean;
  };
  
  /** 自定义元数据 [Website 定义] */
  metadata?: Record<string, unknown>;
  
  /** 定时发送时间 [Website 定义] */
  scheduledAt?: number;
}
```

### 4.2 接收消息（Website API → 推送）

```typescript
/**
 * WebHub 接收消息格式 [Website 定义]
 * 
 * Website 需要向 OpenClaw Gateway 推送消息的格式
 */
interface WebHubInboundMessage {
  /** 消息唯一标识 [Website 定义] */
  id: string;
  
  /** 通道标识 [Website 定义] */
  channelId: string;
  
  /** 消息时间戳 [Website 定义] */
  timestamp: number;
  
  /** 发送者信息 [Website 定义] */
  sender: {
    id: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    isBot?: boolean;
    isAdmin?: boolean;
  };
  
  /** 接收者信息 [Website 定义] */
  recipient?: {
    type: "user" | "group" | "channel";
    id: string;
    name?: string;
  };
  
  /** 消息内容 [Website 定义] */
  content: {
    text: string;
    format?: "plain" | "markdown" | "html";
  };
  
  /** 媒体附件 [Website 定义] */
  media?: Array<{
    type: "image" | "video" | "audio" | "file" | "location";
    url: string;
    filename?: string;
    mimeType?: string;
    size?: number;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    duration?: number;
    latitude?: number;
    longitude?: number;
    caption?: string;
  }>;
  
  /** 回复信息 [Website 定义] */
  replyTo?: {
    /** 回复的消息 ID */
    id: string;
    /** 引用文本 */
    quoteText?: string;
  };
  
  /** 线程信息 [Website 定义] */
  thread?: {
    id: string;
    parentMessageId: string;
  };
  
  /** 编辑标记 [Website 定义] */
  edited?: {
    editedAt: number;
    originalMessageId: string;
  };
  
  /** 表情反应 [Website 定义] */
  reactions?: Array<{
    emoji: string;
    count: number;
    userIds: string[];
    isByBot?: boolean;
  }>;
  
  /** 按钮回调 [Website 定义] */
  callback?: {
    buttonId: string;
    messageId: string;
    userId: string;
    data?: string;
    timestamp: number;
  };
  
  /** 事件类型 [Website 定义] */
  eventType: "message" | "edit" | "delete" | "callback" | "reaction" | "typing" | "presence";
  
  /** 自定义元数据 [Website 定义] */
  metadata?: Record<string, unknown>;
}
```

---

## 5. 类型映射关系表

### 5.1 WebHub → Channel SDK 映射

| WebHub 层 | Channel SDK 层 | 关系 | 映射说明 |
|-----------|-----------------|------|---------|
| `WebHubOutboundMessage` | `OutboundParams` | 实现 | Website 实现的发送格式 |
| `WebHubInboundMessage` | `InboundMessage` | 映射 | 转换为 SDK 标准格式 |
| `WebHubMedia` | `Media` | 扩展 | 添加 location 等类型 |
| `WebHubTarget` | `ChannelTarget` | 修改 | 添加 channel 类型 |
| `WebHubConfig` | `ChannelConfig` | 扩展 | 添加 API/Webhook 配置 |
| `WebHubPlugin` | `ChannelPlugin` | 实现 | 实现 SDK 插件接口 |

### 5.2 Channel SDK → WebHub 关系

| Channel SDK 层 | WebHub 层 | 关系 | 说明 |
|----------------|-------------|------|------|
| `ChannelPlugin` | `WebHubPlugin` | 实现 | WebHub 实现 SDK 接口 |
| `ChannelConfig` | `WebHubConfig` | 源类型 | SDK 标准配置 |
| `ChannelCapabilities` | `WebHubCapabilities` | 遵循 | 直接使用 SDK 结构 |
| `InboundMessage` | `WebHubInboundMessage` | 目标类型 | SDK 标准消息格式 |
| `ChannelMessagingAdapter` | `WebHubMessagingAdapter` | 实现 | WebHub 实现 SDK 接口 |
| `ChannelOutboundAdapter` | `WebHubOutboundAdapter` | 实现 | WebHub 实现 SDK 接口 |

---

## 6. 数据流类型转换

### 6.1 发送消息流程

```
Agent Session
         │
         ▼
┌──────────────────────────────┐
│  OutboundParams [Channel SDK 标准] │
│  {                          │
│    target: ChannelTarget,   │
│    content: string,         │
│    media: Media[]         │
│  }                          │
└──────────────────────────────┘
         │
         │ WebHub Plugin.outbound.sendText()
         ▼
┌──────────────────────────────┐
│  WebHubOutboundMessage [Website 定义] │
│  {                          │
│    messageId: string,       │
│    target: {               │
│      type: "user",         │
│      id: string             │
│    },                      │
│    content: {              │
│      text: string,         │
│      format: "markdown"    │
│    }                        │
│  }                          │
└──────────────────────────────┘
         │
         │ HTTP POST /api/webhub/messages
         ▼
┌──────────────────────────────┐
│  Website REST API [Website 定义] │
└──────────────────────────────┘
```

### 6.2 接收消息流程

```
Website REST API [Website 定义]
         │
         │ HTTP POST /webhub/webhook
         ▼
┌──────────────────────────────┐
│  WebHubInboundMessage [Website 定义] │
│  {                          │
│    id: string,              │
│    sender: { ... },         │
│    content: { text }        │
│  }                          │
└──────────────────────────────┘
         │
         │ WebHub Plugin.messaging.onMessage()
         ▼
┌──────────────────────────────┐
│  WebHub Plugin [WebHub SDK] │
│  - normalizeTarget()       │
│  - format conversion       │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  InboundMessage [Channel SDK 标准] │
│  {                          │
│    id: string,              │
│    sender: { id, displayName },│
│    content: string,          │
│    timestamp: number        │
│  }                          │
└──────────────────────────────┘
         │
         ▼
   SDK Gateway (路由到 Agent)
```

---

## 7. 类型对照速查

### 7.1 开发者角色

| 角色 | 使用层级 | 主要类型 |
|------|----------|----------|
| **Website 开发者** | Website 层 | `WebHubOutboundMessage`, `WebHubInboundMessage` |
| **WebHub 开发者** | WebHub SDK 层 | `WebHubPlugin`, `WebHubConfig`, `WebHubAdapter` |
| **OpenClaw 用户** | Channel SDK 层 | `ChannelPlugin`, `InboundMessage` |

### 7.2 关系标记速查

| 关系类型 | 标记 | 示例 |
|----------|------|------|
| Website 实现 | `[Website 定义]` | `WebHubOutboundMessage` |
| WebHub SDK 适配 | `[WebHub SDK]` | `WebHubConfig` |
| Channel SDK 标准 | `[Channel SDK 标准]` | `ChannelPlugin` |
| 继承 | `Extends SDK` | `WebHubPlugin extends ChannelPlugin` |
| 映射 | `Maps from SDK` | `InboundMessage → WebHubInboundMessage` |
| 修改 | `Modifies SDK` | `ChannelTarget → WebHubTarget` |

---

## 8. 图片索引

| 图片 | 说明 | 位置 |
|------|------|------|
| ![类型层级总览](images/diagram-type-layers.png) | 三层类型架构图 | docs/images/diagram-type-layers.png |
| ![类型继承关系](images/diagram-type-inheritance.png) | 类型继承关系图 | docs/images/diagram-type-inheritance.png |
| ![类型转换](images/diagram-type-flow.png) | 类型转换流程图 | docs/images/diagram-type-flow.png |

---

*最后更新: 2026-02-06*
