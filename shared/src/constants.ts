export const GRID_COLS = 16;
export const GRID_ROWS = 8;

/**
 * Zeilen 0..3: feste Percussion-Sounds. Zeile 4: freie Percussion ("fx").
 * Zeile 5: Bass (Noten eine Oktave tiefer, Bass-Timbre des Stils).
 * Zeilen 6..7: melodisch.
 */
export const PERC_FIXED_SOUNDS = ['bd', 'sd', 'hh', 'oh'] as const;
export const FX_ROW = 4;
export const BASS_ROW = 5;
export const FIRST_MELODIC_ROW = 5;

/** Sounds, die in der fx-Zeile erlaubt sind — alle in der TR-909-Bank vorhanden. */
export const FX_SOUNDS = ['cp', 'rim', 'lt', 'mt', 'ht', 'cr', 'rd'] as const;

/** Drum-Bank, Stimmen und Skalenreise sind Stil-Sache → styles.ts */
export const SCALE_BARS = 4;

export const NOTE_REGEX = /^[a-g][#b]?[2-5]$/;

export const MIN_BPM = 60;
export const MAX_BPM = 200;
export const DEFAULT_BPM = 120;
export const BPM_COOLDOWN_MS = 15_000;

/**
 * Verfall: Zellen, die länger als DECAY_AFTER_MS unberührt sind, erodieren —
 * höchstens eine pro DECAY_INTERVAL_MS, damit es ein Bröckeln bleibt und kein
 * Einsturz. Erneutes Setzen der eigenen Zelle frischt sie auf.
 */
export const DECAY_AFTER_MS = 4 * 60_000;
export const DECAY_INTERVAL_MS = 20_000;

/**
 * Gift-Eskalation (Diamanten, kumulativ — ein grosses Gift bekommt alles):
 *   ≥ GIFT_SEAL_MIN   eigene Zellen SEAL_MS lang gegen Verfall versiegeln
 *   ≥ GIFT_STEAL_MIN  pro GIFT_STEAL_MIN Diamanten ein Diebstahl (max. STEAL_MAX_CREDITS):
 *                     das nächste Kommando auf eine fremde Zelle übernimmt sie
 *   ≥ GIFT_SOLO_MIN   SOLO_MS lang spielen nur die eigenen Zellen, der Rest wird gedämpft
 */
export const GIFT_SEAL_MIN = 1;
export const GIFT_STEAL_MIN = 100;
export const GIFT_SOLO_MIN = 1000;
export const SEAL_MS = 10 * 60_000;
export const STEAL_MAX_CREDITS = 5;
export const STEAL_TTL_MS = 10 * 60_000;
export const SOLO_MS = 60_000;

export const WS_PORT_DEFAULT = 8787;

export const ROW_LABELS = ['bd', 'sd', 'hh', 'oh', 'fx', 'bass', '♪', '♪'] as const;
