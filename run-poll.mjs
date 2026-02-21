/**
 * Standalone poll loop for chatu channel.
 * Runs when openclaw gateway doesn't auto-start the account.
 *
 * Usage: node run-poll.mjs
 *        API_URL=http://localhost:3000 CHANNEL_ID=xxx ACCESS_TOKEN=yyy node run-poll.mjs
 */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// --- Read config from ~/.openclaw/openclaw.json ---
let cfg;
try {
  cfg = JSON.parse(readFileSync(join(homedir(), '.openclaw', 'openclaw.json'), 'utf8'));
} catch {
  cfg = {};
}
const chatuCfg = cfg?.channels?.chatu ?? {};

const API_URL      = process.env.API_URL      || chatuCfg.apiUrl      || 'http://localhost:3000';
const CHANNEL_ID   = process.env.CHANNEL_ID   || chatuCfg.channelId   || '';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN  || chatuCfg.accessToken || '';

if (!CHANNEL_ID || !ACCESS_TOKEN) {
  console.error('[poll] Missing CHANNEL_ID or ACCESS_TOKEN. Check ~/.openclaw/openclaw.json');
  process.exit(1);
}

console.log(`[poll] Starting poll loop`);
console.log(`[poll] API_URL    : ${API_URL}`);
console.log(`[poll] CHANNEL_ID : ${CHANNEL_ID}`);

// --- Load compiled plugin and dispatch via openclaw runtime API ---
// We'll use a lightweight inline dispatcher instead of the full openclaw api:
// Just forward messages to the gateway via the openclaw CLI `chat` command.

const POLL_INTERVAL_MS = 2000;
const MAX_BACKOFF_MS = 30_000;

let lastCursor = '';
let consecutiveErrors = 0;
const MAX_ERRORS = 10;

async function timedFetch(url, init, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function ackMessage(msgId) {
  try {
    await timedFetch(
      `${API_URL}/api/channel/messages/${msgId}/ack`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Channel-Token': ACCESS_TOKEN },
        body: JSON.stringify({ channelId: CHANNEL_ID }),
      },
      10000,
    );
  } catch (e) {
    console.warn(`[poll] ack failed for ${msgId}: ${e.message}`);
  }
}

async function dispatchToOpenClaw(msg) {
  const content = msg.content || msg.text || '';
  const sender = msg.senderName || msg.senderId || 'user';
  if (!content) return;

  console.log(`[poll] Dispatching to openclaw: "${content}" from ${sender}`);

  // Use openclaw CLI to send the message and get AI reply
  const { spawn } = await import('child_process');
  return new Promise((resolve) => {
    const proc = spawn('openclaw', [
      'chat',
      '--channel', 'chatu',
      '--account', 'default',
      '--message', content,
      '--sender', CHANNEL_ID,
      '--json',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', async (code) => {
      if (code !== 0) {
        console.error(`[poll] openclaw chat failed (code=${code}): ${stderr.slice(0, 200)}`);
        resolve();
        return;
      }

      // Parse JSON replies and deliver back to service
      try {
        const lines = stdout.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const reply = parsed?.reply || parsed?.text || parsed?.content || (typeof parsed === 'string' ? parsed : null);
            if (reply) {
              await deliverReply(reply, msg);
            }
          } catch { /* skip non-json lines */ }
        }
        // If no JSON, treat whole stdout as reply
        if (stdout.trim() && !lines.some(l => { try { JSON.parse(l); return true; } catch { return false; } })) {
          await deliverReply(stdout.trim(), msg);
        }
      } catch (e) {
        console.error(`[poll] failed to parse reply: ${e.message}`);
      }
      resolve();
    });
  });
}

async function deliverReply(text, originalMsg) {
  console.log(`[poll] Delivering reply: "${text.slice(0, 80)}..."`);
  try {
    const resp = await timedFetch(
      `${API_URL}/api/channel/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Channel-Token': ACCESS_TOKEN },
        body: JSON.stringify({
          channelId: CHANNEL_ID,
          content: text,
          direction: 'inbound',
          senderId: 'ai',
          targetId: originalMsg.senderId || 'user',
          metadata: {},
        }),
      },
      30000,
    );
    if (resp.ok) {
      console.log('[poll] Reply delivered OK');
    } else {
      const body = await resp.text();
      console.error(`[poll] Reply delivery failed: ${resp.status} ${body.slice(0, 100)}`);
    }
  } catch (e) {
    console.error(`[poll] Reply delivery error: ${e.message}`);
  }
}

// Main poll loop
async function pollLoop() {
  console.log('[poll] Poll loop started');
  while (true) {
    const backoffMs = Math.min(POLL_INTERVAL_MS * Math.pow(2, consecutiveErrors), MAX_BACKOFF_MS);
    await new Promise(r => setTimeout(r, backoffMs));

    try {
      const url =
        `${API_URL}/api/channel/messages/pending` +
        `?channelId=${encodeURIComponent(CHANNEL_ID)}` +
        `&after=${encodeURIComponent(lastCursor)}`;

      const resp = await timedFetch(url, {
        method: 'GET',
        headers: {
          'X-Channel-Token': ACCESS_TOKEN,
          'X-Channel-ID': 'default',
        },
      }, 15000);

      if (!resp.ok) {
        consecutiveErrors++;
        console.warn(`[poll] HTTP ${resp.status} (errors=${consecutiveErrors})`);
        continue;
      }

      consecutiveErrors = 0;
      const data = await resp.json();
      const messages = data?.data ?? [];

      for (const msg of messages) {
        lastCursor = msg.id ?? lastCursor;
        await ackMessage(msg.id);

        // Typing indicator
        timedFetch(`${API_URL}/api/channel/typing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Channel-Token': ACCESS_TOKEN },
          body: JSON.stringify({ channelId: CHANNEL_ID }),
        }, 3000).catch(() => {});

        await dispatchToOpenClaw(msg);
      }
    } catch (err) {
      consecutiveErrors++;
      console.warn(`[poll] Error (errors=${consecutiveErrors}): ${err.message}`);
    }
  }
}

pollLoop().catch(err => {
  console.error('[poll] Fatal:', err);
  process.exit(1);
});
