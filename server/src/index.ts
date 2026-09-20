import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  DECAY_INTERVAL_MS,
  MAX_BPM,
  MIN_BPM,
  WS_PORT_DEFAULT,
  isStyleId,
  type ClientMessage,
  type LiveEvent,
  type ServerMessage,
} from '@nixgame/shared';
import { GridStore } from './store.js';
import { startMockSource } from './mock.js';
import { startTikTokSource } from './tiktok.js';
import { startCameraSource } from './camera.js';

const port = Number(process.env.WS_PORT ?? WS_PORT_DEFAULT);
// Nur localhost: über den WS kommen privilegierte Streamer-Kommandos.
const host = process.env.WS_HOST ?? '127.0.0.1';
/** Handle, unter dem Streamer-Eingriffe im Ticker erscheinen. */
const STREAMER = process.env.TIKTOK_USERNAME ?? 'streamer';
const store = new GridStore(fileURLToPath(new URL('../data/state.json', import.meta.url)));

const wss = new WebSocketServer({ port, host });
console.log(`[server] WebSocket auf ws://${host}:${port}`);

function broadcast(msg: ServerMessage) {
  const raw = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(raw);
  }
}

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'state', state: store.state } satisfies ServerMessage));
  socket.on('message', (raw, isBinary) => {
    if (isBinary) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    for (const out of handleClientMessage(msg)) broadcast(out);
  });
});

/** Streamer-Eingriffe aus dem Overlay (OBS „Interagieren“) — privilegiert. */
function handleClientMessage(msg: ClientMessage): ServerMessage[] {
  switch (msg?.type) {
    case 'cmd':
      if (typeof msg.text !== 'string') return [];
      console.log(`[streamer] ${msg.text}`);
      return store.handleChat(STREAMER, msg.text, true);
    case 'style':
      if (!isStyleId(msg.style)) return [];
      console.log(`[streamer] Stil → ${msg.style}`);
      return store.setStyle(msg.style, STREAMER);
    case 'bpm': {
      const bpm = Math.round(Number(msg.bpm));
      if (!Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) return [];
      return store.apply(STREAMER, { type: 'bpm', bpm }, true);
    }
    case 'clearAll':
      console.log('[streamer] Grid geleert');
      return store.clearAll(STREAMER);
    default:
      return [];
  }
}

// Kamera-Frames binär durchreichen; bei Rückstau Frames verwerfen statt puffern.
void startCameraSource((jpeg) => {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 256_000) {
      client.send(jpeg, { binary: true });
    }
  }
});

// Likes gebündelt weitergeben, damit das Overlay nicht mit Einzel-Events geflutet wird.
let likeBuffer = 0;
setInterval(() => {
  if (likeBuffer > 0) {
    broadcast({ type: 'like', count: likeBuffer });
    likeBuffer = 0;
  }
}, 1000);

// Solo-Ende punktgenau melden (ein neues Solo verschiebt den Timer).
let soloTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSoloEnd(until: number) {
  if (soloTimer) clearTimeout(soloTimer);
  soloTimer = setTimeout(() => {
    soloTimer = null;
    for (const msg of store.expireSolo()) broadcast(msg);
  }, Math.max(0, until - Date.now()) + 50);
}
if (store.state.solo) scheduleSoloEnd(store.state.solo.until);

// Verfall: unbespielte Zellen erodieren langsam.
setInterval(() => {
  for (const msg of store.decay()) broadcast(msg);
}, DECAY_INTERVAL_MS);

function onEvent(ev: LiveEvent) {
  switch (ev.kind) {
    case 'chat': {
      const msgs = store.handleChat(ev.user, ev.text);
      if (process.env.LOG_CHAT !== '0') {
        console.log(`[chat] @${ev.user}: ${ev.text}${msgs.length ? ` → ${msgs.map((m) => m.type).join(',')}` : ''}`);
      }
      for (const msg of msgs) broadcast(msg);
      break;
    }
    case 'like':
      likeBuffer += ev.count;
      break;
    case 'gift':
      broadcast({ type: 'gift', user: ev.user, giftName: ev.giftName, value: ev.value });
      for (const msg of store.applyGift(ev.user, ev.value)) broadcast(msg);
      if (store.state.solo) scheduleSoloEnd(store.state.solo.until);
      break;
  }
}

const username = process.env.TIKTOK_USERNAME;
if (username) {
  startTikTokSource(username, onEvent).catch((e) => {
    console.error('[tiktok] Quelle konnte nicht starten, falle auf Mock zurück:', e);
    startMockSource(onEvent);
  });
} else {
  startMockSource(onEvent);
}
