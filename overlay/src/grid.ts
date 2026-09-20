import {
  GRID_COLS,
  GRID_ROWS,
  ROW_LABELS,
  voiceFor,
  type GridState,
} from '@nixgame/shared';

const LABEL_W = 44;
/** Zeilen-Label und Zell-Text skalieren mit der Zellhöhe (Hochformat: grössere Zellen). */
const labelFont = (ch: number) => `${Math.round(Math.min(18, Math.max(11, ch * 0.34)))}px ui-monospace, monospace`;
const cellFont = (cw: number, ch: number) =>
  `${Math.round(Math.max(10, Math.min(cw * 0.4, ch * 0.42)))}px ui-monospace, monospace`;

/** Canvas-2D-Renderer für das Sequencer-Territorium samt Playhead. */
export class GridRenderer {
  private ctx: CanvasRenderingContext2D;
  /** Layout des letzten Frames (CSS-px) für hitTest(). */
  private layout = { gx: LABEL_W, cw: 0, ch: 0 };

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Zelle unter einem Mauspunkt (relativ zum Canvas, CSS-px) oder null. */
  hitTest(x: number, y: number): { row: number; col: number } | null {
    const { gx, cw, ch } = this.layout;
    if (!cw || !ch) return null;
    const col = Math.floor((x - gx) / cw);
    const row = Math.floor((y - 5) / ch);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
    return { row, col };
  }

  private fit(): { w: number; h: number } {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  render(state: GridState | null, stepFloat: number, pulse: number): void {
    const { w, h } = this.fit();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    if (!state) return;

    const gx = LABEL_W;
    const gw = w - gx - 8;
    const gh = h - 10;
    const cw = gw / GRID_COLS;
    const ch = gh / GRID_ROWS;
    this.layout = { gx, cw, ch };
    const step = Math.floor(stepFloat);
    const now = Date.now();
    const soloist = state.solo?.user ?? null;

    // Hintergrundfläche des Territoriums
    ctx.fillStyle = 'rgba(8, 10, 16, 0.55)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 10);
    ctx.fill();

    // Zeilen-Label
    ctx.font = labelFont(ch);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let row = 0; row < GRID_ROWS; row++) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(ROW_LABELS[row], gx / 2, 5 + row * ch + ch / 2);
    }

    // Playhead-Spalte
    const px = gx + step * cw;
    ctx.fillStyle = `rgba(255,255,255,${0.06 + pulse * 0.1})`;
    ctx.fillRect(px, 5, cw, gh);

    // Zellen
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x = gx + col * cw;
        const y = 5 + row * ch;
        const cell = state.cells[row][col];
        if (cell) {
          const { hue } = voiceFor(cell.user);
          const hot = col === step;
          // Im Solo verblassen fremde Zellen
          const muted = soloist !== null && cell.user !== soloist;
          const alpha = muted ? 0.18 : hot ? 0.95 : 0.7;
          ctx.fillStyle = `hsla(${hue}, 85%, ${hot ? 68 : 52}%, ${alpha})`;
          ctx.beginPath();
          ctx.roundRect(x + 2, y + 2, cw - 4, ch - 4, 4);
          ctx.fill();
          if (hot && !muted) {
            ctx.shadowColor = `hsl(${hue} 90% 70%)`;
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          // Versiegelte Zellen tragen einen hellen Ring
          if (cell.sealedUntil && cell.sealedUntil > now) {
            ctx.strokeStyle = `rgba(255,255,255,${muted ? 0.25 : 0.85})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x + 2, y + 2, cw - 4, ch - 4, 4);
            ctx.stroke();
            ctx.lineWidth = 1;
          }
          ctx.fillStyle = `rgba(0,0,0,${muted ? 0.35 : 0.75})`;
          ctx.font = cellFont(cw, ch);
          ctx.fillText(cell.token, x + cw / 2, y + ch / 2);
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
        }
      }
    }

    // Feine Playhead-Linie (subpixelgenau)
    const lx = gx + stepFloat * cw;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx, 5);
    ctx.lineTo(lx, 5 + gh);
    ctx.stroke();
  }
}
