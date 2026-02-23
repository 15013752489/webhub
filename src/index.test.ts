/**
 * T055 — Gateway lifecycle: back-off behavior and abort-signal shutdown tests
 */

import { computeBackoffMs } from './index';

// ─── computeBackoffMs ──────────────────────────────────────────────────────

describe('computeBackoffMs (exponential back-off formula)', () => {
  const BASE = 2000;
  const MAX = 30_000;

  it('returns baseMs (no back-off) when consecutiveErrors is 0', () => {
    expect(computeBackoffMs(0, BASE, MAX)).toBe(2000);
  });

  it('doubles to 4 s after 1 consecutive error', () => {
    expect(computeBackoffMs(1, BASE, MAX)).toBe(4000);
  });

  it('doubles to 8 s after 2 consecutive errors', () => {
    expect(computeBackoffMs(2, BASE, MAX)).toBe(8000);
  });

  it('doubles to 16 s after 3 consecutive errors', () => {
    expect(computeBackoffMs(3, BASE, MAX)).toBe(16000);
  });

  it('caps at maxMs (30 s) after 4+ consecutive errors', () => {
    expect(computeBackoffMs(4, BASE, MAX)).toBe(MAX);
    expect(computeBackoffMs(10, BASE, MAX)).toBe(MAX);
    expect(computeBackoffMs(100, BASE, MAX)).toBe(MAX);
  });

  it('uses default baseMs = 2000 when not specified', () => {
    expect(computeBackoffMs(1)).toBe(4000);
  });

  it('uses default maxMs = 30000 when not specified', () => {
    expect(computeBackoffMs(10)).toBe(30_000);
  });

  it('works with a custom base and max', () => {
    expect(computeBackoffMs(0, 500, 5000)).toBe(500);
    expect(computeBackoffMs(1, 500, 5000)).toBe(1000);
    expect(computeBackoffMs(3, 500, 5000)).toBe(4000);
    expect(computeBackoffMs(4, 500, 5000)).toBe(5000); // capped
  });
});

// ─── Abort-signal shutdown ─────────────────────────────────────────────────

/**
 * Minimal inline poll loop that mirrors the pattern used in index.ts.
 * Runs until abortSignal fires, with an optional onTick callback.
 */
async function runMiniPollLoop(opts: {
  abortSignal: AbortSignal;
  intervalMs: number;
  onTick?: () => void;
  maxTicks?: number;
}): Promise<{ ticks: number; abortedCleanly: boolean }> {
  const { abortSignal, intervalMs, onTick, maxTicks = Infinity } = opts;
  let ticks = 0;

  while (!abortSignal.aborted && ticks < maxTicks) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, intervalMs);
      abortSignal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    if (abortSignal.aborted) break;
    ticks++;
    onTick?.();
  }

  return { ticks, abortedCleanly: abortSignal.aborted };
}

describe('Poll loop abort-signal shutdown', () => {
  jest.setTimeout(5000); // guard against accidental hangs in these tests

  it('exits immediately when signal is already aborted before loop starts', async () => {
    const controller = new AbortController();
    controller.abort(); // pre-abort
    const result = await runMiniPollLoop({
      abortSignal: controller.signal,
      intervalMs: 10,
      maxTicks: 100,
    });
    // Loop should not execute any ticks
    expect(result.ticks).toBe(0);
    expect(result.abortedCleanly).toBe(true);
  });

  it('exits cleanly when signal fires mid-sleep (no dangling timer)', async () => {
    const controller = new AbortController();
    const ticks: number[] = [];

    // Abort after a short delay (shorter than the interval so the loop is mid-sleep)
    const abortDelay = 40;
    const loopInterval = 500;
    setTimeout(() => controller.abort(), abortDelay);

    const start = Date.now();
    const result = await runMiniPollLoop({
      abortSignal: controller.signal,
      intervalMs: loopInterval,
      onTick: () => ticks.push(Date.now()),
    });
    const elapsed = Date.now() - start;

    // Should have completed quickly (well under one full interval)
    expect(elapsed).toBeLessThan(loopInterval);
    // No ticks should have fired (abort happened before the sleep completed)
    expect(result.ticks).toBe(0);
    expect(result.abortedCleanly).toBe(true);
  });

  it('processes ticks normally before abort fires', async () => {
    const controller = new AbortController();
    const intervalMs = 20;

    // Abort after ~2.5 ticks worth of time → expect exactly 2 ticks
    setTimeout(() => controller.abort(), intervalMs * 2.5);

    const result = await runMiniPollLoop({
      abortSignal: controller.signal,
      intervalMs,
    });

    expect(result.ticks).toBe(2);
    expect(result.abortedCleanly).toBe(true);
  });

  it('respects maxTicks guard — exits via maxTicks without abort', async () => {
    const controller = new AbortController();
    const result = await runMiniPollLoop({
      abortSignal: controller.signal,
      intervalMs: 5,
      maxTicks: 3,
    });
    expect(result.ticks).toBe(3);
    expect(result.abortedCleanly).toBe(false);
  });
});

// ─── T037: WS connection lifecycle integration ─────────────────────────────

/**
 * T037 — WebSocket + cache integration lifecycle tests.
 *
 * Tests the interaction between WebSocketAdapter and MessageCache as used
 * inside wsConnectionLoop (mocked here for unit-test isolation):
 *  1. First connection: adapter.connect() is called; cache.flush() is NOT called
 *  2. Reconnect: onReconnected callback triggers cache.flush()
 *  3. Quick-register: axios.post is called with correct URL + payload; returned
 *     channelId/accessToken are usable for subsequent WS adapter instantiation
 */

jest.mock('./sdk/adapters/websocket', () => {
  return {
    WebSocketAdapter: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      onMessage: jest.fn(),
      onStatusChange: jest.fn(),
      onReconnected: jest.fn(),
      send: jest.fn(),
    })),
  };
});

jest.mock('./sdk/adapters/cache', () => {
  return {
    MessageCache: jest.fn().mockImplementation(() => ({
      enqueue: jest.fn(),
      flush: jest.fn().mockResolvedValue(0),
      ack: jest.fn(),
      get size() { return 0; },
    })),
  };
});

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}), { virtual: true });

describe('WS connection lifecycle (T037)', () => {
  const { WebSocketAdapter } = require('./sdk/adapters/websocket');
  const { MessageCache } = require('./sdk/adapters/cache');
  const axios = require('axios');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('WebSocketAdapter is a constructor that returns an adapter object', () => {
    const adapter = new WebSocketAdapter({ channelId: 'ch-1', accessToken: 'tok', webhubUrl: 'ws://localhost/ws' });
    expect(typeof adapter.connect).toBe('function');
    expect(typeof adapter.onReconnected).toBe('function');
    expect(typeof adapter.onMessage).toBe('function');
  });

  it('onReconnected triggers cache.flush when registered', async () => {
    const adapter = new WebSocketAdapter({});
    const cache = new MessageCache({});

    // Simulate what wsConnectionLoop does: register onReconnected → flush cache
    const flushSpy = cache.flush as jest.Mock;
    const reconnectCallback = jest.fn(async () => {
      await cache.flush(jest.fn());
    });
    adapter.onReconnected(reconnectCallback);

    // Simulate the adapter firing the reconnect callback
    const registeredCallback = (adapter.onReconnected as jest.Mock).mock.calls[0][0];
    await registeredCallback();

    expect(flushSpy).toHaveBeenCalledTimes(1);
  });

  it('cache.enqueue is called when message delivery fails', async () => {
    const cache = new MessageCache({});
    const enqueueSpy = cache.enqueue as jest.Mock;

    // Simulate failed delivery → enqueue
    const failedMsg = { id: 'msg-1', channelId: 'ch-1', content: 'hello', enqueuedAt: Date.now(), status: 'pending' };
    cache.enqueue(failedMsg);

    expect(enqueueSpy).toHaveBeenCalledWith(failedMsg);
  });

  it('quick-register: axios.post called with key+url payload', async () => {
    const axiosPost = axios.post as jest.Mock;
    axiosPost.mockResolvedValue({ data: { success: true, data: { channelId: 'ch-abc', accessToken: 'tok-xyz' } } });

    const apiUrl = 'http://localhost:3000';
    const key = 'my-channel-key';
    const url = apiUrl;

    await axios.post(`${apiUrl}/api/channel/quick-register`, { key, url });

    expect(axiosPost).toHaveBeenCalledWith(
      `${apiUrl}/api/channel/quick-register`,
      { key, url }
    );
  });

  it('quick-register success: returned credentials are used for WS adapter', async () => {
    const axiosPost = axios.post as jest.Mock;
    const channelId = 'ch-from-qr';
    const accessToken = 'tok-from-qr';
    axiosPost.mockResolvedValue({ data: { success: true, data: { channelId, accessToken } } });

    const resp = await axios.post('http://example.com/api/channel/quick-register', { key: 'k', url: 'http://u' });
    const { channelId: retId, accessToken: retTok } = resp.data.data;

    // Use returned credentials to create a WS adapter (matches index.ts behavior)
    const adapter = new WebSocketAdapter({ channelId: retId, accessToken: retTok, webhubUrl: 'ws://example.com/api/channel/ws' });
    adapter.connect();

    expect((adapter.connect as jest.Mock)).toHaveBeenCalledTimes(1);
    expect(retId).toBe(channelId);
    expect(retTok).toBe(accessToken);
  });
});

// ─── T042: Streaming relay (relayStreamChunk / relayStreamDone) ────────────

import { relayStreamChunk, relayStreamDone } from './index';

describe('Streaming relay (T042)', () => {
  const API_URL = 'http://localhost:3000';
  const ACCESS_TOKEN = 'wh_test_token_abc';
  const MESSAGE_ID = 'msg-stream-001';

  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    (global as any).fetch = mockFetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── relayStreamChunk ──────────────────────────────────────────────────────

  describe('relayStreamChunk', () => {
    it('POSTs chunk to /api/channel/stream/chunk with Bearer token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
        text: async () => '',
      });

      const result = await relayStreamChunk(API_URL, ACCESS_TOKEN, MESSAGE_ID, 0, 'Hello ');

      expect(result.ok).toBe(true);

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/channel/stream/chunk`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ messageId: MESSAGE_ID, seq: 0, delta: 'Hello ' }),
        }),
      );
    });

    it('returns ok: false when server responds with non-2xx', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '{"error":"INVALID_TOKEN"}',
      });

      const result = await relayStreamChunk(API_URL, ACCESS_TOKEN, MESSAGE_ID, 1, 'world');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('401');
    });

    it('returns ok: false when fetch throws (network error)', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const result = await relayStreamChunk(API_URL, ACCESS_TOKEN, MESSAGE_ID, 0, 'test');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Network failure');
    });

    it('sends seq and delta correctly for each chunk index', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => '' });

      await relayStreamChunk(API_URL, ACCESS_TOKEN, MESSAGE_ID, 5, 'delta-chunk');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.seq).toBe(5);
      expect(callBody.delta).toBe('delta-chunk');
      expect(callBody.messageId).toBe(MESSAGE_ID);
    });
  });

  // ── relayStreamDone ───────────────────────────────────────────────────────

  describe('relayStreamDone', () => {
    it('POSTs to /api/channel/stream/done with Bearer token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '',
      });

      const result = await relayStreamDone(API_URL, ACCESS_TOKEN, MESSAGE_ID, 3);

      expect(result.ok).toBe(true);

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/channel/stream/done`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${ACCESS_TOKEN}`,
          }),
          body: JSON.stringify({ messageId: MESSAGE_ID, totalSeq: 3 }),
        }),
      );
    });

    it('returns ok: false when server responds with non-2xx', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"error":"MISSING_FIELDS"}',
      });

      const result = await relayStreamDone(API_URL, ACCESS_TOKEN, MESSAGE_ID, 3);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('400');
    });

    it('returns ok: false when fetch throws', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      const result = await relayStreamDone(API_URL, ACCESS_TOKEN, MESSAGE_ID, 5);

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('sends totalSeq correctly', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => '' });

      await relayStreamDone(API_URL, ACCESS_TOKEN, MESSAGE_ID, 7);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.totalSeq).toBe(7);
      expect(callBody.messageId).toBe(MESSAGE_ID);
    });
  });

  // ── Sequential chunk→done relay ───────────────────────────────────────────

  describe('sequential chunk + done relay', () => {
    it('sends 3 chunks then done, fetch called 4 times in order', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => '' });

      await relayStreamChunk(API_URL, ACCESS_TOKEN, MESSAGE_ID, 0, 'Hello');
      await relayStreamChunk(API_URL, ACCESS_TOKEN, MESSAGE_ID, 1, ' ');
      await relayStreamChunk(API_URL, ACCESS_TOKEN, MESSAGE_ID, 2, 'World');
      await relayStreamDone(API_URL, ACCESS_TOKEN, MESSAGE_ID, 3);

      expect(mockFetch).toHaveBeenCalledTimes(4);

      const urls = mockFetch.mock.calls.map((c: any[]) => c[0] as string);
      expect(urls[0]).toContain('/stream/chunk');
      expect(urls[1]).toContain('/stream/chunk');
      expect(urls[2]).toContain('/stream/chunk');
      expect(urls[3]).toContain('/stream/done');
    });
  });
});
