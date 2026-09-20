export const GRID_COLS = 16;
export const GRID_ROWS = 8;

/** Zeilen 0..3: feste Percussion-Sounds. Zeile 4: freie Percussion ("fx"). Zeilen 5..7: melodisch. */
export const PERC_FIXED_SOUNDS = ['bd', 'sd', 'hh', 'oh'] as const;
export const FX_ROW = 4;
export const FIRST_MELODIC_ROW = 5;

/** Sounds, die in der fx-Zeile erlaubt sind — alle in der TR-909-Bank vorhanden. */
export const FX_SOUNDS = ['cp', 'rim', 'lt', 'mt', 'ht', 'cr', 'rd'] as const;

/** Drum-Bank aus den tidal-drum-machines (im Strudel-Prebake enthalten). */
export const DRUM_BANK = 'RolandTR909';

/**
 * Timbres, die als persistente User-Stimme vergeben werden (GM-Soundfonts,
 * laden bei erster Nutzung nach). `release` in Sekunden — Pads dürfen
 * nachklingen, Perkussives bleibt knackig.
 */
export const VOICES = [
  { s: 'gm_epiano1', release: 0.4 },
  { s: 'gm_kalimba', release: 0.5 },
  { s: 'gm_marimba', release: 0.3 },
  { s: 'gm_vibraphone', release: 0.8 },
  { s: 'gm_music_box', release: 0.6 },
  { s: 'gm_celesta', release: 0.5 },
  { s: 'gm_koto', release: 0.4 },
  { s: 'gm_electric_guitar_muted', release: 0.15 },
  { s: 'gm_synth_bass_2', release: 0.2 },
  { s: 'gm_pad_warm', release: 1.2 },
  { s: 'gm_lead_2_sawtooth', release: 0.25 },
  { s: 'gm_steel_drums', release: 0.5 },
] as const;

/**
 * Harmonische Reise: alle 4 Takte wandert die Skala, Zuschauer-Noten werden
 * darauf quantisiert — so klingt auch Zufall musikalisch, und der Loop
 * verändert sich harmonisch von selbst. `drone` ist der Grundton-Teppich.
 */
export const SCALE_JOURNEY = [
  { scale: 'C:minor', drone: '[c2,g2]' },
  { scale: 'C:dorian', drone: '[c2,g2]' },
  { scale: 'Ab:lydian', drone: '[ab1,eb2]' },
  { scale: 'G:minor', drone: '[g1,d2]' },
  { scale: 'Bb:major', drone: '[bb1,f2]' },
  { scale: 'C:minor:pentatonic', drone: '[c2,g2]' },
] as const;
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

export const ROW_LABELS = ['bd', 'sd', 'hh', 'oh', 'fx', '♪', '♪', '♪'] as const;
