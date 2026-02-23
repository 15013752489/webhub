/**
 * T037b — MessageCache unit tests
 *
 * constitution §IV: New modules must have a test file.
 *
 * Tests cover:
 *   - enqueue → FIFO order guarantee
 *   - Capacity limit: evicts oldest + logger.warn (single STRING — §VII)
 *   - flush → calls sendFn in FIFO order; marks submitted
 *   - ack → removes item, prevents re-send
 *   - File persistence: write then re-instantiate → queue restored
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { MessageCache, CachedMessage } from '../../sdk/adapters/cache';

function makeMsg(id: string, channelId = 'ch-1'): CachedMessage {
  return { id, channelId, content: { text: `msg-${id}` }, enqueuedAt: Date.now(), status: 'pending' };
}

describe('MessageCache', () => {
  // ── enqueue / FIFO ──────────────────────────────────────────────────────────

  describe('enqueue', () => {
    it('maintains FIFO insertion order in snapshot', () => {
      const cache = new MessageCache();
      cache.enqueue(makeMsg('a'));
      cache.enqueue(makeMsg('b'));
      cache.enqueue(makeMsg('c'));

      const ids = cache.snapshot().map((m) => m.id);
      expect(ids).toEqual(['a', 'b', 'c']);
    });

    it('size reflects enqueued count', () => {
      const cache = new MessageCache();
      cache.enqueue(makeMsg('x'));
      cache.enqueue(makeMsg('y'));
      expect(cache.size).toBe(2);
    });
  });

  // ── Capacity limit ──────────────────────────────────────────────────────────

  describe('capacity enforcement', () => {
    it('evicts the oldest item when limit is reached', () => {
      const cache = new MessageCache({ maxCapacity: 3 });
      cache.enqueue(makeMsg('first'));
      cache.enqueue(makeMsg('second'));
      cache.enqueue(makeMsg('third'));
      cache.enqueue(makeMsg('fourth'));  // should evict 'first'

      const ids = cache.snapshot().map((m) => m.id);
      expect(ids).not.toContain('first');
      expect(ids).toContain('fourth');
      expect(cache.size).toBe(3);
    });

    it('calls logger.warn with a SINGLE STRING on eviction (§VII)', () => {
      const warnMessages: string[] = [];
      const logger = { warn: (msg: string) => { warnMessages.push(msg); } };

      const cache = new MessageCache({ maxCapacity: 1, logger });
      cache.enqueue(makeMsg('m1', 'ch-test'));
      cache.enqueue(makeMsg('m2', 'ch-test'));  // evicts 'm1'

      expect(warnMessages.length).toBe(1);
      // Must be a string — not an object (§VII)
      expect(typeof warnMessages[0]).toBe('string');
      expect(warnMessages[0]).toContain('cache_capacity_exceeded');
      expect(warnMessages[0]).toContain('ch-test');
      expect(warnMessages[0]).toContain('m1');
    });
  });

  // ── flush ───────────────────────────────────────────────────────────────────

  describe('flush', () => {
    it('calls sendFn for each pending message in FIFO order', async () => {
      const cache = new MessageCache();
      cache.enqueue(makeMsg('p1'));
      cache.enqueue(makeMsg('p2'));
      cache.enqueue(makeMsg('p3'));

      const order: string[] = [];
      const count = await cache.flush(async (msg) => {
        order.push(msg.id);
      });

      expect(count).toBe(3);
      expect(order).toEqual(['p1', 'p2', 'p3']);
    });

    it('marks flushed messages as submitted', async () => {
      const cache = new MessageCache();
      cache.enqueue(makeMsg('s1'));
      await cache.flush(async () => { /* no-op */ });
      const snap = cache.snapshot();
      expect(snap[0].status).toBe('submitted');
    });

    it('stops flushing on first sendFn error, leaving remaining as pending', async () => {
      const cache = new MessageCache();
      cache.enqueue(makeMsg('ok1'));
      cache.enqueue(makeMsg('fail'));
      cache.enqueue(makeMsg('ok2'));

      let calls = 0;
      await cache.flush(async (msg) => {
        calls++;
        if (msg.id === 'fail') throw new Error('send failed');
      });

      // Stopped at 'fail' — only 'ok1' submitted
      expect(calls).toBe(2);
      const snaps = cache.snapshot();
      expect(snaps.find((m) => m.id === 'ok1')?.status).toBe('submitted');
      expect(snaps.find((m) => m.id === 'fail')?.status).toBe('pending');
      expect(snaps.find((m) => m.id === 'ok2')?.status).toBe('pending');
    });

    it('does not re-send already-submitted messages on subsequent flush', async () => {
      const cache = new MessageCache();
      cache.enqueue(makeMsg('d1'));
      await cache.flush(async () => { /* no-op */ });

      const sentIds: string[] = [];
      await cache.flush(async (msg) => { sentIds.push(msg.id); });
      expect(sentIds).not.toContain('d1');
    });
  });

  // ── ack ─────────────────────────────────────────────────────────────────────

  describe('ack', () => {
    it('removes the message from the queue by id', () => {
      const cache = new MessageCache();
      cache.enqueue(makeMsg('ack-1'));
      cache.enqueue(makeMsg('ack-2'));

      cache.ack('ack-1');

      const ids = cache.snapshot().map((m) => m.id);
      expect(ids).not.toContain('ack-1');
      expect(ids).toContain('ack-2');
    });

    it('prevents the acked message from being re-sent on flush', async () => {
      const cache = new MessageCache();
      cache.enqueue(makeMsg('r1'));
      cache.enqueue(makeMsg('r2'));
      cache.ack('r1');

      const sent: string[] = [];
      await cache.flush(async (msg) => { sent.push(msg.id); });
      expect(sent).not.toContain('r1');
      expect(sent).toContain('r2');
    });

    it('is a no-op for unknown ids', () => {
      const cache = new MessageCache();
      cache.enqueue(makeMsg('x'));
      expect(() => cache.ack('nonexistent')).not.toThrow();
      expect(cache.size).toBe(1);
    });
  });

  // ── File persistence ─────────────────────────────────────────────────────────

  describe('file persistence', () => {
    let tmpFile: string;

    beforeEach(() => {
      tmpFile = path.join(os.tmpdir(), `cache-test-${Date.now()}.json`);
    });

    afterEach(() => {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    });

    it('persists queue to file and restores on re-instantiation', () => {
      const cache1 = new MessageCache({ filePath: tmpFile });
      cache1.enqueue(makeMsg('persist-1'));
      cache1.enqueue(makeMsg('persist-2'));

      // Re-instantiate from same file path
      const cache2 = new MessageCache({ filePath: tmpFile });
      const ids = cache2.snapshot().map((m) => m.id);
      expect(ids).toEqual(['persist-1', 'persist-2']);
    });

    it('starts with empty queue if file does not exist', () => {
      const cache = new MessageCache({ filePath: '/tmp/definitely-does-not-exist-xyz123.json' });
      expect(cache.size).toBe(0);
    });

    it('starts with empty queue if file is corrupt JSON', () => {
      fs.writeFileSync(tmpFile, 'not valid json');
      const cache = new MessageCache({ filePath: tmpFile });
      expect(cache.size).toBe(0);
    });
  });
});
