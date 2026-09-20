import type { StyleId } from './styles.js';

/** Eine belegte Zelle im Grid. `token` ist je nach Zeile ein Sample-Name oder eine Note (z. B. "c3"). */
export interface Cell {
  user: string;
  token: string;
  /** Zeitpunkt der (letzten) Beanspruchung, ms epoch — Basis für den Verfall. */
  since?: number;
  /** Bis hierhin (ms epoch) ist die Zelle per Gift gegen Verfall versiegelt. */
  sealedUntil?: number;
}

/** Solo: 60 s gehört die Bühne einem Top-Gifter — nur seine Zellen spielen. */
export interface Solo {
  user: string;
  until: number;
}

export interface GridState {
  bpm: number;
  /** [row][col] */
  cells: (Cell | null)[][];
  solo?: Solo | null;
  /** Stil-Preset (Streamer-Wahl); fehlt bei alten Zuständen → DEFAULT_STYLE. */
  style?: StyleId;
}

/** Persistente "Stimme" eines Users, deterministisch aus dem Handle abgeleitet. */
export interface UserVoice {
  synth: string;
  /** Release in Sekunden (Pads klingen nach, Perkussives nicht). */
  release: number;
  hue: number;
}

/** Geparste Chat-Kommandos (Whitelist-DSL — es wird nie roher Zuschauer-Code evaluiert). */
export type Command =
  | { type: 'drum'; sound: string; col: number }
  | { type: 'note'; note: string; col: number }
  | { type: 'cell'; col: number; row: number; token: string }
  | { type: 'clear'; col: number; row: number }
  | { type: 'bpm'; bpm: number };

/** Normalisierte Live-Events, egal ob aus TikTok oder dem Mock-Generator. */
export type LiveEvent =
  | { kind: 'chat'; user: string; text: string }
  | { kind: 'like'; user: string; count: number }
  | { kind: 'gift'; user: string; giftName: string; value: number };

/** Nachrichten Server → Overlay. */
export type ServerMessage =
  | { type: 'state'; state: GridState }
  | { type: 'cell'; row: number; col: number; cell: Cell | null }
  | { type: 'bpm'; bpm: number; user: string }
  | { type: 'ticker'; text: string; user?: string }
  | { type: 'like'; count: number }
  | { type: 'gift'; user: string; giftName: string; value: number }
  | { type: 'solo'; solo: Solo | null };

/**
 * Nachrichten Overlay → Server: der Streamer greift per OBS „Interagieren“
 * ein. Privilegiert (kein Territorium, kein Cooldown) — der WS lauscht nur
 * auf localhost.
 */
export type ClientMessage =
  | { type: 'cmd'; text: string }
  | { type: 'style'; style: StyleId }
  | { type: 'bpm'; bpm: number }
  | { type: 'clearAll' };
