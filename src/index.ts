/**
 * OpenClaw WebHub Channel Plugin
 * 
 * This plugin enables OpenClaw to communicate with WebHub services via HTTP/WebSocket.
 * Install with: openclaw plugins install ./
 * 
 * @see https://docs.openclaw.ai/plugin
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 */

import { Type } from '@sinclair/typebox';

/**
 * Plugin configuration schema
 */
const ConfigSchema = Type.Object({
  enabled: Type.Optional(Type.Boolean({ default: true })),
  apiUrl: Type.Optional(Type.String({ format: 'uri' })),
  accessToken: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number({ default: 30000 })),
  accounts: Type.Optional(Type.Record(Type.String(), Type.Object({
    accountId: Type.String(),
    apiUrl: Type.Optional(Type.String()),
    accessToken: Type.Optional(Type.String()),
  }))),
});

/**
 * OpenClaw WebHub Channel Plugin Definition
 * 
 * Implements the correct OpenClaw plugin pattern with:
 * - slot: 'channel' - indicates this is a channel plugin
 * - id: unique plugin identifier
 * - schema: configuration validation schema
 * - metadata: plugin information
 * - init: activation function that receives config and PluginAPI
 */
export default {
  slot: 'channel' as const,
  id: 'webhub',
  schema: ConfigSchema,
  metadata: {
    name: 'WebHub',
    description: 'Connect OpenClaw to any Website via HTTP/WebSocket',
    version: '0.1.0',
    author: 'OpenClaw Team',
    homepage: 'https://github.com/chatu-ai/openclaw-web-hub-channel',
  },
  
  /**
   * Plugin initialization function
   * 
   * @param config - Validated configuration object
   * @param api - OpenClaw Plugin API
   * @returns Channel plugin implementation
   */
  async init(config: any, api: any) {
    const channelId = 'webhub';
    
    // Log plugin initialization
    api.log?.info({ event: 'plugin_init', channelId }, 'Initializing WebHub channel plugin');
    
    // Register the channel with OpenClaw
    await api.registerChannel({
      id: channelId,
      
      // Channel metadata
      meta: {
        id: channelId,
        label: 'WebHub',
        selectionLabel: 'WebHub (HTTP/WebSocket)',
        docsPath: '/channels/webhub',
        blurb: 'Connect to any website via HTTP/WebSocket',
        aliases: ['webhub', 'http-channel'],
      },
      
      // Channel capabilities
      capabilities: {
        chatTypes: ['direct', 'group'],
        media: ['text', 'image', 'file'],
        features: ['reply', 'edit', 'delete'],
      },
      
      // Configuration management
      config: {
        listAccountIds: (cfg: any) => {
          const accounts = cfg.channels?.webhub?.accounts ?? {};
          return Object.keys(accounts);
        },
        resolveAccount: (cfg: any, accountId: string) => {
          const accounts = cfg.channels?.webhub?.accounts ?? {};
          return accounts[accountId ?? 'default'] ?? { accountId };
        },
      },
      
      // Outbound message handling
      outbound: {
        deliveryMode: 'direct',
        sendText: async ({ text, target, accountId }: any) => {
          try {
            const account = config.accounts?.[accountId] ?? {};
            const apiUrl = account.apiUrl ?? config.apiUrl;
            const accessToken = account.accessToken ?? config.accessToken;
            
            if (!apiUrl || !accessToken) {
              throw new Error('WebHub API URL and access token are required');
            }
            
            // TODO: Implement actual HTTP/WebSocket message sending
            // This is a placeholder implementation
            api.log?.debug({ text, target, apiUrl }, 'Sending message via WebHub');
            
            return {
              ok: true,
              messageId: `msg_${Date.now()}`,
              timestamp: Date.now(),
            };
          } catch (error) {
            api.log?.error({ error, text, target }, 'Failed to send message via WebHub');
            return {
              ok: false,
              error: {
                message: error instanceof Error ? error.message : 'Unknown error',
              },
            };
          }
        },
      },
    });
    
    api.log?.info({ event: 'plugin_loaded', channelId }, 'WebHub channel plugin loaded successfully');
    
    // Return plugin lifecycle handlers
    return {
      name: 'webhub-channel',
      
      // Cleanup on plugin deactivation
      async dispose() {
        api.log?.info({ event: 'plugin_dispose', channelId }, 'Disposing WebHub channel plugin');
      },
    };
  },
};
