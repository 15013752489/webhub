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
import { InboundMessage, OutboundMessage, SendResult, ConnectionConfig, ConnectionStatus, ChannelStats, MessageType, TargetType } from '../types/channel';
import type { ConnectionAdapter, MessageCallback, StatusCallback, AdapterFactory } from '../types/adapters';
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
export declare class WebHubAdapter implements ConnectionAdapter {
    /** 配置 [Channel SDK 标准] */
    config: WebHubAdapterConfig;
    /** 当前状态 [Channel SDK 标准] */
    private _status;
    /** 实际使用的性能模式 */
    private currentMode;
    /** WebHub URL (从配置获取) */
    private get webhubUrl();
    /** 消息回调 [Channel SDK 标准] */
    private messageCallbacks;
    /** 状态回调 [Channel SDK 标准] */
    private statusCallbacks;
    /** 待确认消息 */
    private pendingMessages;
    /** 最后心跳时间 */
    private lastHeartbeat;
    /** 心跳定时器 */
    private heartbeatTimer;
    /** 轮询定时器 */
    private pollTimer;
    /** SSE EventSource */
    private eventSource;
    /** WebSocket 实例 */
    private ws;
    /** 统计 [Channel SDK 标准] */
    private stats;
    /**
     * 创建 WebHub 适配器
     */
    constructor(config: WebHubAdapterConfig);
    /**
     * 获取当前状态 [Channel SDK 标准]
     */
    get status(): ConnectionStatus;
    /**
     * 获取实际使用的性能模式
     */
    get mode(): PerformanceMode;
    /**
     * 连接到 WebHub [Channel SDK 标准]
     */
    connect(): Promise<void>;
    /**
     * 获取完整的 WebHub URL
     */
    private getUrl;
    /**
     * 尝试 WebSocket 连接
     */
    private tryWebSocket;
    /**
     * 尝试 SSE 连接
     */
    private trySSE;
    /**
     * 清理 WebSocket
     */
    private cleanupWebSocket;
    /**
     * 清理 SSE
     */
    private cleanupSSE;
    /**
     * 注册频道
     */
    private register;
    /**
     * 连接到 Hub
     */
    private connectToHub;
    /**
     * 断开连接 [Channel SDK 标准]
     */
    disconnect(): Promise<void>;
    /**
     * 发送消息 [Channel SDK 标准]
     */
    send(message: OutboundMessage): Promise<SendResult>;
    /**
     * 订阅消息 [Channel SDK 标准]
     */
    onMessage(callback: MessageCallback): void;
    /**
     * 订阅状态变化 [Channel SDK 标准]
     */
    onStatusChange(callback: StatusCallback): void;
    /**
     * 获取统计 [Channel SDK 标准]
     */
    getStats(): Promise<ChannelStats>;
    /**
     * 发起 HTTP 请求
     */
    private request;
    /**
     * 启动轮询接收消息
     */
    private startPolling;
    /**
     * 停止轮询
     */
    private stopPolling;
    /**
     * 启动心跳
     */
    private startHeartbeat;
    /**
     * 停止心跳
     */
    private stopHeartbeat;
    /**
     * 通知消息
     */
    private notifyMessage;
    /**
     * 通知状态变化
     */
    private notifyStatus;
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
export declare class WebHubAdapterFactory implements AdapterFactory {
    /** 性能模式配置 */
    private modeConfig;
    constructor(modeConfig?: PerformanceModeConfig);
    /**
     * 创建 WebHub 适配器 (从 config.webhubUrl 获取 URL)
     */
    createConnectionAdapter(config: ConnectionConfig): ConnectionAdapter;
    /**
     * 创建消息适配器
     */
    createMessageAdapter(): {
        parseInbound: (raw: unknown) => InboundMessage;
        formatOutbound: (message: OutboundMessage) => unknown;
        validate: (message: unknown) => boolean;
        sanitize: (text: string) => string;
    };
    /**
     * 创建心跳适配器
     */
    createHeartbeatAdapter(): {
        send: () => Promise<boolean>;
        handleResponse: () => void;
        isTimeout: () => boolean;
        getNextHeartbeatTime: () => number;
    };
    /**
     * 创建认证适配器
     */
    createAuthAdapter(): {
        getAuthHeaders: () => Record<string, string>;
        validateResponse: (response: unknown) => boolean;
        refreshToken: () => Promise<boolean>;
    };
    /**
     * 创建能力适配器
     */
    createCapabilitiesAdapter(): {
        getCapabilities: () => Promise<{
            messageTypes: MessageType[];
            targetTypes: TargetType[];
            richFormats: ("markdown" | "html")[];
            attachments: boolean;
            reply: boolean;
        }>;
        hasCapability: () => boolean;
    };
    /**
     * 创建日志适配器
     */
    createLoggerAdapter(): {
        debug: (message: string, data?: unknown) => void;
        info: (message: string, data?: unknown) => void;
        warn: (message: string, data?: unknown) => void;
        error: (message: string, error?: Error) => void;
    };
}
/**
 * 创建 WebHub 适配器工厂
 */
export declare function createWebHubFactory(modeConfig?: PerformanceModeConfig): WebHubAdapterFactory;
//# sourceMappingURL=webhub.d.ts.map