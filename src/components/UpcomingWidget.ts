// ============================================================
// components/UpcomingWidget.ts
// Kompakte Vorschau der nächsten anstehenden Aufgaben in der rechten
// Widget-Spalte der Aufgaben-Ansicht (Desktop ≥1200px). Die vollständige,
// nach Datum gruppierte Liste bleibt UpcomingView vorbehalten — dieses
// Widget zeigt bewusst nur die ersten paar Einträge als Kurzüberblick.
//
// Angular-Migration:
//   @Component({ selector: 'app-upcoming-widget', standalone: true })
//   export class UpcomingWidgetComponent {
//     @Input() entries!: UpcomingEntry[];
//   }
// ============================================================

export interface UpcomingEntry {
  title: string;
  when: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export class UpcomingWidget {
  render(entries: UpcomingEntry[]): string {
    if (entries.length === 0) {
      return `
        <div class="widget-card upcoming-widget">
          <div class="widget-card-title">Upcoming</div>
          <p class="widget-empty">Keine geplanten Aufgaben.</p>
        </div>`;
    }

    const rows = entries
      .map(
        (e) => `
      <div class="upcoming-widget-row">
        <span class="upcoming-widget-title">${escapeHtml(e.title)}</span>
        <span class="upcoming-widget-when">${escapeHtml(e.when)}</span>
      </div>`
      )
      .join("");

    return `
      <div class="widget-card upcoming-widget">
        <div class="widget-card-title">Upcoming</div>
        <div class="upcoming-widget-list">${rows}</div>
      </div>`;
  }
}
