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

  // enableExtendedGiftInfo würde gift/list/ signieren lassen — das ist bei Euler
  // Stream eine Premium-Route ("requires a Business plan"). Name und Diamantwert
  // stecken ohnehin im Gift-Event selbst (Proto-Feld `gift`).
  const conn = new Connection(username, { enableExtendedGiftInfo: false });

  // v2 liefert rohe Webcast-Protos (user.displayId, content, likeCount, gift.*);
  // v1 hatte flache Felder (uniqueId, comment, diamondCount). Beides abdecken.
  const handleOf = (data: any): string | null =>
    data?.user?.displayId ?? data?.user?.uniqueId ?? data?.uniqueId ?? null;

  conn.on('chat', (data: any) => {
    const user = handleOf(data);
    const text = data?.content ?? data?.comment;
    if (user && typeof text === 'string') emit({ kind: 'chat', user, text });
  });

  conn.on('like', (data: any) => {
    emit({
      kind: 'like',
      user: handleOf(data) ?? 'unbekannt',
      count: Number(data?.likeCount ?? data?.count ?? 1),
    });
  });

  let giftLogged = false;
  conn.on('gift', (data: any) => {
    if (!giftLogged) {
      // Einmalig die Feldstruktur loggen — die Bibliothek benennt Felder je Version um.
      giftLogged = true;
      const g = data?.gift ?? {};
      console.log('[tiktok] erstes Gift-Event:', JSON.stringify({
        gift: { id: g.id, name: g.name, diamondCount: g.diamondCount, type: g.type },
        repeatCount: data?.repeatCount, repeatEnd: data?.repeatEnd, giftType: data?.giftType,
        keys: Object.keys(data ?? {}),
      }));
    }
    const gift = data?.gift ?? data?.giftDetails ?? {};
    const giftType = Number(data?.giftType ?? gift?.type ?? 0);
    // Bei streakbaren Gifts nur das Streak-Ende werten, sonst zählt jede Stufe doppelt.
    if (giftType === 1 && !data?.repeatEnd) return;
    const repeat = Number(data?.repeatCount ?? 1);
    const diamonds = Number(data?.diamondCount ?? gift?.diamondCount ?? 1);
    emit({
      kind: 'gift',
      user: handleOf(data) ?? 'unbekannt',
      giftName: String(data?.giftName ?? gift?.name ?? 'Gift'),
      value: diamonds * (repeat > 0 ? repeat : 1),
    });
  });

  conn.on('error', (e: any) => console.warn('[tiktok] error-Event:', e?.info ?? e?.message ?? e));

  let backoff = 5_000;
  const connect = async () => {
    try {
      await conn.connect();
      backoff = 5_000;
      console.log(`[tiktok] verbunden mit @${username}`);
    } catch (e) {
      console.warn(`[tiktok] Verbindung fehlgeschlagen, Retry in ${backoff / 1000}s:`, e);
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30_000);
    }
  };

  conn.on('disconnected', () => {
    console.warn('[tiktok] getrennt, versuche Reconnect …');
    setTimeout(connect, backoff);
  });

  await connect();
}
