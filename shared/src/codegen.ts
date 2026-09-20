import {
  DRUM_BANK,
  FIRST_MELODIC_ROW,
  FX_ROW,
  GRID_COLS,
  SCALE_BARS,
  SCALE_JOURNEY,
} from './constants.js';
import type { Cell, GridState } from './types.js';
import { voiceFor } from './voice.js';

/** Alle 8 Takte: hh verdoppelt (Fill), bd setzt kurz aus, Melodie atmet. */
const PHRASE_BARS = 8;

const journeyScales = `<${SCALE_JOURNEY.map((j) => j.scale).join(' ')}>/${SCALE_BARS}`;
const journeyDrone = `<${SCALE_JOURNEY.map((j) => j.drone).join(' ')}>/${SCALE_BARS}`;

function rowTokens(row: (Cell | null)[], pick: (c: Cell) => string): string {
  const out: string[] = [];
  for (let col = 0; col < GRID_COLS; col++) {
    const cell = row[col];
    out.push(cell ? pick(cell) : '~');
  }
  return out.join(' ');
}

function rowActive(row: (Cell | null)[]): boolean {
  return row.some((c) => c !== null);
}

/** Zeilen-spezifische Würze für die Drums: Akzente, Fills, Raum. */
function drumFlavor(row: number): string {
  switch (row) {
    case 0: // bd
      return `.gain(1).lastOf(${PHRASE_BARS * 2}, x => x.degradeBy(.5))`;
    case 1: // sd
      return `.gain(.85).room(.25)`;
    case 2: // hh — Akzente auf den Achteln, alle 8 Takte ein Fill
      return `.gain("[.85 .5 .7 .5]*4").lastOf(${PHRASE_BARS}, x => x.ply(2))`;
    case 3: // oh
      return `.gain(.6).release(.12)`;
    default: // fx
      return `.gain(.75).room(.2)`;
  }
}

/**
 * Übersetzt den Grid-Zustand in ein Strudel-Programm.
 * Es entsteht ausschließlich Code aus validierten Whitelist-Tokens —
 * das Grid ist die einzige Quelle, nie roher Zuschauertext.
 *
 * Klangkonzept: TR-909-Drums mit Swing, Zuschauer-Noten werden auf eine
 * wandernde Skala quantisiert und mit GM-Timbres pro Autor gespielt; ein
 * Grundton-Drone hält den Raum, auch wenn das Grid leer ist.
 */
export function gridToStrudel(state: GridState): string {
  const layers: string[] = [];

  // Drone: die Entität summt — Grundton + Quinte, folgt der Skalenreise.
  layers.push(
    `  note("${journeyDrone}").s("gm_pad_warm")\n` +
      `    .gain(.2).attack(1.5).release(2).lpf(600).room(.7).size(.9)`,
  );

  for (let row = 0; row <= FX_ROW; row++) {
    const cells = state.cells[row];
    if (!rowActive(cells)) continue;
    layers.push(
      `  s("${rowTokens(cells, (c) => c.token)}").bank("${DRUM_BANK}")${drumFlavor(row)}`,
    );
  }

  for (let row = FIRST_MELODIC_ROW; row < state.cells.length; row++) {
    const cells = state.cells[row];
    if (!rowActive(cells)) continue;
    const notes = rowTokens(cells, (c) => c.token);
    const synths = rowTokens(cells, (c) => voiceFor(c.user).synth);
    const releases = rowTokens(cells, (c) => String(voiceFor(c.user).release));
    layers.push(
      `  note("${notes}").scale("${journeyScales}")\n` +
        `    .s("${synths}")\n` +
        `    .release("${releases}").gain(.55)\n` +
        `    .lpf(perlin.range(1200, 6000).slow(12))\n` +
        `    .room(.4).size(.85).delay(.2).delaysync(3/16).delayfeedback(.35)\n` +
        `    .sometimesBy(.1, x => x.add(note(12)))\n` +
        `    .lastOf(${PHRASE_BARS}, x => x.degradeBy(.35))`,
    );
  }

  const cps = `setcps(${state.bpm}/60/4)`;
  return `${cps}\nstack(\n${layers.join(',\n')}\n).swingBy(.06, 4)`;
}
