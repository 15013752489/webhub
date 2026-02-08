/******************************************************************
 * Channel SDK - Channel Class
 *
 * OpenClaw Channel SDK 的核心 Channel 类
 *
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 ******************************************************************/
import { OutboundMessage, SendResult, ConnectionConfig, ConnectionStatus, ChannelStats, ChannelCapabilities, TargetType } from '../types/channel';
import type { MessageCallback, StatusCallback, AdapterFactory } from '../types/adapters';
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
export declare class Channel {
    /** 连接配置 [Channel SDK 标准] */
    readonly config: ConnectionConfig;
    /** 适配器工厂 [Channel SDK 标准] */
    readonly adapterFactory: AdapterFactory;
    /** 连接适配器 [Channel SDK 标准] */
    private connectionAdapter;
    /** 消息回调列表 [Channel SDK 标准] */
    private messageCallbacks;
    /** 状态回调列表 [Channel SDK 标准] */
    private statusCallbacks;
    /** 是否已连接 [Channel SDK 标准] */
    get isConnected(): boolean;
    /** 当前状态 [Channel SDK 标准] */
    get status(): ConnectionStatus;
    /** 统计信息 [Channel SDK 标准] */
    private _stats;
    /**
     * 创建 Channel 实例 [Channel SDK 标准]
     */
    constructor(options: ChannelOptions);
    /**
     * 连接到 Channel 服务 [Channel SDK 标准]
     */
    connect(): Promise<void>;
    /**
     * 断开连接 [Channel SDK 标准]
     */
    disconnect(): Promise<void>;
    /**
     * 发送消息 [Channel SDK 标准]
     */
    send(message: OutboundMessage): Promise<SendResult>;
    /**
     * 发送文本消息 [Channel SDK 标准]
     */
    sendText(targetId: string, text: string, options?: {
        type?: TargetType;
        replyTo?: string;
    }): Promise<SendResult>;
    /**
     * 订阅消息 [Channel SDK 标准]
     */
    onMessage(callback: MessageCallback): () => void;
    /**
     * 订阅状态变化 [Channel SDK 标准]
     */
    onStatusChange(callback: StatusCallback): () => void;
    /**
     * 获取统计信息 [Channel SDK 标准]
     */
    getStats(): Promise<ChannelStats>;
    /**
     * 获取能力 [Channel SDK 标准]
     */
    getCapabilities(): Promise<ChannelCapabilities>;
    /**
     * 销毁 Channel [Channel SDK 标准]
     */
    destroy(): Promise<void>;
}
//# sourceMappingURL=channel.d.ts.map