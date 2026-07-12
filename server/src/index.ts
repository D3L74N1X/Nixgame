import { WebSocketServer, WebSocket } from 'ws';
import { WS_PORT_DEFAULT, type LiveEvent, type ServerMessage } from '@nixgame/shared';
import { GridStore } from './store.js';
import { startMockSource } from './mock.js';
import { startTikTokSource } from './tiktok.js';

const port = Number(process.env.WS_PORT ?? WS_PORT_DEFAULT);
const store = new GridStore(new URL('../data/state.json', import.meta.url).pathname);

const wss = new WebSocketServer({ port });
console.log(`[server] WebSocket auf ws://localhost:${port}`);

function broadcast(msg: ServerMessage) {
  const raw = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(raw);
  }
}

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'state', state: store.state } satisfies ServerMessage));
});

// Likes gebündelt weitergeben, damit das Overlay nicht mit Einzel-Events geflutet wird.
let likeBuffer = 0;
setInterval(() => {
  if (likeBuffer > 0) {
    broadcast({ type: 'like', count: likeBuffer });
    likeBuffer = 0;
  }
}, 1000);

function onEvent(ev: LiveEvent) {
  switch (ev.kind) {
    case 'chat': {
      for (const msg of store.handleChat(ev.user, ev.text)) broadcast(msg);
      break;
    }
    case 'like':
      likeBuffer += ev.count;
      break;
    case 'gift':
      broadcast({ type: 'gift', user: ev.user, giftName: ev.giftName, value: ev.value });
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
