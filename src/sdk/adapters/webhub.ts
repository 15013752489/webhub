/******************************************************************
 * Channel SDK - WebHub Adapter with Performance Degradation
 * 
 * 支持从高性能到低性能的优雅退化:
 * 1. WebSocket (最高性能) - 实时双向通信
 * 2. Server-Sent Events (SSE) - 单向推送
 * 3. HTTP Polling (最低性能) - 简单轮询
 * 
 * URL 从 config.webhubUrl 配置中获取
 * 
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 ******************************************************************/

import {
  InboundMessage,
  OutboundMessage,
  SendResult,
  ConnectionConfig,
  ConnectionStatus,
  ChannelStats,
  MessageType,
  TargetType,
  Target,
} from '../types/channel';
import type {
  ConnectionAdapter,
  MessageCallback,
  StatusCallback,
  AdapterFactory,
} from '../types/adapters';
import { v4 as uuidv4 } from 'uuid';

/**
 * 将 WebHub API 原始消息 JSON 映射为 Channel SDK InboundMessage 格式。
 *
 * 这是跨层映射的唯一位置 (SC-003):
 *   - WebHub sender.name     → InboundMessage.sender.displayName
 *   - WebHub sender.avatar   → InboundMessage.sender.avatarUrl
 *   - WebHub authorDisplayName (旧字段兼容) → InboundMessage.sender.displayName
 *   - WebHub authorId        (旧字段兼容) → InboundMessage.sender.id
 *   - WebHub replyTo.id      → InboundMessage.replyTo.messageId
 *   - WebHub replyTo.quoteText → InboundMessage.replyTo.quotedText
 *   - WebHub content (string 或 {text}) → InboundMessage.content.text
 *   - WebHub createdAt (string) → InboundMessage.timestamp (ms)
 */
export function mapRawToInboundMessage(raw: unknown): InboundMessage {
  const msg = raw as Record<string, unknown>;
  const rawSender = (msg.sender && typeof msg.sender === 'object'
    ? msg.sender
    : {}) as Record<string, unknown>;
  const rawContent = msg.content;
  const rawMedia = Array.isArray(msg.media) ? (msg.media as Array<Record<string, unknown>>) : [];
  const rawReplyTo = msg.replyTo && typeof msg.replyTo === 'object'
    ? (msg.replyTo as Record<string, unknown>)
    : undefined;

  // sender: prefer new-style {id, name, avatar}; fall back to legacy authorId/authorDisplayName
  const senderId: string = String(
    rawSender.id ?? msg.authorId ?? ''
  );
  const senderDisplayName: string = String(
    rawSender.name ?? rawSender.displayName ?? msg.authorDisplayName ?? ''
  );
  const senderAvatarUrl: string | undefined =
    (rawSender.avatar as string | undefined) ??
    (rawSender.avatarUrl as string | undefined) ??
    undefined;

  // content: new-style string OR legacy {text: ...}
  const contentText: string =
    typeof rawContent === 'string'
      ? rawContent
      : String((rawContent as Record<string, unknown> | undefined)?.text ?? '');

  // timestamp: ISO string (createdAt) or numeric
  let ts: number;
  if (typeof msg.createdAt === 'string') {
    ts = new Date(msg.createdAt).getTime();
  } else if (typeof msg.timestamp === 'number') {
    ts = msg.timestamp;
  } else {
    ts = Date.now();
  }

  return {
    id: String(msg.id ?? ''),
    channelId: String(msg.channelId ?? ''),
    sender: {
      id: senderId,
      displayName: senderDisplayName,
      avatarUrl: senderAvatarUrl,
      isBot: senderId === 'webhub',
    },
    target: (msg.target as Target | undefined) ?? { type: TargetType.USER, id: '' },
    content: {
      text: contentText,
      format: (msg.format as 'plain' | 'markdown' | 'html' | undefined) ?? 'plain',
    },
    media: rawMedia.map((m) => ({
      type: (m.type ?? MessageType.FILE) as MessageType,
      url: String(m.url ?? ''),
      mimeType: m.mimeType as string | undefined,
      size: m.size as number | undefined,
      width: m.width as number | undefined,
      height: m.height as number | undefined,
      duration: m.duration as number | undefined,
      thumbnailUrl: m.thumbnailUrl as string | undefined,
    })),
    replyTo: rawReplyTo
      ? {
          messageId: String(rawReplyTo.id ?? ''),
          quotedText: rawReplyTo.quoteText as string | undefined,
        }
      : undefined,
    timestamp: ts,
    metadata: msg.metadata as Record<string, unknown> | undefined,
  };
}

/**
 * 将 Channel SDK Media 对象映射为 WebHub API 可接受的媒体格式。
 *
 * Channel SDK Media 字段名称（thumbnailUrl / width / height）已与 WebHub 对齐；
 * 此函数负责补充 WebHub 要求但 SDK 未提供的 filename 字段（从 url 推断），
 * 是全局唯一的媒体映射位置（SC-003）。
 *
 * @param media - Channel SDK Media 对象
 * @returns WebHub 媒体对象
 */
export function mapChannelSdkMedia(media: {
  type: MessageType;
  url: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
}): {
  type: MessageType;
  url: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  filename?: string;
} {
  // Infer filename from URL path when not explicitly available
  const filename = media.url
    ? media.url.split('/').pop()?.split('?')[0] || undefined
    : undefined;
  return {
    type: media.type,
    url: media.url,
    mimeType: media.mimeType,
    size: media.size,
    width: media.width,
    height: media.height,
    duration: media.duration,
    thumbnailUrl: media.thumbnailUrl,
    filename,
  };
}

/**
 * 性能模式
 */
export type PerformanceMode = 'websocket' | 'sse' | 'polling';

/**
 * WebHub 适配器配置 (继承 ConnectionConfig)
 */
export interface WebHubAdapterConfig extends ConnectionConfig {
  /** 首选性能模式 (默认: websocket) */
  preferredMode?: PerformanceMode;
  /** SSE URL 路径 */
  ssePath?: string;
  /** 轮询间隔 (毫秒) */
  pollInterval?: number;
}

/**
 * WebHub 响应格式
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
 * WebHub 适配器
 * 
 * 支持三种模式的优雅退化:
 * - WebSocket: 实时双向通信
 * - SSE: 单向推送 + HTTP 发送
 * - Polling: HTTP 轮询
 * 
 * URL 从 config.webhubUrl 配置中获取
 * 
 * @example
 * ```typescript
 * // 配置时设置 webhubUrl
 * const channel = new Channel({
 *   config: {
 *     channelId: 'wh_ch_xxx',
 *     accessToken: 'token_xxx',
 *     webhubUrl: 'http://localhost:3000',  // 从配置获取
 *   }
 * });
 * ```
 */
export class WebHubAdapter implements ConnectionAdapter {
  /** 配置 [Channel SDK 标准] */
  public config: WebHubAdapterConfig;
  
  /** 当前状态 [Channel SDK 标准] */
  private _status: ConnectionStatus = 'disconnected';
  
  /** 实际使用的性能模式 */
  private currentMode: PerformanceMode = 'polling';
  
  /** WebHub URL (从配置获取) */
  private get webhubUrl(): string {
    return this.config.webhubUrl || 'http://localhost:3000';
  }
  
  /** 消息回调 [Channel SDK 标准] */
  private messageCallbacks: Set<MessageCallback> = new Set();
  
  /** 状态回调 [Channel SDK 标准] */
  private statusCallbacks: Set<StatusCallback> = new Set();
  
  /** 待确认消息 */
  private pendingMessages: Map<string, { timestamp: number }> = new Map();
  
  /** 最后心跳时间 */
  private lastHeartbeat: number = 0;
  
  /** 心跳定时器 */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  
  /** 轮询定时器 */
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  
  /** SSE EventSource */
  private eventSource: EventSource | null = null;
  
  /** WebSocket 实例 */
  private ws: WebSocket | null = null;
  
  /** 统计 [Channel SDK 标准] */
  private stats: ChannelStats = {
    messagesSent: 0,
    messagesReceived: 0,
    connectedDuration: 0,
    lastActiveAt: Date.now(),
  };
  
  /**
   * 创建 WebHub 适配器
   */
  constructor(config: WebHubAdapterConfig) {
    this.config = {
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      maxReconnectAttempts: 3,
      preferredMode: 'websocket',
      ssePath: '/api/channel/events',
      pollInterval: 5000,
      ...config,
    };
  }
  
  /**
   * 获取当前状态 [Channel SDK 标准]
   */
  get status(): ConnectionStatus {
    return this._status;
  }
  
  /**
   * 获取实际使用的性能模式
   */
  get mode(): PerformanceMode {
    return this.currentMode;
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
      
      // 3. 尝试高性能连接 (按优先级)
      let connected = false;
      
      // 3.1 尝试 WebSocket
      if (this.config.preferredMode === 'websocket') {
        connected = await this.tryWebSocket();
        if (connected) {
          this.currentMode = 'websocket';
          this.notifyStatus('connected');
          return;
        }
      }
      
      // 3.2 尝试 SSE
      if (this.config.preferredMode === 'websocket' || this.config.preferredMode === 'sse') {
        connected = await this.trySSE();
        if (connected) {
          this.currentMode = 'sse';
          this.notifyStatus('connected');
          return;
        }
      }
      
      // 3.3 降级到 Polling
      this.currentMode = 'polling';
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
   * 获取完整的 WebHub URL
   */
  private getUrl(path: string): string {
    const baseUrl = this.webhubUrl.replace(/\/$/, '');
    const urlPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${urlPath}`;
  }
  
  /**
   * 尝试 WebSocket 连接
   */
  private async tryWebSocket(): Promise<boolean> {
    const wsUrl = new URL(this.getUrl(this.config.wsUrl || '/ws'));
    wsUrl.searchParams.set('channelId', this.config.channelId);
    wsUrl.searchParams.set('token', this.config.accessToken);
    
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(wsUrl.toString());
        
        const timeout = setTimeout(() => {
          this.cleanupWebSocket();
          resolve(false);
        }, 5000);
        
        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.stats.connectedDuration = Date.now();
          this.startHeartbeat();
          resolve(true);
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'message') {
              this.stats.messagesReceived++;
              this.notifyMessage(message.data || message);
            }
          } catch (e) {
            // 忽略解析错误
          }
        };
        
        this.ws.onclose = () => {
          clearTimeout(timeout);
          this.cleanupWebSocket();
          resolve(false);
        };
        
        this.ws.onerror = () => {
          clearTimeout(timeout);
          this.cleanupWebSocket();
          resolve(false);
        };
        
      } catch {
        resolve(false);
      }
    });
  }
  
  /**
   * 尝试 SSE 连接
   */
  private async trySSE(): Promise<boolean> {
    const sseUrl = new URL(this.getUrl(this.config.ssePath || '/api/channel/events'));
    sseUrl.searchParams.set('channelId', this.config.channelId);
    sseUrl.searchParams.set('token', this.config.accessToken || this.config.accessToken);
    
    return new Promise((resolve) => {
      try {
        this.eventSource = new EventSource(sseUrl.toString());
        
        const timeout = setTimeout(() => {
          this.cleanupSSE();
          resolve(false);
        }, 5000);
        
        this.eventSource.onopen = () => {
          clearTimeout(timeout);
          this.stats.connectedDuration = Date.now();
          this.startHeartbeat();
          resolve(true);
        };
        
        this.eventSource.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.stats.messagesReceived++;
            this.notifyMessage(message);
          } catch (e) {
            // 忽略解析错误
          }
        };
        
        this.eventSource.onerror = () => {
          clearTimeout(timeout);
          this.cleanupSSE();
          resolve(false);
        };
        
      } catch {
        resolve(false);
      }
    });
  }
  
  /**
   * 清理 WebSocket
   */
  private cleanupWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  /**
   * 清理 SSE
   */
  private cleanupSSE(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
  
  /**
   * 注册频道
   */
  private async register(): Promise<void> {
    const response = await this.request<{ accessToken: string }>('/api/channel/register', {
      channelId: this.config.channelId,
      secret: this.config.accessToken,
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
      this.stopPolling();
      this.stopHeartbeat();
      this.cleanupWebSocket();
      this.cleanupSSE();
      
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
      // FR-007: degrade 'channel' target type → 'group' (Channel SDK only supports user/group)
      const targetType = (message.target.type as string) === 'channel'
        ? TargetType.GROUP
        : message.target.type;

      const response = await this.request<{ messageId: string; deliveredAt: string }>(
        '/api/channel/messages',
        {
          channelId: this.config.channelId,
          messageId,
          target: { type: targetType, id: message.target.id, name: message.target.name },
          content: {
            text: message.content.text,
            type: message.content.format || 'text',
          },
          media: message.media?.map(mapChannelSdkMedia),
          // Map Channel SDK replyTo (string message ID) → WebHub {id} object
          replyTo: message.replyTo ? { id: message.replyTo } : undefined,
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
   * US3 Cross-Channel Relay: forward a message from another OpenClaw channel
   * to this ChatU WebHub channel so it appears in the frontend with a special
   * source-channel badge.
   *
   * Calls POST /api/channel/cross-channel-messages authenticated via
   * X-Access-Token (same token used for polling / outbound delivery).
   *
   * @param payload - Cross-channel message payload
   * @returns Resolves with the stored message id, channelId and createdAt from the service
   */
  async postCrossChannelMessage(payload: {
    /** Originating channel id (lowercase, max 64 chars, /^[a-z0-9_-]{1,64}$/) */
    sourceChannel: string;
    /** 'inbound' = AI reply, 'outbound' = user message */
    direction: 'inbound' | 'outbound';
    /** Sender object — id is optional, name is required */
    sender: { id?: string; name: string };
    /** Text content of the message */
    content: string;
    /** Session key from the originating channel */
    sessionKey: string;
    /** Optional extra metadata forwarded as-is */
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string; channelId: string; createdAt: string }> {
    // Note: the cross-channel endpoint returns { id, channelId, createdAt } directly,
    // not wrapped in { success, data }. Cast accordingly.
    const raw = await this.request<unknown>(
      '/api/channel/cross-channel-messages',
      payload as unknown as Record<string, unknown>,
      true,
    ) as unknown as Record<string, unknown>;

    if (!raw.id) {
      throw new Error(`postCrossChannelMessage failed: ${JSON.stringify(raw)}`);
    }

    return raw as unknown as { id: string; channelId: string; createdAt: string };
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
    return {
      ...this.stats,
      mode: this.currentMode,
    };
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
    
    if (requireAuth && this.config.accessToken) {
      headers['X-Access-Token'] = this.config.accessToken;
    }
    
    const response = await fetch(this.getUrl(path), {
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
    }, this.config.pollInterval || 5000);
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
      this.request('/api/channel/heartbeat', {
        channelId: this.config.channelId,
      }, true).catch(() => {});
    }, this.config.heartbeatInterval || 30000);
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
 * 性能模式配置
 */
export interface PerformanceModeConfig {
  /** 首选模式 */
  preferred: PerformanceMode;
  /** WebSocket 配置 */
  websocket?: {
    /** 重试次数 */
    maxRetries?: number;
    /** 重试间隔 (毫秒) */
    retryInterval?: number;
  };
  /** SSE 配置 */
  sse?: {
    /** 重试次数 */
    maxRetries?: number;
  };
  /** Polling 配置 */
  polling?: {
    /** 轮询间隔 (毫秒) */
    interval?: number;
  };
}

/**
 * WebHub 适配器工厂
 */
export class WebHubAdapterFactory implements AdapterFactory {
  /** 性能模式配置 */
  private modeConfig: PerformanceModeConfig;
  
  constructor(modeConfig?: PerformanceModeConfig) {
    this.modeConfig = modeConfig || {
      preferred: 'websocket',
      websocket: { maxRetries: 3, retryInterval: 1000 },
      sse: { maxRetries: 2 },
      polling: { interval: 5000 },
    };
  }
  
  /**
   * 创建 WebHub 适配器 (从 config.webhubUrl 获取 URL)
   */
  createConnectionAdapter(config: ConnectionConfig): ConnectionAdapter {
    return new WebHubAdapter(config as WebHubAdapterConfig);
  }
  
  /**
   * 创建消息适配器
   */
  createMessageAdapter() {
    return {
      parseInbound: mapRawToInboundMessage,
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
        messageTypes: [MessageType.TEXT, MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.FILE],
        targetTypes: [TargetType.USER],
        richFormats: ['markdown'] as ('markdown' | 'html')[],
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
export function createWebHubFactory(modeConfig?: PerformanceModeConfig): WebHubAdapterFactory {
  return new WebHubAdapterFactory(modeConfig);
}
