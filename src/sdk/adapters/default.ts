/******************************************************************
 * Channel SDK - Default Adapter Factory
 * 
 * OpenClaw Channel SDK 的默认适配器工厂
 * 
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 ******************************************************************/

import {
  ConnectionConfig,
  ChannelStats,
  ConnectionStatus,
  ChannelCapabilities,
  MessageType,
  TargetType,
} from '../types/channel';
import type {
  ConnectionAdapter,
  MessageAdapter,
  HeartbeatAdapter,
  AuthAdapter,
  CapabilitiesAdapter,
  LoggerAdapter,
  MessageCallback,
  StatusCallback,
  AdapterFactory,
} from '../types/adapters';
import { WebSocketAdapter } from './websocket';
import { v4 as uuidv4 } from 'uuid';

/**
 * 消息适配器实现 [Channel SDK 标准]
 */
class DefaultMessageAdapter implements MessageAdapter {
  parseInbound(raw: unknown): any {
    return raw;
  }
  
  formatOutbound(message: any): any {
    return message;
  }
  
  validate(message: any): boolean {
    return message && typeof message === 'object';
  }
  
  sanitize(text: string): string {
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

/**
 * 心跳适配器实现 [Channel SDK 标准]
 */
class DefaultHeartbeatAdapter implements HeartbeatAdapter {
  private lastResponse: number = Date.now();
  private timeout: number;
  
  constructor(timeout: number = 10000) {
    this.timeout = timeout;
  }
  
  async send(): Promise<boolean> {
    return true;
  }
  
  handleResponse(): void {
    this.lastResponse = Date.now();
  }
  
  isTimeout(): boolean {
    return Date.now() - this.lastResponse > this.timeout;
  }
  
  getNextHeartbeatTime(): number {
    return Date.now() + 30000;
  }
}

/**
 * 认证适配器实现 [Channel SDK 标准]
 */
class DefaultAuthAdapter implements AuthAdapter {
  private token: string;
  
  constructor(token: string) {
    this.token = token;
  }
  
  getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }
  
  validateResponse(response: unknown): boolean {
    return response !== null && response !== undefined;
  }
  
  async refreshToken(): Promise<boolean> {
    return true;
  }
}

/**
 * 能力适配器实现 [Channel SDK 标准]
 */
class DefaultCapabilitiesAdapter implements CapabilitiesAdapter {
  async getCapabilities(): Promise<ChannelCapabilities> {
    return {
      messageTypes: [
        MessageType.TEXT,
        MessageType.IMAGE,
        MessageType.VIDEO,
        MessageType.AUDIO,
        MessageType.FILE,
      ],
      targetTypes: [TargetType.USER, TargetType.GROUP],
      richFormats: ['markdown'],
      attachments: true,
      reply: true,
    };
  }
  
  hasCapability(capability: keyof ChannelCapabilities): boolean {
    return true;
  }
}

/**
 * 日志适配器实现 [Channel SDK 标准]
 */
class DefaultLoggerAdapter implements LoggerAdapter {
  debug(message: string, data?: unknown): void {
    console.debug(`[DEBUG] ${message}`, data || '');
  }
  
  info(message: string, data?: unknown): void {
    console.info(`[INFO] ${message}`, data || '');
  }
  
  warn(message: string, data?: unknown): void {
    console.warn(`[WARN] ${message}`, data || '');
  }
  
  error(message: string, error?: Error): void {
    console.error(`[ERROR] ${message}`, error || '');
  }
}

/**
 * 默认适配器工厂 [Channel SDK 标准]
 * 
 * 提供所有适配器的默认实现
 */
export class DefaultAdapterFactory implements AdapterFactory {
  createConnectionAdapter(config: ConnectionConfig): ConnectionAdapter {
    return new WebSocketAdapter(config);
  }
  
  createMessageAdapter(): MessageAdapter {
    return new DefaultMessageAdapter();
  }
  
  createHeartbeatAdapter(): HeartbeatAdapter {
    return new DefaultHeartbeatAdapter();
  }
  
  createAuthAdapter(token?: string): AuthAdapter {
    return new DefaultAuthAdapter(token || '');
  }
  
  createCapabilitiesAdapter(): CapabilitiesAdapter {
    return new DefaultCapabilitiesAdapter();
  }
  
  createLoggerAdapter(): LoggerAdapter {
    return new DefaultLoggerAdapter();
  }
}

/**
 * 创建默认工厂单例 [Channel SDK 标准]
 */
let factory: DefaultAdapterFactory | null = null;

export function createDefaultFactory(): DefaultAdapterFactory {
  if (!factory) {
    factory = new DefaultAdapterFactory();
  }
  return factory;
}
