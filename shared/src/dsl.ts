import {
  FIRST_MELODIC_ROW,
  FX_ROW,
  FX_SOUNDS,
  GRID_COLS,
  GRID_ROWS,
  MAX_BPM,
  MIN_BPM,
  NOTE_REGEX,
  PERC_FIXED_SOUNDS,
} from './constants.js';
import type { Command } from './types.js';

function parseInt1Based(raw: string | undefined, max: number): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (n < 1 || n > max) return null;
  return n - 1;
}

function isFxSound(s: string): boolean {
  return (FX_SOUNDS as readonly string[]).includes(s);
}

function isPercSound(s: string): boolean {
  return (PERC_FIXED_SOUNDS as readonly string[]).includes(s) || isFxSound(s);
}

/**
 * Übersetzt eine Chat-Zeile in ein Kommando — oder null, wenn sie keins ist.
 * Nur Whitelist-Tokens; Zuschauer-Text erreicht nie das REPL.
 *
 *   !drum bd 5        Percussion in Spalte 5 (Zeile ergibt sich aus dem Sound)
 *   !note c3 5        Note in Spalte 5 (erste freie melodische Zeile)
 *   !bass c2 5        Note in der Bass-Zeile, Spalte 5
 *   !cell 5 7 e4      Direkte Zellen-Adressierung (Spalte, Zeile, Token)
 *   !clear 5 7        Eigene Zelle räumen
 *   !bpm 140          Tempo (mit Cooldown)
 */
export function parseCommand(text: string): Command | null {
  const parts = text.trim().toLowerCase().split(/\s+/);
  if (parts.length === 0 || !parts[0].startsWith('!')) return null;

  switch (parts[0]) {
    case '!drum': {
      const sound = parts[1];
      const col = parseInt1Based(parts[2], GRID_COLS);
      if (!sound || col === null || !isPercSound(sound)) return null;
      return { type: 'drum', sound, col };
    }
    case '!note': {
      const note = parts[1];
      const col = parseInt1Based(parts[2], GRID_COLS);
      if (!note || col === null || !NOTE_REGEX.test(note)) return null;
      return { type: 'note', note, col };
    }
    case '!bass': {
      const note = parts[1];
      const col = parseInt1Based(parts[2], GRID_COLS);
      if (!note || col === null || !NOTE_REGEX.test(note)) return null;
      return { type: 'bass', note, col };
    }
    case '!cell': {
      const col = parseInt1Based(parts[1], GRID_COLS);
      const row = parseInt1Based(parts[2], GRID_ROWS);
      const token = parts[3];
      if (col === null || row === null || !token) return null;
      if (!isValidToken(row, token)) return null;
      return { type: 'cell', col, row, token };
    }
    case '!clear': {
      const col = parseInt1Based(parts[1], GRID_COLS);
      const row = parseInt1Based(parts[2], GRID_ROWS);
      if (col === null || row === null) return null;
      return { type: 'clear', col, row };
    }
    case '!bpm': {
      if (!parts[1] || !/^\d+$/.test(parts[1])) return null;
      const bpm = Number(parts[1]);
      if (bpm < MIN_BPM || bpm > MAX_BPM) return null;
      return { type: 'bpm', bpm };
    }
    default:
      return null;
  }
}

/** Ist `token` in Zeile `row` erlaubt? (Gleiche Regeln wie `!cell`.) */
export function isValidToken(row: number, token: string): boolean {
  if (row < FX_ROW) return token === PERC_FIXED_SOUNDS[row];
  if (row === FX_ROW) return isFxSound(token);
  return NOTE_REGEX.test(token);
}

/** Zeile, in der ein Percussion-Sound landet. */
export function rowForSound(sound: string): number {
  const fixed = (PERC_FIXED_SOUNDS as readonly string[]).indexOf(sound);
  return fixed >= 0 ? fixed : FX_ROW;
}

export { FIRST_MELODIC_ROW };
