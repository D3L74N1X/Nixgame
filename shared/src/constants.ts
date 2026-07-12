export const GRID_COLS = 16;
export const GRID_ROWS = 8;

/** Zeilen 0..3: feste Percussion-Sounds. Zeile 4: freie Percussion ("fx"). Zeilen 5..7: melodisch. */
export const PERC_FIXED_SOUNDS = ['bd', 'sd', 'hh', 'oh'] as const;
export const FX_ROW = 4;
export const FIRST_MELODIC_ROW = 5;

/** Sounds, die in der fx-Zeile erlaubt sind (Strudel-Standard-Samples). */
export const FX_SOUNDS = ['cp', 'rim', 'lt', 'mt', 'ht', 'click', 'perc'] as const;

/** Synths, die als persistente User-Stimme vergeben werden. */
export const VOICE_SYNTHS = ['sawtooth', 'square', 'triangle', 'sine'] as const;

export const NOTE_REGEX = /^[a-g][#b]?[2-5]$/;

export const MIN_BPM = 60;
export const MAX_BPM = 200;
export const DEFAULT_BPM = 120;
export const BPM_COOLDOWN_MS = 15_000;

export const WS_PORT_DEFAULT = 8787;

export const ROW_LABELS = ['bd', 'sd', 'hh', 'oh', 'fx', '♪', '♪', '♪'] as const;
