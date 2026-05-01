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

/**
 * Returns the CSS class for the actual-time bar based on the ratio of
 * actual to estimated hours.
 *   ≤ 90%  → green  (Unter Schätzung)
 *   ≤ 110% → yellow (Nahe Schätzung)
 *   > 110% → red    (Über Schätzung)
 */
function actualBarClass(stat: CategoryTimeStat): string {
  if (stat.estimatedHours === 0) return "cat-time-bar-fill--yellow";
  const ratio = stat.actualHours / stat.estimatedHours;
  if (ratio <= 0.9) return "cat-time-bar-fill--green";
  if (ratio <= 1.1) return "cat-time-bar-fill--yellow";
  return "cat-time-bar-fill--red";
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
    const bodyHtml =
      stats.length === 0
        ? `<p class="cat-time-widget__empty">Keine Zeitdaten für diese Woche.<br>Trage bei erledigten Aufgaben die tatsächliche Zeit ein.</p>`
        : this.buildRows(stats) + this.buildLegend();

    return `
      <details class="cat-time-widget" open>
        <summary class="cat-time-widget__summary">
          <span class="cat-time-widget__title">Zeitaufwand pro Kategorie</span>
          <span class="cat-time-widget__toggle" aria-hidden="true">▾</span>
        </summary>
        <div class="cat-time-widget__body">
          ${bodyHtml}
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
        const actCls = actualBarClass(s);

        const estBar =
          s.estimatedHours > 0
            ? `<div class="cat-time-bar-line">
                <span class="cat-time-bar-label">Geplant</span>
                <div class="cat-time-bar-track">
                  <div class="cat-time-bar-fill cat-time-bar-fill--est" style="width:${estPct}%"></div>
                </div>
               </div>`
            : "";

        const actBar =
          s.actualHours > 0
            ? `<div class="cat-time-bar-line">
                <span class="cat-time-bar-label">Tatsächlich</span>
                <div class="cat-time-bar-track">
                  <div class="cat-time-bar-fill ${actCls}" style="width:${actPct}%"></div>
                </div>
               </div>`
            : "";

        const valStr =
          s.estimatedHours > 0
            ? `${s.actualHours.toFixed(1)}h / ${s.estimatedHours.toFixed(1)}h`
            : `${s.actualHours.toFixed(1)}h`;

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
        <span class="cat-time-legend__dot cat-time-legend__dot--est"></span><span>Geplant</span>
        <span class="cat-time-legend__dot cat-time-legend__dot--act"></span><span>Tatsächlich</span>
        <span class="cat-time-legend__sep"></span>
        <span class="cat-time-legend__dot cat-time-legend__dot--green"></span><span>Unter Schätzung</span>
        <span class="cat-time-legend__dot cat-time-legend__dot--yellow"></span><span>Nahe Schätzung</span>
        <span class="cat-time-legend__dot cat-time-legend__dot--red"></span><span>Über Schätzung</span>
      </div>`;
  }
}
