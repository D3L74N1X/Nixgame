import type { ServerMessage } from '@nixgame/shared';

/** Verbindet mit Auto-Reconnect (Backoff) — das Overlay läuft ggf. tagelang in OBS. */
export function connectWS(
  url: string,
  onMessage: (msg: ServerMessage) => void,
  onFrame?: (jpeg: Blob) => void,
): void {
  let retry = 1000;
  const open = () => {
    const ws = new WebSocket(url);
    ws.binaryType = 'blob';
    ws.onopen = () => {
      retry = 1000;
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
      retry = Math.min(retry * 2, 15_000);
      setTimeout(open, retry);
    };
    ws.onerror = () => ws.close();
  };
  open();
}
