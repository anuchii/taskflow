// ============================================================
// components/EsquemaView.ts
// Mind-Map-Ansicht ("Esquema") für den heutigen Tag:
// Tag-Blase in der Mitte, Aufgaben-Blasen radial verteilt.
// ============================================================

import type { Task, Category } from "../models/Task.js";
import type { TaskService } from "../services/TaskService.js";
import { today, formatDisplay } from "../utils/DateUtils.js";

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

const PRIORITY_STROKE: Record<string, string> = {
  high:   "var(--red)",
  medium: "var(--accent)",
  low:    "var(--border)",
};

// Verhältnis Blasenbreite zu Kreisumfang: bestimmt wie viel Platz jede Aufgabe braucht.
// Zu kleiner Radius → Blasen überlappen; dieser Wert gibt Mindest-Bogenabstand vor.
const BUBBLE_ARC_SPACING = 155;
const BUBBLE_W = 128;
const BUBBLE_H  = 56;
const DAY_RX    = 88;
const DAY_RY    = 54;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export class EsquemaView {
  // onBack wird von TodoView übergeben und bei jedem Re-Render neu verdrahtet,
  // weil innerHTML das DOM ersetzt und alte Listener verloren gehen.
  private onBack: (() => void) | null = null;

  constructor(
    private readonly taskService: TaskService,
    private readonly container: HTMLElement
  ) {}

  async render(onBack?: () => void): Promise<void> {
    if (onBack) this.onBack = onBack;
    this.container.innerHTML = `<div class="loading">Lädt…</div>`;

    const todayStr = today();
    const tasks    = await this.taskService.getTasksForDateWithOverdue(todayStr);
    const cats     = await this.taskService.getCategories();

    const completedIds = new Set<string>();
    for (const t of tasks) {
      if (await this.taskService.isCompletedOn(t.id, todayStr)) {
        completedIds.add(t.id);
      }
    }

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Esquema</h1>
          <p class="view-subtitle">${formatDisplay(todayStr)} · ${completedIds.size}/${tasks.length} erledigt</p>
        </div>
        <button class="btn btn-ghost" id="btn-esquema-back">☰ Liste</button>
      </div>
      <div class="esquema-wrap">
        ${this.buildSVG(tasks, completedIds, cats)}
      </div>
    `;

    this.attachEvents(tasks, completedIds, todayStr);
  }

  private buildSVG(tasks: Task[], completedIds: Set<string>, cats: Category[]): string {
    const catMap = new Map(cats.map(c => [c.id, c]));

    const count = tasks.length;

    // Radius so wählen, dass Blasen nicht überlappen
    const minRadius = Math.max(180, (count * BUBBLE_ARC_SPACING) / (2 * Math.PI));
    const R = Math.min(minRadius, 300);

    const W  = Math.round((R + BUBBLE_W) * 2 + 40);
    const H  = Math.round((R + BUBBLE_H) * 2 + 40);
    const cx = W / 2;
    const cy = H / 2;

    const dayName   = DAY_NAMES[new Date().getDay()];
    const dateLabel = formatDisplay(today());

    if (count === 0) {
      return `
        <svg class="esquema-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
          ${this.dayBubble(cx, cy, dayName, dateLabel, 0, 0)}
        </svg>`;
    }

    const lines:   string[] = [];
    const bubbles: string[] = [];

    // Gleichmäßige Winkelverteilung, Start oben (−π/2)
    tasks.forEach((task, i) => {
      const angle = -Math.PI / 2 + (i / count) * 2 * Math.PI;
      const tx    = cx + R * Math.cos(angle);
      const ty    = cy + R * Math.sin(angle);

      const isCompleted = completedIds.has(task.id);
      const cat         = catMap.get(task.category);

      lines.push(this.line(cx, cy, tx, ty));
      bubbles.push(this.taskBubble(task, tx, ty, isCompleted, cat));
    });

    return `
      <svg class="esquema-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        ${lines.join("")}
        ${bubbles.join("")}
        ${this.dayBubble(cx, cy, dayName, dateLabel, completedIds.size, count)}
      </svg>`;
  }

  private line(x1: number, y1: number, x2: number, y2: number): string {
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"
                  x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
                  stroke="var(--border)" stroke-width="1.4" stroke-linecap="round"/>`;
  }

  private dayBubble(cx: number, cy: number, dayName: string, dateLabel: string, done: number, total: number): string {
    const progress = total > 0 ? `${done}/${total} erledigt` : "Keine Aufgaben";
    return `
      <g class="esquema-day-bubble">
        <ellipse cx="${cx}" cy="${cy}" rx="${DAY_RX}" ry="${DAY_RY}"
          fill="var(--accent)" stroke="none"/>
        <text x="${cx}" y="${cy - 12}" text-anchor="middle"
          fill="#000" font-size="15" font-weight="700">${escapeHtml(dayName)}</text>
        <text x="${cx}" y="${cy + 6}" text-anchor="middle"
          fill="#000" font-size="11">${escapeHtml(dateLabel)}</text>
        <text x="${cx}" y="${cy + 22}" text-anchor="middle"
          fill="#00000099" font-size="10">${progress}</text>
      </g>`;
  }

  private taskBubble(task: Task, tx: number, ty: number, isCompleted: boolean, cat?: Category): string {
    const bx    = tx - BUBBLE_W / 2;
    const by    = ty - BUBBLE_H / 2;
    const title = truncate(task.title, 20);

    // Erledigte Aufgaben → Farbe des Tages; offene → neutrale Oberfläche
    const fill   = isCompleted ? "var(--accent-dim)" : "var(--surface)";
    const stroke = PRIORITY_STROKE[task.priority ?? "low"] ?? "var(--border)";
    const sw     = task.priority === "high" ? 2.5 : 1.5;

    const catColor  = cat?.color ?? "var(--text-muted)";
    const checkmark = isCompleted
      ? `<text x="${tx + BUBBLE_W / 2 - 10}" y="${ty - BUBBLE_H / 2 + 14}"
              text-anchor="middle" fill="var(--green)" font-size="11">✓</text>`
      : "";

    return `
      <g class="esquema-task" data-id="${task.id}" data-completed="${isCompleted}" style="cursor:pointer" pointer-events="all">
        <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}"
          width="${BUBBLE_W}" height="${BUBBLE_H}" rx="14"
          fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>

        <!-- Kategorie-Punkt -->
        <circle cx="${bx + 12}" cy="${ty}" r="4" fill="${catColor}"/>

        <text x="${tx + 4}" y="${ty - 7}" text-anchor="middle"
          fill="var(--text)" font-size="12" font-weight="600">
          ${escapeHtml(title)}
        </text>

        <text x="${tx + 4}" y="${ty + 10}" text-anchor="middle"
          fill="var(--text-muted)" font-size="10">
          ${escapeHtml(cat?.label ?? task.category)}
        </text>

        ${checkmark}
      </g>`;
  }

  private attachEvents(tasks: Task[], completedIds: Set<string>, todayStr: string): void {
    this.container.querySelector("#btn-esquema-back")
      ?.addEventListener("click", () => this.onBack?.());

    // Klick auf Aufgaben-Blase → erledigen / rückgängig
    this.container.querySelector(".esquema-wrap")
      ?.addEventListener("click", async (e) => {
        const g = (e.target as Element).closest<SVGGElement>(".esquema-task");
        if (!g) return;

        // getAttribute() statt .dataset: SVGElement.dataset ist in älteren
        // WebKit-Versionen (u.a. eingebettete WebViews) unzuverlässig und lieferte
        // dort still undefined — der Klick passierte, aber markDone()/unmarkDone()
        // liefen mit einer leeren id ins Leere.
        const id          = g.getAttribute("data-id")!;
        const isCompleted = g.getAttribute("data-completed") === "true";

        if (isCompleted) {
          await this.taskService.unmarkDone(id, todayStr);
        } else {
          await this.taskService.markDone(id);
        }
        await this.render();
      });
  }
}
