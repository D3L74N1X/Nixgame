import {
  FX_SOUNDS,
  GRID_COLS,
  PERC_FIXED_SOUNDS,
  type LiveEvent,
} from '@nixgame/shared';

const USERS = [
  'nachtwerk', 'pxlgeist', 'moira_k', 'subbassine', 'ferrofluid',
  'tau_zero', 'kaltstart', 'ohrwurm99', 'glitzerlot', 'randfigur',
];

const NOTES = ['c3', 'd3', 'e3', 'g3', 'a3', 'c4', 'e4', 'g4'];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randCol(): number {
  return 1 + Math.floor(Math.random() * GRID_COLS);
}

function randomChatLine(): string {
  const r = Math.random();
  if (r < 0.45) return `!drum ${pick([...PERC_FIXED_SOUNDS, ...FX_SOUNDS])} ${randCol()}`;
  if (r < 0.72) return `!note ${pick(NOTES)} ${randCol()}`;
  if (r < 0.8) return `!bass ${pick(['c2', 'g2', 'eb2', 'f2', 'a2'])} ${randCol()}`;
  if (r < 0.87) return `!clear ${randCol()} ${1 + Math.floor(Math.random() * 8)}`;
  if (r < 0.92) return `!bpm ${90 + Math.floor(Math.random() * 8) * 10}`;
  return pick(['nice', 'was ist das hier?', 'mehr bass!!', '🔥🔥🔥']);
}

/**
 * Erzeugt Fake-Live-Events, damit sich das Overlay ohne laufenden
 * TikTok-Stream entwickeln lässt. Gleiche Event-Form wie tiktok.ts.
 */
export function startMockSource(emit: (ev: LiveEvent) => void): () => void {
  console.log('[mock] Mock-Eventquelle aktiv (TIKTOK_USERNAME nicht gesetzt)');

  const timers: ReturnType<typeof setInterval>[] = [];

  const chat = setInterval(() => {
    emit({ kind: 'chat', user: pick(USERS), text: randomChatLine() });
  }, 4000 + Math.random() * 4000);
  timers.push(chat);

  timers.push(
    setInterval(() => {
      emit({ kind: 'like', user: pick(USERS), count: 1 + Math.floor(Math.random() * 15) });
    }, 2500),
  );

  timers.push(
    setInterval(() => {
      if (Math.random() < 0.4) {
        emit({
          kind: 'gift',
          user: pick(USERS),
          giftName: pick(['Rose', 'Finger Heart', 'Galaxy']),
          value: pick([1, 5, 100, 1000]),
        });
      }
    }, 12_000),
  );

  return () => timers.forEach(clearInterval);
}
