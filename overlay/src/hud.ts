import { voiceFor } from '@nixgame/shared';

const TICKER_MAX = 6;
const TICKER_TTL_MS = 8000;

export class Hud {
  private ticker = document.getElementById('ticker')!;
  private credit = document.getElementById('credit')!;
  private lastCredit = '';

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
  setCredit(users: string[]): void {
    const key = users.join(',');
    if (key === this.lastCredit) return;
    this.lastCredit = key;
    this.credit.replaceChildren();
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
