"use strict";
/******************************************************************
 * Channel SDK - Default Adapter Factory
 *
 * OpenClaw Channel SDK 的默认适配器工厂
 *
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 ******************************************************************/
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultAdapterFactory = void 0;
exports.createDefaultFactory = createDefaultFactory;
const channel_1 = require("../types/channel");
const websocket_1 = require("./websocket");
/**
 * 消息适配器实现 [Channel SDK 标准]
 */
class DefaultMessageAdapter {
    parseInbound(raw) {
        return raw;
    }
    formatOutbound(message) {
        return message;
    }
    validate(message) {
        return message && typeof message === 'object';
    }
    sanitize(text) {
        return text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
/**
 * 心跳适配器实现 [Channel SDK 标准]
 */
class DefaultHeartbeatAdapter {
    constructor(timeout = 10000) {
        this.lastResponse = Date.now();
        this.timeout = timeout;
    }
    async send() {
        return true;
    }
    handleResponse() {
        this.lastResponse = Date.now();
    }
    isTimeout() {
        return Date.now() - this.lastResponse > this.timeout;
    }
    getNextHeartbeatTime() {
        return Date.now() + 30000;
    }
}
/**
 * 认证适配器实现 [Channel SDK 标准]
 */
class DefaultAuthAdapter {
    constructor(token) {
        this.token = token;
    }
    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
        };
    }
    validateResponse(response) {
        return response !== null && response !== undefined;
    }
    async refreshToken() {
        return true;
    }
}
/**
 * 能力适配器实现 [Channel SDK 标准]
 */
class DefaultCapabilitiesAdapter {
    async getCapabilities() {
        return {
            messageTypes: [
                channel_1.MessageType.TEXT,
                channel_1.MessageType.IMAGE,
                channel_1.MessageType.VIDEO,
                channel_1.MessageType.AUDIO,
                channel_1.MessageType.FILE,
            ],
            targetTypes: [channel_1.TargetType.USER, channel_1.TargetType.GROUP],
            richFormats: ['markdown'],
            attachments: true,
            reply: true,
        };
    }
    hasCapability(capability) {
        return true;
    }
}
/**
 * 日志适配器实现 [Channel SDK 标准]
 */
class DefaultLoggerAdapter {
    debug(message, data) {
        console.debug(`[DEBUG] ${message}`, data || '');
    }
    info(message, data) {
        console.info(`[INFO] ${message}`, data || '');
    }
    warn(message, data) {
        console.warn(`[WARN] ${message}`, data || '');
    }
    error(message, error) {
        console.error(`[ERROR] ${message}`, error || '');
    }
}
/**
 * 默认适配器工厂 [Channel SDK 标准]
 *
 * 提供所有适配器的默认实现
 */
class DefaultAdapterFactory {
    createConnectionAdapter(config) {
        return new websocket_1.WebSocketAdapter(config);
    }
    createMessageAdapter() {
        return new DefaultMessageAdapter();
    }
    createHeartbeatAdapter() {
        return new DefaultHeartbeatAdapter();
    }
    createAuthAdapter(token) {
        return new DefaultAuthAdapter(token || '');
    }
    createCapabilitiesAdapter() {
        return new DefaultCapabilitiesAdapter();
    }
    createLoggerAdapter() {
        return new DefaultLoggerAdapter();
    }
}
exports.DefaultAdapterFactory = DefaultAdapterFactory;
/**
 * 创建默认工厂单例 [Channel SDK 标准]
 */
let factory = null;
function createDefaultFactory() {
    if (!factory) {
        factory = new DefaultAdapterFactory();
    }
    return factory;
}
//# sourceMappingURL=default.js.map