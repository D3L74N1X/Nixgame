import { FIRST_MELODIC_ROW, FX_ROW, GRID_COLS, SCALE_BARS } from './constants.js';
import { DEFAULT_STYLE, STYLES, type Style } from './styles.js';
import type { Cell, GridState } from './types.js';
import { voiceFor } from './voice.js';

/** Alle 8 Takte: hh verdoppelt (Fill), bd setzt kurz aus, Melodie atmet. */
const PHRASE_BARS = 8;

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

const n2 = (x: number) => Number(x.toFixed(2));

/** Zeilen-spezifische Würze für die Drums: Akzente, Fills, Raum — sanft. */
function drumFlavor(row: number, st: Style): string {
  const g = st.drums.gain;
  const h = g * st.drums.hats;
  switch (row) {
    case 0: // bd
      return `.gain(${n2(g)}).lastOf(${PHRASE_BARS * 2}, x => x.degradeBy(.5))`;
    case 1: // sd — zurückgenommen, mit Raum statt Knall
      return `.gain(${n2(g * 0.65)}).room(${n2(st.drums.room + 0.15)})`;
    case 2: // hh — leise Achtel-Akzente, alle 8 Takte ein Fill
      return `.gain("[${n2(h)} ${n2(h * 0.55)} ${n2(h * 0.8)} ${n2(h * 0.55)}]*4").lastOf(${PHRASE_BARS}, x => x.ply(2))${st.drums.hatExtra}`;
    case 3: // oh
      return `.gain(${n2(h * 0.9)}).release(.12)`;
    default: // fx
      return `.gain(${n2(g * 0.7)}).room(${n2(st.drums.room)})`;
  }
}

function drumTail(st: Style): string {
  return (st.drums.lpf ? `.lpf(${st.drums.lpf})` : '') + st.drums.extra;
}

/**
 * Übersetzt den Grid-Zustand in ein Strudel-Programm.
 * Es entsteht ausschließlich Code aus validierten Whitelist-Tokens und den
 * Stil-Presets — das Grid ist die einzige Zuschauer-Quelle, nie roher Text.
 *
 * Klangkonzept: Drums aus einer Bank mit Swing, Zuschauer-Noten werden auf
 * eine wandernde Skala quantisiert und mit Timbres pro Autor gespielt; ein
 * Grundton-Drone hält den Raum, auch wenn das Grid leer ist.
 */
export function gridToStrudel(state: GridState): string {
  const styleId = state.style ?? DEFAULT_STYLE;
  const st = STYLES[styleId];
  const journeyScales = `<${st.journey.map((j) => j.scale).join(' ')}>/${SCALE_BARS}`;
  const journeyDrone = `<${st.journey.map((j) => j.drone).join(' ')}>/${SCALE_BARS}`;
  const layers: string[] = [];

  // Drone: die Entität summt — Grundton-Akkord, folgt der Skalenreise.
  layers.push(
    `  note("${journeyDrone}").s("${st.drone.s}")\n` +
      `    .gain(${st.drone.gain}).attack(1.5).release(2).lpf(${st.drone.lpf}).room(.7).size(.9)`,
  );

  // Solo: nur die Zellen des Solisten spielen voll; fremde Drums laufen
  // gedämpft als Bett weiter, fremde Melodien schweigen.
  const soloist = state.solo?.user ?? null;
  const own = (cells: (Cell | null)[]) =>
    soloist ? cells.map((c) => (c && c.user === soloist ? c : null)) : cells;
  const foreign = (cells: (Cell | null)[]) =>
    cells.map((c) => (c && c.user !== soloist ? c : null));

  for (let row = 0; row <= FX_ROW; row++) {
    const cells = state.cells[row];
    if (!rowActive(cells)) continue;
    const mine = own(cells);
    if (rowActive(mine)) {
      layers.push(
        `  s("${rowTokens(mine, (c) => c.token)}").bank("${st.bank}")${drumFlavor(row, st)}${drumTail(st)}`,
      );
    }
    if (soloist && rowActive(foreign(cells))) {
      layers.push(
        `  s("${rowTokens(foreign(cells), (c) => c.token)}").bank("${st.bank}").gain(.25).lpf(700)`,
      );
    }
  }

  const m = st.melodic;
  for (let row = FIRST_MELODIC_ROW; row < state.cells.length; row++) {
    const cells = own(state.cells[row]);
    if (!rowActive(cells)) continue;
    const notes = rowTokens(cells, (c) => c.token);
    const synths = rowTokens(cells, (c) => voiceFor(c.user, styleId).synth);
    const releases = rowTokens(cells, (c) => String(voiceFor(c.user, styleId).release));
    layers.push(
      `  note("${notes}").scale("${journeyScales}")\n` +
        `    .s("${synths}")\n` +
        `    .release("${releases}").gain(${m.gain})\n` +
        `    .lpf(perlin.range(${m.lpf[0]}, ${m.lpf[1]}).slow(12))${m.lpq ? `.lpq(${m.lpq})` : ''}${m.extra}\n` +
        `    .room(${m.room}).size(${m.size}).delay(${m.delay}).delaysync(3/16).delayfeedback(${m.feedback})\n` +
        `    .sometimesBy(.1, x => x.add(note(12)))\n` +
        `    .lastOf(${PHRASE_BARS}, x => x.degradeBy(.35))`,
    );
  }

  const cps = `setcps(${state.bpm}/60/4)`;
  const swing = st.swing ? `.swingBy(${st.swing}, 4)` : '';
  return `${cps}\nstack(\n${layers.join(',\n')}\n)${swing}`;
}
