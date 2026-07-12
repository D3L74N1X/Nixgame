import '@strudel/repl';

/**
 * Brücke zur <strudel-editor> Web Component. Deren `.editor`-Property
 * (StrudelMirror) erlaubt programmatisches setCode/evaluate — damit
 * "tippt" das Grid seinen eigenen Code sichtbar ins REPL.
 */
export class StrudelBridge {
  private el: HTMLElement;
  private pendingCode: string | null = null;
  private armed = false;

  constructor(container: HTMLElement) {
    this.el = document.createElement('strudel-editor');
    this.el.setAttribute('code', '// warte auf das Territorium …\nsilence');
    container.appendChild(this.el);
  }

  private get mirror(): any {
    return (this.el as any).editor ?? null;
  }

  /** Ab dem ARM-Klick (User-Geste) darf evaluiert werden. */
  arm(): void {
    this.armed = true;
    if (this.pendingCode !== null) {
      const code = this.pendingCode;
      this.pendingCode = null;
      this.setAndEval(code);
    }
  }

  stop(): void {
    try {
      this.mirror?.stop?.();
    } catch (e) {
      console.warn('[strudel] stop fehlgeschlagen:', e);
    }
  }

  setAndEval(code: string): void {
    const m = this.mirror;
    if (!m) {
      // Web Component noch nicht initialisiert — kurz später erneut versuchen
      this.pendingCode = code;
      setTimeout(() => {
        if (this.pendingCode !== null && this.mirror) {
          const c = this.pendingCode;
          this.pendingCode = null;
          this.setAndEval(c);
        }
      }, 500);
      return;
    }
    try {
      m.setCode(code);
      if (this.armed) m.evaluate();
      else this.pendingCode = code;
    } catch (e) {
      console.warn('[strudel] evaluate fehlgeschlagen:', e);
    }
  }
}
