import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  BPM_COOLDOWN_MS,
  DECAY_AFTER_MS,
  DEFAULT_BPM,
  FIRST_MELODIC_ROW,
  GRID_COLS,
  GRID_ROWS,
  isValidToken,
  parseCommand,
  rowForSound,
  type Cell,
  type Command,
  type GridState,
  type ServerMessage,
} from '@nixgame/shared';

function emptyGrid(): (Cell | null)[][] {
  return Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => null),
  );
}

export class GridStore {
  state: GridState = { bpm: DEFAULT_BPM, cells: emptyGrid() };
  private lastBpmChange = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private persistPath?: string) {
    if (persistPath) this.load(persistPath);
  }

  private load(path: string) {
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8')) as GridState;
      if (
        Array.isArray(raw.cells) &&
        raw.cells.length === GRID_ROWS &&
        raw.cells.every((r) => Array.isArray(r) && r.length === GRID_COLS)
      ) {
        // Tokens, die nach einer Whitelist-Änderung ungültig wurden, verwerfen.
        let dropped = 0;
        const now = Date.now();
        raw.cells.forEach((row, r) =>
          row.forEach((cell, c) => {
            if (cell && !isValidToken(r, cell.token)) {
              row[c] = null;
              dropped++;
            } else if (cell) {
              cell.since ??= now;
            }
          }),
        );
        this.state = { bpm: raw.bpm ?? DEFAULT_BPM, cells: raw.cells };
        console.log(`[store] Zustand geladen aus ${path}${dropped ? ` (${dropped} ungültige Zellen verworfen)` : ''}`);
      }
    } catch {
      // kein persistierter Zustand — frisches Grid
    }
  }

  private scheduleSave() {
    if (!this.persistPath || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        mkdirSync(dirname(this.persistPath!), { recursive: true });
        writeFileSync(this.persistPath!, JSON.stringify(this.state));
      } catch (e) {
        console.warn('[store] Persistieren fehlgeschlagen:', e);
      }
    }, 1000);
  }

  /** Wendet eine Chat-Zeile an und liefert die Broadcast-Nachrichten. */
  handleChat(user: string, text: string): ServerMessage[] {
    const cmd = parseCommand(text);
    if (!cmd) return [];
    return this.apply(user, cmd);
  }

  apply(user: string, cmd: Command): ServerMessage[] {
    switch (cmd.type) {
      case 'drum':
        return this.setCell(user, rowForSound(cmd.sound), cmd.col, cmd.sound);
      case 'cell':
        return this.setCell(user, cmd.row, cmd.col, cmd.token);
      case 'note': {
        // Erste freie melodische Zeile; ersatzweise eine eigene Zelle ersetzen.
        let target = -1;
        for (let row = FIRST_MELODIC_ROW; row < GRID_ROWS; row++) {
          if (!this.state.cells[row][cmd.col]) {
            target = row;
            break;
          }
        }
        if (target < 0) {
          for (let row = FIRST_MELODIC_ROW; row < GRID_ROWS; row++) {
            if (this.state.cells[row][cmd.col]?.user === user) {
              target = row;
              break;
            }
          }
        }
        if (target < 0) {
          return [
            { type: 'ticker', text: `Spalte ${cmd.col + 1} ist voll`, user },
          ];
        }
        return this.setCell(user, target, cmd.col, cmd.note);
      }
      case 'clear': {
        const cell = this.state.cells[cmd.row][cmd.col];
        if (!cell) return [];
        if (cell.user !== user) {
          return [
            { type: 'ticker', text: `Zelle gehört @${cell.user}`, user },
          ];
        }
        this.state.cells[cmd.row][cmd.col] = null;
        this.scheduleSave();
        return [{ type: 'cell', row: cmd.row, col: cmd.col, cell: null }];
      }
      case 'bpm': {
        const now = Date.now();
        if (now - this.lastBpmChange < BPM_COOLDOWN_MS) {
          return [{ type: 'ticker', text: 'BPM-Cooldown aktiv', user }];
        }
        this.lastBpmChange = now;
        this.state.bpm = cmd.bpm;
        this.scheduleSave();
        return [{ type: 'bpm', bpm: cmd.bpm, user }];
      }
    }
  }

  private setCell(
    user: string,
    row: number,
    col: number,
    token: string,
  ): ServerMessage[] {
    const existing = this.state.cells[row][col];
    if (existing && existing.user !== user) {
      return [{ type: 'ticker', text: `Zelle gehört @${existing.user}`, user }];
    }
    const cell: Cell = { user, token, since: Date.now() };
    this.state.cells[row][col] = cell;
    this.scheduleSave();
    return [{ type: 'cell', row, col, cell }];
  }

  /**
   * Verfall: eine zufällige Zelle, die länger als DECAY_AFTER_MS unberührt
   * ist, bröckelt weg. Liefert die Broadcast-Nachrichten (leer, wenn nichts
   * alt genug ist).
   */
  decay(now = Date.now()): ServerMessage[] {
    const stale: { row: number; col: number; cell: Cell }[] = [];
    this.state.cells.forEach((cells, row) =>
      cells.forEach((cell, col) => {
        if (cell && now - (cell.since ?? 0) > DECAY_AFTER_MS) stale.push({ row, col, cell });
      }),
    );
    if (stale.length === 0) return [];
    const { row, col, cell } = stale[Math.floor(Math.random() * stale.length)];
    this.state.cells[row][col] = null;
    this.scheduleSave();
    return [
      { type: 'cell', row, col, cell: null },
      { type: 'ticker', text: `${cell.token} in Spalte ${col + 1} verfällt`, user: cell.user },
    ];
  }
}
