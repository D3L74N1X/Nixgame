import {
  GRID_COLS,
  GRID_ROWS,
  ROW_LABELS,
  voiceFor,
  type GridState,
} from '@nixgame/shared';

const LABEL_W = 44;

/** Canvas-2D-Renderer für das Sequencer-Territorium samt Playhead. */
export class GridRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
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
    const step = Math.floor(stepFloat);

    // Hintergrundfläche des Territoriums
    ctx.fillStyle = 'rgba(8, 10, 16, 0.55)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 10);
    ctx.fill();

    // Zeilen-Label
    ctx.font = '12px ui-monospace, monospace';
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
          ctx.fillStyle = `hsla(${hue}, 85%, ${hot ? 68 : 52}%, ${hot ? 0.95 : 0.7})`;
          ctx.beginPath();
          ctx.roundRect(x + 2, y + 2, cw - 4, ch - 4, 4);
          ctx.fill();
          if (hot) {
            ctx.shadowColor = `hsl(${hue} 90% 70%)`;
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.font = `${Math.min(11, ch * 0.4)}px ui-monospace, monospace`;
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
