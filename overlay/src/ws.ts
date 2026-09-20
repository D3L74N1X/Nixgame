import type { ClientMessage, ServerMessage } from '@nixgame/shared';

export interface WsLink {
  /** Nachricht an den Server (Streamer-Eingriffe); verworfen, wenn getrennt. */
  send(msg: ClientMessage): void;
}

/** Verbindet mit Auto-Reconnect (Backoff) — das Overlay läuft ggf. tagelang in OBS. */
export function connectWS(
  url: string,
  onMessage: (msg: ServerMessage) => void,
  onFrame?: (jpeg: Blob) => void,
): WsLink {
  let retry = 1000;
  let current: WebSocket | null = null;
  const open = () => {
    const ws = new WebSocket(url);
    ws.binaryType = 'blob';
    ws.onopen = () => {
      retry = 1000;
      current = ws;
      console.log('[ws] verbunden:', url);
    };
    ws.onmessage = (e) => {
      if (e.data instanceof Blob) {
        onFrame?.(e.data); // Kamera-Frame (JPEG) vom Server
        return;
      }
      try {
        onMessage(JSON.parse(String(e.data)) as ServerMessage);
      } catch {
        // fehlerhafte Nachricht ignorieren
      }
    };
    ws.onclose = () => {
      if (current === ws) current = null;
      retry = Math.min(retry * 2, 15_000);
      setTimeout(open, retry);
    };
    ws.onerror = () => ws.close();
  };
  open();
  return {
    send(msg) {
      if (current?.readyState === WebSocket.OPEN) current.send(JSON.stringify(msg));
    },
  };
}
