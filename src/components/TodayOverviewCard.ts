// ============================================================
// components/TodayOverviewCard.ts
// "Heute"-Fortschrittskarte (Wochentag/Datum, Prozent-Ring als Balken,
// erledigt/gesamt, Streak). Wird von TodoView zweimal eingebunden: einmal
// gestapelt über der Liste (Mobil/Tablet) und einmal in der rechten
// Widget-Spalte (Desktop ≥1200px) — siehe styles/components/_today-overview.css
// für die Sichtbarkeits-Umschaltung per Media Query.
//
// Angular-Migration:
//   @Component({ selector: 'app-today-overview-card', standalone: true })
//   export class TodayOverviewCardComponent {
//     @Input() data!: TodayOverviewData;
//   }
// ============================================================

export interface TodayOverviewData {
  weekdayLabel: string;
  dateLabel: string;
  doneCount: number;
  totalCount: number;
  streakDays: number;
}

export class TodayOverviewCard {
  render(data: TodayOverviewData): string {
    const percent = data.totalCount > 0
      ? Math.round((data.doneCount / data.totalCount) * 100)
      : 0;

    return `
      <div class="today-overview-card">
        <div class="today-overview-top">
          <div>
            <div class="today-overview-heading">${data.weekdayLabel}</div>
            <div class="today-overview-date">${data.dateLabel}</div>
          </div>
          <div class="today-overview-percent">${percent}%</div>
        </div>
        <div class="today-overview-bar-track">
          <div class="today-overview-bar-fill" style="width:${percent}%"></div>
        </div>
        <div class="today-overview-footer">
          <span>${data.doneCount} von ${data.totalCount} Aufgaben erledigt</span>
          <span>🔥 ${data.streakDays} Tage Serie</span>
        </div>
      </div>`;
  }
}
