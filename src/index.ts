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

  // Helper: get resolved config (channel-level, no per-account for lifecycle)
  function getConfig() {
    const pluginConfig = api.config?.plugins?.entries?.chatu?.config ?? {};
    const channelConfig = api.config?.channels?.chatu ?? {};
    return {
      apiUrl: channelConfig.apiUrl ?? pluginConfig.apiUrl,
      channelId: channelConfig.channelId ?? pluginConfig.channelId,
      secret: channelConfig.secret ?? pluginConfig.secret,
      accessToken: channelConfig.accessToken ?? pluginConfig.accessToken,
      timeout: channelConfig.timeout ?? pluginConfig.timeout ?? 30000,
    };
  }

  // Register + Connect lifecycle: called at plugin start
  async function registerAndConnect(): Promise<void> {
    const cfg = getConfig();
    if (!cfg.apiUrl) {
      api.log?.warn({ event: 'lifecycle_skip' }, 'No apiUrl configured, skipping register/connect');
      return;
    }

    // Step 1: register (secret → accessToken, status: registered)
    if (cfg.channelId && cfg.secret) {
      try {
        const resp = await fetch(`${cfg.apiUrl}/api/channel/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId: cfg.channelId, secret: cfg.secret }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const token = data?.data?.accessToken;
          if (token) {
            // Persist the returned token back to config
            try {
              await api.config?.set?.('channels.chatu.accessToken', token);
            } catch (_) {
              // config.set may not be available; log and continue with existing token
            }
            api.log?.info({ event: 'channel_registered', channelId: cfg.channelId }, 'Channel registered');
            cfg.accessToken = token;
          }
        } else {
          const body = await resp.text();
          api.log?.warn({ event: 'register_failed', status: resp.status, body }, 'Register failed, using existing accessToken');
        }
      } catch (err) {
        api.log?.warn({ event: 'register_error', err }, 'Register request failed, continuing');
      }
    }

    // Step 2: connect (accessToken → status: connected)
    const token = cfg.accessToken;
    const cid = cfg.channelId;
    if (token && cid) {
      try {
        const resp = await fetch(`${cfg.apiUrl}/api/channel/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': token,
          },
          body: JSON.stringify({ channelId: cid }),
        });
        if (resp.ok) {
          api.log?.info({ event: 'channel_connected', channelId: cid }, 'Channel connected');
        } else {
          const body = await resp.text();
          api.log?.warn({ event: 'connect_failed', status: resp.status, body }, 'Connect failed');
        }
      } catch (err) {
        api.log?.warn({ event: 'connect_error', err }, 'Connect request failed');
      }
    } else {
      api.log?.warn({ event: 'connect_skip' }, 'Missing accessToken or channelId, skipping connect');
    }
  }

  // Disconnect lifecycle: called at plugin dispose
  async function disconnect(): Promise<void> {
    const cfg = getConfig();
    if (!cfg.apiUrl || !cfg.accessToken || !cfg.channelId) return;
    try {
      await fetch(`${cfg.apiUrl}/api/channel/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': cfg.accessToken,
        },
        body: JSON.stringify({ channelId: cfg.channelId }),
      });
      api.log?.info({ event: 'channel_disconnected', channelId: cfg.channelId }, 'Channel disconnected');
    } catch (err) {
      api.log?.warn({ event: 'disconnect_error', err }, 'Disconnect request failed');
    }
  }

  // Kick off register+connect (non-blocking, errors are logged not thrown)
  registerAndConnect().catch(err => api.log?.error({ err }, 'registerAndConnect uncaught error'));

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
      
      // Resolve target - accept any string as a valid target
      resolveTarget: async (target: string) => {
        // Return the target as-is, allowing any target ID
        return {
          id: target,
          label: target,
          type: 'direct' as const,
        };
      },
      
      // Handle all targets for this channel
      listTargets: async ({ accountId }: any) => {
        try {
          const pluginConfig = api.config?.plugins?.entries?.chatu?.config ?? {};
          const channelConfig = api.config?.channels?.chatu ?? {};
          const account = channelConfig.accounts?.[accountId ?? 'default'] ?? {};
          const apiUrl = account.apiUrl ?? channelConfig.apiUrl ?? pluginConfig.apiUrl;
          
          if (!apiUrl) {
            return [];
          }
          
          // Return a default target based on channel ID
          // In a real implementation, you might fetch this from the server
          return [{
            id: accountId || 'default',
            label: `Chatu Channel (${accountId || 'default'})`,
            type: 'direct' as const,
          }];
        } catch (error) {
          api.log?.error({ error }, 'Failed to list targets');
          return [];
        }
      },
      
      sendText: async ({ text, target, accountId, replyTo }: any) => {
        try {
          // Get plugin configuration via api.config
          const pluginConfig = api.config?.plugins?.entries?.chatu?.config ?? {};
          const channelConfig = api.config?.channels?.chatu ?? {};
          
          // Resolve account configuration
          const account = channelConfig.accounts?.[accountId ?? 'default'] ?? {};
          const apiUrl = account.apiUrl ?? channelConfig.apiUrl ?? pluginConfig.apiUrl;
          const accessToken = account.accessToken ?? channelConfig.accessToken ?? pluginConfig.accessToken;
          const timeout = account.timeout ?? channelConfig.timeout ?? pluginConfig.timeout ?? 30000;
          
          if (!apiUrl) {
            throw new Error('Chatu API URL is required. Configure with: openclaw config set channels.chatu.apiUrl "http://localhost:3000"');
          }
          
          if (!accessToken) {
            throw new Error('Chatu access token is required. Configure with: openclaw config set channels.chatu.accessToken "your-token"');
          }
          
          // Prepare message payload
          const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const payload = {
            messageId,
            target: {
              type: 'user',
              id: target || accountId || 'default',
            },
            content: {
              text,
              format: 'plain',
            },
            timestamp: Date.now(),
            ...(replyTo && { replyTo }),
          };
          
          api.log?.info({ 
            event: 'sending_message',
            target: payload.target,
            apiUrl,
            messageId 
          }, 'Sending message to Chatu service');
          
          // Send HTTP POST request
          const url = `${apiUrl}/api/channel/messages`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Channel-Token': accessToken,
                'X-Channel-ID': accountId || 'default',
              },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            api.log?.info({ 
              event: 'message_sent',
              messageId,
              result 
            }, 'Message sent successfully');
            
            return {
              ok: true,
              messageId: result.messageId || messageId,
              timestamp: result.deliveredAt ? new Date(result.deliveredAt).getTime() : Date.now(),
            };
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            
            if (fetchError.name === 'AbortError') {
              throw new Error(`Request timeout after ${timeout}ms`);
            }
            
            throw fetchError;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          api.log?.error({ 
            event: 'send_message_failed',
            errorMessage, 
            errorStack, 
            text, 
            target 
          }, 'Failed to send message via Chatu');
          
          return {
            ok: false,
            error: {
              message: errorMessage,
              code: 'SEND_FAILED',
            },
          };
        }
      },
      
      sendMedia: async ({ mediaUrl, mediaType, caption, target, accountId }: any) => {
        try {
          const pluginConfig = api.config?.plugins?.entries?.chatu?.config ?? {};
          const channelConfig = api.config?.channels?.chatu ?? {};
          const account = channelConfig.accounts?.[accountId ?? 'default'] ?? {};
          const apiUrl = account.apiUrl ?? channelConfig.apiUrl ?? pluginConfig.apiUrl;
          const accessToken = account.accessToken ?? channelConfig.accessToken ?? pluginConfig.accessToken;
          const timeout = account.timeout ?? channelConfig.timeout ?? pluginConfig.timeout ?? 30000;
          
          if (!apiUrl || !accessToken) {
            throw new Error('Chatu API URL and access token are required');
          }
          
          const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const payload = {
            messageId,
            target: {
              type: 'user',
              id: target || accountId || 'default',
            },
            content: {
              text: caption || '',
              format: 'plain',
            },
            media: [{
              type: mediaType || 'file',
              url: mediaUrl,
            }],
            timestamp: Date.now(),
          };
          
          api.log?.info({ event: 'sending_media', messageId, mediaType }, 'Sending media message');
          
          const url = `${apiUrl}/api/channel/messages`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Channel-Token': accessToken,
                'X-Channel-ID': accountId || 'default',
              },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            return {
              ok: true,
              messageId: result.messageId || messageId,
              timestamp: result.deliveredAt ? new Date(result.deliveredAt).getTime() : Date.now(),
            };
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              throw new Error(`Request timeout after ${timeout}ms`);
            }
            throw fetchError;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          api.log?.error({ event: 'send_media_failed', errorMessage, mediaUrl, target }, 'Failed to send media');
          return {
            ok: false,
            error: {
              message: errorMessage,
              code: 'SEND_MEDIA_FAILED',
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
      await disconnect();
    },
  };
}
