// ============================================================
// components/WeekOverviewWidget.ts
// Balken-Mini-Chart der aktuellen Woche (Mo–So) in der rechten
// Widget-Spalte der Aufgaben-Ansicht (Desktop ≥1200px).
//
// Angular-Migration:
//   @Component({ selector: 'app-week-overview-widget', standalone: true })
//   export class WeekOverviewWidgetComponent {
//     @Input() days!: WeekDayBar[];
//   }
// ============================================================

export interface WeekDayBar {
  label: string;
  percent: number;
  isToday: boolean;
}

export class WeekOverviewWidget {
  render(days: WeekDayBar[]): string {
    const bars = days
      .map(
        (d) => `
      <div class="week-overview-col">
        <div class="week-overview-bar${d.isToday ? " is-today" : ""}" style="height:${Math.max(d.percent, 3)}%"></div>
        <span class="week-overview-label${d.isToday ? " is-today" : ""}">${d.label}</span>
      </div>`
      )
      .join("");

    return `
      <div class="widget-card week-overview-widget">
        <div class="widget-card-title">Wochenübersicht</div>
        <div class="week-overview-row">${bars}</div>
      </div>`;
  }
}
