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
import pkg from '../package.json';
import { WebSocketAdapter } from './sdk/adapters/websocket';
import { MessageCache } from './sdk/adapters/cache';
import type { InboundMessage } from './sdk/types/channel';

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

  // ── T015 Plugin-Channel Realtime: per-account outbound message caches ───────
  /** Stores failed AI replies for retry on reconnect. One per account. */
  const accountCaches = new Map<string, MessageCache>();

  function getAccountCache(accountId: string): MessageCache {
    if (!accountCaches.has(accountId)) {
      accountCaches.set(
        accountId,
        new MessageCache({
          logger: api.logger,
          maxCapacity: process.env.CHATU_CACHE_MAX ? parseInt(process.env.CHATU_CACHE_MAX, 10) : 1000,
          filePath: process.env.CHATU_CACHE_FILE
            ? `${process.env.CHATU_CACHE_FILE}.${accountId}.json`
            : undefined,
        }),
      );
    }
    return accountCaches.get(accountId)!;
  }


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

  /**
   * T023 Plugin-Channel Realtime: If CHATU_KEY and CHATU_URL env vars are set,
   * call POST /api/channel/quick-register to obtain credentials automatically.
   * This runs BEFORE registerAndConnect so WS setup (T012) can use the credentials.
   * Skipped if channelId + accessToken are already configured.
   */
  async function quickRegisterIfNeeded(accountId?: string | null): Promise<void> {
    const key = process.env.CHATU_KEY;
    const apiUrl = process.env.CHATU_URL ?? process.env.CHATU_API_URL;
    if (!key || !apiUrl) return;

    // If already have credentials, skip
    const cfg = getAccountConfig(accountId);
    if (cfg.channelId && cfg.accessToken) return;

    try {
      const resp = await timedFetch(
        `${apiUrl}/api/channel/quick-register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, url: apiUrl }),
        },
        DEFAULT_TIMEOUT_MS,
      );

      if (resp.ok) {
        const data = await resp.json();
        const channelId: string | undefined = data?.data?.channelId;
        const accessToken: string | undefined = data?.data?.accessToken;

        if (channelId && accessToken) {
          const base = accountId
            ? `channels.chatu.accounts.${accountId}`
            : 'channels.chatu';
          try {
            await (api as any).config?.set?.(`${base}.channelId`, channelId);
            await (api as any).config?.set?.(`${base}.accessToken`, accessToken);
            await (api as any).config?.set?.(`${base}.apiUrl`, apiUrl);
          } catch (_) { /* config persistence optional */ }
          api.logger.info(
            `[chatu] Quick-registered via CHATU_KEY (channelId=${channelId}, account=${accountId ?? 'default'})`,
          );
        }
      } else {
        api.logger.warn(
          `[chatu] Quick-register returned HTTP ${resp.status} — check CHATU_KEY/CHATU_URL`,
        );
      }
    } catch (err) {
      api.logger.warn(`[chatu] Quick-register failed: ${String(err)}`);
    }
  }

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
            body: JSON.stringify({ channelId: refreshed.channelId, pluginVersion: pkg.version }),
          },
          refreshed.timeout,
        );
        if (resp.ok) {
          api.logger.info(`[chatu] Channel connected (channelId=${refreshed.channelId}, v${pkg.version})`);  
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

  // ── Inbound: deliver AI reply back to service ────────────────────────────────

  async function deliverOutbound(params: {
    text: string;
    target: string;
    accountId?: string | null;
    replyTo?: string | null;
    mediaUrl?: string;
    mediaType?: string;
    messageType?: string;
    metadata?: Record<string, unknown>;
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
    if (params.messageType) payload.messageType = params.messageType;
    if (params.metadata) payload.metadata = params.metadata;
    // Phase 11 T049: always stamp role:'ai' so the service can persist the correct author role
    payload.role = 'ai';

    try {
      const resp = await timedFetch(
        `${cfg.apiUrl}/api/channel/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Channel-Token': cfg.accessToken,
            'X-Channel-ID': cfg.channelId,
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

  // ── Streaming relay helpers (T042) ────────────────────────────────────────

  /**
   * Relay a single streaming chunk to the WebHub API.
   * Called by the outbound.sendStreamChunk handler when OpenClaw AI streams.
   */
  async function deliverStreamChunk(params: {
    messageId: string;
    seq: number;
    delta: string;
    accountId?: string | null;
  }): Promise<{ ok: boolean; error?: string }> {
    const cfg = getAccountConfig(params.accountId);
    if (!cfg.apiUrl || !cfg.accessToken) {
      return { ok: false, error: 'Missing apiUrl or accessToken' };
    }
    try {
      const resp = await timedFetch(
        `${cfg.apiUrl}/api/channel/stream/chunk`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.accessToken}`,
          },
          body: JSON.stringify({ messageId: params.messageId, seq: params.seq, delta: params.delta }),
        },
        cfg.timeout,
      );
      if (!resp.ok) {
        const errorText = await resp.text();
        return { ok: false, error: `HTTP ${resp.status}: ${errorText}` };
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: String(err?.message ?? err) };
    }
  }

  /**
   * Signal streaming completion to the WebHub API.
   * Called by the outbound.sendStreamDone handler when OpenClaw AI finishes.
   */
  async function deliverStreamDone(params: {
    messageId: string;
    totalSeq: number;
    accountId?: string | null;
  }): Promise<{ ok: boolean; error?: string }> {
    const cfg = getAccountConfig(params.accountId);
    if (!cfg.apiUrl || !cfg.accessToken) {
      return { ok: false, error: 'Missing apiUrl or accessToken' };
    }
    try {
      const resp = await timedFetch(
        `${cfg.apiUrl}/api/channel/stream/done`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.accessToken}`,
          },
          body: JSON.stringify({ messageId: params.messageId, totalSeq: params.totalSeq }),
        },
        cfg.timeout,
      );
      if (!resp.ok) {
        const errorText = await resp.text();
        return { ok: false, error: `HTTP ${resp.status}: ${errorText}` };
      }
      return { ok: true };
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
              // T015 Plugin-Channel Realtime: cache failed delivery for retry on reconnect
              const cfg2 = getAccountConfig(accountId);
              const cache = getAccountCache(accountId);
              const cacheId = result.messageId ?? `retry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              cache.enqueue({
                id: cacheId,
                channelId: cfg2.channelId,
                content: { text, target: senderId, replyTo: payload.replyToId ?? id },
                enqueuedAt: Date.now(),
                status: 'pending',
              });
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
   * Plugin-Channel Realtime (T012): WebSocket-based gateway loop.
   * Replaces HTTP polling. Connects to /api/channel/ws via WebSocketAdapter
   * and dispatches inbound messages to the OpenClaw AI pipeline.
   * Reconnects automatically with infinite exponential back-off (T009).
   *
   * Runs until `abortSignal` fires.
   */
  async function wsConnectionLoop(ctx: {
    accountId: string;
    abortSignal: AbortSignal;
    setStatus: (s: ChannelAccountSnapshot) => void;
    log?: ChannelLogSink;
  }): Promise<void> {
    const cfg = getAccountConfig(ctx.accountId);

    if (!cfg.apiUrl) {
      ctx.log?.error?.(`[${ctx.accountId}] chatu: missing apiUrl for WS connection`);
      return;
    }
    if (!cfg.accessToken || !cfg.channelId) {
      ctx.log?.error?.(`[${ctx.accountId}] chatu: missing accessToken/channelId for WS connection`);
      return;
    }

    // Convert HTTP URL to WebSocket URL scheme
    const wsBase = cfg.apiUrl
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://');

    const adapter = new WebSocketAdapter({
      channelId: cfg.channelId,
      accessToken: cfg.accessToken,
      webhubUrl: `${wsBase}/api/channel/ws`,
    });

    // Register inbound message handler — dispatches user messages to AI
    adapter.onMessage(async (msg: InboundMessage) => {
      const text = msg.content?.text?.trim() ?? '';
      if (!text) return;

      const freshCfg = api.config ?? {};

      // Phase 11 T048 (fixed): role:agent frames come from the human operator via the
      // webhub frontend.  api.dispatch() does not exist in the OpenClaw plugin SDK;
      // instead we re-use dispatchUserMessage so the agent message appears in OpenClaw's
      // conversation context (sender = 'webhub-agent').  OpenClaw AI may reply; if it does,
      // the reply is delivered via deliverOutbound → /api/channel/messages → frontend.
      const senderId = (msg as any).role === 'agent'
        ? ((msg as any).sender?.id ?? 'webhub-agent')
        : msg.sender.id;
      const senderName = (msg as any).role === 'agent'
        ? ((msg as any).sender?.displayName ?? 'Agent')
        : msg.sender.displayName;

      await dispatchUserMessage({
        id: msg.id,
        content: text,
        senderId,
        senderName,
        timestamp: msg.timestamp,
        accountId: ctx.accountId,
        cfg: freshCfg,
      });
    });

    // Track connection status → surface to OpenClaw gateway
    adapter.onStatusChange((status, err) => {
      if (status === 'connected') {
        ctx.setStatus({ accountId: ctx.accountId, connected: true });
        ctx.log?.info?.(`[${ctx.accountId}] chatu: WebSocket connected`);
      } else if (status === 'disconnected') {
        ctx.setStatus({ accountId: ctx.accountId, connected: false });
      } else if (status === 'error') {
        ctx.setStatus({
          accountId: ctx.accountId,
          connected: false,
          lastError: err?.message ?? 'WS error',
        });
      }
    });

    // T015 Plugin-Channel Realtime: flush cached failed deliveries on reconnect
    adapter.onReconnected(async () => {
      const cache = getAccountCache(ctx.accountId);
      if (cache.pendingCount === 0) return;
      api.logger.info(
        `[chatu] Reconnected — flushing ${cache.pendingCount} cached messages (account=${ctx.accountId})`,
      );
      await cache.flush(async (cachedMsg) => {
        const payload = cachedMsg.content as { text: string; target: string; replyTo?: string };
        const result = await deliverOutbound({
          text: payload.text ?? '',
          target: payload.target ?? '',
          accountId: ctx.accountId,
          replyTo: payload.replyTo,
        });
        if (!result.ok) {
          throw new Error(result.error ?? 'Cached delivery failed');
        }
        cache.ack(cachedMsg.id);
      });
    });

    ctx.setStatus({ accountId: ctx.accountId, connected: false });
    ctx.log?.info?.(`[${ctx.accountId}] chatu: starting WebSocket connection to ${wsBase}/api/channel/ws`);

    // Attempt initial connect (adapter auto-reconnects indefinitely on failure)
    try {
      await adapter.connect();
    } catch (err) {
      api.logger.warn(`[chatu] Initial WS connect failed (account=${ctx.accountId}): ${String(err)}`);
      // Adapter will keep retrying — proceed to wait for abort
    }

    // Hold until the gateway signals shutdown
    await new Promise<void>((resolve) => {
      if (ctx.abortSignal.aborted) { resolve(); return; }
      ctx.abortSignal.addEventListener('abort', () => resolve(), { once: true });
    });

    ctx.log?.info?.(`[${ctx.accountId}] chatu: WebSocket connection stopping`);
    await adapter.disconnect();
    ctx.setStatus({ accountId: ctx.accountId, connected: false });
  }

  /**
   * @deprecated Use wsConnectionLoop instead (Plugin-Channel Realtime T012).
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

    // Pre-flight check
    const initCfg = getAccountConfig(accountId);
    if (!initCfg.apiUrl) {
      ctx.log?.error?.(`[${accountId}] chatu: missing apiUrl for polling`);
      return;
    }

    let lastCursor = '';
    let consecutiveErrors = 0;
    const MAX_ERRORS = 10;
    // Track processed message IDs to handle same-millisecond createdAt duplicates
    const processedIds = new Set<string>();
    const MAX_PROCESSED_IDS = 500;

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
        // Re-read config each iteration so a refreshed accessToken is picked up
        const cfg = getAccountConfig(accountId);
        if (!cfg.accessToken) {
          consecutiveErrors++;
          api.logger.warn(`[chatu] No accessToken yet (account=${accountId}), retrying...`);
          continue;
        }

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
          // Advance ISO timestamp cursor so next poll fetches only newer messages
          if (msg.createdAt) lastCursor = msg.createdAt as string;

          // Skip messages already processed in-memory (handles same-ms duplicates)
          if (processedIds.has(msg.id)) continue;
          processedIds.add(msg.id);
          // Bound set growth
          if (processedIds.size > MAX_PROCESSED_IDS) {
            const first = processedIds.values().next().value;
            if (first !== undefined) processedIds.delete(first);
          }

          // Ack first (idempotency)
          await ackMessage(cfg.apiUrl, cfg.accessToken, msg.id, cfg.timeout);

          // T099: send typing indicator before dispatching to AI
          const typingChannelId = msg.channelId ?? cfg.channelId;
          if (typingChannelId) {
            timedFetch(
              `${cfg.apiUrl}/api/channel/typing`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Channel-Token': cfg.accessToken },
                body: JSON.stringify({ channelId: typingChannelId }),
              },
              3000,
            ).catch(() => { /* best-effort */ });
          }

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
      edit: true,
      unsend: true,
      reactions: true,
      polls: false,
      media: true,
      threads: true,
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
        api.logger.info(`[chatu] WebHub channel plugin v${pkg.version} starting`);
        // T023: quick-register via env vars if no credentials configured
        await quickRegisterIfNeeded(ctx.accountId);
        await registerAndConnect(ctx.accountId);
        // Plugin-Channel Realtime (T012): use WebSocket instead of HTTP polling
        await wsConnectionLoop({
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

      // T098: send a rich payload (richCard, structured content)
      sendPayload: async (ctx: any) => {
        const { to, accountId, replyToId, messageType, metadata, text } = ctx;
        const result = await deliverOutbound({
          text: text ?? '',
          target: to,
          accountId,
          replyTo: replyToId,
          messageType,
          metadata,
        });
        if (!result.ok) {
          api.logger.error(`[chatu] Failed to send payload (to=${to}): ${result.error}`);
          throw new Error(result.error ?? 'sendPayload failed');
        }
        return { channel: CHANNEL_ID, messageId: result.messageId ?? '' };
      },

      // T098: send a poll message
      sendPoll: async (ctx: any) => {
        const { to, accountId, replyToId, question, options, multiple } = ctx;
        const result = await deliverOutbound({
          text: question ?? 'Poll',
          target: to,
          accountId,
          replyTo: replyToId,
          messageType: 'poll',
          metadata: { poll: { question, options, multiple: multiple ?? false } },
        });
        if (!result.ok) {
          api.logger.error(`[chatu] Failed to send poll (to=${to}): ${result.error}`);
          throw new Error(result.error ?? 'sendPoll failed');
        }
        return { channel: CHANNEL_ID, messageId: result.messageId ?? '' };
      },

      // T042: streaming relay — forward AI stream chunks/done to WebHub API
      sendStreamChunk: async (ctx: any) => {
        const { messageId, seq, delta, accountId } = ctx;
        const result = await deliverStreamChunk({ messageId, seq, delta, accountId });
        if (!result.ok) {
          api.logger.warn(`[chatu] stream chunk relay failed (messageId=${messageId}): ${result.error}`);
        }
        return result;
      },

      sendStreamDone: async (ctx: any) => {
        const { messageId, totalSeq, accountId } = ctx;
        const result = await deliverStreamDone({ messageId, totalSeq, accountId });
        if (!result.ok) {
          api.logger.warn(`[chatu] stream done relay failed (messageId=${messageId}): ${result.error}`);
        }
        return result;
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

/**
 * T042 testable export: relay a streaming AI chunk to the WebHub API.
 *
 * @param apiUrl      - WebHub service base URL
 * @param accessToken - Channel access token (Bearer)
 * @param messageId   - Unique ID for the streaming message
 * @param seq         - 0-based sequential chunk index
 * @param delta       - Text delta for this chunk
 * @param timeoutMs   - Fetch timeout in milliseconds
 */
export async function relayStreamChunk(
  apiUrl: string,
  accessToken: string,
  messageId: string,
  seq: number,
  delta: string,
  timeoutMs: number = 30_000,
): Promise<{ ok: boolean; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${apiUrl}/api/channel/stream/chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messageId, seq, delta }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      const errorText = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${errorText}` };
    }
    return { ok: true };
  } catch (err: any) {
    clearTimeout(timer);
    return { ok: false, error: String(err?.message ?? err) };
  }
}

/**
 * T042 testable export: signal streaming completion to the WebHub API.
 *
 * @param apiUrl      - WebHub service base URL
 * @param accessToken - Channel access token (Bearer)
 * @param messageId   - Unique ID for the streaming message
 * @param totalSeq    - Total number of chunks sent
 * @param timeoutMs   - Fetch timeout in milliseconds
 */
export async function relayStreamDone(
  apiUrl: string,
  accessToken: string,
  messageId: string,
  totalSeq: number,
  timeoutMs: number = 30_000,
): Promise<{ ok: boolean; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${apiUrl}/api/channel/stream/done`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messageId, totalSeq }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      const errorText = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${errorText}` };
    }
    return { ok: true };
  } catch (err: any) {
    clearTimeout(timer);
    return { ok: false, error: String(err?.message ?? err) };
  }
}
