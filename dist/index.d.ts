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
 * OpenClaw WebHub Channel Plugin Definition
 *
 * Implements the correct OpenClaw plugin pattern with:
 * - slot: 'channel' - indicates this is a channel plugin
 * - id: unique plugin identifier
 * - schema: configuration validation schema
 * - metadata: plugin information
 * - init: activation function that receives config and PluginAPI
 */
declare const WebHubPlugin: {
    slot: "channel";
    id: string;
    schema: import("@sinclair/typebox").TObject<{
        enabled: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
        apiUrl: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        accessToken: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        timeout: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        heartbeatInterval: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        maxReconnectAttempts: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        accounts: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TRecord<import("@sinclair/typebox").TString, import("@sinclair/typebox").TObject<{
            accountId: import("@sinclair/typebox").TString;
            apiUrl: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            accessToken: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            heartbeatInterval: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
            maxReconnectAttempts: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        }>>>;
    }>;
    metadata: {
        name: string;
        description: string;
        version: string;
        author: string;
        homepage: string;
    };
    /**
     * Plugin initialization function
     *
     * @param config - Validated configuration object
     * @param api - OpenClaw Plugin API
     * @returns Channel plugin implementation
     */
    init(config: any, api: any): Promise<{
        name: string;
        dispose(): Promise<void>;
    }>;
};
/**
 * Default export for standard ES6 module imports
 */
export default WebHubPlugin;
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
export declare const register: {
    slot: "channel";
    id: string;
    schema: import("@sinclair/typebox").TObject<{
        enabled: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
        apiUrl: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        accessToken: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        timeout: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        heartbeatInterval: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        maxReconnectAttempts: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        accounts: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TRecord<import("@sinclair/typebox").TString, import("@sinclair/typebox").TObject<{
            accountId: import("@sinclair/typebox").TString;
            apiUrl: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            accessToken: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            heartbeatInterval: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
            maxReconnectAttempts: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        }>>>;
    }>;
    metadata: {
        name: string;
        description: string;
        version: string;
        author: string;
        homepage: string;
    };
    /**
     * Plugin initialization function
     *
     * @param config - Validated configuration object
     * @param api - OpenClaw Plugin API
     * @returns Channel plugin implementation
     */
    init(config: any, api: any): Promise<{
        name: string;
        dispose(): Promise<void>;
    }>;
};
/**
 * Activate export - Plugin definition object for OpenClaw
 * Alternative export name that some versions of OpenClaw may look for
 */
export declare const activate: {
    slot: "channel";
    id: string;
    schema: import("@sinclair/typebox").TObject<{
        enabled: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
        apiUrl: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        accessToken: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        timeout: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        heartbeatInterval: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        maxReconnectAttempts: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        accounts: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TRecord<import("@sinclair/typebox").TString, import("@sinclair/typebox").TObject<{
            accountId: import("@sinclair/typebox").TString;
            apiUrl: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            accessToken: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
            heartbeatInterval: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
            maxReconnectAttempts: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        }>>>;
    }>;
    metadata: {
        name: string;
        description: string;
        version: string;
        author: string;
        homepage: string;
    };
    /**
     * Plugin initialization function
     *
     * @param config - Validated configuration object
     * @param api - OpenClaw Plugin API
     * @returns Channel plugin implementation
     */
    init(config: any, api: any): Promise<{
        name: string;
        dispose(): Promise<void>;
    }>;
};
//# sourceMappingURL=index.d.ts.map