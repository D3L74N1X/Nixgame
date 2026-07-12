import type { LiveEvent } from '@nixgame/shared';

/**
 * Adapter um tiktok-live-connector (inoffizielles Webcast-Protokoll).
 * Defensiv gehalten: Die Bibliothek hat zwischen v1 und v2 API-Namen
 * geändert und kann jederzeit brechen — deshalb dynamischer Import,
 * Feature-Detection und großzügiges Error-Handling. Bricht die
 * Verbindung, wird mit Backoff neu verbunden.
 */
export async function startTikTokSource(
  username: string,
  emit: (ev: LiveEvent) => void,
): Promise<void> {
  const mod: any = await import('tiktok-live-connector');
  const Connection = mod.TikTokLiveConnection ?? mod.WebcastPushConnection;
  if (!Connection) {
    throw new Error('tiktok-live-connector: keine bekannte Connection-Klasse gefunden');
  }

  const conn = new Connection(username, { enableExtendedGiftInfo: true });

  conn.on('chat', (data: any) => {
    const user = data?.uniqueId ?? data?.user?.uniqueId;
    const text = data?.comment;
    if (user && typeof text === 'string') emit({ kind: 'chat', user, text });
  });

  conn.on('like', (data: any) => {
    const user = data?.uniqueId ?? data?.user?.uniqueId ?? 'unbekannt';
    emit({ kind: 'like', user, count: Number(data?.likeCount ?? 1) });
  });

  conn.on('gift', (data: any) => {
    // Bei streakbaren Gifts nur das Streak-Ende werten, sonst zählt jede Stufe doppelt.
    if (data?.giftType === 1 && !data?.repeatEnd) return;
    const user = data?.uniqueId ?? data?.user?.uniqueId ?? 'unbekannt';
    const repeat = Number(data?.repeatCount ?? 1);
    emit({
      kind: 'gift',
      user,
      giftName: String(data?.giftName ?? data?.giftDetails?.giftName ?? 'Gift'),
      value: Number(data?.diamondCount ?? 1) * (repeat > 0 ? repeat : 1),
    });
  });

  let backoff = 5_000;
  const connect = async () => {
    try {
      await conn.connect();
      backoff = 5_000;
      console.log(`[tiktok] verbunden mit @${username}`);
    } catch (e) {
      console.warn(`[tiktok] Verbindung fehlgeschlagen, Retry in ${backoff / 1000}s:`, e);
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 120_000);
    }
  };

  conn.on('disconnected', () => {
    console.warn('[tiktok] getrennt, versuche Reconnect …');
    setTimeout(connect, backoff);
  });

  await connect();
}
