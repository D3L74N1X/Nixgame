import { VOICES } from './constants.js';
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
  const v = VOICES[h % VOICES.length];
  return {
    synth: v.s,
    release: v.release,
    hue: (h >>> 8) % 360,
  };
}
