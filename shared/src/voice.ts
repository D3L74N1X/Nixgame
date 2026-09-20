import { DEFAULT_STYLE, STYLES, type StyleId } from './styles.js';
import type { UserVoice } from './types.js';

/** FNV-1a — stabil über Sessions, damit ein Handle immer dieselbe Stimme behält. */
export function hashHandle(handle: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < handle.length; i++) {
    h ^= handle.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Persistente Stimme eines Handles. Die Farbe ist stil-unabhängig (Identität),
 * das Timbre kommt aus dem Stimmen-Set des aktiven Stils.
 */
export function voiceFor(handle: string, style: StyleId = DEFAULT_STYLE): UserVoice {
  const h = hashHandle(handle.toLowerCase());
  const voices = STYLES[style].voices;
  const v = voices[h % voices.length];
  return {
    synth: v.s,
    release: v.release,
    hue: (h >>> 8) % 360,
  };
}
