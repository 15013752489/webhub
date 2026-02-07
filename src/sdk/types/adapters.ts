/******************************************************************
 * Channel SDK - Adapter Types
 * 
 * OpenClaw Channel SDK 的适配器接口定义
 * 
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 ******************************************************************/

import type {
  InboundMessage,
  OutboundMessage,
  SendResult,
  ConnectionConfig,
  ConnectionStatus,
  ChannelStats,
  ChannelCapabilities,
} from './channel';

/**
 * 消息回调 [Channel SDK 标准]
 */
export type MessageCallback = (message: InboundMessage) => void;

/**
 * 状态回调 [Channel SDK 标准]
 */
export type StatusCallback = (status: ConnectionStatus, error?: Error) => void;

/**
 * 连接适配器接口 [Channel SDK 标准]
 * 
 * 负责管理与目标服务的连接
 */
export interface ConnectionAdapter {
  /** 连接配置 [Channel SDK 标准] */
  config: ConnectionConfig;
  
  /** 当前状态 [Channel SDK 标准] */
  status: ConnectionStatus;
  
  /** 连接 [Channel SDK 标准] */
  connect(): Promise<void>;
  
  /** 断开连接 [Channel SDK 标准] */
  disconnect(): Promise<void>;
  
  /** 发送消息 [Channel SDK 标准] */
  send(message: OutboundMessage): Promise<SendResult>;
  
  /** 订阅消息 [Channel SDK 标准] */
  onMessage(callback: MessageCallback): void;
  
  /** 订阅状态变化 [Channel SDK 标准] */
  onStatusChange(callback: StatusCallback): void;
  
  /** 获取连接统计 [Channel SDK 标准] */
  getStats(): Promise<ChannelStats>;
}

/**
 * 消息处理适配器接口 [Channel SDK 标准]
 * 
 * 负责消息的解析和格式化
 */
export interface MessageAdapter {
  /** 解析入站消息 [Channel SDK 标准] */
  parseInbound(raw: unknown): InboundMessage;
  
  /** 格式化出站消息 [Channel SDK 标准] */
  formatOutbound(message: OutboundMessage): unknown;
  
  /** 验证消息 [Channel SDK 标准] */
  validate(message: InboundMessage | OutboundMessage): boolean;
  
  /** 清理消息 [Channel SDK 标准] */
  sanitize(text: string): string;
}

/**
 * 心跳适配器接口 [Channel SDK 标准]
 * 
 * 负责心跳检测和管理
 */
export interface HeartbeatAdapter {
  /** 发送心跳 [Channel SDK 标准] */
  send(): Promise<boolean>;
  
  /** 处理心跳响应 [Channel SDK 标准] */
  handleResponse(): void;
  
  /** 检查是否超时 [Channel SDK 标准] */
  isTimeout(): boolean;
  
  /** 获取下次心跳时间 [Channel SDK 标准] */
  getNextHeartbeatTime(): number;
}

/**
 * 认证适配器接口 [Channel SDK 标准]
 * 
 * 负责身份验证和授权
 */
export interface AuthAdapter {
  /** 获取认证头 [Channel SDK 标准] */
  getAuthHeaders(): Record<string, string>;
  
  /** 验证响应 [Channel SDK 标准] */
  validateResponse(response: unknown): boolean;
  
  /** 刷新令牌 [Channel SDK 标准] */
  refreshToken(): Promise<boolean>;
}

/**
 * 能力查询适配器接口 [Channel SDK 标准]
 * 
 * 负责查询 Channel 能力
 */
export interface CapabilitiesAdapter {
  /** 获取能力 [Channel SDK 标准] */
  getCapabilities(): Promise<ChannelCapabilities>;
  
  /** 检查能力 [Channel SDK 标准] */
  hasCapability(capability: keyof ChannelCapabilities): boolean;
}

/**
 * 日志适配器接口 [Channel SDK 标准]
 * 
 * 负责日志记录
 */
export interface LoggerAdapter {
  /** 调试日志 [Channel SDK 标准] */
  debug(message: string, data?: unknown): void;
  
  /** 信息日志 [Channel SDK 标准] */
  info(message: string, data?: unknown): void;
  
  /** 警告日志 [Channel SDK 标准] */
  warn(message: string, data?: unknown): void;
  
  /** 错误日志 [Channel SDK 标准] */
  error(message: string, error?: Error): void;
}

/**
 * 适配器工厂接口 [Channel SDK 标准]
 * 
 * 负责创建和管理适配器
 */
export interface AdapterFactory {
  /** 创建连接适配器 [Channel SDK 标准] */
  createConnectionAdapter(config: ConnectionConfig): ConnectionAdapter;
  
  /** 创建消息适配器 [Channel SDK 标准] */
  createMessageAdapter(): MessageAdapter;
  
  /** 创建心跳适配器 [Channel SDK 标准] */
  createHeartbeatAdapter(): HeartbeatAdapter;
  
  /** 创建认证适配器 [Channel SDK 标准] */
  createAuthAdapter(): AuthAdapter;
  
  /** 创建能力适配器 [Channel SDK 标准] */
  createCapabilitiesAdapter(): CapabilitiesAdapter;
  
  /** 创建日志适配器 [Channel SDK 标准] */
  createLoggerAdapter(): LoggerAdapter;
}
