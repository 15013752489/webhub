/******************************************************************
 * Channel SDK - Channel Class
 * 
 * OpenClaw Channel SDK 的核心 Channel 类
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
  ChannelCapabilities,
  TargetType,
} from '../types/channel';
import type {
  ConnectionAdapter,
  MessageCallback,
  StatusCallback,
  AdapterFactory,
} from '../types/adapters';
import { createDefaultFactory } from '../adapters/default';

/**
 * Channel 配置 [Channel SDK 标准]
 */
export interface ChannelOptions {
  /** 连接配置 [Channel SDK 标准] */
  config: ConnectionConfig;
  
  /** 适配器工厂 [Channel SDK 标准] */
  adapterFactory?: AdapterFactory;
  
  /** 自动重连 [Channel SDK 标准] */
  autoReconnect?: boolean;
  
  /** 自动发送心跳 [Channel SDK 标准] */
  autoHeartbeat?: boolean;
}

/**
 * Channel 类 [Channel SDK 标准]
 * 
 * Channel 的核心管理类，处理连接、消息收发等
 * 
 * @example
 * ```typescript
 * const channel = new Channel({
 *   config: {
 *     channelId: 'wh_ch_xxx',
 *     accessToken: 'token_xxx',
 *   }
 * });
 * 
 * channel.connect();
 * channel.onMessage((msg) => {
 *   console.log('收到消息:', msg);
 * });
 * ```
 */
export class Channel {
  /** 连接配置 [Channel SDK 标准] */
  public readonly config: ConnectionConfig;
  
  /** 适配器工厂 [Channel SDK 标准] */
  public readonly adapterFactory: AdapterFactory;
  
  /** 连接适配器 [Channel SDK 标准] */
  private connectionAdapter: ConnectionAdapter;
  
  /** 消息回调列表 [Channel SDK 标准] */
  private messageCallbacks: Set<MessageCallback>;
  
  /** 状态回调列表 [Channel SDK 标准] */
  private statusCallbacks: Set<StatusCallback>;
  
  /** 是否已连接 [Channel SDK 标准] */
  public get isConnected(): boolean {
    return this.connectionAdapter.status === 'connected';
  }
  
  /** 当前状态 [Channel SDK 标准] */
  public get status(): ConnectionStatus {
    return this.connectionAdapter.status;
  }
  
  /** 统计信息 [Channel SDK 标准] */
  private _stats: ChannelStats = {
    messagesSent: 0,
    messagesReceived: 0,
    connectedDuration: 0,
    lastActiveAt: Date.now(),
  };
  
  /**
   * 创建 Channel 实例 [Channel SDK 标准]
   */
  constructor(options: ChannelOptions) {
    this.config = {
      heartbeatInterval: 30000,
      heartbeatTimeout: 10000,
      maxReconnectAttempts: 3,
      ...options.config,
    };
    
    this.adapterFactory = options.adapterFactory || createDefaultFactory();
    this.connectionAdapter = this.adapterFactory.createConnectionAdapter(this.config);
    
    this.messageCallbacks = new Set();
    this.statusCallbacks = new Set();
    
    // 设置回调
    this.connectionAdapter.onMessage((message) => {
      this._stats.messagesReceived++;
      this._stats.lastActiveAt = Date.now();
      this.messageCallbacks.forEach((cb) => cb(message));
    });
    
    this.connectionAdapter.onStatusChange((status, error) => {
      this.statusCallbacks.forEach((cb) => cb(status, error));
    });
  }
  
  /**
   * 连接到 Channel 服务 [Channel SDK 标准]
   */
  async connect(): Promise<void> {
    await this.connectionAdapter.connect();
  }
  
  /**
   * 断开连接 [Channel SDK 标准]
   */
  async disconnect(): Promise<void> {
    await this.connectionAdapter.disconnect();
  }
  
  /**
   * 发送消息 [Channel SDK 标准]
   */
  async send(message: OutboundMessage): Promise<SendResult> {
    const result = await this.connectionAdapter.send(message);
    
    if (result.success) {
      this._stats.messagesSent++;
      this._stats.lastActiveAt = Date.now();
    }
    
    return result;
  }
  
  /**
   * 发送文本消息 [Channel SDK 标准]
   */
  async sendText(
    targetId: string,
    text: string,
    options?: {
      type?: TargetType;
      replyTo?: string;
    }
  ): Promise<SendResult> {
    return this.send({
      target: {
        type: options?.type || TargetType.USER,
        id: targetId,
      },
      content: {
        text,
        format: 'plain',
      },
      replyTo: options?.replyTo,
    });
  }
  
  /**
   * 订阅消息 [Channel SDK 标准]
   */
  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback);
    
    // 返回取消订阅函数
    return () => {
      this.messageCallbacks.delete(callback);
    };
  }
  
  /**
   * 订阅状态变化 [Channel SDK 标准]
   */
  onStatusChange(callback: StatusCallback): () => void {
    this.statusCallbacks.add(callback);
    
    return () => {
      this.statusCallbacks.delete(callback);
    };
  }
  
  /**
   * 获取统计信息 [Channel SDK 标准]
   */
  async getStats(): Promise<ChannelStats> {
    const adapterStats = await this.connectionAdapter.getStats();
    
    return {
      ...this._stats,
      ...adapterStats,
    };
  }
  
  /**
   * 获取能力 [Channel SDK 标准]
   */
  async getCapabilities(): Promise<ChannelCapabilities> {
    const adapter = this.adapterFactory.createCapabilitiesAdapter();
    return adapter.getCapabilities();
  }
  
  /**
   * 销毁 Channel [Channel SDK 标准]
   */
  async destroy(): Promise<void> {
    await this.disconnect();
    this.messageCallbacks.clear();
    this.statusCallbacks.clear();
  }
}
