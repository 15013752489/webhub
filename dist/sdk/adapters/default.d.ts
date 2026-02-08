/******************************************************************
 * Channel SDK - Default Adapter Factory
 *
 * OpenClaw Channel SDK 的默认适配器工厂
 *
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 ******************************************************************/
import { ConnectionConfig } from '../types/channel';
import type { ConnectionAdapter, MessageAdapter, HeartbeatAdapter, AuthAdapter, CapabilitiesAdapter, LoggerAdapter, AdapterFactory } from '../types/adapters';
/**
 * 默认适配器工厂 [Channel SDK 标准]
 *
 * 提供所有适配器的默认实现
 */
export declare class DefaultAdapterFactory implements AdapterFactory {
    createConnectionAdapter(config: ConnectionConfig): ConnectionAdapter;
    createMessageAdapter(): MessageAdapter;
    createHeartbeatAdapter(): HeartbeatAdapter;
    createAuthAdapter(token?: string): AuthAdapter;
    createCapabilitiesAdapter(): CapabilitiesAdapter;
    createLoggerAdapter(): LoggerAdapter;
}
export declare function createDefaultFactory(): DefaultAdapterFactory;
//# sourceMappingURL=default.d.ts.map