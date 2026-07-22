// ============================================================
// components/CategoryDonutWidget.ts
// Zeigt die Kategorien-Verteilung der heutigen Aufgaben als Donut
// (CSS conic-gradient — kein Chart-Framework nötig für einen einzelnen Ring).
//
// Angular-Migration:
//   @Component({ selector: 'app-category-donut-widget', standalone: true })
//   export class CategoryDonutWidgetComponent {
//     @Input() slices!: DonutSlice[];
//   }
// ============================================================

export interface DonutSlice {
  label: string;
  color: string;
  count: number;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export class CategoryDonutWidget {
  render(slices: DonutSlice[]): string {
    const total = slices.reduce((sum, s) => sum + s.count, 0);

    if (total === 0) {
      return `
        <div class="widget-card category-donut-widget">
          <div class="widget-card-title">Kategorien-Verteilung</div>
          <p class="widget-empty">Keine Aufgaben heute.</p>
        </div>`;
    }

    let acc = 0;
    const stops = slices.map((s) => {
      const pct = (s.count / total) * 100;
      const stop = `${s.color} ${acc}% ${acc + pct}%`;
      acc += pct;
      return stop;
    });
    const gradient = `conic-gradient(${stops.join(", ")})`;

    const legend = slices
      .map(
        (s) => `
      <div class="donut-legend-row">
        <span class="donut-legend-dot" style="background:${s.color}"></span>
        <span class="donut-legend-label">${escapeHtml(s.label)}</span>
        <span class="donut-legend-count">${s.count}</span>
      </div>`
      )
      .join("");

    return `
      <div class="widget-card category-donut-widget">
        <div class="widget-card-title">Kategorien-Verteilung</div>
        <div class="donut-row">
          <div class="donut-circle" style="background:${gradient}"></div>
          <div class="donut-legend">${legend}</div>
        </div>
      </div>`;
  }
}
