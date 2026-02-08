/******************************************************************
 * Channel SDK - Entry Point
 *
 * OpenClaw Channel SDK 入口文件
 *
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 ******************************************************************/
export * from './types/channel';
export * from './types/adapters';
export * from './core/channel';
export * from './adapters/websocket';
export * from './adapters/default';
export * from './adapters/webhub';
/******************************************************************
 * Channel SDK - Message Class (Placeholder)
 ******************************************************************/
export interface Message {
    id: string;
    content: string;
}
/******************************************************************
 * Channel SDK - Connection Class (Placeholder)
 ******************************************************************/
export interface Connection {
    status: string;
}
//# sourceMappingURL=index.d.ts.map