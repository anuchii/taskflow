// ============================================================
// components/PriorityInfoPopup.ts
// ============================================================

// Diese Klasse ist bewusst zustandslos und DOM-unabhängig in ihrer Logik,
// damit sie in Angular als eigenständige Komponente ohne Adapter-Schicht
// übernommen werden kann (Dependency nur: ein Host-Element via mount()).
export class PriorityInfoPopup {
  private overlay: HTMLElement | null = null;

  getIconHtml(): string {
    return `<button class="info-trigger" id="btn-priority-info" aria-label="Warum ist Priorisierung wichtig?">ℹ</button>`;
  }

  mount(host: HTMLElement): void {
    const trigger = host.querySelector<HTMLButtonElement>("#btn-priority-info");
    if (!trigger) return;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openPopup();
    });
  }

  private openPopup(): void {
    if (this.overlay) return;

    this.overlay = document.createElement("div");
    this.overlay.className = "info-popup-overlay";
    this.overlay.innerHTML = `
      <div class="info-popup-card" role="dialog" aria-modal="true" aria-label="Priorisierung erklärt">
        <button class="info-popup-close" aria-label="Schließen">✕</button>
        <div class="info-popup-icon-wrap">
          <span class="info-popup-icon">📋</span>
        </div>
        <h2 class="info-popup-title">Warum ist Priorisierung so wichtig?</h2>
        <p class="info-popup-intro">
          Als Student oder Schüler jonglierst du täglich mit vielen Aufgaben.
          Priorisierung hilft dir, den Kopf frei zu behalten und das Richtige zuerst zu erledigen.
        </p>
        <ol class="info-popup-list">
          <li><div>
            <strong>Reihenfolge bestimmen</strong>
            <p>Nicht alle Aufgaben sind gleich dringend. Durch Prioritäten erkennst du sofort, was heute wirklich zählt – und was warten kann.</p>
          </div></li>
          <li><div>
            <strong>Große Aufgaben zerlegen</strong>
            <p>Komplexe Themen (z.&thinsp;B. eine Hausarbeit) lassen sich in kleine, konkrete Schritte aufteilen. Das macht sie weniger überwältigend.</p>
          </div></li>
          <li><div>
            <strong>Fokus statt Hektik</strong>
            <p>Ohne Priorisierung springt man zwischen Aufgaben hin und her und verliert Zeit. Mit klarer Reihenfolge arbeitest du konzentrierter und weniger gestresst.</p>
          </div></li>
          <li><div>
            <strong>Bessere Ergebnisse</strong>
            <p>Wer zuerst das Wichtigste erledigt, liefert bei kritischen Abgaben bessere Qualität – statt am Ende zu hetzen.</p>
          </div></li>
        </ol>
        <p class="info-popup-summary">
          Kurz gesagt: Priorisierung ist dein Werkzeug, um aus vielen Aufgaben eine klare Handlungsliste zu machen – damit du dich auf das Wesentliche konzentrieren kannst.
        </p>
      </div>`;

    document.body.appendChild(this.overlay);

    // Schließen via Hintergrund-Klick oder ✕-Button
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.closePopup();
    });
    this.overlay.querySelector(".info-popup-close")!.addEventListener("click", () => this.closePopup());

    document.addEventListener("keydown", this.handleKeydown);
  }

  private closePopup(): void {
    this.overlay?.remove();
    this.overlay = null;
    document.removeEventListener("keydown", this.handleKeydown);
  }

  // Arrow Function, damit `this` beim removeEventListener korrekt gebunden bleibt
  private readonly handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") this.closePopup();
  };
}
