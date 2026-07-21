// ============================================================
// components/MiniCalendarPicker.ts
// ============================================================

export class MiniCalendarPicker {
  private popup: HTMLElement | null = null;
  private currentYear: number;
  private currentMonth: number;

  constructor(private readonly input: HTMLInputElement) {
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth();
    this.attachTrigger();
  }

  private attachTrigger(): void {
    const btn = this.input.parentElement!.querySelector<HTMLButtonElement>(".date-picker-icon")!;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.popup ? this.close() : this.open();
    });

    // Außerhalb klicken schließt den Kalender
    document.addEventListener("click", () => this.close());
  }

  private open(): void {
    if (this.input.value) {
      const d = new Date(this.input.value + "T00:00:00");
      this.currentYear = d.getFullYear();
      this.currentMonth = d.getMonth();
    }
    this.popup = document.createElement("div");
    this.popup.className = "mini-cal-popup";
    // Klick im Popup soll nicht den document-Listener auslösen
    this.popup.addEventListener("click", (e) => e.stopPropagation());
    this.input.parentElement!.appendChild(this.popup);
    this.renderPopup();
  }

  private close(): void {
    this.popup?.remove();
    this.popup = null;
  }

  private renderPopup(): void {
    if (!this.popup) return;

    const selected = this.input.value;
    const todayStr = new Date().toISOString().slice(0, 10);
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    // Wochentag des ersten Tags, Mo-basiert (0=Mo … 6=So)
    let startOffset = firstDay.getDay();
    startOffset = startOffset === 0 ? 6 : startOffset - 1;

    const monthLabel = firstDay.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

    let cells = "";
    for (let i = 0; i < startOffset; i++) cells += `<span class="mini-cal-empty"></span>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const cls = [
        "mini-cal-day",
        dateStr === selected ? "selected" : "",
        dateStr === todayStr ? "today" : "",
      ].filter(Boolean).join(" ");
      cells += `<button type="button" class="${cls}" data-date="${dateStr}">${d}</button>`;
    }

    this.popup.innerHTML = `
      <div class="mini-cal-header">
        <button type="button" class="mini-cal-nav" data-dir="-1">‹</button>
        <span class="mini-cal-month">${monthLabel}</span>
        <button type="button" class="mini-cal-nav" data-dir="1">›</button>
      </div>
      <div class="mini-cal-weekdays">
        <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span>
        <span>Fr</span><span>Sa</span><span>So</span>
      </div>
      <div class="mini-cal-grid">${cells}</div>
    `;

    this.popup.querySelectorAll<HTMLButtonElement>(".mini-cal-nav").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.currentMonth += parseInt(btn.dataset.dir!);
        if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
        if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
        this.renderPopup();
      });
    });

    this.popup.querySelectorAll<HTMLButtonElement>(".mini-cal-day").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.input.value = btn.dataset.date!;
        // Change-Event damit andere Listener (z.B. repeatSel) reagieren können
        this.input.dispatchEvent(new Event("change", { bubbles: true }));
        this.close();
      });
    });
  }
}
