/******************************************************************
 * Plugin Local Message Cache (cache.ts)
 *
 * In-memory FIFO queue for outbound messages that couldn't be sent
 * while the WebSocket was disconnected.
 *
 * Key behaviour (spec FR-007/US2):
 *   - Capacity limited to CHATU_CACHE_MAX (default 1000)
 *   - On overflow: oldest item is evicted; PluginLogger.warn is called
 *     with a SINGLE STRING (constitution §VII — NON-NEGOTIABLE)
 *   - Optional JSON file persistence via CHATU_CACHE_FILE env var
 *   - flush(sendFn) sends items in FIFO order; ack(id) marks delivered
 *
 * @see specs/001-plugin-channel-realtime/tasks.md T013
 ******************************************************************/

import fs from 'fs';
import path from 'path';

/** Minimal subset of PluginLogger used here (§VII: warn accepts single string). */
export interface PluginLoggerSubset {
  warn: (msg: string) => void;
  info?: (msg: string) => void;
}

/** A cached outbound message entry. */
export interface CachedMessage {
  id: string;
  channelId: string;
  content: unknown;
  enqueuedAt: number;
  /** 'pending' until ACKed by the server. */
  status: 'pending' | 'submitted';
}

export interface CacheOptions {
  /** Max items before evicting the oldest. Defaults to CHATU_CACHE_MAX env or 1000. */
  maxCapacity?: number;
  /** Path for JSON file persistence. Defaults to CHATU_CACHE_FILE env or undefined. */
  filePath?: string;
  /** Logger used for capacity warnings (§VII). */
  logger?: PluginLoggerSubset;
}

const DEFAULT_CAPACITY = 1000;

/**
 * MessageCache — FIFO queue for offline-buffered outbound messages.
 *
 * @example
 * ```typescript
 * const cache = new MessageCache({ logger: api.logger });
 * cache.enqueue({ id: uuid(), channelId: 'wh_ch_xxx', content: { text: 'hello' }, enqueuedAt: Date.now(), status: 'pending' });
 * await cache.flush(async (msg) => adapter.send(msg));
 * ```
 */
export class MessageCache {
  private queue: CachedMessage[] = [];
  private maxCapacity: number;
  private filePath: string | undefined;
  private logger: PluginLoggerSubset | undefined;

  constructor(options: CacheOptions = {}) {
    this.maxCapacity =
      options.maxCapacity ??
      (process.env.CHATU_CACHE_MAX ? parseInt(process.env.CHATU_CACHE_MAX, 10) : DEFAULT_CAPACITY);

    this.filePath =
      options.filePath ??
      (process.env.CHATU_CACHE_FILE ? path.resolve(process.env.CHATU_CACHE_FILE) : undefined);

    this.logger = options.logger;

    // Restore from file if configured
    if (this.filePath) {
      this.loadFromFile();
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Enqueue a message for later delivery.
   * If at capacity, evicts the oldest pending item and logs a warning.
   */
  enqueue(msg: CachedMessage): void {
    if (this.queue.length >= this.maxCapacity) {
      const dropped = this.queue.shift();
      if (dropped && this.logger) {
        // §VII: PluginLogger.warn must receive a SINGLE STRING — no object argument
        this.logger.warn(
          'cache_capacity_exceeded: channelId=' + msg.channelId + ' dropped=' + dropped.id,
        );
      }
    }

    this.queue.push(msg);
    this.persist();
  }

  /**
   * Flush all 'pending' items in FIFO order by calling sendFn for each.
   * Items that sendFn resolves successfully are marked 'submitted'.
   * Items where sendFn throws remain 'pending' for the next flush.
   *
   * Returns the number of successfully flushed items.
   */
  async flush(sendFn: (msg: CachedMessage) => Promise<void>): Promise<number> {
    let flushed = 0;
    const pending = this.queue.filter((m) => m.status === 'pending');

    for (const msg of pending) {
      try {
        await sendFn(msg);
        msg.status = 'submitted';
        flushed++;
      } catch {
        // Leave as pending — will retry on next flush
        break;
      }
    }

    this.persist();
    return flushed;
  }

  /**
   * Acknowledge delivery of a message by its id.
   * Removes it from the queue to prevent duplicate re-sends.
   */
  ack(id: string): void {
    const idx = this.queue.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      this.persist();
    }
  }

  /**
   * Returns a snapshot of the current queue (read-only copy).
   */
  snapshot(): ReadonlyArray<Readonly<CachedMessage>> {
    return [...this.queue];
  }

  /**
   * Number of items currently in the queue.
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Number of pending (not yet ACKed) items.
   */
  get pendingCount(): number {
    return this.queue.filter((m) => m.status === 'pending').length;
  }

  // ─── Persistence ─────────────────────────────────────────────────────────────

  /**
   * Persist the current queue to the JSON file (if configured).
   * Errors are silently swallowed to avoid disrupting the main flow.
   */
  private persist(): void {
    if (!this.filePath) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.queue, null, 2), 'utf-8');
    } catch {
      // best-effort: silently ignore fs errors
    }
  }

  /**
   * Load queue from the JSON file on startup (if the file exists).
   */
  private loadFromFile(): void {
    if (!this.filePath) return;
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        this.queue = parsed as CachedMessage[];
      }
    } catch {
      // best-effort: ignore corrupt/missing files
    }
  }
}
