/******************************************************************
 * Channel SDK - WebSocket Adapter
 *
 * OpenClaw Channel SDK 的 WebSocket 连接适配器
 *
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 ******************************************************************/
import type { OutboundMessage, SendResult, ConnectionConfig, ConnectionStatus, ChannelStats } from '../types/channel';
import type { ConnectionAdapter, MessageCallback, StatusCallback } from '../types/adapters';
/**
 * WebSocket 连接适配器 [Channel SDK 标准]
 *
 * 使用 WebSocket 进行实时通信
 *
 * @example
 * ```typescript
 * const adapter = new WebSocketAdapter({
 *   channelId: 'wh_ch_xxx',
 *   accessToken: 'token_xxx',
 * });
 *
 * adapter.connect();
 * adapter.onMessage((msg) => console.log(msg));
 * ```
 */
export declare class WebSocketAdapter implements ConnectionAdapter {
    /** 配置 [Channel SDK 标准] */
    config: ConnectionConfig;
    /** WebSocket 实例 [Channel SDK 标准] */
    private ws;
    /** 当前状态 [Channel SDK 标准] */
    private _status;
    /** 消息回调 [Channel SDK 标准] */
    private messageCallbacks;
    /** 状态回调 [Channel SDK 标准] */
    private statusCallbacks;
    /** 待确认消息 [Channel SDK 标准] */
    private pendingMessages;
    /** 最后心跳时间 [Channel SDK 标准] */
    private lastHeartbeat;
    /** 心跳定时器 [Channel SDK 标准] */
    private heartbeatTimer;
    /** 重连定时器 [Channel SDK 标准] */
    private reconnectTimer;
    /** 重连次数 [Channel SDK 标准] */
    private reconnectAttempts;
    /** 统计 [Channel SDK 标准] */
    private stats;
    /**
     * 创建 WebSocket 适配器 [Channel SDK 标准]
     */
    constructor(config: ConnectionConfig);
    /** 当前状态 [Channel SDK 标准] */
    get status(): ConnectionStatus;
    /**
     * 建立连接 [Channel SDK 标准]
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
     * 处理消息帧 [Channel SDK 标准]
     */
    private handleFrame;
    /**
     * 处理消息 [Channel SDK 标准]
     */
    private handleMessage;
    /**
     * 处理心跳 [Channel SDK 标准]
     */
    private handleHeartbeat;
    /**
     * 处理确认 [Channel SDK 标准]
     */
    private handleAck;
    /**
     * 处理错误 [Channel SDK 标准]
     */
    private handleError;
    /**
     * 启动心跳 [Channel SDK 标准]
     */
    private startHeartbeat;
    /**
     * 停止心跳 [Channel SDK 标准]
     */
    private stopHeartbeat;
    /**
     * 发送心跳 [Channel SDK 标准]
     */
    private sendHeartbeat;
    /**
     * 尝试重连 [Channel SDK 标准]
     */
    private attemptReconnect;
    /**
     * 停止重连 [Channel SDK 标准]
     */
    private stopReconnect;
    /**
     * 通知状态变化 [Channel SDK 标准]
     */
    private notifyStatus;
}
//# sourceMappingURL=websocket.d.ts.map