// ============================================================
// components/CategoryAnalyticsWidget.ts
// Renders the category analytics dashboard section as an HTML string.
// Accepts pre-computed data via method argument — no service calls.
//
// Three cards, always rendered even when data is absent:
//   - Top-Volumen     : category with most completions this week
//   - Pünktlichkeit   : category with lowest on-time rate (alert state)
//   - Tages-Streaks   : top-5 categories by consecutive completion days
//
// Angular migration:
//   @Component({ selector: 'app-category-analytics', standalone: true })
//   export class CategoryAnalyticsWidgetComponent {
//     @Input() analytics!: CategoryAnalytics;
//   }
//   Stylesheet: styles/components/_category-analytics.css
//
// On-time note:
//   The deadline logic (completedAt ≤ dueDate) is intentionally
//   aligned with the flashcard "delayed review" concept: both measure
//   whether knowledge/work was applied before the deadline expires.
// ============================================================

import type {
  CategoryAnalytics,
  CategoryStreak,
  OnTimeCategory,
  TopVolumeCategory,
} from "../utils/categoryAnalyticsUtils.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export class CategoryAnalyticsWidget {
  render(analytics: CategoryAnalytics): string {
    return `
      <div class="ca-section">
        <div class="ca-header">
          <span class="ca-title">Kategorie-Analytik</span>
        </div>
        <div class="ca-grid">
          ${this.buildVolumeCard(analytics.topVolume)}
          ${this.buildOnTimeCard(analytics.lowestOnTime)}
          ${this.buildStreakCard(analytics.streaks)}
        </div>
      </div>`;
  }

  // ─── Volume card ──────────────────────────────────────────

  private buildVolumeCard(data: TopVolumeCategory | null): string {
    if (!data) {
      return `
        <div class="ca-card">
          <div class="ca-card-label">↑ Top-Volumen — Diese Woche</div>
          <p class="ca-empty">Noch keine Erledigungen diese Woche.</p>
        </div>`;
    }

    const pct = Math.round((data.completedCount / data.weekTotal) * 100);

    return `
      <div class="ca-card">
        <div class="ca-card-label">↑ Top-Volumen — Diese Woche</div>
        <div class="ca-cat-name">
          <span class="ca-dot" style="background:${esc(data.color)}"></span>
          ${esc(data.name)}
        </div>
        <div class="ca-value">${data.completedCount}</div>
        <div class="ca-sub">${pct}% aller ${data.weekTotal} Erledigungen</div>
        <div class="ca-bar-track">
          <div class="ca-bar-fill" style="width:${pct}%; background:${esc(data.color)}"></div>
        </div>
      </div>`;
  }

  // ─── On-time card ─────────────────────────────────────────

  private buildOnTimeCard(data: OnTimeCategory | null): string {
    if (!data) {
      return `
        <div class="ca-card">
          <div class="ca-card-label">◎ Pünktlichkeit</div>
          <p class="ca-empty">Noch zu wenig Aufgaben mit Fälligkeitsdatum (mind. 2 pro Kategorie).</p>
        </div>`;
    }

    const rateColor =
      data.onTimeRate >= 80
        ? "var(--green)"
        : data.onTimeRate >= 50
        ? "var(--accent)"
        : "var(--red)";
    const late = data.total - data.onTime;

    return `
      <div class="ca-card ca-card--alert">
        <div class="ca-card-label">◎ Schlechteste Pünktlichkeit</div>
        <div class="ca-cat-name">
          <span class="ca-dot" style="background:${esc(data.color)}"></span>
          ${esc(data.name)}
        </div>
        <div class="ca-value" style="color:${rateColor}">${data.onTimeRate}%</div>
        <div class="ca-sub">${data.onTime} pünktlich · ${late} zu spät · ${data.total} gesamt</div>
        <div class="ca-bar-track">
          <div class="ca-bar-fill" style="width:${data.onTimeRate}%; background:${rateColor}"></div>
        </div>
      </div>`;
  }

  // ─── Streak card ──────────────────────────────────────────

  private buildStreakCard(streaks: CategoryStreak[]): string {
    if (streaks.length === 0) {
      return `
        <div class="ca-card">
          <div class="ca-card-label">◈ Tages-Streaks</div>
          <p class="ca-empty">Noch keine aufeinanderfolgenden Tage mit Erledigungen.</p>
        </div>`;
    }

    const rows = streaks
      .map(
        (s) => `
      <div class="ca-streak-row">
        <span class="ca-streak-name">
          <span class="ca-dot" style="background:${esc(s.color)}"></span>
          ${esc(s.name)}
        </span>
        <span class="ca-streak-count">${s.currentStreak}T</span>
      </div>`
      )
      .join("");

    return `
      <div class="ca-card">
        <div class="ca-card-label">◈ Tages-Streaks</div>
        <div class="ca-streak-list">${rows}</div>
      </div>`;
  }
}
