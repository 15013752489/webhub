"use strict";
/******************************************************************
 * Channel SDK - WebSocket Adapter
 *
 * OpenClaw Channel SDK 的 WebSocket 连接适配器
 *
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 ******************************************************************/
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketAdapter = void 0;
const uuid_1 = require("uuid");
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
class WebSocketAdapter {
    /**
     * 创建 WebSocket 适配器 [Channel SDK 标准]
     */
    constructor(config) {
        /** WebSocket 实例 [Channel SDK 标准] */
        this.ws = null;
        /** 当前状态 [Channel SDK 标准] */
        this._status = 'disconnected';
        /** 消息回调 [Channel SDK 标准] */
        this.messageCallbacks = new Set();
        /** 状态回调 [Channel SDK 标准] */
        this.statusCallbacks = new Set();
        /** 待确认消息 [Channel SDK 标准] */
        this.pendingMessages = new Map();
        /** 最后心跳时间 [Channel SDK 标准] */
        this.lastHeartbeat = 0;
        /** 心跳定时器 [Channel SDK 标准] */
        this.heartbeatTimer = null;
        /** 重连定时器 [Channel SDK 标准] */
        this.reconnectTimer = null;
        /** 重连次数 [Channel SDK 标准] */
        this.reconnectAttempts = 0;
        /** 统计 [Channel SDK 标准] */
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            connectedDuration: 0,
            lastActiveAt: Date.now(),
        };
        this.config = {
            heartbeatInterval: 30000,
            heartbeatTimeout: 10000,
            maxReconnectAttempts: 3,
            ...config,
        };
    }
    /** 当前状态 [Channel SDK 标准] */
    get status() {
        return this._status;
    }
    /**
     * 建立连接 [Channel SDK 标准]
     */
    async connect() {
        return new Promise((resolve, reject) => {
            // 使用 webhubUrl 构建 WebSocket URL
            const webhubUrl = this.config.webhubUrl || 'wss://example.com/ws';
            const url = new URL(webhubUrl);
            url.searchParams.set('channelId', this.config.channelId);
            url.searchParams.set('token', this.config.accessToken);
            this.ws = new WebSocket(url.toString());
            this.ws.onopen = () => {
                this._status = 'connected';
                this.reconnectAttempts = 0;
                this.stats.connectedDuration = Date.now();
                this.startHeartbeat();
                this.notifyStatus('connected');
                resolve();
            };
            this.ws.onmessage = (event) => {
                try {
                    const frame = JSON.parse(event.data);
                    this.handleFrame(frame);
                }
                catch (error) {
                    console.error('解析消息失败:', error);
                }
            };
            this.ws.onclose = () => {
                this._status = 'disconnected';
                this.stopHeartbeat();
                this.notifyStatus('disconnected');
                this.attemptReconnect();
            };
            this.ws.onerror = (error) => {
                this._status = 'error';
                this.notifyStatus('error', new Error('WebSocket error'));
                reject(error);
            };
        });
    }
    /**
     * 断开连接 [Channel SDK 标准]
     */
    async disconnect() {
        this.stopHeartbeat();
        this.stopReconnect();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this._status = 'disconnected';
        this.notifyStatus('disconnected');
    }
    /**
     * 发送消息 [Channel SDK 标准]
     */
    async send(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return {
                messageId: message.messageId || (0, uuid_1.v4)(),
                success: false,
                timestamp: Date.now(),
                error: {
                    code: 'NOT_CONNECTED',
                    message: 'WebSocket 未连接',
                },
            };
        }
        const messageId = message.messageId || (0, uuid_1.v4)();
        const frame = {
            type: 'message',
            channelId: this.config.channelId,
            timestamp: Date.now(),
            payload: {
                messageId,
                ...message,
            },
        };
        // 加入待确认队列
        this.pendingMessages.set(messageId, {
            timestamp: Date.now(),
            retryCount: 0,
        });
        this.ws.send(JSON.stringify(frame));
        return {
            messageId,
            success: true,
            timestamp: Date.now(),
        };
    }
    /**
     * 订阅消息 [Channel SDK 标准]
     */
    onMessage(callback) {
        this.messageCallbacks.add(callback);
    }
    /**
     * 订阅状态变化 [Channel SDK 标准]
     */
    onStatusChange(callback) {
        this.statusCallbacks.add(callback);
    }
    /**
     * 获取统计 [Channel SDK 标准]
     */
    async getStats() {
        return { ...this.stats };
    }
    /**
     * 处理消息帧 [Channel SDK 标准]
     */
    handleFrame(frame) {
        switch (frame.type) {
            case 'message':
                this.handleMessage(frame);
                break;
            case 'heartbeat':
                this.handleHeartbeat(frame);
                break;
            case 'ack':
                this.handleAck(frame);
                break;
            case 'error':
                this.handleError(frame);
                break;
        }
    }
    /**
     * 处理消息 [Channel SDK 标准]
     */
    handleMessage(frame) {
        const message = frame.payload;
        this.stats.messagesReceived++;
        this.messageCallbacks.forEach((cb) => cb(message));
    }
    /**
     * 处理心跳 [Channel SDK 标准]
     */
    handleHeartbeat(frame) {
        this.lastHeartbeat = Date.now();
        this.notifyStatus('connected');
    }
    /**
     * 处理确认 [Channel SDK 标准]
     */
    handleAck(frame) {
        const payload = frame.payload;
        if (payload.messageId) {
            this.pendingMessages.delete(payload.messageId);
        }
    }
    /**
     * 处理错误 [Channel SDK 标准]
     */
    handleError(frame) {
        const error = frame.payload;
        const err = new Error(error.message || '未知错误');
        this.notifyStatus('error', err);
    }
    /**
     * 启动心跳 [Channel SDK 标准]
     */
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.config.heartbeatInterval);
    }
    /**
     * 停止心跳 [Channel SDK 标准]
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    /**
     * 发送心跳 [Channel SDK 标准]
     */
    async sendHeartbeat() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        const frame = {
            type: 'heartbeat',
            channelId: this.config.channelId,
            timestamp: Date.now(),
        };
        this.ws.send(JSON.stringify(frame));
    }
    /**
     * 尝试重连 [Channel SDK 标准]
     */
    attemptReconnect() {
        const maxAttempts = this.config.maxReconnectAttempts ?? 3;
        if (this.reconnectAttempts >= maxAttempts) {
            this._status = 'error';
            this.notifyStatus('error', new Error('重连次数过多'));
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectTimer = setTimeout(() => {
            this.connect().catch(() => { });
        }, delay);
    }
    /**
     * 停止重连 [Channel SDK 标准]
     */
    stopReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    /**
     * 通知状态变化 [Channel SDK 标准]
     */
    notifyStatus(status, error) {
        this.statusCallbacks.forEach((cb) => cb(status, error));
    }
}
exports.WebSocketAdapter = WebSocketAdapter;
//# sourceMappingURL=websocket.js.map