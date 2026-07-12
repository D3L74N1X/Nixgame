import { FIRST_MELODIC_ROW, FX_ROW, GRID_COLS } from './constants.js';
import type { GridState } from './types.js';
import { voiceFor } from './voice.js';

/**
 * Übersetzt den Grid-Zustand in ein Strudel-Programm.
 * Es entsteht ausschließlich Code aus validierten Whitelist-Tokens —
 * das Grid ist die einzige Quelle, nie roher Zuschauertext.
 */
export function gridToStrudel(state: GridState): string {
  const layers: string[] = [];

  for (let row = 0; row <= FX_ROW; row++) {
    const tokens: string[] = [];
    let active = false;
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = state.cells[row][col];
      tokens.push(cell ? cell.token : '~');
      if (cell) active = true;
    }
    if (active) {
      layers.push(`  s("${tokens.join(' ')}").gain(0.9)`);
    }
  }

  for (let row = FIRST_MELODIC_ROW; row < state.cells.length; row++) {
    const notes: string[] = [];
    const synths: string[] = [];
    let active = false;
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = state.cells[row][col];
      notes.push(cell ? cell.token : '~');
      synths.push(cell ? voiceFor(cell.user).synth : '~');
      if (cell) active = true;
    }
    if (active) {
      layers.push(
        `  note("${notes.join(' ')}").s("${synths.join(' ')}").gain(0.6).release(0.1)`,
      );
    }
  }

  const cps = `setcps(${state.bpm}/60/4)`;
  if (layers.length === 0) return `${cps}\nsilence`;
  return `${cps}\nstack(\n${layers.join(',\n')}\n)`;
}
