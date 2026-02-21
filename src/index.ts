/**
 * OpenClaw Chatu Channel Plugin
 *
 * This plugin enables OpenClaw to communicate with Chatu/WebHub services
 * via HTTP polling (inbound) and HTTP POST (outbound).
 *
 * Architecture:
 *   User (browser) → WebHub service (POST /api/webhub/channels/:id/messages)
 *   Plugin polls    → GET /api/channel/messages/pending
 *   Plugin dispatches → OpenClaw AI
 *   AI responds     → plugin outbound.sendText → POST /api/channel/messages
 *   WebHub service  → WebSocket push → browser
 *
 * @see https://docs.openclaw.ai/channels/chatu
 * @see https://github.com/chatu-ai/openclaw-web-hub-channel
 */

import type {
  OpenClawPluginApi,
  ChannelPlugin,
  OpenClawConfig,
  ChannelAccountSnapshot,
  ChannelGatewayContext,
  ChannelLogoutContext,
  ChannelSetupInput,
  ChannelLogSink,
} from 'openclaw/plugin-sdk';

/** Resolved per-account configuration for the Chatu channel. */
export interface ChatuAccount {
  accountId: string;
  apiUrl: string;
  channelId: string;
  secret?: string;
  accessToken?: string;
  timeout: number;
}

/** Custom setup input fields used by the Chatu channel. */
type ChatuSetupInput = ChannelSetupInput & {
  apiUrl?: string;
  channelId?: string;
  secret?: string;
};

const CHANNEL_ID = 'chatu' as const;
const POLL_INTERVAL_MS = 2000;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_CHUNK_LIMIT = 4000;

// ─────────────────────────────────────────────────────────────────────────────
// Plugin Entry Point
// ─────────────────────────────────────────────────────────────────────────────

export default function (api: OpenClawPluginApi) {
  // ── Config helpers ──────────────────────────────────────────────────────────

  api.logger.info('[chatu] Initializing channel plugin');


  // ── Config helpers ──────────────────────────────────────────────────────────

  /** Resolve per-account config, falling back to channel-level then plugin-level. */
  function getAccountConfig(accountId?: string | null) {
    const pluginCfg: Record<string, any> = api.config?.plugins?.entries?.chatu?.config ?? {};
    const channelCfg: Record<string, any> = api.config?.channels?.chatu ?? {};
    const accounts: Record<string, any> = channelCfg.accounts ?? {};
    const acctCfg: Record<string, any> =
      accountId && accounts[accountId] ? accounts[accountId] : {};

    return {
      apiUrl:     acctCfg.apiUrl     ?? channelCfg.apiUrl     ?? pluginCfg.apiUrl     ?? '',
      channelId:  acctCfg.channelId  ?? channelCfg.channelId  ?? pluginCfg.channelId  ?? '',
      secret:     acctCfg.secret     ?? channelCfg.secret     ?? pluginCfg.secret     ?? '',
      accessToken:acctCfg.accessToken?? channelCfg.accessToken?? pluginCfg.accessToken?? '',
      timeout:    acctCfg.timeout    ?? channelCfg.timeout    ?? pluginCfg.timeout    ?? DEFAULT_TIMEOUT_MS,
    };
  }

  // ── HTTP helpers ─────────────────────────────────────────────────────────────

  async function timedFetch(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(id);
    }
  }

  // ── Lifecycle: register + connect ─────────────────────────────────────────────

  async function registerAndConnect(accountId?: string | null): Promise<void> {
    const cfg = getAccountConfig(accountId);
    if (!cfg.apiUrl) return;

    // Step 1: register (secret → accessToken)
    if (cfg.channelId && cfg.secret && !cfg.accessToken) {
      try {
        const resp = await timedFetch(
          `${cfg.apiUrl}/api/channel/register`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId: cfg.channelId, secret: cfg.secret }),
          },
          cfg.timeout,
        );
        if (resp.ok) {
          const data = await resp.json();
          const token: string | undefined = data?.data?.accessToken;
          if (token) {
            const cfgKey = accountId
              ? `channels.chatu.accounts.${accountId}.accessToken`
              : 'channels.chatu.accessToken';
            try { await (api as any).config?.set?.(cfgKey, token); } catch (_) { /* ok */ }
            api.logger.info(`[chatu] Channel registered (channelId=${cfg.channelId})`);
          }
        }
      } catch (err) {
        api.logger.warn(`[chatu] Register request failed: ${String(err)}`);
      }
    }

    // Step 2: connect
    const refreshed = getAccountConfig(accountId);
    if (refreshed.accessToken && refreshed.channelId) {
      try {
        const resp = await timedFetch(
          `${refreshed.apiUrl}/api/channel/connect`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-access-token': refreshed.accessToken,
            },
            body: JSON.stringify({ channelId: refreshed.channelId }),
          },
          refreshed.timeout,
        );
        if (resp.ok) {
          api.logger.info(`[chatu] Channel connected (channelId=${refreshed.channelId})`);
        }
      } catch (err) {
        api.logger.warn(`[chatu] Connect request failed: ${String(err)}`);
      }
    }
  }

  async function disconnectAccount(accountId?: string | null): Promise<void> {
    const cfg = getAccountConfig(accountId);
    if (!cfg.apiUrl || !cfg.accessToken || !cfg.channelId) return;
    try {
      await timedFetch(
        `${cfg.apiUrl}/api/channel/disconnect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-access-token': cfg.accessToken,
          },
          body: JSON.stringify({ channelId: cfg.channelId }),
        },
        cfg.timeout,
      );
    } catch (_) { /* best-effort */ }
  }

  // Kick off default account lifecycle (non-blocking)
  registerAndConnect().catch((err) =>
    api.logger.error(`[chatu] registerAndConnect uncaught error: ${String(err)}`),
  );

  // ── Inbound: deliver AI reply back to service ────────────────────────────────

  async function deliverOutbound(params: {
    text: string;
    target: string;
    accountId?: string | null;
    replyTo?: string | null;
    mediaUrl?: string;
    mediaType?: string;
  }): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    const cfg = getAccountConfig(params.accountId);
    if (!cfg.apiUrl || !cfg.accessToken) {
      return { ok: false, error: 'Missing apiUrl or accessToken' };
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload: Record<string, unknown> = {
      messageId,
      target: { type: 'user', id: params.target },
      content: { text: params.text, format: 'plain' },
      timestamp: Date.now(),
    };
    if (params.replyTo) payload.replyTo = params.replyTo;
    if (params.mediaUrl) {
      payload.media = [{ type: params.mediaType ?? 'file', url: params.mediaUrl }];
    }

    try {
      const resp = await timedFetch(
        `${cfg.apiUrl}/api/channel/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Channel-Token': cfg.accessToken,
            'X-Channel-ID': params.accountId ?? cfg.channelId ?? 'default',
          },
          body: JSON.stringify(payload),
        },
        cfg.timeout,
      );
      if (!resp.ok) {
        const errorText = await resp.text();
        return { ok: false, error: `HTTP ${resp.status}: ${errorText}` };
      }
      const result = await resp.json();
      return { ok: true, messageId: result.messageId ?? messageId };
    } catch (err: any) {
      return { ok: false, error: String(err?.message ?? err) };
    }
  }

  // ── Gateway: poll + dispatch inbound user messages ───────────────────────────

  /**
   * Dispatch a single user message from the web client to the OpenClaw AI
   * pipeline using the PluginRuntime API.
   */
  async function dispatchUserMessage(params: {
    id: string;
    content: string;
    senderId: string;
    senderName?: string;
    timestamp?: number;
    accountId: string;
    cfg: any;
  }): Promise<void> {
    const { id, content, senderId, senderName, timestamp, accountId, cfg } = params;

    if (!content?.trim()) return;

    const runtime = api.runtime;
    if (!runtime?.channel?.reply?.dispatchReplyWithBufferedBlockDispatcher) {
      api.logger.warn(`[chatu] api.runtime not available; cannot dispatch inbound message (id=${id})`);
      return;
    }

    const to = `chatu:${senderId}`;
    const fromLabel = senderName ? `${senderName} (${senderId})` : senderId;

    try {
      const route = runtime.channel.routing.resolveAgentRoute({
        cfg,
        channel: CHANNEL_ID,
        accountId,
        peer: { kind: 'direct' as const, id: senderId },
      });

      const ctxPayload = runtime.channel.reply.finalizeInboundContext({
        Body: content,
        BodyForAgent: content,
        RawBody: content,
        CommandBody: content,
        From: `chatu:${senderId}`,
        To: to,
        SessionKey: route.sessionKey,
        AccountId: route.accountId,
        ChatType: 'direct',
        ConversationLabel: fromLabel,
        SenderName: senderName ?? senderId,
        SenderId: senderId,
        Provider: CHANNEL_ID,
        Surface: CHANNEL_ID,
        MessageSid: id,
        Timestamp: timestamp ?? Date.now(),
        OriginatingChannel: CHANNEL_ID,
        OriginatingTo: to,
        WasMentioned: true,
        CommandAuthorized: false,
      });

      api.logger.info(`[chatu] Dispatching user message to AI (id=${id}, sender=${senderId})`);

      await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx: ctxPayload,
        cfg,
        dispatcherOptions: {
          deliver: async (payload: any) => {
            const text: string = payload.text ?? '';
            if (!text) return;
            const result = await deliverOutbound({
              text,
              target: senderId,
              accountId,
              replyTo: payload.replyToId ?? id,
            });
            if (!result.ok) {
              api.logger.error(`[chatu] Failed to deliver AI reply (target=${senderId}): ${result.error}`);
            }
          },
          onError: (err: unknown, info: { kind: string }) => {
            api.logger.error(`[chatu] ${info.kind} reply failed: ${String(err)}`);
          },
        },
        replyOptions: {},
      });
    } catch (err) {
      api.logger.error(`[chatu] Exception dispatching user message (id=${id}): ${String(err)}`);
    }
  }

  /**
   * Acknowledge that a message has been processed by the plugin.
   */
  async function ackMessage(
    apiUrl: string,
    accessToken: string,
    messageId: string,
    timeout: number,
  ): Promise<void> {
    try {
      await timedFetch(
        `${apiUrl}/api/channel/messages/${messageId}/ack`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Channel-Token': accessToken,
          },
        },
        timeout,
      );
    } catch (_) { /* best-effort */ }
  }

  /**
   * Long-running poll loop for the gateway.
   * Polls the WebHub service for new user messages and dispatches them to OpenClaw AI.
   * Runs until `abortSignal` fires.
   */
  async function pollLoop(ctx: {
    accountId: string;
    abortSignal: AbortSignal;
    setStatus: (s: ChannelAccountSnapshot) => void;
    log?: ChannelLogSink;
  }): Promise<void> {
    const { accountId, abortSignal } = ctx;
    const cfg = getAccountConfig(accountId);

    if (!cfg.apiUrl || !cfg.accessToken) {
      ctx.log?.error?.(`[${accountId}] chatu: missing apiUrl or accessToken for polling`);
      return;
    }

    let lastCursor = '';
    let consecutiveErrors = 0;
    const MAX_ERRORS = 10;

    ctx.setStatus({ accountId: ctx.accountId, connected: true });
    ctx.log?.info?.(`[${accountId}] chatu: polling started`);

    while (!abortSignal.aborted) {
      // Exponential back-off: 2s → 4s → 8s → … capped at 30s on consecutive errors
      const backoffMs = Math.min(POLL_INTERVAL_MS * Math.pow(2, consecutiveErrors), MAX_BACKOFF_MS);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, backoffMs);
        abortSignal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
      });

      if (abortSignal.aborted) break;

      try {
        const url =
          `${cfg.apiUrl}/api/channel/messages/pending` +
          `?channelId=${encodeURIComponent(cfg.channelId)}` +
          `&after=${encodeURIComponent(lastCursor)}`;

        const resp = await timedFetch(
          url,
          {
            method: 'GET',
            headers: {
              'X-Channel-Token': cfg.accessToken,
              'X-Channel-ID': accountId,
            },
          },
          cfg.timeout,
        );

        if (!resp.ok) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_ERRORS) {
            ctx.setStatus({ accountId: ctx.accountId, connected: false, lastError: `HTTP ${resp.status}` });
          }
          continue;
        }

        consecutiveErrors = 0;
        ctx.setStatus({ accountId: ctx.accountId, connected: true });

        const data = await resp.json();
        const messages: any[] = data?.data ?? [];

        for (const msg of messages) {
          lastCursor = msg.id ?? lastCursor;

          // Ack first (idempotency)
          await ackMessage(cfg.apiUrl, cfg.accessToken, msg.id, cfg.timeout);

          const freshCfg = api.config ?? {};
          await dispatchUserMessage({
            id: msg.id,
            content: msg.content ?? msg.text ?? '',
            senderId: msg.senderId ?? msg.sender?.id ?? 'user',
            senderName: msg.senderName ?? msg.sender?.name,
            timestamp: msg.createdAt
              ? new Date(msg.createdAt).getTime()
              : Date.now(),
            accountId,
            cfg: freshCfg,
          });
        }
      } catch (err) {
        consecutiveErrors++;
        api.logger.warn(`[chatu] Poll failed (account=${accountId}, errors=${consecutiveErrors}): ${String(err)}`);
        if (consecutiveErrors >= MAX_ERRORS) {
          ctx.setStatus({ accountId: ctx.accountId, connected: false, lastError: String(err) });
        }
      }
    }

    ctx.setStatus({ accountId: ctx.accountId, connected: false });
    ctx.log?.info?.(`[${accountId}] chatu: polling stopped`);
  }

  // ── Channel Plugin Definition ────────────────────────────────────────────────

  const chatuChannel: ChannelPlugin<ChatuAccount> = {
    id: CHANNEL_ID,

    // ── Metadata ──────────────────────────────────────────────────────────────
    meta: {
      id: CHANNEL_ID,
      label: 'Chatu',
      selectionLabel: 'Chatu (HTTP/WebSocket)',
      docsPath: '/channels/chatu',
      blurb: 'Connect to any website via HTTP/WebSocket (WebHub service)',
      aliases: ['chatu', 'http-channel', 'webhub'],
    },

    // ── Capabilities ──────────────────────────────────────────────────────────
    capabilities: {
      chatTypes: ['direct', 'group'] as Array<'direct' | 'group'>,
      reply: true,
      edit: false,
      unsend: false,
      reactions: false,
      polls: false,
      media: true,
      threads: false,
      blockStreaming: false,
    },

    defaults: { queue: { debounceMs: 0 } },

    // ── Config Schema (UI hints) ───────────────────────────────────────────────
    configSchema: {
      schema: {
        type: 'object',
        properties: {
          apiUrl:      { type: 'string', description: 'WebHub service base URL' },
          channelId:   { type: 'string', description: 'Channel ID from WebHub' },
          secret:      { type: 'string', description: 'Channel secret (wh_secret_...)' },
          accessToken: { type: 'string', description: 'Access token' },
          timeout:     { type: 'number', description: 'Request timeout in ms' },
        },
      },
      uiHints: {
        apiUrl: {
          label: 'API URL',
          placeholder: 'https://your-webhub-service.example.com',
          help: 'Base URL of the Chatu WebHub service',
        },
        channelId: {
          label: 'Channel ID',
          placeholder: 'wh_ch_xxxxxx',
          help: 'Channel ID from the WebHub service',
        },
        secret: {
          label: 'Channel Secret',
          sensitive: true,
          placeholder: 'wh_secret_xxxxxxxxxx',
        },
        accessToken: {
          label: 'Access Token',
          sensitive: true,
          placeholder: 'wh_xxxxxxxxxxxxxxxx',
          advanced: true,
        },
        timeout: { label: 'Timeout (ms)', placeholder: '30000', advanced: true },
      },
    },

    // ── Setup (CLI) ───────────────────────────────────────────────────────────
    setup: {
      applyAccountConfig: ({ cfg, accountId, input }: { cfg: OpenClawConfig; accountId: string; input: ChannelSetupInput }) => {
        const chatInput = input as ChatuSetupInput;
        const next = { ...cfg } as Record<string, any>;
        if (!next['channels']) next['channels'] = {};
        if (!next['channels'].chatu) next['channels'].chatu = {};
        if (!next['channels'].chatu.accounts) next['channels'].chatu.accounts = {};
        if (!next['channels'].chatu.accounts[accountId]) {
          next['channels'].chatu.accounts[accountId] = {};
        }
        const acct = next['channels'].chatu.accounts[accountId];
        if (chatInput.apiUrl)        acct.apiUrl      = chatInput.apiUrl;
        if (chatInput.channelId)     acct.channelId   = chatInput.channelId;
        if (chatInput.secret)        acct.secret      = chatInput.secret;
        if (input.accessToken)       acct.accessToken = input.accessToken;
        return next as OpenClawConfig;
      },
      validateInput: ({ input }: { cfg: OpenClawConfig; accountId: string; input: ChannelSetupInput }): string | null => {
        const chatInput = input as ChatuSetupInput;
        if (!chatInput.apiUrl)    return 'apiUrl is required';
        if (!chatInput.channelId) return 'channelId is required';
        if (!chatInput.secret && !input.accessToken)
          return 'Either secret or accessToken is required';
        return null;
      },
    },

    // ── Config ────────────────────────────────────────────────────────────────
    config: {
      listAccountIds: (cfg: OpenClawConfig): string[] => {
        const accounts = cfg?.channels?.chatu?.accounts ?? {};
        const ids = Object.keys(accounts);
        if (
          ids.length === 0 &&
          (cfg?.channels?.chatu?.apiUrl || cfg?.channels?.chatu?.channelId)
        ) {
          return ['default'];
        }
        return ids;
      },

      resolveAccount: (cfg: OpenClawConfig, accountId?: string | null): ChatuAccount => {
        const accounts   = cfg?.channels?.chatu?.accounts ?? {};
        const channelCfg = cfg?.channels?.chatu ?? {};
        const id         = accountId ?? 'default';
        const acct       = accounts[id] ?? {};
        return {
          accountId:   id,
          apiUrl:      acct.apiUrl      ?? channelCfg.apiUrl      ?? '',
          channelId:   acct.channelId   ?? channelCfg.channelId   ?? '',
          secret:      acct.secret      ?? channelCfg.secret,
          accessToken: acct.accessToken ?? channelCfg.accessToken,
          timeout:     acct.timeout     ?? channelCfg.timeout     ?? DEFAULT_TIMEOUT_MS,
        };
      },

      isConfigured: (account: ChatuAccount, _cfg: OpenClawConfig): boolean =>
        Boolean(
          account?.apiUrl &&
          account?.channelId &&
          (account?.accessToken || account?.secret),
        ),

      unconfiguredReason: (account: ChatuAccount, _cfg: OpenClawConfig): string => {
        if (!account?.apiUrl)    return 'apiUrl not configured';
        if (!account?.channelId) return 'channelId not configured';
        if (!account?.accessToken && !account?.secret)
          return 'accessToken or secret not configured';
        return 'Not configured';
      },

      isEnabled: (account: ChatuAccount, cfg: OpenClawConfig): boolean => {
        if (cfg?.channels?.chatu?.enabled === false) return false;
        return Boolean(account?.apiUrl);
      },

      disabledReason: (_account: ChatuAccount, cfg: OpenClawConfig): string => {
        if (cfg?.channels?.chatu?.enabled === false) return 'Channel disabled in config';
        return 'Not enabled';
      },

      describeAccount: (account: ChatuAccount, _cfg: OpenClawConfig): ChannelAccountSnapshot => ({
        accountId: account.accountId,
        name:      `Chatu (${account.channelId || account.accountId || 'unknown'})`,
        connected: Boolean(account.accessToken),
        baseUrl:   account.apiUrl || undefined,
      }),
    },

    // ── Pairing ───────────────────────────────────────────────────────────────
    pairing: {
      idLabel: 'Channel ID',
      normalizeAllowEntry: (entry: string) => entry.trim().toLowerCase(),
    },

    // ── Security ──────────────────────────────────────────────────────────────
    security: {
      resolveDmPolicy: () => null, // WebHub controls access
    },

    // ── Groups ────────────────────────────────────────────────────────────────
    groups: {
      resolveRequireMention: () => false,
    },

    // ── Streaming ─────────────────────────────────────────────────────────────
    streaming: {
      blockStreamingCoalesceDefaults: { minChars: 40, idleMs: 300 },
    },

    // ── Threading ─────────────────────────────────────────────────────────────
    threading: {
      resolveReplyToMode: () => 'first' as const,
      allowExplicitReplyTagsWhenOff: true,
    },

    // ── Messaging ─────────────────────────────────────────────────────────────
    messaging: {
      normalizeTarget: (raw: string) =>
        raw?.trim().replace(/^chatu:/i, '').toLowerCase() || undefined,
      targetResolver: {
        looksLikeId: (raw: string) => Boolean(raw?.trim()),
        hint: 'User ID or channel ID from the WebHub service',
      },
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      probeAccount: async ({ account, timeoutMs }: { account: ChatuAccount; timeoutMs: number; cfg: OpenClawConfig }) => {
        const cfg = getAccountConfig(account?.accountId);
        if (!cfg.apiUrl || !cfg.accessToken) {
          return { ok: false, error: 'Not configured' };
        }
        try {
          const resp = await timedFetch(
            `${cfg.apiUrl}/api/channel/status`,
            {
              headers: {
                'x-access-token': cfg.accessToken,
                'X-Channel-ID': account?.accountId ?? cfg.channelId,
              },
            },
            Math.min(timeoutMs, 5000),
          );
          if (resp.ok) {
            const data = await resp.json();
            return { ok: true, status: data?.data?.status ?? 'unknown' };
          }
          return { ok: false, error: `HTTP ${resp.status}` };
        } catch (err: any) {
          return { ok: false, error: String(err?.message ?? err) };
        }
      },

      buildAccountSnapshot: ({ account, probe }: { account: ChatuAccount; cfg: OpenClawConfig; probe?: unknown }): ChannelAccountSnapshot => {
        const p = probe as { ok?: boolean; error?: string; status?: string } | undefined;
        return {
          accountId: account.accountId,
          connected: p?.ok === true,
          lastError: p?.ok ? null : (p?.error ?? null),
          baseUrl:   account.apiUrl || undefined,
          name:      `Chatu (${account.channelId || account.accountId})`,
        };
      },
    },

    // ── Heartbeat ─────────────────────────────────────────────────────────────
    heartbeat: {
      checkReady: async ({ accountId }: { cfg: OpenClawConfig; accountId?: string | null; deps?: unknown }) => {
        const aid = accountId ?? 'default';
        const cfg = getAccountConfig(aid);
        if (!cfg.apiUrl)      return { ok: false, reason: 'apiUrl not configured' };
        if (!cfg.accessToken) return { ok: false, reason: 'accessToken not configured' };
        try {
          const resp = await timedFetch(`${cfg.apiUrl}/health`, {}, 5000);
          if (resp.ok) return { ok: true, reason: 'Service reachable' };
          return { ok: false, reason: `Service returned HTTP ${resp.status}` };
        } catch (err: any) {
          return {
            ok: false,
            reason: `Cannot reach service: ${String(err?.message ?? err)}`,
          };
        }
      },
    },

    // ── Gateway (long-running per-account connection) ─────────────────────────
    gateway: {
      startAccount: async (ctx: ChannelGatewayContext<ChatuAccount>): Promise<void> => {
        await registerAndConnect(ctx.accountId);
        await pollLoop({
          accountId:   ctx.accountId,
          abortSignal: ctx.abortSignal,
          setStatus:   ctx.setStatus,
          log:         ctx.log,
        });
      },

      stopAccount: async (ctx: ChannelGatewayContext<ChatuAccount>): Promise<void> => {
        await disconnectAccount(ctx.accountId);
      },

      logoutAccount: async (ctx: ChannelLogoutContext<ChatuAccount>) => {
        const { accountId } = ctx;
        const cfgKey =
          accountId === 'default'
            ? 'channels.chatu.accessToken'
            : `channels.chatu.accounts.${accountId}.accessToken`;
        try { await (api as any).config?.set?.(cfgKey, ''); } catch (_) { /* ok */ }
        await disconnectAccount(accountId);
        return { cleared: true, loggedOut: true };
      },
    },

    // ── Outbound ──────────────────────────────────────────────────────────────
    outbound: {
      deliveryMode: 'direct' as const,
      textChunkLimit: DEFAULT_CHUNK_LIMIT,

      resolveTarget: (params) => {
        const raw = params?.to ?? params?.accountId ?? 'default';
        const normalized = String(raw).trim().replace(/^chatu:/i, '');
        if (!normalized) {
          return { ok: false as const, error: new Error('Empty target') };
        }
        return { ok: true as const, to: normalized };
      },

      sendText: async (ctx) => {
        const { to, text, accountId, replyToId, silent } = ctx;
        if (silent) return { channel: CHANNEL_ID, messageId: 'silent' };

        const result = await deliverOutbound({ text, target: to, accountId, replyTo: replyToId });

        if (!result.ok) {
          api.logger.error(`[chatu] Failed to send text (to=${to}): ${result.error}`);
          throw new Error(result.error ?? 'sendText failed');
        }
        api.logger.info(`[chatu] Text sent (to=${to}, messageId=${result.messageId})`);
        return { channel: CHANNEL_ID, messageId: result.messageId ?? '' };
      },

      sendMedia: async (ctx) => {
        const { to, mediaUrl, text, accountId, replyToId } = ctx;
        const result = await deliverOutbound({
          text: text ?? '',
          target: to,
          accountId,
          replyTo: replyToId,
          mediaUrl,
        });
        if (!result.ok) {
          api.logger.error(`[chatu] Failed to send media (to=${to}): ${result.error}`);
          throw new Error(result.error ?? 'sendMedia failed');
        }
        return { channel: CHANNEL_ID, messageId: result.messageId ?? '' };
      },
    },
  };

  // ── Register channel with OpenClaw ─────────────────────────────────────────
  api.registerChannel({ plugin: chatuChannel });

  api.logger.info('[chatu] Channel plugin loaded');

  // Return plugin lifecycle
  return {
    name: 'chatu-channel',
    async dispose() {
      api.logger.info('[chatu] Disposing channel plugin');
      await disconnectAccount();
    },
  };
}

// ── Testable utility exports ────────────────────────────────────────────────

/**
 * Computes the exponential back-off wait time in milliseconds.
 * On each consecutive error the wait doubles starting from baseMs, capped at maxMs.
 *
 * consecutiveErrors=0 → baseMs (normal interval, no back-off)
 * consecutiveErrors=1 → baseMs * 2
 * consecutiveErrors=2 → baseMs * 4
 * ...
 *
 * @param consecutiveErrors - Number of consecutive failures so far
 * @param baseMs            - Base interval in milliseconds (default 2000)
 * @param maxMs             - Maximum allowed wait in milliseconds (default 30000)
 */
export function computeBackoffMs(
  consecutiveErrors: number,
  baseMs: number = POLL_INTERVAL_MS,
  maxMs: number = MAX_BACKOFF_MS,
): number {
  return Math.min(baseMs * Math.pow(2, consecutiveErrors), maxMs);
}
