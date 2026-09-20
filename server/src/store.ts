import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  BPM_COOLDOWN_MS,
  DECAY_AFTER_MS,
  GIFT_SEAL_MIN,
  GIFT_SOLO_MIN,
  GIFT_STEAL_MIN,
  SEAL_MS,
  SOLO_MS,
  STEAL_MAX_CREDITS,
  STEAL_TTL_MS,
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
  /** Diebstahl-Guthaben pro User (flüchtig, verfällt nach STEAL_TTL_MS). */
  private steals = new Map<string, { credits: number; until: number }>();

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
        const solo = raw.solo && raw.solo.until > now ? raw.solo : null;
        this.state = { bpm: raw.bpm ?? DEFAULT_BPM, cells: raw.cells, solo };
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
    const msgs: ServerMessage[] = [];
    if (existing && existing.user !== user) {
      if (!this.consumeSteal(user)) {
        return [{ type: 'ticker', text: `Zelle gehört @${existing.user}`, user }];
      }
      msgs.push({ type: 'ticker', text: `stiehlt ${existing.token} von @${existing.user} 🗡️`, user });
    }
    const cell: Cell = { user, token, since: Date.now() };
    // Eigene Versiegelung bleibt beim Überschreiben erhalten.
    if (existing?.user === user && existing.sealedUntil) cell.sealedUntil = existing.sealedUntil;
    this.state.cells[row][col] = cell;
    this.scheduleSave();
    msgs.push({ type: 'cell', row, col, cell });
    return msgs;
  }

  private consumeSteal(user: string): boolean {
    const s = this.steals.get(user);
    if (!s || s.until < Date.now() || s.credits <= 0) {
      this.steals.delete(user);
      return false;
    }
    s.credits--;
    if (s.credits === 0) this.steals.delete(user);
    return true;
  }

  /**
   * Gift-Eskalation, kumulativ nach Diamantwert: versiegeln → Diebstahl-
   * Guthaben → Solo. Liefert die Broadcast-Nachrichten.
   */
  applyGift(user: string, value: number): ServerMessage[] {
    const now = Date.now();
    const msgs: ServerMessage[] = [];

    if (value >= GIFT_SEAL_MIN) {
      let sealed = 0;
      for (const row of this.state.cells) {
        for (const cell of row) {
          if (cell?.user === user) {
            cell.sealedUntil = now + SEAL_MS;
            sealed++;
          }
        }
      }
      if (sealed > 0) {
        const plural = sealed > 1 ? 'n' : '';
        msgs.push({ type: 'ticker', text: `versiegelt ${sealed} Zelle${plural} für ${SEAL_MS / 60_000} min 🔒`, user });
        this.scheduleSave();
      }
    }

    if (value >= GIFT_STEAL_MIN) {
      const prev = this.steals.get(user);
      const credits = Math.min(
        STEAL_MAX_CREDITS,
        (prev && prev.until > now ? prev.credits : 0) + Math.floor(value / GIFT_STEAL_MIN),
      );
      this.steals.set(user, { credits, until: now + STEAL_TTL_MS });
      const plural = credits > 1 ? 'n' : '';
      msgs.push({
        type: 'ticker',
        text: `darf ${credits} fremde Zelle${plural} stehlen — einfach draufsetzen 🗡️`,
        user,
      });
    }

    if (value >= GIFT_SOLO_MIN) {
      this.state.solo = { user, until: now + SOLO_MS };
      this.scheduleSave();
      msgs.push({ type: 'solo', solo: this.state.solo });
      msgs.push({ type: 'ticker', text: `SOLO — ${SOLO_MS / 1000} s gehört die Bühne dir ⚡`, user });
    }

    return msgs;
  }

  /** Solo beenden, falls abgelaufen. Liefert die Broadcast-Nachricht oder nichts. */
  expireSolo(now = Date.now()): ServerMessage[] {
    if (!this.state.solo || this.state.solo.until > now) return [];
    this.state.solo = null;
    this.scheduleSave();
    return [{ type: 'solo', solo: null }];
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
        if (!cell) return;
        if (cell.sealedUntil && cell.sealedUntil > now) return; // versiegelt
        if (now - (cell.since ?? 0) > DECAY_AFTER_MS) stale.push({ row, col, cell });
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
