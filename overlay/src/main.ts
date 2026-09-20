import './style.css';
import {
  DEFAULT_STYLE,
  FIRST_MELODIC_ROW,
  FX_ROW,
  FX_SOUNDS,
  GRID_COLS,
  PERC_FIXED_SOUNDS,
  STYLE_IDS,
  STYLES,
  WS_PORT_DEFAULT,
  gridToStrudel,
  voiceFor,
  type GridState,
  type ServerMessage,
} from '@nixgame/shared';
import { connectWS } from './ws.js';
import { StepClock } from './clock.js';
import { GridRenderer } from './grid.js';
import { Hud } from './hud.js';
import { StrudelBridge } from './strudel.js';
import { Entity } from './entity/entity.js';

const ENERGY_BASE = 0.15;

let grid: GridState | null = null;
let energy = ENERGY_BASE;
let pulse = 0;
let hue = 190; // Tint der Entität: Stimme des letzten Autors
let armed = false;

const clock = new StepClock();
const hud = new Hud();
const gridRenderer = new GridRenderer(document.getElementById('grid') as HTMLCanvasElement);
const strudel = new StrudelBridge(document.getElementById('repl')!);
const entity = new Entity(document.getElementById('entity') as HTMLCanvasElement);

// --- Code-Regeneration (debounced, damit Kommando-Schübe nur einmal evaluieren)
let regenTimer: ReturnType<typeof setTimeout> | null = null;
function regen(): void {
  if (regenTimer) return;
  regenTimer = setTimeout(() => {
    regenTimer = null;
    if (grid) strudel.setAndEval(gridToStrudel(grid));
  }, 400);
}

// --- Server-Nachrichten
function onMessage(msg: ServerMessage): void {
  switch (msg.type) {
    case 'state':
      grid = msg.state;
      clock.setBpm(grid.bpm);
      updateTools();
      regen();
      break;
    case 'cell':
      if (!grid) break;
      grid.cells[msg.row][msg.col] = msg.cell;
      if (msg.cell) {
        if (!grid.solo) hue = voiceFor(msg.cell.user).hue;
        hud.addLine(`setzt ${msg.cell.token} (Spalte ${msg.col + 1})`, msg.cell.user);
      }
      regen();
      break;
    case 'solo':
      if (!grid) break;
      grid.solo = msg.solo;
      if (msg.solo) {
        hue = voiceFor(msg.solo.user).hue;
        energy = 1;
        pulse = 1;
      }
      regen();
      break;
    case 'bpm':
      if (grid) grid.bpm = msg.bpm;
      clock.setBpm(msg.bpm);
      updateTools();
      hud.addLine(`dreht das Tempo auf ${msg.bpm} BPM`, msg.user);
      regen();
      break;
    case 'ticker':
      hud.addLine(msg.text, msg.user);
      break;
    case 'like':
      energy = Math.min(1, energy + msg.count * 0.012);
      break;
    case 'gift':
      energy = Math.min(1, energy + Math.min(0.6, msg.value / 300));
      pulse = 1;
      if (!grid?.solo) hue = voiceFor(msg.user).hue;
      hud.addLine(`🎁 ${msg.giftName} (${msg.value} 💎)`, msg.user);
      break;
  }
}

const params = new URLSearchParams(location.search);
const wsUrl =
  params.get('ws') ?? `ws://${location.hostname || 'localhost'}:${WS_PORT_DEFAULT}`;
const link = connectWS(wsUrl, onMessage, (jpeg) => entity.pushFrame(jpeg));

// --- Streamer-Eingriffe (OBS „Interagieren“): Grid klickbar, Toolbar bei Mausbewegung
const NOTE_CYCLE = (() => {
  const names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
  const out: string[] = [];
  for (let o = 2; o <= 5; o++) for (const n of names) out.push(`${n}${o}`);
  return out;
})();
let lastNote = 'c3';

function stepToken(row: number, token: string, dir: 1 | -1): string {
  if (row >= FIRST_MELODIC_ROW) {
    const i = NOTE_CYCLE.indexOf(token);
    return NOTE_CYCLE[(i < 0 ? 12 : i + dir + NOTE_CYCLE.length) % NOTE_CYCLE.length];
  }
  if (row === FX_ROW) {
    const i = FX_SOUNDS.indexOf(token as (typeof FX_SOUNDS)[number]);
    return FX_SOUNDS[(i + dir + FX_SOUNDS.length) % FX_SOUNDS.length];
  }
  return token;
}

const gridCanvas = document.getElementById('grid') as HTMLCanvasElement;
function cellAt(e: MouseEvent) {
  const r = gridCanvas.getBoundingClientRect();
  return gridRenderer.hitTest(e.clientX - r.left, e.clientY - r.top);
}

gridCanvas.addEventListener('click', (e) => {
  const hit = cellAt(e);
  if (!hit || !grid) return;
  const cell = grid.cells[hit.row][hit.col];
  let token: string;
  if (cell) {
    token = stepToken(hit.row, cell.token, 1);
    if (token === cell.token) return; // feste Drum-Zeile: Klick ändert nichts
  } else if (hit.row < FX_ROW) {
    token = PERC_FIXED_SOUNDS[hit.row];
  } else if (hit.row === FX_ROW) {
    token = FX_SOUNDS[0];
  } else {
    token = lastNote;
  }
  if (hit.row >= FIRST_MELODIC_ROW) lastNote = token;
  link.send({ type: 'cmd', text: `!cell ${hit.col + 1} ${hit.row + 1} ${token}` });
});

gridCanvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const hit = cellAt(e);
  if (!hit || !grid?.cells[hit.row][hit.col]) return;
  link.send({ type: 'cmd', text: `!clear ${hit.col + 1} ${hit.row + 1}` });
});

gridCanvas.addEventListener('wheel', (e) => {
  const hit = cellAt(e);
  if (!hit || !grid) return;
  const cell = grid.cells[hit.row][hit.col];
  if (!cell) return;
  e.preventDefault();
  const token = stepToken(hit.row, cell.token, e.deltaY < 0 ? 1 : -1);
  if (token === cell.token) return;
  if (hit.row >= FIRST_MELODIC_ROW) lastNote = token;
  link.send({ type: 'cmd', text: `!cell ${hit.col + 1} ${hit.row + 1} ${token}` });
}, { passive: false });

const tools = document.getElementById('tools')!;
const toolsStyles = document.getElementById('tools-styles')!;
const toolsBpm = document.getElementById('tools-bpm')!;
for (const id of STYLE_IDS) {
  const b = document.createElement('button');
  b.textContent = STYLES[id].label;
  b.dataset.style = id;
  b.addEventListener('click', () => link.send({ type: 'style', style: id }));
  toolsStyles.appendChild(b);
}
tools.querySelectorAll<HTMLButtonElement>('button[data-bpm]').forEach((b) =>
  b.addEventListener('click', () => {
    if (grid) link.send({ type: 'bpm', bpm: grid.bpm + Number(b.dataset.bpm) });
  }),
);
const clearBtn = document.getElementById('tools-clear') as HTMLButtonElement;
clearBtn.classList.add('danger');
clearBtn.addEventListener('click', () => {
  // Zwei Klicks innerhalb von 3 s — ein Fehlklick räumt nicht alles ab.
  if (clearBtn.dataset.armed) {
    delete clearBtn.dataset.armed;
    clearBtn.textContent = 'Territorium räumen';
    link.send({ type: 'clearAll' });
  } else {
    clearBtn.dataset.armed = '1';
    clearBtn.textContent = 'Wirklich? Nochmal klicken';
    setTimeout(() => {
      delete clearBtn.dataset.armed;
      clearBtn.textContent = 'Territorium räumen';
    }, 3000);
  }
});

function updateTools(): void {
  if (!grid) return;
  toolsBpm.textContent = String(grid.bpm);
  const active = grid.style ?? DEFAULT_STYLE;
  toolsStyles.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
    b.classList.toggle('active', b.dataset.style === active),
  );
}

// Toolbar nur zeigen, während die Maus sich bewegt (Zuschauer sehen sie kurz).
let toolsTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('mousemove', () => {
  tools.hidden = false;
  if (toolsTimer) clearTimeout(toolsTimer);
  toolsTimer = setTimeout(() => (tools.hidden = true), 4000);
});
tools.addEventListener('mouseenter', () => toolsTimer && clearTimeout(toolsTimer));

// --- ARM: Autoplay-Policy verlangt eine User-Geste für Audio & Kamera
const armOverlay = document.getElementById('arm')!;
function arm(): void {
  if (armed) return;
  armed = true;
  armOverlay.remove();
  clock.restart();
  strudel.arm();
  void entity.start();
}
document.getElementById('arm-btn')!.addEventListener('click', arm);

// In OBS (Browser-Source, CEF ohne Autoplay-Sperre) gibt es keine Klick-Geste —
// dort automatisch wecken. `?autostart=1` erzwingt das auch anderswo.
const inObs = 'obsstudio' in window;
if (inObs || params.get('autostart') === '1') arm();

// --- Render-Loop
let lastT = performance.now();
let lastStep = -1;

function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;

  // Energie fällt zur Basis zurück, Puls klingt schnell ab — im Solo bleibt sie hoch
  const floor = grid?.solo ? 0.7 : ENERGY_BASE;
  energy = floor + (energy - floor) * Math.exp(-dt / 2.5);
  pulse *= Math.exp(-dt / 0.15);

  const stepFloat = clock.stepFloat();
  const step = Math.floor(stepFloat);
  if (step !== lastStep && grid) {
    lastStep = step;
    const users: string[] = [];
    for (const row of grid.cells) {
      const cell = row[step];
      if (cell && !users.includes(cell.user)) users.push(cell.user);
    }
    hud.setCredit(users, grid.solo?.user ?? null);
    if (users.length > 0 && armed) pulse = Math.max(pulse, 0.8);
  }

  hud.gridEmpty = !grid || grid.cells.every((row) => row.every((c) => c === null));
  gridRenderer.render(grid, stepFloat, pulse);
  entity.render(now / 1000, energy, pulse, hue, stepFloat / GRID_COLS);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
