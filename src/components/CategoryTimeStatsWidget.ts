// ============================================================
// components/CategoryTimeStatsWidget.ts
// Renders the weekly category-time statistics widget as an HTML string.
// Accepts data via method argument — no direct service calls.
//
// Angular migration: convert to a standalone component
//   @Component({ selector: 'app-category-time-stats', ... })
//   export class CategoryTimeStatsWidgetComponent {
//     @Input() stats: CategoryTimeStat[] = [];
//   }
// Stylesheet: styles/components/_category-time-stats.css
// ============================================================

import type { CategoryTimeStat } from "../utils/categoryStatsUtils.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Returns the status hex color for the Tatsächlich bar. */
function actualBarColor(stat: CategoryTimeStat): string {
  if (stat.estimatedHours === 0) return "#facc15";
  const ratio = stat.actualHours / stat.estimatedHours;
  if (ratio <= 0.9) return "#4ade80";
  if (ratio <= 1.1) return "#facc15";
  return "#f87171";
}

export class CategoryTimeStatsWidget {
  /**
   * Returns the complete widget HTML.
   * Uses <details open> so it is expanded by default.
   * On small screens (< 768px) the user can collapse it.
   * On medium+ screens CSS disables the toggle interaction.
   *
   * @param stats Aggregated category time data for the current week
   */
  render(stats: CategoryTimeStat[]): string {
    const isEmpty = stats.length === 0;

    return `
      <details class="cat-time-widget" open>
        <summary class="cat-time-widget__summary">
          <span class="cat-time-widget__title">Zeitaufwand pro Kategorie</span>
          <span class="cat-time-widget__toggle" aria-hidden="true">▾</span>
        </summary>
        <div class="cat-time-widget__body">
          ${isEmpty
            ? `<p class="cat-time-widget__empty">Keine Zeitdaten für diese Woche.<br>Trage bei erledigten Aufgaben die tatsächliche Zeit ein.</p>`
            : `<div class="cat-time-rows">${this.buildRows(stats)}</div>${this.buildLegend()}`
          }
        </div>
      </details>`;
  }

  private buildRows(stats: CategoryTimeStat[]): string {
    const maxH = Math.max(
      ...stats.map((s) => Math.max(s.estimatedHours, s.actualHours)),
      0.1
    );

    return stats
      .map((s) => {
        const estPct = Math.round((s.estimatedHours / maxH) * 100);
        const actPct = Math.round((s.actualHours / maxH) * 100);
        const actColor = actualBarColor(s);
        // Geplant bar: category color at 60% opacity
        const estBg = `color-mix(in srgb, ${esc(s.color)} 60%, transparent)`;

        const valStr =
          s.estimatedHours > 0
            ? `${s.actualHours.toFixed(1)}h / ${s.estimatedHours.toFixed(1)}h`
            : `${s.actualHours.toFixed(1)}h`;

        const estBar =
          s.estimatedHours > 0
            ? `<div class="cat-time-bar-line">
                <span class="cat-time-bar-label">Geplant</span>
                <div class="cat-time-bar-track">
                  <div class="cat-time-bar-fill" style="width:${estPct}%; background:${estBg}"></div>
                </div>
               </div>`
            : "";

        const actBar =
          s.actualHours > 0
            ? `<div class="cat-time-bar-line">
                <span class="cat-time-bar-label">Tatsächlich</span>
                <div class="cat-time-bar-track">
                  <div class="cat-time-bar-fill" style="width:${actPct}%; background:${actColor}"></div>
                </div>
               </div>`
            : "";

        return `
          <div class="cat-time-row">
            <div class="cat-time-row__header">
              <span class="cat-time-row__name">
                <span class="cat-time-dot" style="background:${esc(s.color)}"></span>
                ${esc(s.name)}
              </span>
              <span class="cat-time-row__values">${valStr}</span>
            </div>
            <div class="cat-time-bars">${estBar}${actBar}</div>
          </div>`;
      })
      .join("");
  }

  private buildLegend(): string {
    return `
      <div class="cat-time-legend">
        <div class="cat-time-legend__row">
          <span class="cat-time-legend__item">
            <span class="cat-time-legend__dot" style="background:var(--accent); opacity:0.6"></span>
            <span>Geplant</span>
          </span>
          <span class="cat-time-legend__item">
            <span class="cat-time-legend__dot" style="background:var(--text-muted)"></span>
            <span>Tatsächlich</span>
          </span>
        </div>
        <div class="cat-time-legend__row">
          <span class="cat-time-legend__item">
            <span class="cat-time-legend__dot" style="background:#4ade80"></span>
            <span>Unter Schätzung</span>
          </span>
          <span class="cat-time-legend__item">
            <span class="cat-time-legend__dot" style="background:#facc15"></span>
            <span>Nahe Schätzung</span>
          </span>
          <span class="cat-time-legend__item">
            <span class="cat-time-legend__dot" style="background:#f87171"></span>
            <span>Über Schätzung</span>
          </span>
        </div>
      </div>`;
  }
}
