/**
 * OpenClaw Chatu Channel Plugin
 * 
 * This plugin enables OpenClaw to communicate with Chatu services via HTTP/WebSocket.
 * Install with: openclaw plugins install @openclaw/chatu
 * 
 * @see https://docs.openclaw.ai/plugin
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 */

/**
 * Channel capability constants
 */
const SUPPORTED_CHAT_TYPES = ['direct', 'group'] as const;
const SUPPORTED_MEDIA_TYPES = ['text', 'image', 'file'] as const;
const SUPPORTED_FEATURES = ['reply', 'edit', 'delete'] as const;

/**
 * OpenClaw Chatu Channel Plugin
 * 
 * Modern function-based plugin API (OpenClaw 1.x+)
 * This is the recommended approach for creating channel plugins.
 * 
 * @param api - OpenClaw Plugin API provided by the runtime
 */
export default function (api: any) {
  const channelId = 'chatu';
  
  // Log plugin initialization
  api.log?.info({ event: 'plugin_init', channelId }, 'Initializing Chatu channel plugin');
  
  // Define the channel configuration
  const chatuChannel = {
    id: channelId,
    
    // Channel metadata
    meta: {
      id: channelId,
      label: 'Chatu',
      selectionLabel: 'Chatu (HTTP/WebSocket)',
      docsPath: '/channels/chatu',
      blurb: 'Connect to any website via HTTP/WebSocket',
      aliases: ['chatu', 'http-channel'],
    },
    
    // Channel capabilities
    capabilities: {
      chatTypes: [...SUPPORTED_CHAT_TYPES],
      media: [...SUPPORTED_MEDIA_TYPES],
      features: [...SUPPORTED_FEATURES],
    },
    
    // Configuration management
    config: {
      listAccountIds: (cfg: any) => {
        const accounts = cfg.channels?.chatu?.accounts ?? {};
        return Object.keys(accounts);
      },
      resolveAccount: (cfg: any, accountId: string) => {
        const accounts = cfg.channels?.chatu?.accounts ?? {};
        return accounts[accountId ?? 'default'] ?? { accountId };
      },
    },
    
    // Outbound message handling
    outbound: {
      deliveryMode: 'direct' as const,
      sendText: async ({ text, target, accountId }: any) => {
        try {
          // Get plugin configuration via api.config
          const pluginConfig = api.config?.plugins?.entries?.chatu?.config ?? {};
          const channelConfig = api.config?.channels?.chatu ?? {};
          
          // Resolve account configuration
          const account = channelConfig.accounts?.[accountId ?? 'default'] ?? {};
          const apiUrl = account.apiUrl ?? channelConfig.apiUrl ?? pluginConfig.apiUrl;
          const accessToken = account.accessToken ?? channelConfig.accessToken ?? pluginConfig.accessToken;
          
          if (!apiUrl || !accessToken) {
            throw new Error('Chatu API URL and access token are required');
          }
          
          // TODO: Implement actual HTTP/WebSocket message sending
          // This is a placeholder implementation
          api.log?.debug({ text, target, apiUrl }, 'Sending message via Chatu');
          
          return {
            ok: true,
            messageId: `msg_${Date.now()}`,
            timestamp: Date.now(),
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          api.log?.error({ errorMessage, errorStack, text, target }, 'Failed to send message via Chatu');
          return {
            ok: false,
            error: {
              message: errorMessage,
            },
          };
        }
      },
    },
  };
  
  // Register the channel with OpenClaw
  api.registerChannel({ plugin: chatuChannel });
  
  api.log?.info({ event: 'plugin_loaded', channelId }, 'Chatu channel plugin loaded successfully');
  
  // Return plugin lifecycle handlers (optional)
  return {
    name: 'chatu-channel',
    
    // Cleanup on plugin deactivation
    async dispose() {
      api.log?.info({ event: 'plugin_dispose', channelId }, 'Disposing Chatu channel plugin');
    },
  };
}
