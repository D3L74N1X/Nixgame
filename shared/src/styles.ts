/**
 * Stil-Presets: Drum-Bank, Stimmen-Set, Skalenreise und Effekt-Charakter.
 * Der Streamer schaltet sie über die Toolbar um; Zuschauer-Zellen bleiben,
 * klingen aber sofort anders — dasselbe Territorium, ein anderes Wetter.
 *
 * Klangrichtung: sanfte elektronische Musik (Ambient, Minimal/Dub-Techno,
 * IDM). Keine klirrenden Leads, keine scheppernden Hi-Hats: Drums laufen
 * überall tiefpass-gefiltert mit leisen Hats/Snares, Stimmen sind weiche
 * Plucks, Pads und Sinus/Dreieck.
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
    /** Zusätzliche Kette, roher Strudel-Code — nur aus diesem Modul. */
    extra: string;
  };
  drums: {
    gain: number;
    lpf: number | null;
    room: number;
    /** Hi-Hat-Pegel relativ zu gain (Hats sind das, was am schnellsten nervt). */
    hats: number;
    extra: string;
    /** Zusätzliche Kette nur für die Hi-Hat-Zeile (z. B. IDM-Stotterer). */
    hatExtra: string;
  };
  swing: number;
}

export type StyleId = 'dream' | 'minimal' | 'idm' | 'dub';
export const DEFAULT_STYLE: StyleId = 'dream';

export const STYLES: Record<StyleId, Style> = {
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
    drums: { gain: 0.55, lpf: 2200, room: 0.5, hats: 0.5, extra: '', hatExtra: '' },
    swing: 0,
  },

  minimal: {
    id: 'minimal',
    label: 'Minimal',
    bpm: 124,
    bank: 'RolandTR909',
    voices: [
      { s: 'sine', release: 0.25 },
      { s: 'triangle', release: 0.2 },
      { s: 'gm_epiano1', release: 0.3 },
      { s: 'gm_marimba', release: 0.3 },
      { s: 'gm_kalimba', release: 0.4 },
      { s: 'gm_synth_bass_2', release: 0.2 },
      { s: 'gm_pad_poly', release: 0.6 },
      { s: 'gm_vibraphone', release: 0.6 },
      { s: 'gm_electric_guitar_muted', release: 0.15 },
      { s: 'gm_pad_warm', release: 0.8 },
    ],
    journey: [
      { scale: 'C:minor', drone: '[c1,c2]' },
      { scale: 'C:dorian', drone: '[c1,c2]' },
      { scale: 'Eb:major', drone: '[eb1,eb2]' },
      { scale: 'G:minor', drone: '[g1,g2]' },
      { scale: 'C:minor:pentatonic', drone: '[c1,c2]' },
    ],
    drone: { s: 'sine', gain: 0.18, lpf: 200 },
    melodic: {
      gain: 0.42, lpf: [500, 2200], lpq: 0, room: 0.5, size: 0.9,
      delay: 0.35, feedback: 0.55, extra: '',
    },
    // 909 ja, aber gefiltert und mit fast unhörbaren Hats — Dub-Techno-Bett.
    drums: { gain: 0.75, lpf: 2600, room: 0.35, hats: 0.35, extra: '', hatExtra: '' },
    swing: 0.03,
  },

  idm: {
    id: 'idm',
    label: 'IDM',
    bpm: 98,
    bank: 'LinnDrum',
    voices: [
      { s: 'gm_epiano2', release: 0.6 },
      { s: 'gm_pad_warm', release: 1.2 },
      { s: 'gm_vibraphone', release: 0.9 },
      { s: 'gm_music_box', release: 0.8 },
      { s: 'gm_celesta', release: 0.7 },
      { s: 'gm_flute', release: 0.5 },
      { s: 'gm_synth_bass_2', release: 0.25 },
      { s: 'triangle', release: 0.3 },
      { s: 'gm_kalimba', release: 0.6 },
      { s: 'gm_pad_sweep', release: 1.2 },
      { s: 'gm_acoustic_guitar_nylon', release: 0.5 },
    ],
    journey: [
      { scale: 'D:dorian', drone: '[d2,a2]' },
      { scale: 'F:lydian', drone: '[f1,c2]' },
      { scale: 'A:minor', drone: '[a1,e2]' },
      { scale: 'C:major', drone: '[c2,g2]' },
      { scale: 'G:mixolydian', drone: '[g1,d2]' },
      { scale: 'E:minor:pentatonic', drone: '[e2,b2]' },
    ],
    drone: { s: 'gm_pad_warm', gain: 0.16, lpf: 700 },
    // Leichte Stereo-Bewegung; kein Bitcrush, keine Verzerrung.
    melodic: {
      gain: 0.45, lpf: [700, 2800], lpq: 0, room: 0.55, size: 0.85,
      delay: 0.3, feedback: 0.45, extra: '.pan(sine.range(.35,.65).slow(7))',
    },
    // LinnDrum weich gefiltert; die Hats stottern gelegentlich (ply) — der IDM-Tick.
    drums: {
      gain: 0.6, lpf: 2400, room: 0.4, hats: 0.45, extra: '',
      hatExtra: '.sometimesBy(.12, x => x.ply(3).gain(.6))',
    },
    swing: 0.05,
  },

  dub: {
    id: 'dub',
    label: 'Dub',
    bpm: 116,
    bank: 'RolandTR505',
    voices: [
      { s: 'gm_epiano1', release: 0.5 },
      { s: 'gm_electric_guitar_clean', release: 0.3 },
      { s: 'gm_pad_warm', release: 1 },
      { s: 'gm_vibraphone', release: 0.8 },
      { s: 'sine', release: 0.3 },
      { s: 'gm_synth_bass_2', release: 0.25 },
      { s: 'gm_epiano2', release: 0.5 },
      { s: 'gm_marimba', release: 0.4 },
      { s: 'gm_pad_choir', release: 1 },
      { s: 'triangle', release: 0.3 },
    ],
    journey: [
      { scale: 'A:minor', drone: '[a1,e2]' },
      { scale: 'A:dorian', drone: '[a1,e2]' },
      { scale: 'F:major', drone: '[f1,c2]' },
      { scale: 'D:minor', drone: '[d2,a2]' },
      { scale: 'A:minor:pentatonic', drone: '[a1,e2]' },
    ],
    drone: { s: 'gm_pad_warm', gain: 0.18, lpf: 500 },
    // Langes, tempo-synchrones Echo mit hohem Feedback: der Dub-Raum.
    melodic: {
      gain: 0.42, lpf: [400, 1800], lpq: 0, room: 0.7, size: 0.92,
      delay: 0.45, feedback: 0.62, extra: '',
    },
    drums: { gain: 0.65, lpf: 2000, room: 0.5, hats: 0.4, extra: '', hatExtra: '' },
    swing: 0.04,
  },
};

export const STYLE_IDS = Object.keys(STYLES) as StyleId[];

export function isStyleId(x: unknown): x is StyleId {
  return typeof x === 'string' && x in STYLES;
}
