// OpenClaw WebHub Channel Plugin
// 
// This plugin enables OpenClaw to communicate with WebHub services.
// Install with: openclaw plugins install ./

export default function registerWebHubChannel(api: any) {
  const channelId = 'webhub'
  
  api.registerChannel({
    id: channelId,
    meta: {
      id: channelId,
      label: 'WebHub',
      selectionLabel: 'WebHub (HTTP/WebSocket)',
      docsPath: '/channels/webhub',
      blurb: 'Connect to any website via HTTP/WebSocket',
      aliases: ['webhub', 'http-channel'],
    },
    capabilities: {
      chatTypes: ['direct'],
      media: ['text'],
    },
    config: {
      listAccountIds: (cfg: any) => Object.keys(cfg.channels?.webhub?.accounts ?? {}),
      resolveAccount: (cfg: any, accountId: string) =>
        cfg.channels?.webhub?.accounts?.[accountId ?? 'default'] ?? { accountId },
    },
    outbound: {
      deliveryMode: 'direct',
      sendText: async ({ text, target }: any) => {
        return { ok: true }
      },
    },
  })
  
  api.logger?.info({ event: 'plugin_loaded', channelId }, 'WebHub channel plugin loaded')
}
