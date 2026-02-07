/******************************************************************
 * Channel SDK - Channel Types
 * 
 * OpenClaw Channel SDK 的核心类型定义
 * 
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 ******************************************************************/

/**
 * 连接状态 [Channel SDK 标准]
 */
export type ConnectionStatus =
  | 'connecting'   // 连接中
  | 'connected'   // 已连接
  | 'disconnected' // 已断开
  | 'error';      // 错误

/**
 * 消息类型 [Channel SDK 标准]
 */
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  LOCATION = 'location',
}

/**
 * 目标类型 [Channel SDK 标准]
 */
export enum TargetType {
  USER = 'user',
  GROUP = 'group',
  CHANNEL = 'channel',
}

/**
 * 消息发送者 [Channel SDK 标准]
 */
export interface Sender {
  /** 发送者 ID [Channel SDK 标准] */
  id: string;
  
  /** 发送者显示名 [Channel SDK 标准] */
  displayName?: string;
  
  /** 发送者头像 URL [Channel SDK 标准] */
  avatarUrl?: string;
  
  /** 是否为机器人 [Channel SDK 标准] */
  isBot?: boolean;
}

/**
 * 消息目标 [Channel SDK 标准]
 */
export interface Target {
  /** 目标类型 [Channel SDK 标准] */
  type: TargetType;
  
  /** 目标 ID [Channel SDK 标准] */
  id: string;
  
  /** 目标名称 [Channel SDK 标准] */
  name?: string;
}

/**
 * 媒体附件 [Channel SDK 标准]
 */
export interface Media {
  /** 媒体类型 [Channel SDK 标准] */
  type: MessageType;
  
  /** 媒体 URL [Channel SDK 标准] */
  url: string;
  
  /** MIME 类型 [Channel SDK 标准] */
  mimeType?: string;
  
  /** 文件大小（字节）[Channel SDK 标准] */
  size?: number;
  
  /** 图片/视频宽度 [Channel SDK 标准] */
  width?: number;
  
  /** 图片/视频高度 [Channel SDK 标准] */
  height?: number;
  
  /** 音视频时长（秒）[Channel SDK 标准] */
  duration?: number;
  
  /** 缩略图 URL [Channel SDK 标准] */
  thumbnailUrl?: string;
}

/**
 * 消息内容 [Channel SDK 标准]
 */
export interface MessageContent {
  /** 文本内容 [Channel SDK 标准] */
  text: string;
  
  /** 文本格式 [Channel SDK 标准] */
  format?: 'plain' | 'markdown' | 'html';
}

/**
 * 消息回复 [Channel SDK 标准]
 */
export interface MessageReply {
  /** 回复的消息 ID [Channel SDK 标准] */
  messageId: string;
  
  /** 引用的文本 [Channel SDK 标准] */
  quotedText?: string;
}

/**
 * 入站消息 [Channel SDK 标准]
 */
export interface InboundMessage {
  /** 消息 ID [Channel SDK 标准] */
  id: string;
  
  /** 通道 ID [Channel SDK 标准] */
  channelId: string;
  
  /** 发送者 [Channel SDK 标准] */
  sender: Sender;
  
  /** 目标 [Channel SDK 标准] */
  target: Target;
  
  /** 消息内容 [Channel SDK 标准] */
  content: MessageContent;
  
  /** 媒体附件 [Channel SDK 标准] */
  media?: Media[];
  
  /** 回复 [Channel SDK 标准] */
  replyTo?: MessageReply;
  
  /** 时间戳 [Channel SDK 标准] */
  timestamp: number;
  
  /** 元数据 [Channel SDK 标准] */
  metadata?: Record<string, unknown>;
}

/**
 * 出站消息 [Channel SDK 标准]
 */
export interface OutboundMessage {
  /** 消息 ID [Channel SDK 标准] */
  messageId?: string;
  
  /** 目标 [Channel SDK 标准] */
  target: Target;
  
  /** 消息内容 [Channel SDK 标准] */
  content: MessageContent;
  
  /** 媒体附件 [Channel SDK 标准] */
  media?: Media[];
  
  /** 回复 [Channel SDK 标准] */
  replyTo?: string;
  
  /** 消息标记 [Channel SDK 标准] */
  flags?: {
    /** 静默发送 [Channel SDK 标准] */
    silent?: boolean;
    /** 紧急消息 [Channel SDK 标准] */
    urgent?: boolean;
  };
}

/**
 * 发送结果 [Channel SDK 标准]
 */
export interface SendResult {
  /** 消息 ID [Channel SDK 标准] */
  messageId: string;
  
  /** 是否成功 [Channel SDK 标准] */
  success: boolean;
  
  /** 时间戳 [Channel SDK 标准] */
  timestamp: number;
  
  /** 错误信息 [Channel SDK 标准] */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 连接配置 [Channel SDK 标准]
 */
export interface ConnectionConfig {
  /** Channel ID [Channel SDK 标准] */
  channelId: string;
  
  /** 访问令牌 [Channel SDK 标准] */
  accessToken: string;
  
  /** WebHub Backend URL (配置时设置) */
  webhubUrl?: string;
  
  /** Webhook URL [Channel SDK 标准] */
  webhookUrl?: string;
  
  /** WebSocket URL [Channel SDK 标准] */
  wsUrl?: string;
  
  /** 心跳间隔（毫秒）[Channel SDK 标准] */
  heartbeatInterval?: number;
  
  /** 心跳超时（毫秒）[Channel SDK 标准] */
  heartbeatTimeout?: number;
  
  /** 最大重连次数 [Channel SDK 标准] */
  maxReconnectAttempts?: number;
}

/**
 * Channel 统计信息 [Channel SDK 标准]
 */
export interface ChannelStats {
  /** 发送消息数 [Channel SDK 标准] */
  messagesSent: number;
  
  /** 接收消息数 [Channel SDK 标准] */
  messagesReceived: number;
  
  /** 连接时长（秒）[Channel SDK 标准] */
  connectedDuration: number;
  
  /** 最后活跃时间 [Channel SDK 标准] */
  lastActiveAt: number;
}

/**
 * Channel 能力 [Channel SDK 标准]
 */
export interface ChannelCapabilities {
  /** 支持的消息类型 [Channel SDK 标准] */
  messageTypes: MessageType[];
  
  /** 支持的目标类型 [Channel SDK 标准] */
  targetTypes: TargetType[];
  
  /** 支持富文本格式 [Channel SDK 标准] */
  richFormats?: ('markdown' | 'html')[];
  
  /** 支持附件 [Channel SDK 标准] */
  attachments?: boolean;
  
  /** 支持回复 [Channel SDK 标准] */
  reply?: boolean;
  
  /** 支持消息编辑 [Channel SDK 标准] */
  edit?: boolean;
  
  /** 支持消息删除 [Channel SDK 标准] */
  delete?: boolean;
  
  /** 支持表情反应 [Channel SDK 标准] */
  reactions?: boolean;
  
  /** 支持投票 [Channel SDK 标准] */
  polls?: boolean;
  
  /** 支持按钮 [Channel SDK 标准] */
  buttons?: boolean;
}
