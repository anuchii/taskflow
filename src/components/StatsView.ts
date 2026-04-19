// ============================================================
// components/StatsView.ts
// ============================================================

import type { TaskService, DayStat, TimeEntry } from "../services/TaskService.js";
import {
  currentWeekDates, currentMonthDates, weekDates,
  formatShort, formatDisplay, formatWeekday, today,
} from "../utils/DateUtils.js";

type Period = "week" | "month";

export class StatsView {
  private activePeriod: Period = "month";
  private tableWeekOffset: number = 0;

  constructor(
    private readonly taskService: TaskService,
    private readonly container: HTMLElement
  ) {}

  async render(): Promise<void> {
    this.container.innerHTML = `<div class="loading">Lädt…</div>`;

    const chartDates = this.getChartDates();
    const tableDates = weekDates(this.tableWeekOffset);

    const [chartStats, tableStats, timeEntries] = await Promise.all([
      this.taskService.getStatsForDates(chartDates),
      this.taskService.getStatsForDates(tableDates),
      this.taskService.getTimeComparisonForDates(tableDates),
    ]);

    const totalAll = chartStats.reduce((s, d) => s + d.total, 0);
    const completedAll = chartStats.reduce((s, d) => s + d.completed, 0);
    const rate = totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0;
    const todayStat = chartStats.find((s) => s.date === today());
    const todayTotal = todayStat?.total ?? 0;
    const todayDone = todayStat?.completed ?? 0;

    const weekLabel = this.weekLabel(tableDates);
    const isCurrentWeek = this.tableWeekOffset === 0;

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Statistik</h1>
          <p class="view-subtitle">Dein Fortschritt auf einen Blick</p>
        </div>
      </div>

      <div class="stats-kpi-row">
        <div class="kpi-card">
          <span class="kpi-value">${todayDone}/${todayTotal}</span>
          <span class="kpi-label">Heute</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-value">${completedAll}/${totalAll}</span>
          <span class="kpi-label">${this.periodLabel()}</span>
        </div>
        <div class="kpi-card ${rate >= 80 ? "kpi-good" : rate >= 50 ? "kpi-ok" : "kpi-low"}">
          <span class="kpi-value">${rate}%</span>
          <span class="kpi-label">Erledigungsrate</span>
        </div>
      </div>

      <div class="chart-section">
        <div class="chart-toolbar">
          <span class="chart-title">Aufgaben pro Tag</span>
          <div class="period-tabs">
            ${(["week", "month"] as Period[]).map((p) => `
              <button class="period-tab ${this.activePeriod === p ? "active" : ""}" data-period="${p}">
                ${p === "week" ? "Woche" : "Monat"}
              </button>`).join("")}
          </div>
        </div>
        <div class="chart-wrap">${this.buildSVGChart(chartStats)}</div>
        <div class="chart-legend">
          <span class="legend-dot total-dot"></span><span>Gesamt</span>
          <span class="legend-dot done-dot"></span><span>Erledigt</span>
        </div>
      </div>

      <div class="stats-table-wrap">
        <div class="table-nav">
          <button class="btn btn-ghost table-nav-btn" id="btn-prev-week">← Vorwoche</button>
          <span class="table-week-label">${weekLabel}</span>
          <button class="btn btn-ghost table-nav-btn" id="btn-next-week" ${isCurrentWeek ? "disabled" : ""}>
            Nächste Woche →
          </button>
        </div>
        <table class="stats-table">
          <thead><tr><th>Tag</th><th>Datum</th><th>Gesamt</th><th>Erledigt</th><th>Rate</th></tr></thead>
          <tbody>
            ${tableStats.map((s) => {
              const r = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
              const isFuture = s.date > today();
              return `<tr class="${s.date === today() ? "today-row" : ""}${isFuture ? " future-row" : ""}">
                <td class="weekday-cell">${formatWeekday(s.date)}</td>
                <td>${formatDisplay(s.date)}</td>
                <td>${isFuture ? "—" : s.total}</td>
                <td>${isFuture ? "—" : s.completed}</td>
                <td>${isFuture ? "" : `<span class="rate-badge ${r >= 80 ? "good" : r >= 50 ? "ok" : s.total === 0 ? "" : "low"}">${s.total > 0 ? r + "%" : "—"}</span>`}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>

      <div class="time-chart-section">
        <div class="chart-toolbar">
          <span class="chart-title">Zeitschätzung vs. Tatsächlich</span>
        </div>
        ${timeEntries.length === 0
          ? `<p class="tc-empty">Keine Zeitdaten für diese Woche.<br>Trage bei erledigten Aufgaben die tatsächliche Zeit ein.</p>`
          : this.buildTimeRows(timeEntries)}
      </div>
    `;

    this.container.querySelectorAll<HTMLButtonElement>(".period-tab").forEach((btn) => {
      btn.addEventListener("click", async () => {
        this.activePeriod = btn.dataset.period as Period;
        await this.render();
      });
    });

    this.container.querySelector("#btn-prev-week")?.addEventListener("click", async () => {
      this.tableWeekOffset -= 1;
      await this.render();
    });

    this.container.querySelector("#btn-next-week")?.addEventListener("click", async () => {
      if (this.tableWeekOffset < 0) {
        this.tableWeekOffset += 1;
        await this.render();
      }
    });
  }

  private weekLabel(dates: string[]): string {
    const first = new Date(dates[0] + "T00:00:00");
    const last = new Date(dates[6] + "T00:00:00");
    const sameMonth = first.getMonth() === last.getMonth();
    const sameYear = first.getFullYear() === last.getFullYear();
    const startStr = first.toLocaleDateString("de-AT", {
      day: "2-digit",
      month: sameMonth ? undefined : "short",
    });
    const endStr = last.toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "short",
      year: sameYear ? undefined : "numeric",
    });
    const year = last.getFullYear();
    return `${startStr} – ${endStr} ${year}`;
  }

  private buildSVGChart(stats: DayStat[]): string {
    const W = 760, H = 220;
    const padL = 42, padR = 16, padT = 20, padB = 40;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const maxVal = Math.max(...stats.map((s) => s.total), 1);
    const gridLines = 5;
    const x = (i: number) => padL + (i / (stats.length - 1 || 1)) * chartW;
    const y = (v: number) => padT + chartH - (v / maxVal) * chartH;

    const polyline = (vals: number[], cls: string) => {
      const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
      return `<polyline class="${cls}" points="${pts}" fill="none" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    };
    const area = (vals: number[], cls: string) => {
      if (vals.length < 2) return "";
      const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
      return `<polygon class="${cls}" points="${x(0)},${padT + chartH} ${pts} ${x(vals.length - 1)},${padT + chartH}" />`;
    };

    const gridSVG = Array.from({ length: gridLines + 1 }, (_, i) => {
      const val = Math.round((maxVal / gridLines) * (gridLines - i));
      const yy = y((maxVal / gridLines) * (gridLines - i));
      return `<line class="grid-line" x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" />
              <text class="grid-label" x="${padL - 6}" y="${yy + 4}">${val}</text>`;
    }).join("");

    const step = stats.length > 20 ? Math.ceil(stats.length / 10) : 1;
    const xLabels = stats.map((s, i) => {
      if (i % step !== 0 && i !== stats.length - 1) return "";
      return `<text class="x-label" x="${x(i)}" y="${H - 6}" text-anchor="middle">${formatShort(s.date)}</text>`;
    }).join("");

    const dots = (vals: number[], cls: string) =>
      vals.map((v, i) =>
        `<circle class="${cls}" cx="${x(i)}" cy="${y(v)}" r="3.5"><title>${formatDisplay(stats[i].date)}: ${v}</title></circle>`
      ).join("");

    const totals = stats.map((s) => s.total);
    const completeds = stats.map((s) => s.completed);

    return `
      <svg class="line-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad-total" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart-total)" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="var(--chart-total)" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="grad-done" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart-done)" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="var(--chart-done)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${gridSVG}
        ${area(totals, "area-total")}
        ${area(completeds, "area-done")}
        ${polyline(totals, "line-total")}
        ${polyline(completeds, "line-done")}
        ${dots(totals, "dot-total")}
        ${dots(completeds, "dot-done")}
        ${xLabels}
      </svg>`;
  }

  private getChartDates(): string[] {
    if (this.activePeriod === "week") return currentWeekDates();
    return currentMonthDates();
  }

  private periodLabel(): string {
    if (this.activePeriod === "week") return "Diese Woche";
    return "Dieser Monat";
  }

  private buildTimeRows(entries: TimeEntry[]): string {
    const maxMin = Math.max(...entries.map((e) => Math.max(e.estimated ?? 0, e.actual ?? 0)), 1);
    const rows = entries.map((e) => {
      const estPct = e.estimated ? Math.round((e.estimated / maxMin) * 100) : 0;
      const actPct = e.actual   ? Math.round((e.actual   / maxMin) * 100) : 0;

      let diffHtml = "<span style=\"color:var(--text-muted)\">—</span>";
      if (e.estimated != null && e.actual != null) {
        const diff = e.actual - e.estimated;
        const color = diff > 0 ? "var(--red)" : diff < 0 ? "var(--green)" : "var(--text-muted)";
        diffHtml = `<span style="color:${color};font-weight:700">${diff > 0 ? "+" : ""}${diff} Min</span>`;
      }

      const estBar = e.estimated != null ? `
        <div class="tc-bar-line">
          <span class="tc-bar-label">Geplant</span>
          <div class="tc-bar-track"><div class="tc-bar-fill tc-bar-fill--est" style="width:${estPct}%"></div></div>
          <span class="tc-bar-value">${e.estimated} Min</span>
        </div>` : "";
      const actBar = e.actual != null ? `
        <div class="tc-bar-line">
          <span class="tc-bar-label">Tatsächlich</span>
          <div class="tc-bar-track"><div class="tc-bar-fill tc-bar-fill--actual" style="width:${actPct}%"></div></div>
          <span class="tc-bar-value">${e.actual} Min</span>
        </div>` : "";

      return `
        <div class="tc-task-row">
          <div>
            <div class="tc-task-name">${escapeHtml(e.task.title)}</div>
            <div class="tc-task-date">${formatShort(e.date)}</div>
          </div>
          <div class="tc-bars">${estBar}${actBar}</div>
          <div class="tc-diff">${diffHtml}</div>
        </div>`;
    }).join("");

    return `${rows}
      <div class="tc-legend">
        <span class="legend-dot" style="background:var(--accent)"></span><span>Geplant</span>
        <span class="legend-dot" style="background:var(--green)"></span><span>Tatsächlich</span>
      </div>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
