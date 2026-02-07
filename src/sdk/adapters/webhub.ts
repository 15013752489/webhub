/******************************************************************
 * Channel SDK - WebHub HTTP Adapter
 * 
 * 用于调用 WebHub Backend API 的 HTTP 适配器
 * 
 * API 文档: https://github.com/chatu-ai/chatu-web-hub-service/docs/api/channel-api.en.md
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
} from '../types/channel';
import type {
  ConnectionAdapter,
  MessageCallback,
  StatusCallback,
  AdapterFactory,
} from '../types/adapters';
import { v4 as uuidv4 } from 'uuid';

/**
 * WebHub API 响应格式
 */
interface WebHubResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * WebHub API 请求格式
 */
interface WebHubRequest {
  channelId: string;
  messageId?: string;
  target?: {
    type: string;
    id: string;
  };
  content?: {
    text: string;
    type?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * WebHub HTTP 适配器配置
 */
export interface WebHubHttpConfig extends ConnectionConfig {
  /** WebHub Backend URL */
  baseUrl: string;
  /** Channel ID */
  channelId: string;
  /** Channel Secret */
  secret: string;
  /** Access Token (从 register 获取) */
  accessToken?: string;
}

/**
 * WebHub HTTP 适配器
 * 
 * 用于调用 WebHub Backend 的 /api/channel/* 接口
 * 
 * @example
 * ```typescript
 * const adapter = new WebHubHttpAdapter({
 *   baseUrl: 'http://localhost:3000',
 *   channelId: 'wh_ch_xxx',
 *   secret: 'wh_secret_xxx',
 *   accessToken: 'wh_xxx',
 * });
 * 
 * adapter.connect();
 * adapter.onMessage((msg) => console.log(msg));
 * adapter.send({ text: 'Hello!' });
 * ```
 */
export class WebHubHttpAdapter implements ConnectionAdapter {
  /** 配置 [Channel SDK 标准] */
  public config: WebHubHttpConfig;
  
  /** 当前状态 [Channel SDK 标准] */
  private _status: ConnectionStatus = 'disconnected';
  
  /** 消息回调 [Channel SDK 标准] */
  private messageCallbacks: Set<MessageCallback> = new Set();
  
  /** 状态回调 [Channel SDK 标准] */
  private statusCallbacks: Set<StatusCallback> = new Set();
  
  /** 待确认消息 */
  private pendingMessages: Map<string, { timestamp: number }> = new Map();
  
  /** 最后心跳时间 */
  private lastHeartbeat: number = 0;
  
  /** 心跳定时器 */
  private heartbeatTimer: NodeJS.Timer | null = null;
  
  /** 轮询定时器 */
  private pollTimer: NodeJS.Timer | null = null;
  
  /** 统计 [Channel SDK 标准] */
  private stats: ChannelStats = {
    messagesSent: 0,
    messagesReceived: 0,
    connectedDuration: 0,
    lastActiveAt: Date.now(),
  };
  
  /** 轮询间隔 (毫秒) */
  private pollInterval: number = 5000;
  
  /**
   * 创建 WebHub HTTP 适配器
   */
  constructor(config: WebHubHttpConfig) {
    this.config = {
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      maxReconnectAttempts: 3,
      ...config,
    };
    
    // 如果没有尾随斜杠，添加
    if (!this.config.baseUrl.endsWith('/')) {
      this.config.baseUrl += '/';
    }
  }
  
  /**
   * 获取当前状态 [Channel SDK 标准]
   */
  get status(): ConnectionStatus {
    return this._status;
  }
  
  /**
   * 连接到 WebHub [Channel SDK 标准]
   */
  async connect(): Promise<void> {
    try {
      // 1. 先注册 (如果还没有 accessToken)
      if (!this.config.accessToken) {
        await this.register();
      }
      
      // 2. 连接
      await this.connectToHub();
      
      // 3. 启动轮询接收消息
      this.startPolling();
      
      // 4. 启动心跳
      this.startHeartbeat();
      
      this._status = 'connected';
      this.stats.connectedDuration = Date.now();
      this.notifyStatus('connected');
      
    } catch (error) {
      this._status = 'disconnected';
      throw error;
    }
  }
  
  /**
   * 注册频道
   */
  private async register(): Promise<void> {
    const response = await this.request<{ accessToken: string }>('/api/channel/register', {
      channelId: this.config.channelId,
      secret: this.config.secret,
    });
    
    if (response.success && response.data?.accessToken) {
      this.config.accessToken = response.data.accessToken;
    } else {
      throw new Error('Failed to register channel');
    }
  }
  
  /**
   * 连接到 Hub
   */
  private async connectToHub(): Promise<void> {
    const response = await this.request<{ status: string }>('/api/channel/connect', {
      channelId: this.config.channelId,
    }, true);
    
    if (!response.success) {
      throw new Error('Failed to connect to hub');
    }
  }
  
  /**
   * 断开连接 [Channel SDK 标准]
   */
  async disconnect(): Promise<void> {
    try {
      // 停止轮询和心跳
      this.stopPolling();
      this.stopHeartbeat();
      
      // 通知 Hub 断开
      if (this.config.accessToken) {
        await this.request('/api/channel/disconnect', {
          channelId: this.config.channelId,
        }, true).catch(() => {});
      }
      
    } finally {
      this._status = 'disconnected';
      this.notifyStatus('disconnected');
    }
  }
  
  /**
   * 发送消息 [Channel SDK 标准]
   */
  async send(message: OutboundMessage): Promise<SendResult> {
    const messageId = message.messageId || uuidv4();
    
    try {
      const response = await this.request<{ messageId: string; deliveredAt: string }>(
        '/api/channel/messages',
        {
          channelId: this.config.channelId,
          messageId,
          target: message.target,
          content: {
            text: message.content.text,
            type: message.content.type || 'text',
          },
          metadata: message.metadata,
        },
        true
      );
      
      this.stats.messagesSent++;
      this.stats.lastActiveAt = Date.now();
      
      return {
        messageId,
        success: true,
        timestamp: Date.now(),
      };
      
    } catch (error) {
      return {
        messageId,
        success: false,
        timestamp: Date.now(),
        error: {
          code: 'SEND_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
  
  /**
   * 订阅消息 [Channel SDK 标准]
   */
  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.add(callback);
  }
  
  /**
   * 订阅状态变化 [Channel SDK 标准]
   */
  onStatusChange(callback: StatusCallback): void {
    this.statusCallbacks.add(callback);
  }
  
  /**
   * 获取统计 [Channel SDK 标准]
   */
  async getStats(): Promise<ChannelStats> {
    return { ...this.stats };
  }
  
  /**
   * 发起 HTTP 请求
   */
  private async request<T>(
    path: string,
    body: Record<string, unknown>,
    requireAuth: boolean = false
  ): Promise<WebHubResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // 如果需要认证，使用 accessToken 或 secret
    if (requireAuth) {
      if (this.config.accessToken) {
        headers['X-Access-Token'] = this.config.accessToken;
      } else if (this.config.secret) {
        headers['X-Channel-Token'] = this.config.secret;
      }
    }
    
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    return response.json();
  }
  
  /**
   * 启动轮询接收消息
   */
  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      try {
        // 调用 webhook 端点获取消息
        const response = await this.request<InboundMessage[]>('/api/channel/webhook', {
          channelId: this.config.channelId,
        }, true);
        
        if (response.success && response.data) {
          const messages = Array.isArray(response.data) ? response.data : [response.data];
          
          for (const message of messages) {
            this.stats.messagesReceived++;
            this.notifyMessage(message);
          }
          
          this.stats.lastActiveAt = Date.now();
        }
        
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, this.pollInterval);
  }
  
  /**
   * 停止轮询
   */
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
  
  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.lastHeartbeat = Date.now();
      
      // 发送心跳到 hub
      this.request('/api/channel/heartbeat', {
        channelId: this.config.channelId,
      }, true).catch(() => {});
      
    }, this.config.heartbeatInterval);
  }
  
  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  /**
   * 通知消息
   */
  private notifyMessage(message: InboundMessage): void {
    this.messageCallbacks.forEach((cb) => cb(message));
  }
  
  /**
   * 通知状态变化
   */
  private notifyStatus(status: ConnectionStatus, error?: Error): void {
    this.statusCallbacks.forEach((cb) => cb(status, error));
  }
}

/**
 * WebHub HTTP 适配器工厂
 */
export class WebHubAdapterFactory implements AdapterFactory {
  /** WebHub Backend URL */
  private baseUrl: string;
  
  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }
  
  /**
   * 创建 WebHub HTTP 连接适配器
   */
  createConnectionAdapter(config: ConnectionConfig): ConnectionAdapter {
    const webhubConfig = config as WebHubHttpConfig;
    return new WebHubHttpAdapter({
      ...webhubConfig,
      baseUrl: this.baseUrl,
    });
  }
  
  /**
   * 创建消息适配器
   */
  createMessageAdapter() {
    return {
      parseInbound: (raw: unknown): InboundMessage => raw as InboundMessage,
      formatOutbound: (message: OutboundMessage): unknown => message,
      validate: (message: unknown): boolean => !!message,
      sanitize: (text: string): string => text,
    };
  }
  
  /**
   * 创建心跳适配器
   */
  createHeartbeatAdapter() {
    return {
      send: async (): Promise<boolean> => true,
      handleResponse: (): void => {},
      isTimeout: (): boolean => false,
      getNextHeartbeatTime: (): number => Date.now() + 30000,
    };
  }
  
  /**
   * 创建认证适配器
   */
  createAuthAdapter() {
    return {
      getAuthHeaders: (): Record<string, string> => ({}),
      validateResponse: (response: unknown): boolean => true,
      refreshToken: async (): Promise<boolean> => true,
    };
  }
  
  /**
   * 创建能力适配器
   */
  createCapabilitiesAdapter() {
    return {
      getCapabilities: async () => ({
        messageTypes: ['text', 'image', 'video', 'audio', 'file'],
        targetTypes: ['user'],
        richFormats: ['markdown'],
        attachments: true,
        reply: true,
      }),
      hasCapability: (): boolean => true,
    };
  }
  
  /**
   * 创建日志适配器
   */
  createLoggerAdapter() {
    return {
      debug: (message: string, data?: unknown): void => console.debug(message, data),
      info: (message: string, data?: unknown): void => console.info(message, data),
      warn: (message: string, data?: unknown): void => console.warn(message, data),
      error: (message: string, error?: Error): void => console.error(message, error),
    };
  }
}

/**
 * 创建 WebHub 适配器工厂
 */
export function createWebHubFactory(baseUrl?: string): WebHubAdapterFactory {
  return new WebHubAdapterFactory(baseUrl);
}
