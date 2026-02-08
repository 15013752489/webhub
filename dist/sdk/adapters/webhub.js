"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebHubAdapterFactory = exports.WebHubAdapter = void 0;
exports.createWebHubFactory = createWebHubFactory;
const channel_1 = require("../types/channel");
const uuid_1 = require("uuid");
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
class WebHubAdapter {
    /** WebHub URL (从配置获取) */
    get webhubUrl() {
        return this.config.webhubUrl || 'http://localhost:3000';
    }
    /**
     * 创建 WebHub 适配器
     */
    constructor(config) {
        /** 当前状态 [Channel SDK 标准] */
        this._status = 'disconnected';
        /** 实际使用的性能模式 */
        this.currentMode = 'polling';
        /** 消息回调 [Channel SDK 标准] */
        this.messageCallbacks = new Set();
        /** 状态回调 [Channel SDK 标准] */
        this.statusCallbacks = new Set();
        /** 待确认消息 */
        this.pendingMessages = new Map();
        /** 最后心跳时间 */
        this.lastHeartbeat = 0;
        /** 心跳定时器 */
        this.heartbeatTimer = null;
        /** 轮询定时器 */
        this.pollTimer = null;
        /** SSE EventSource */
        this.eventSource = null;
        /** WebSocket 实例 */
        this.ws = null;
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
            preferredMode: 'websocket',
            ssePath: '/api/channel/events',
            pollInterval: 5000,
            ...config,
        };
    }
    /**
     * 获取当前状态 [Channel SDK 标准]
     */
    get status() {
        return this._status;
    }
    /**
     * 获取实际使用的性能模式
     */
    get mode() {
        return this.currentMode;
    }
    /**
     * 连接到 WebHub [Channel SDK 标准]
     */
    async connect() {
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
        }
        catch (error) {
            this._status = 'disconnected';
            throw error;
        }
    }
    /**
     * 获取完整的 WebHub URL
     */
    getUrl(path) {
        const baseUrl = this.webhubUrl.replace(/\/$/, '');
        const urlPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${urlPath}`;
    }
    /**
     * 尝试 WebSocket 连接
     */
    async tryWebSocket() {
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
                    }
                    catch (e) {
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
            }
            catch {
                resolve(false);
            }
        });
    }
    /**
     * 尝试 SSE 连接
     */
    async trySSE() {
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
                    }
                    catch (e) {
                        // 忽略解析错误
                    }
                };
                this.eventSource.onerror = () => {
                    clearTimeout(timeout);
                    this.cleanupSSE();
                    resolve(false);
                };
            }
            catch {
                resolve(false);
            }
        });
    }
    /**
     * 清理 WebSocket
     */
    cleanupWebSocket() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    /**
     * 清理 SSE
     */
    cleanupSSE() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }
    /**
     * 注册频道
     */
    async register() {
        const response = await this.request('/api/channel/register', {
            channelId: this.config.channelId,
            secret: this.config.accessToken,
        });
        if (response.success && response.data?.accessToken) {
            this.config.accessToken = response.data.accessToken;
        }
        else {
            throw new Error('Failed to register channel');
        }
    }
    /**
     * 连接到 Hub
     */
    async connectToHub() {
        const response = await this.request('/api/channel/connect', {
            channelId: this.config.channelId,
        }, true);
        if (!response.success) {
            throw new Error('Failed to connect to hub');
        }
    }
    /**
     * 断开连接 [Channel SDK 标准]
     */
    async disconnect() {
        try {
            this.stopPolling();
            this.stopHeartbeat();
            this.cleanupWebSocket();
            this.cleanupSSE();
            if (this.config.accessToken) {
                await this.request('/api/channel/disconnect', {
                    channelId: this.config.channelId,
                }, true).catch(() => { });
            }
        }
        finally {
            this._status = 'disconnected';
            this.notifyStatus('disconnected');
        }
    }
    /**
     * 发送消息 [Channel SDK 标准]
     */
    async send(message) {
        const messageId = message.messageId || (0, uuid_1.v4)();
        try {
            const response = await this.request('/api/channel/messages', {
                channelId: this.config.channelId,
                messageId,
                target: message.target,
                content: {
                    text: message.content.text,
                    type: message.content.format || 'text',
                },
                metadata: message.metadata,
            }, true);
            this.stats.messagesSent++;
            this.stats.lastActiveAt = Date.now();
            return {
                messageId,
                success: true,
                timestamp: Date.now(),
            };
        }
        catch (error) {
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
        return {
            ...this.stats,
            mode: this.currentMode,
        };
    }
    /**
     * 发起 HTTP 请求
     */
    async request(path, body, requireAuth = false) {
        const headers = {
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
    startPolling() {
        this.pollTimer = setInterval(async () => {
            try {
                const response = await this.request('/api/channel/webhook', {
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
            }
            catch (error) {
                console.error('Polling error:', error);
            }
        }, this.config.pollInterval || 5000);
    }
    /**
     * 停止轮询
     */
    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }
    /**
     * 启动心跳
     */
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.lastHeartbeat = Date.now();
            this.request('/api/channel/heartbeat', {
                channelId: this.config.channelId,
            }, true).catch(() => { });
        }, this.config.heartbeatInterval || 30000);
    }
    /**
     * 停止心跳
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    /**
     * 通知消息
     */
    notifyMessage(message) {
        this.messageCallbacks.forEach((cb) => cb(message));
    }
    /**
     * 通知状态变化
     */
    notifyStatus(status, error) {
        this.statusCallbacks.forEach((cb) => cb(status, error));
    }
}
exports.WebHubAdapter = WebHubAdapter;
/**
 * WebHub 适配器工厂
 */
class WebHubAdapterFactory {
    constructor(modeConfig) {
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
    createConnectionAdapter(config) {
        return new WebHubAdapter(config);
    }
    /**
     * 创建消息适配器
     */
    createMessageAdapter() {
        return {
            parseInbound: (raw) => raw,
            formatOutbound: (message) => message,
            validate: (message) => !!message,
            sanitize: (text) => text,
        };
    }
    /**
     * 创建心跳适配器
     */
    createHeartbeatAdapter() {
        return {
            send: async () => true,
            handleResponse: () => { },
            isTimeout: () => false,
            getNextHeartbeatTime: () => Date.now() + 30000,
        };
    }
    /**
     * 创建认证适配器
     */
    createAuthAdapter() {
        return {
            getAuthHeaders: () => ({}),
            validateResponse: (response) => true,
            refreshToken: async () => true,
        };
    }
    /**
     * 创建能力适配器
     */
    createCapabilitiesAdapter() {
        return {
            getCapabilities: async () => ({
                messageTypes: [channel_1.MessageType.TEXT, channel_1.MessageType.IMAGE, channel_1.MessageType.VIDEO, channel_1.MessageType.AUDIO, channel_1.MessageType.FILE],
                targetTypes: [channel_1.TargetType.USER],
                richFormats: ['markdown'],
                attachments: true,
                reply: true,
            }),
            hasCapability: () => true,
        };
    }
    /**
     * 创建日志适配器
     */
    createLoggerAdapter() {
        return {
            debug: (message, data) => console.debug(message, data),
            info: (message, data) => console.info(message, data),
            warn: (message, data) => console.warn(message, data),
            error: (message, error) => console.error(message, error),
        };
    }
}
exports.WebHubAdapterFactory = WebHubAdapterFactory;
/**
 * 创建 WebHub 适配器工厂
 */
function createWebHubFactory(modeConfig) {
    return new WebHubAdapterFactory(modeConfig);
}
//# sourceMappingURL=webhub.js.map