// ============================================================
// components/EsquemaView.ts
// Mind-Map-Ansicht ("Esquema") für den heutigen Tag:
// Tag-Blase in der Mitte, Aufgaben-Blasen radial verteilt.
// ============================================================

import type { Task, Category } from "../models/Task.js";
import type { TaskService } from "../services/TaskService.js";
import type { TaskFormModal } from "./TaskFormModal.js";
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
  // Mittelpunkt der Tages-Blase in SVG-Koordinaten — wird beim Bau des SVGs
  // gesetzt und beim Drag-Out-Gesture gebraucht, um zu prüfen ob der Loslass-
  // Punkt noch innerhalb der Tages-Blase liegt (dann: kein echter "Zieh"-Vorgang).
  private centerX = 0;
  private centerY = 0;

  constructor(
    private readonly taskService: TaskService,
    private readonly modal: TaskFormModal,
    private readonly container: HTMLElement
  ) {}

  async render(): Promise<void> {
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
    this.centerX = cx;
    this.centerY = cy;

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
          fill="#fff" font-size="15" font-weight="700">${escapeHtml(dayName)}</text>
        <text x="${cx}" y="${cy + 6}" text-anchor="middle"
          fill="#fff" font-size="11">${escapeHtml(dateLabel)}</text>
        <text x="${cx}" y="${cy + 22}" text-anchor="middle"
          fill="#ffffffcc" font-size="10">${progress}</text>
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

    this.attachCreateByDrag();
  }

  // ─── Neue Aufgabe durch Herausziehen aus der Tages-Blase ──
  private attachCreateByDrag(): void {
    const svg = this.container.querySelector<SVGSVGElement>(".esquema-svg");
    const dayBubble = this.container.querySelector<SVGGElement>(".esquema-day-bubble");
    if (!svg || !dayBubble) return;

    dayBubble.addEventListener("mousedown", (e) => {
      e.preventDefault(); // verhindert Textauswahl während des Ziehens
      dayBubble.classList.add("is-dragging");

      const onMouseUp = (upEvent: MouseEvent) => {
        dayBubble.classList.remove("is-dragging");

        // Losgelassen auf einer bestehenden Aufgaben-Blase → abbrechen,
        // dort ist bereits eine Aufgabe, kein Platz für eine neue.
        const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        if (target?.closest(".esquema-task")) return;

        // Losgelassen noch innerhalb der Tages-Blase → kein echtes
        // Herausziehen, sondern eher ein Klick auf die Mitte → abbrechen.
        const p = this.toSvgPoint(svg, upEvent.clientX, upEvent.clientY);
        const dx = (p.x - this.centerX) / DAY_RX;
        const dy = (p.y - this.centerY) / DAY_RY;
        if (dx * dx + dy * dy <= 1) return;

        this.modal.open();
      };

      document.addEventListener("mouseup", onMouseUp, { once: true });
    });
  }

  // Rechnet Bildschirm-Koordinaten (clientX/clientY) in SVG-Koordinaten um —
  // nötig weil das SVG über viewBox skaliert wird und Mausposition sonst
  // nicht mit den intern verwendeten cx/cy-Werten vergleichbar wäre.
  private toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): DOMPoint {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : pt;
  }
}
