"use strict";
/******************************************************************
 * Channel SDK - Channel Class
 *
 * OpenClaw Channel SDK 的核心 Channel 类
 *
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 ******************************************************************/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Channel = void 0;
const channel_1 = require("../types/channel");
const default_1 = require("../adapters/default");
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
class Channel {
    /** 是否已连接 [Channel SDK 标准] */
    get isConnected() {
        return this.connectionAdapter.status === 'connected';
    }
    /** 当前状态 [Channel SDK 标准] */
    get status() {
        return this.connectionAdapter.status;
    }
    /**
     * 创建 Channel 实例 [Channel SDK 标准]
     */
    constructor(options) {
        /** 统计信息 [Channel SDK 标准] */
        this._stats = {
            messagesSent: 0,
            messagesReceived: 0,
            connectedDuration: 0,
            lastActiveAt: Date.now(),
        };
        this.config = {
            heartbeatInterval: 30000,
            heartbeatTimeout: 10000,
            maxReconnectAttempts: 3,
            ...options.config,
        };
        this.adapterFactory = options.adapterFactory || (0, default_1.createDefaultFactory)();
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
    async connect() {
        await this.connectionAdapter.connect();
    }
    /**
     * 断开连接 [Channel SDK 标准]
     */
    async disconnect() {
        await this.connectionAdapter.disconnect();
    }
    /**
     * 发送消息 [Channel SDK 标准]
     */
    async send(message) {
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
    async sendText(targetId, text, options) {
        return this.send({
            target: {
                type: options?.type || channel_1.TargetType.USER,
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
    onMessage(callback) {
        this.messageCallbacks.add(callback);
        // 返回取消订阅函数
        return () => {
            this.messageCallbacks.delete(callback);
        };
    }
    /**
     * 订阅状态变化 [Channel SDK 标准]
     */
    onStatusChange(callback) {
        this.statusCallbacks.add(callback);
        return () => {
            this.statusCallbacks.delete(callback);
        };
    }
    /**
     * 获取统计信息 [Channel SDK 标准]
     */
    async getStats() {
        const adapterStats = await this.connectionAdapter.getStats();
        return {
            ...this._stats,
            ...adapterStats,
        };
    }
    /**
     * 获取能力 [Channel SDK 标准]
     */
    async getCapabilities() {
        const adapter = this.adapterFactory.createCapabilitiesAdapter();
        return adapter.getCapabilities();
    }
    /**
     * 销毁 Channel [Channel SDK 标准]
     */
    async destroy() {
        await this.disconnect();
        this.messageCallbacks.clear();
        this.statusCallbacks.clear();
    }
}
exports.Channel = Channel;
//# sourceMappingURL=channel.js.map