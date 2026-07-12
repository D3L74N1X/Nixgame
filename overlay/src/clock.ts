import { DEFAULT_BPM, GRID_COLS } from '@nixgame/shared';

/**
 * Visueller Playhead-Takt. Strudel hat seinen eigenen Scheduler; diese Uhr
 * läuft mit derselben nominellen Geschwindigkeit (16 Steps = 1 Cycle) und
 * dient nur der Anzeige — leichte Drift ist akzeptabel und wird bei jedem
 * BPM-Wechsel neu verankert.
 */
export class StepClock {
  private epoch = performance.now();
  private _bpm = DEFAULT_BPM;

  get bpm(): number {
    return this._bpm;
  }

  /** Ändert das Tempo phasenerhaltend, damit der Playhead nicht springt. */
  setBpm(bpm: number): void {
    const s = this.stepFloat();
    this._bpm = bpm;
    this.epoch = performance.now() - (s / this.stepsPerSecond()) * 1000;
  }

  restart(): void {
    this.epoch = performance.now();
  }

  private stepsPerSecond(): number {
    return (this._bpm / 60) * 4;
  }

  stepFloat(): number {
    const t = (performance.now() - this.epoch) / 1000;
    return ((t * this.stepsPerSecond()) % GRID_COLS + GRID_COLS) % GRID_COLS;
  }

  step(): number {
    return Math.floor(this.stepFloat());
  }
}
