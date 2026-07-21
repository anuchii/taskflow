// ============================================================
// components/SettingsView.ts
// Einstellungen — aktuell nur der Urlaubsmodus, bewusst als
// eigene Ansicht angelegt für zukünftige weitere Optionen.
// ============================================================

import type { VacationService } from "../services/VacationService.js";
import { formatDisplay, today } from "../utils/DateUtils.js";

export class SettingsView {
  constructor(
    private readonly vacationService: VacationService,
    private readonly container: HTMLElement
  ) {}

  async render(): Promise<void> {
    this.container.innerHTML = `<div class="loading">Lädt…</div>`;
    const mode = await this.vacationService.getMode();

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Einstellungen</h1>
          <p class="view-subtitle">Urlaubsmodus &amp; weitere Optionen</p>
        </div>
      </div>

      <div class="settings-card">
        <h2 class="settings-card-title">Urlaubsmodus</h2>
        ${mode?.active ? this.activeStatus(mode) : this.activationForm()}
      </div>
    `;

    if (mode?.active) this.attachEndHandler();
    else this.attachStartHandler();
  }

  // ─── Anzeige: Modus ist aktiv ─────────────────────────────

  private activeStatus(mode: { startDate: string; endDate: string | null }): string {
    const endLabel = mode.endDate ? `bis ${formatDisplay(mode.endDate)}` : "unbegrenzt";
    return `
      <p class="settings-vacation-status">
        🌴 Aktiv seit ${formatDisplay(mode.startDate)} · ${endLabel}
      </p>
      <p class="settings-hint">
        Nicht erledigte Aufgaben werden während dieser Zeit pausiert statt als
        „zu spät" markiert. Ihr Datum verschiebt sich automatisch auf das Ende
        des Urlaubsmodus.
      </p>
      <div class="form-actions" style="justify-content:flex-start;border-top:none;padding-top:0;margin-top:12px;">
        <button class="btn btn-ghost" id="btn-vacation-end">Jetzt beenden</button>
      </div>
    `;
  }

  private attachEndHandler(): void {
    this.container.querySelector("#btn-vacation-end")?.addEventListener("click", async () => {
      const count = await this.vacationService.countAffectedTasks();
      const msg = count > 0
        ? `${count} Aufgabe${count !== 1 ? "n werden" : " wird"} auf heute (${formatDisplay(today())}) verschoben. Fortfahren?`
        : `Urlaubsmodus jetzt beenden?`;
      if (!confirm(msg)) return;
      await this.vacationService.endNow();
      await this.render();
    });
  }

  // ─── Anzeige: Modus ist inaktiv → Formular zum Aktivieren ─

  private activationForm(): string {
    return `
      <p class="settings-hint">
        Im Urlaubsmodus werden nicht erledigte Aufgaben pausiert statt als
        überfällig gezählt. Lege ein Enddatum fest oder aktiviere ihn
        unbegrenzt — du entscheidest bewusst, wie er endet.
      </p>
      <div class="form-group">
        <label>Enddatum</label>
        <div class="settings-vacation-mode-row">
          <label class="settings-radio">
            <input type="radio" name="vacation-mode" value="dated" checked />
            <span>Enddatum festlegen</span>
          </label>
          <label class="settings-radio">
            <input type="radio" name="vacation-mode" value="unlimited" />
            <span>Unbegrenzt</span>
          </label>
        </div>
        <input type="date" id="vacation-end-input" min="${today()}" />
      </div>
      <div class="form-actions" style="justify-content:flex-start;border-top:none;padding-top:0;margin-top:12px;">
        <button class="btn btn-primary" id="btn-vacation-start">Urlaubsmodus aktivieren</button>
      </div>
    `;
  }

  private attachStartHandler(): void {
    const dateInput = this.container.querySelector<HTMLInputElement>("#vacation-end-input")!;
    this.container.querySelectorAll<HTMLInputElement>('input[name="vacation-mode"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        dateInput.style.display = radio.value === "unlimited" && radio.checked ? "none" : "";
      });
    });

    this.container.querySelector("#btn-vacation-start")?.addEventListener("click", async () => {
      const unlimited = this.container.querySelector<HTMLInputElement>('input[name="vacation-mode"][value="unlimited"]')!.checked;
      if (!unlimited && !dateInput.value) {
        alert('Bitte ein Enddatum wählen oder „Unbegrenzt" auswählen.');
        return;
      }
      await this.vacationService.start(unlimited ? null : dateInput.value);
      await this.render();
    });
  }
}
