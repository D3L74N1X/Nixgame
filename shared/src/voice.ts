import { VOICE_SYNTHS } from './constants.js';
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

export function voiceFor(handle: string): UserVoice {
  const h = hashHandle(handle.toLowerCase());
  return {
    synth: VOICE_SYNTHS[h % VOICE_SYNTHS.length],
    hue: (h >>> 8) % 360,
  };
}
