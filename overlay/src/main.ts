import './style.css';
import {
  GRID_COLS,
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
      regen();
      break;
    case 'cell':
      if (!grid) break;
      grid.cells[msg.row][msg.col] = msg.cell;
      if (msg.cell) {
        hue = voiceFor(msg.cell.user).hue;
        hud.addLine(`setzt ${msg.cell.token} (Spalte ${msg.col + 1})`, msg.cell.user);
      }
      regen();
      break;
    case 'bpm':
      if (grid) grid.bpm = msg.bpm;
      clock.setBpm(msg.bpm);
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
      hue = voiceFor(msg.user).hue;
      hud.addLine(`🎁 ${msg.giftName} (${msg.value} 💎)`, msg.user);
      break;
  }
}

const params = new URLSearchParams(location.search);
const wsUrl =
  params.get('ws') ?? `ws://${location.hostname || 'localhost'}:${WS_PORT_DEFAULT}`;
connectWS(wsUrl, onMessage, (jpeg) => entity.pushFrame(jpeg));

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

  // Energie fällt zur Basis zurück, Puls klingt schnell ab
  energy = ENERGY_BASE + (energy - ENERGY_BASE) * Math.exp(-dt / 2.5);
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
    hud.setCredit(users);
    if (users.length > 0 && armed) pulse = Math.max(pulse, 0.8);
  }

  gridRenderer.render(grid, stepFloat, pulse);
  entity.render(now / 1000, energy, pulse, hue, stepFloat / GRID_COLS);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
