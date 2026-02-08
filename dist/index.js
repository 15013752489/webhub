"use strict";
/**
 * OpenClaw WebHub Channel Plugin
 *
 * This plugin enables OpenClaw to communicate with WebHub services via HTTP/WebSocket.
 * Install with: openclaw plugins install ./
 *
 * @see https://docs.openclaw.ai/plugin
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = exports.register = void 0;
const typebox_1 = require("@sinclair/typebox");
const webhub_1 = require("./sdk/adapters/webhub");
/**
 * Channel capability constants
 */
const SUPPORTED_CHAT_TYPES = ['direct', 'group'];
const SUPPORTED_MEDIA_TYPES = ['text', 'image', 'file'];
const SUPPORTED_FEATURES = ['reply', 'edit', 'delete'];
/**
 * Plugin configuration schema
 */
const ConfigSchema = typebox_1.Type.Object({
    enabled: typebox_1.Type.Optional(typebox_1.Type.Boolean({ default: true })),
    apiUrl: typebox_1.Type.Optional(typebox_1.Type.String({ format: 'uri' })),
    accessToken: typebox_1.Type.Optional(typebox_1.Type.String()),
    timeout: typebox_1.Type.Optional(typebox_1.Type.Number({ default: 30000 })),
    accounts: typebox_1.Type.Optional(typebox_1.Type.Record(typebox_1.Type.String(), typebox_1.Type.Object({
        accountId: typebox_1.Type.String(),
        apiUrl: typebox_1.Type.Optional(typebox_1.Type.String()),
        accessToken: typebox_1.Type.Optional(typebox_1.Type.String()),
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
const WebHubPlugin = {
    slot: 'channel',
    id: 'chatu-webhub',
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
    async init(config, api) {
        const channelId = 'chatu-webhub';
        // Log plugin initialization
        api.log?.info({ event: 'plugin_init', channelId }, 'Initializing WebHub channel plugin');
        // Create a map to store WebHub adapters per account
        const adapters = new Map();
        /**
         * Get or create a WebHub adapter for a specific account
         */
        const getAdapter = async (accountId) => {
            const cacheKey = accountId || 'default';
            // Return existing adapter if already connected
            if (adapters.has(cacheKey)) {
                return adapters.get(cacheKey);
            }
            // Get account-specific configuration
            const account = config.accounts?.[accountId] ?? {};
            const webhubUrl = account.apiUrl ?? config.apiUrl;
            const accessToken = account.accessToken ?? config.accessToken;
            if (!webhubUrl || !accessToken) {
                throw new Error('WebHub API URL and access token are required');
            }
            // Create and configure adapter
            const adapter = new webhub_1.WebHubAdapter({
                channelId: cacheKey,
                webhubUrl,
                accessToken,
                heartbeatInterval: 30000,
                maxReconnectAttempts: 3,
            });
            // Connect to WebHub
            await adapter.connect();
            // Cache the adapter
            adapters.set(cacheKey, adapter);
            api.log?.info({ accountId, webhubUrl }, 'WebHub adapter connected');
            return adapter;
        };
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
                listAccountIds: (cfg) => {
                    const accounts = cfg.channels?.webhub?.accounts ?? {};
                    return Object.keys(accounts);
                },
                resolveAccount: (cfg, accountId) => {
                    const accounts = cfg.channels?.webhub?.accounts ?? {};
                    return accounts[accountId ?? 'default'] ?? { accountId };
                },
            },
            // Outbound message handling
            outbound: {
                deliveryMode: 'direct',
                sendText: async ({ text, target, accountId }) => {
                    try {
                        api.log?.debug({ text, target, accountId }, 'Sending message via WebHub');
                        // Get or create adapter for this account
                        const adapter = await getAdapter(accountId);
                        // Prepare outbound message using SDK types
                        const message = {
                            messageId: `msg_${Date.now()}`,
                            target: {
                                type: target.type || 'user',
                                id: target.id || target,
                            },
                            content: {
                                text,
                                format: 'plain', // Use valid format: 'plain', 'markdown', or 'html'
                            },
                            metadata: {
                                source: 'openclaw',
                                channelId,
                                accountId,
                            },
                        };
                        // Send message using WebHub adapter
                        const result = await adapter.send(message);
                        if (result.success) {
                            api.log?.debug({ messageId: result.messageId }, 'Message sent successfully via WebHub');
                            return {
                                ok: true,
                                messageId: result.messageId,
                                timestamp: result.timestamp,
                            };
                        }
                        else {
                            throw new Error(result.error?.message || 'Failed to send message');
                        }
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        const errorStack = error instanceof Error ? error.stack : undefined;
                        api.log?.error({ errorMessage, errorStack, text, target }, 'Failed to send message via WebHub');
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
        api.log?.info({ event: 'plugin_loaded', channelId }, 'WebHub channel plugin loaded successfully');
        // Return plugin lifecycle handlers
        return {
            name: 'webhub-channel',
            // Cleanup on plugin deactivation
            async dispose() {
                api.log?.info({ event: 'plugin_dispose', channelId }, 'Disposing WebHub channel plugin');
                // Disconnect all adapters
                for (const [accountId, adapter] of adapters.entries()) {
                    try {
                        await adapter.disconnect();
                        api.log?.debug({ accountId }, 'WebHub adapter disconnected');
                    }
                    catch (error) {
                        api.log?.warn({ accountId, error }, 'Failed to disconnect WebHub adapter');
                    }
                }
                // Clear adapter map
                adapters.clear();
            },
        };
    },
};
/**
 * Default export for standard ES6 module imports
 */
exports.default = WebHubPlugin;
/**
 * Named exports for OpenClaw plugin system compatibility
 *
 * OpenClaw's plugin loader looks for either:
 * 1. A default export of a plugin object (preferred, modern API)
 * 2. Named exports: 'register' or 'activate' (legacy compatibility)
 *
 * Based on the error message "chatu-webhub missing register/activate export",
 * some versions of OpenClaw require these named exports to be present.
 *
 * Both exports point to the same plugin object, as OpenClaw expects a plugin
 * definition object (with slot, id, schema, metadata, init) rather than functions.
 *
 * @see https://docs.openclaw.ai/plugin
 * @see Issue: "openclaw plugins install . 时出以下错" - User reported missing register/activate export
 */
/**
 * Register export - Plugin definition object for OpenClaw
 * Used by OpenClaw when loading the plugin
 */
exports.register = WebHubPlugin;
/**
 * Activate export - Plugin definition object for OpenClaw
 * Alternative export name that some versions of OpenClaw may look for
 */
exports.activate = WebHubPlugin;
//# sourceMappingURL=index.js.map