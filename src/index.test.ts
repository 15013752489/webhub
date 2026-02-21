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
