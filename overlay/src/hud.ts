import { voiceFor } from '@nixgame/shared';

const TICKER_MAX = 6;
const TICKER_TTL_MS = 8000;
const HINT_INTERVAL_MS = 12_000;

/**
 * Rotierende Hinweise für Zuschauer. `Backticks` werden als Kommando
 * hervorgehoben. Die ersten STARTER_HINTS erklären den Einstieg und laufen
 * exklusiv, solange das Grid leer ist.
 */
const HINTS = [
  'Du bist der Creator. Schreib in den Chat: `!note e4 5` → deine Note in Spalte 5',
  '`!drum bd 1` → Kick auf die Eins. Sounds: bd sd hh oh · cp rim lt mt ht cr rd',
  'Spalten 1–16 laufen von links nach rechts. Freie Zellen gehören dem, der zuerst kommt.',
  'Deine Zellen leuchten in deiner Farbe und klingen mit deiner Stimme.',
  '`!bpm 128` → Tempo für alle (60–200)',
  'Was 4 Minuten unberührt bleibt, verfällt. Setz es neu, um es zu halten.',
  '`!bass c2 5` → Bass in Spalte 5. Solange niemand Bass schreibt, brummt die Entität ihren eigenen.',
  '`!clear 5 7` → eigene Zelle räumen · `!cell 5 7 e4` → gezielt setzen',
  'Likes geben der Entität Energie. Gifts lassen sie pulsieren.',
  'Noten: c2 bis b5, auch mit # und b. Was du tippst, wird in die Tonart gebogen.',
  'Jedes Gift 🔒 versiegelt deine Zellen 10 min gegen den Verfall.',
  'Gift ab 100 💎 🗡️ → du darfst fremde Zellen übernehmen: einfach draufsetzen.',
  'Gift ab 1000 💎 ⚡ → 60 s SOLO: nur deine Zellen spielen, die Entität trägt deine Farbe.',
];
const STARTER_HINTS = 2;

export class Hud {
  private ticker = document.getElementById('ticker')!;
  private credit = document.getElementById('credit')!;
  private hint = document.getElementById('hint')!;
  private lastCredit = '';
  private hintIndex = -1;
  gridEmpty = true;

  constructor() {
    this.nextHint();
    setInterval(() => this.nextHint(), HINT_INTERVAL_MS);
  }

  private nextHint(): void {
    const pool = this.gridEmpty ? STARTER_HINTS : HINTS.length;
    this.hintIndex = (this.hintIndex + 1) % pool;
    const el = document.createElement('div');
    el.className = 'hint-line';
    // `Kommando` → <code>
    HINTS[this.hintIndex].split('`').forEach((part, i) => {
      if (!part) return;
      const node = i % 2 ? document.createElement('code') : document.createTextNode(part);
      if (i % 2) node.textContent = part;
      el.appendChild(node);
    });
    this.hint.replaceChildren(el);
  }

  addLine(text: string, user?: string): void {
    const el = document.createElement('div');
    el.className = 'ticker-line';
    if (user) {
      const hue = voiceFor(user).hue;
      const name = document.createElement('span');
      name.textContent = `@${user} `;
      name.style.color = `hsl(${hue} 90% 70%)`;
      el.appendChild(name);
    }
    el.appendChild(document.createTextNode(text));
    this.ticker.prepend(el);
    while (this.ticker.children.length > TICKER_MAX) {
      this.ticker.lastElementChild?.remove();
    }
    setTimeout(() => el.remove(), TICKER_TTL_MS);
  }

  /** "jetzt hörbar: …" — die Autorschafts-Anzeige unterm Playhead. */
  setCredit(users: string[], soloist: string | null = null): void {
    const key = `${soloist ?? ''}|${users.join(',')}`;
    if (key === this.lastCredit) return;
    this.lastCredit = key;
    this.credit.replaceChildren();
    this.credit.classList.toggle('solo', soloist !== null);
    if (soloist) {
      const span = document.createElement('span');
      span.textContent = `⚡ SOLO @${soloist}`;
      span.style.color = `hsl(${voiceFor(soloist).hue} 90% 70%)`;
      this.credit.appendChild(span);
      return;
    }
    if (users.length === 0) return;
    this.credit.appendChild(document.createTextNode('jetzt hörbar: '));
    users.forEach((u, i) => {
      const span = document.createElement('span');
      span.textContent = `@${u}`;
      span.style.color = `hsl(${voiceFor(u).hue} 90% 70%)`;
      this.credit.appendChild(span);
      if (i < users.length - 1) this.credit.appendChild(document.createTextNode(' · '));
    });
  }
}
