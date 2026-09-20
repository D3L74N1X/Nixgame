/**
 * Stil-Presets: Drum-Bank, Stimmen-Set, Skalenreise und Effekt-Charakter.
 * Der Streamer schaltet sie über die Toolbar um; Zuschauer-Zellen bleiben,
 * klingen aber sofort anders — dasselbe Territorium, ein anderes Wetter.
 *
 * Drum-Banks müssen alle Sounds `bd sd hh oh cp rim lt mt ht cr rd` haben
 * (geprüft gegen tidal-drum-machines: 909, LinnDrum, MPC60, SP-12, DMX, …).
 */

export interface Voice {
  s: string;
  /** Release in Sekunden — Pads klingen nach, Perkussives nicht. */
  release: number;
}

export interface JourneyStep {
  scale: string;
  /** Drone-Akkord (Mini-Notation), passend zum Grundton. */
  drone: string;
}

export interface Style {
  id: StyleId;
  label: string;
  /** Voreinstellung beim Umschalten. */
  bpm: number;
  bank: string;
  voices: readonly Voice[];
  journey: readonly JourneyStep[];
  drone: { s: string; gain: number; lpf: number };
  melodic: {
    gain: number;
    /** Perlin-Filterfahrt [min, max] Hz */
    lpf: [number, number];
    lpq: number;
    room: number;
    size: number;
    delay: number;
    feedback: number;
    /** Zusätzliche Kette (z. B. Distortion), roher Strudel-Code — nur aus diesem Modul. */
    extra: string;
  };
  drums: { gain: number; lpf: number | null; room: number; extra: string };
  swing: number;
}

export type StyleId = 'deep' | 'lofi' | 'rave' | 'dream';
export const DEFAULT_STYLE: StyleId = 'deep';

export const STYLES: Record<StyleId, Style> = {
  deep: {
    id: 'deep',
    label: 'Deep',
    bpm: 120,
    bank: 'RolandTR909',
    voices: [
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
    ],
    journey: [
      { scale: 'C:minor', drone: '[c2,g2]' },
      { scale: 'C:dorian', drone: '[c2,g2]' },
      { scale: 'Ab:lydian', drone: '[ab1,eb2]' },
      { scale: 'G:minor', drone: '[g1,d2]' },
      { scale: 'Bb:major', drone: '[bb1,f2]' },
      { scale: 'C:minor:pentatonic', drone: '[c2,g2]' },
    ],
    drone: { s: 'gm_pad_warm', gain: 0.2, lpf: 600 },
    melodic: {
      gain: 0.55, lpf: [1200, 6000], lpq: 0, room: 0.4, size: 0.85,
      delay: 0.2, feedback: 0.35, extra: '',
    },
    drums: { gain: 1, lpf: null, room: 0.15, extra: '' },
    swing: 0.06,
  },

  lofi: {
    id: 'lofi',
    label: 'Lo-Fi',
    bpm: 84,
    bank: 'AkaiMPC60',
    voices: [
      { s: 'gm_epiano1', release: 0.6 },
      { s: 'gm_epiano2', release: 0.6 },
      { s: 'gm_vibraphone', release: 1 },
      { s: 'gm_acoustic_guitar_nylon', release: 0.5 },
      { s: 'gm_flute', release: 0.4 },
      { s: 'gm_electric_bass_finger', release: 0.3 },
      { s: 'gm_clavinet', release: 0.2 },
      { s: 'gm_harmonica', release: 0.4 },
      { s: 'gm_muted_trumpet', release: 0.4 },
      { s: 'gm_acoustic_bass', release: 0.3 },
      { s: 'gm_electric_guitar_jazz', release: 0.5 },
      { s: 'gm_dulcimer', release: 0.7 },
    ],
    journey: [
      { scale: 'C:major:pentatonic', drone: '[c2,g2]' },
      { scale: 'D:dorian', drone: '[d2,a2]' },
      { scale: 'F:lydian', drone: '[f1,c2]' },
      { scale: 'A:minor', drone: '[a1,e2]' },
      { scale: 'G:mixolydian', drone: '[g1,d2]' },
      { scale: 'C:major', drone: '[c2,g2]' },
    ],
    drone: { s: 'gm_pad_choir', gain: 0.15, lpf: 500 },
    melodic: {
      gain: 0.5, lpf: [600, 2600], lpq: 0, room: 0.5, size: 0.8,
      delay: 0.3, feedback: 0.4, extra: '.coarse(3)',
    },
    drums: { gain: 0.85, lpf: 3200, room: 0.2, extra: '.coarse(2)' },
    swing: 0.13,
  },

  rave: {
    id: 'rave',
    label: 'Rave',
    bpm: 138,
    bank: 'EmuSP12',
    voices: [
      { s: 'sawtooth', release: 0.15 },
      { s: 'square', release: 0.12 },
      { s: 'supersaw', release: 0.2 },
      { s: 'triangle', release: 0.15 },
      { s: 'gm_lead_2_sawtooth', release: 0.2 },
      { s: 'gm_synth_bass_1', release: 0.15 },
      { s: 'gm_lead_8_bass_lead', release: 0.15 },
      { s: 'gm_lead_1_square', release: 0.15 },
      { s: 'gm_synth_strings_1', release: 0.4 },
      { s: 'gm_lead_5_charang', release: 0.15 },
    ],
    journey: [
      { scale: 'C:minor', drone: '[c1,c2]' },
      { scale: 'C:phrygian', drone: '[c1,c2]' },
      { scale: 'F:minor', drone: '[f1,f2]' },
      { scale: 'G:phrygian', drone: '[g1,g2]' },
      { scale: 'C:minor:pentatonic', drone: '[c1,c2]' },
    ],
    drone: { s: 'sawtooth', gain: 0.12, lpf: 300 },
    melodic: {
      gain: 0.45, lpf: [400, 5000], lpq: 8, room: 0.2, size: 0.6,
      delay: 0.15, feedback: 0.3, extra: '.lpenv(2).distort(.15)',
    },
    drums: { gain: 1, lpf: null, room: 0.08, extra: '.shape(.25)' },
    swing: 0,
  },

  dream: {
    id: 'dream',
    label: 'Dream',
    bpm: 92,
    bank: 'OberheimDMX',
    voices: [
      { s: 'gm_pad_warm', release: 2.5 },
      { s: 'gm_pad_halo', release: 2.5 },
      { s: 'gm_choir_aahs', release: 2 },
      { s: 'gm_orchestral_harp', release: 1.2 },
      { s: 'gm_celesta', release: 1 },
      { s: 'gm_music_box', release: 1.2 },
      { s: 'gm_string_ensemble_1', release: 2 },
      { s: 'gm_flute', release: 0.8 },
      { s: 'gm_pad_new_age', release: 2.5 },
      { s: 'gm_glockenspiel', release: 1 },
      { s: 'gm_kalimba', release: 1 },
    ],
    journey: [
      { scale: 'C:lydian', drone: '[c2,g2,e3]' },
      { scale: 'G:major', drone: '[g1,d2,b2]' },
      { scale: 'D:mixolydian', drone: '[d2,a2,f#3]' },
      { scale: 'A:dorian', drone: '[a1,e2,c3]' },
      { scale: 'F:lydian', drone: '[f1,c2,a2]' },
      { scale: 'C:major', drone: '[c2,g2,e3]' },
    ],
    drone: { s: 'gm_pad_halo', gain: 0.22, lpf: 900 },
    melodic: {
      gain: 0.45, lpf: [800, 3200], lpq: 0, room: 0.8, size: 0.95,
      delay: 0.4, feedback: 0.5, extra: '',
    },
    drums: { gain: 0.55, lpf: 2200, room: 0.5, extra: '' },
    swing: 0,
  },
};

export const STYLE_IDS = Object.keys(STYLES) as StyleId[];

export function isStyleId(x: unknown): x is StyleId {
  return typeof x === 'string' && x in STYLES;
}
