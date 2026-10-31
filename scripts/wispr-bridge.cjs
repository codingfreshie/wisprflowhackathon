#!/usr/bin/env node
/**
 * Wispr Flow -> hosted site bridge.
 *
 * Run this on the laptop where Wispr Flow is installed. It reads your local
 * Wispr database and pushes the latest dictations/meetings to your deployed
 * site, so the "Sync from Desktop App" button works on the public URL.
 *
 * Usage:
 *   node scripts/wispr-bridge.cjs https://your-app.onrender.com YOUR_TOKEN
 *   (or set SITE_URL and WISPR_BRIDGE_TOKEN env vars)
 * Flags:
 *   --once     push a single time and exit (default: keep pushing every 5s)
 *
 * Requires the sqlite3 command-line tool on PATH (same requirement as local sync).
 */
const sync = require('../server/src/wisprDesktopSync');

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const once = process.argv.includes('--once');
const SITE = (args[0] || process.env.SITE_URL || '').replace(/\/+$/, '');
const TOKEN = args[1] || process.env.WISPR_BRIDGE_TOKEN || '';
const INTERVAL_MS = 5000;

if (!SITE || !TOKEN) {
  console.error('Usage: node scripts/wispr-bridge.cjs <site-url> <token> [--once]');
  process.exit(1);
}
if (!sync.getWisprDbPath()) {
  console.error('Could not find Wispr Flow database (flow.sqlite) on this machine.');
  console.error('Expected: %APPDATA%\\Wispr Flow\\flow.sqlite  -- is Wispr Flow installed and used at least once?');
  process.exit(1);
}

let lastFingerprint = '';

async function pushOnce() {
  const latest = sync.getLatestDesktopSync('notetaker_only');
  const history = sync.getDesktopHistory(20);
  const meetings = sync.getDesktopMeetingsList();

  // If there are no Note-Taker meetings, use the newest dictation so the button still has something to pull.
  let effectiveLatest = latest;
  if (!(latest && latest.hasMeetingNotes) && history.length > 0) {
    const h = history[0];
    effectiveLatest = {
      connected: true, hasMeetingNotes: false, type: 'Wispr Dictation (History)',
      id: h.id, title: h.title, transcript: h.transcript, timestamp: h.timestamp,
      numWords: h.numWords, source: 'Wispr History via bridge'
    };
  }

  const fingerprint = JSON.stringify([effectiveLatest && effectiveLatest.id, history.length, history[0] && history[0].id]);
  if (fingerprint === lastFingerprint && !once) return; // nothing new
  lastFingerprint = fingerprint;

  const res = await fetch(`${SITE}/api/wispr/bridge-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bridge-token': TOKEN },
    body: JSON.stringify({ latest: effectiveLatest, history, meetings })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[bridge] push failed (${res.status}):`, body.error || body);
    if (res.status === 401 || res.status === 503) process.exit(1);
    return;
  }
  console.log(`[bridge] ${new Date().toLocaleTimeString()} pushed latest + ${history.length} dictations`);
}

(async () => {
  console.log(`[bridge] Pushing Wispr data to ${SITE} ${once ? '(once)' : `every ${INTERVAL_MS / 1000}s - Ctrl+C to stop`}`);
  try { await pushOnce(); } catch (e) { console.error('[bridge] error:', e.message); }
  if (once) return;
  setInterval(() => pushOnce().catch(e => console.error('[bridge] error:', e.message)), INTERVAL_MS);
})();
