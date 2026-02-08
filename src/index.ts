/**
 * OpenClaw WebHub Channel Plugin
 * 
 * This plugin enables OpenClaw to communicate with WebHub services via HTTP/WebSocket.
 * Install with: openclaw plugins install ./
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
 * OpenClaw WebHub Channel Plugin Activation Function
 * 
 * This is the main entry point for the OpenClaw plugin system.
 * The activate function receives the PluginAPI and registers the channel.
 * 
 * @param api - OpenClaw Plugin API
 * @see https://docs.openclaw.ai/plugin
 */
export async function activate(api: any) {
  const channelId = 'webhub';
  
  // Log plugin initialization
  api.log?.info?.({ event: 'plugin_init', channelId }, 'Initializing WebHub channel plugin');
  
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
      chatTypes: [...SUPPORTED_CHAT_TYPES],
      media: [...SUPPORTED_MEDIA_TYPES],
      features: [...SUPPORTED_FEATURES],
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
      sendText: async ({ text, target, accountId, config }: any) => {
        try {
          const account = config?.accounts?.[accountId] ?? {};
          const apiUrl = account.apiUrl ?? config?.apiUrl;
          const accessToken = account.accessToken ?? config?.accessToken;
          
          if (!apiUrl || !accessToken) {
            throw new Error('WebHub API URL and access token are required');
          }
          
          // TODO: Implement actual HTTP/WebSocket message sending
          // This is a placeholder implementation
          api.log?.debug?.({ text, target, apiUrl }, 'Sending message via WebHub');
          
          return {
            ok: true,
            messageId: `msg_${Date.now()}`,
            timestamp: Date.now(),
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          api.log?.error?.({ errorMessage, errorStack, text, target }, 'Failed to send message via WebHub');
          return {
            ok: false,
            error: {
              message: errorMessage,
            },
          };
        }
      },
    },
  });
  
  api.log?.info?.({ event: 'plugin_loaded', channelId }, 'WebHub channel plugin loaded successfully');
  
  // Return plugin lifecycle handlers
  return {
    name: 'webhub-channel',
    
    // Cleanup on plugin deactivation
    async dispose() {
      api.log?.info?.({ event: 'plugin_dispose', channelId }, 'Disposing WebHub channel plugin');
    },
  };
}

/**
 * Register export - Alias for activate function
 * Some versions of OpenClaw may look for 'register' instead of 'activate'
 */
export const register = activate;

/**
 * Default export for ES6 module compatibility
 */
export default activate;
