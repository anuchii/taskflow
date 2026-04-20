// ============================================================
// components/UpcomingView.ts
// ============================================================

import type { Task } from "../models/Task.js";
import type { TaskService } from "../services/TaskService.js";
import type { TaskFormModal } from "./TaskFormModal.js";
import { parseDate } from "../utils/DateUtils.js";

export class UpcomingView {
  constructor(
    private readonly taskService: TaskService,
    private readonly modal: TaskFormModal,
    private readonly container: HTMLElement
  ) {}

  async render(): Promise<void> {
    this.container.innerHTML = `<div class="loading">Lädt…</div>`;
    const groups = await this.taskService.getUpcomingByDate(30);

    const groupsHtml = groups.length > 0
      ? (await Promise.all(groups.map(({ date, tasks }) => this.renderGroup(date, tasks)))).join("")
      : `<div class="empty-state">
           <span class="empty-icon">◎</span>
           <p>Keine geplanten Aufgaben.<br>Erstelle eine Aufgabe mit einem zukünftigen Datum!</p>
         </div>`;

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Upcoming</h1>
          <p class="view-subtitle">Geplante Aufgaben der nächsten 30 Tage</p>
        </div>
        <button class="btn btn-primary" id="btn-new-task">+ Aufgabe</button>
      </div>
      ${groupsHtml}
    `;

    this.container.querySelector("#btn-new-task")?.addEventListener("click", () => {
      this.modal.open();
    });

    this.container.querySelectorAll<HTMLButtonElement>(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const task = (await this.taskService.getAllTasks()).find((t) => t.id === btn.dataset.id);
        if (task) this.modal.open(task);
      });
    });
  }

  private async renderGroup(date: string, tasks: Task[]): Promise<string> {
    const d = parseDate(date);
    const dateLabel = d.toLocaleDateString("de-AT", {
      weekday: "long", day: "2-digit", month: "long",
    });
    const cards = await Promise.all(tasks.map((t) => this.taskCard(t)));
    return `
      <div class="upcoming-group">
        <div class="upcoming-date-header">
          <span class="upcoming-weekday">${dateLabel}</span>
          <span class="upcoming-count">${tasks.length} Aufgabe${tasks.length !== 1 ? "n" : ""}</span>
        </div>
        <div class="task-section">${cards.join("")}</div>
      </div>`;
  }

  private async taskCard(task: Task): Promise<string> {
    const cat = await this.taskService.getCategoryById(task.category);
    const map: Record<string, string> = {
      none: "Einmalig", daily: "Täglich", weekly: "Wöchentlich", monthly: "Monatlich",
    };
    const repeatLabel = map[task.repeat.unit] ?? task.repeat.unit;
    return `
      <div class="task-card" data-id="${task.id}">
        <div class="task-body">
          <div class="task-top">
            <span class="task-title">${escapeHtml(task.title)}</span>
            ${cat ? `<span class="cat-badge" style="--cat-color:${cat.color}">${escapeHtml(cat.label)}</span>` : ""}
            ${task.estimatedMinutes != null ? `<span class="time-est">⏱ ${task.estimatedMinutes} Min</span>` : ""}
          </div>
          ${task.description ? `<span class="task-desc">${escapeHtml(task.description)}</span>` : ""}
          <span class="task-meta">${repeatLabel}</span>
        </div>
        <div class="task-actions">
          <button class="icon-btn edit-btn" data-id="${task.id}" title="Bearbeiten">✎</button>
        </div>
      </div>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
