// ============================================================
// components/TodoView.ts
// ============================================================

import type { Task } from "../models/Task.js";
import type { TaskService } from "../services/TaskService.js";
import type { TaskFormModal } from "./TaskFormModal.js";
import { today, formatDisplay } from "../utils/DateUtils.js";

export class TodoView {
  constructor(
    private readonly taskService: TaskService,
    private readonly modal: TaskFormModal,
    private readonly container: HTMLElement
  ) {}

  async render(): Promise<void> {
    this.container.innerHTML = `<div class="loading">Lädt…</div>`;
    const todayStr = today();
    const tasks = await this.taskService.getTasksForDate(todayStr);

    const pending: Task[] = [];
    const done: Task[] = [];
    for (const t of tasks) {
      if (await this.taskService.isCompletedOn(t.id, todayStr)) done.push(t);
      else pending.push(t);
    }

    const taskCards = await Promise.all([
      ...pending.map(t => this.taskCard(t, false)),
      ...done.map(t => this.taskCard(t, true)),
    ]);
    const pendingCards = taskCards.slice(0, pending.length);
    const doneCards = taskCards.slice(pending.length);

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Heute</h1>
          <p class="view-subtitle">${formatDisplay(todayStr)} · ${done.length}/${tasks.length} erledigt</p>
        </div>
        <button class="btn btn-primary" id="btn-new-task">+ Aufgabe</button>
      </div>

      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${tasks.length ? (done.length / tasks.length) * 100 : 0}%"></div>
      </div>

      <section class="task-section">
        ${pending.length === 0 && done.length === 0
          ? `<div class="empty-state">
               <span class="empty-icon">✓</span>
               <p>Keine Aufgaben heute.<br>Erstelle eine neue Aufgabe!</p>
             </div>`
          : ""}
        ${pendingCards.join("")}
      </section>

      ${done.length > 0 ? `
        <details class="done-section" ${done.length < 3 ? "open" : ""}>
          <summary>Erledigt (${done.length})</summary>
          <div class="task-section done-list">
            ${doneCards.join("")}
          </div>
        </details>` : ""}
    `;

    this.container.querySelector("#btn-new-task")?.addEventListener("click", () => {
      this.modal.open();
    });

    this.container.querySelectorAll<HTMLButtonElement>(".check-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id!;
        if (btn.dataset.done === "true") {
          await this.taskService.unmarkDone(id);
          await this.render();
        } else {
          btn.closest<HTMLElement>(".task-card")?.classList.add("completing");
          setTimeout(async () => {
            await this.taskService.markDone(id);
            await this.render();
          }, 350);
        }
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const task = (await this.taskService.getAllTasks()).find((t) => t.id === btn.dataset.id);
        if (task) this.modal.open(task);
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>(".archive-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (confirm("Aufgabe archivieren?")) {
          await this.taskService.archiveTask(btn.dataset.id!);
          await this.render();
        }
      });
    });
  }

  private async taskCard(task: Task, isDone: boolean): Promise<string> {
    const cat = await this.taskService.getCategoryById(task.category);
    const repeatLabel = this.repeatLabel(task);
    return `
      <div class="task-card ${isDone ? "is-done" : ""}" data-id="${task.id}">
        <button class="check-btn ${isDone ? "checked" : ""}" data-id="${task.id}" data-done="${isDone}">
          ${isDone ? "✓" : ""}
        </button>
        <div class="task-body">
          <div class="task-top">
            <span class="task-title">${escapeHtml(task.title)}</span>
            ${cat ? `<span class="cat-badge" style="--cat-color:${cat.color}">${escapeHtml(cat.label)}</span>` : ""}
          </div>
          ${task.description ? `<span class="task-desc">${escapeHtml(task.description)}</span>` : ""}
          <span class="task-meta">${repeatLabel}</span>
        </div>
        <div class="task-actions">
          <button class="icon-btn edit-btn" data-id="${task.id}" title="Bearbeiten">✎</button>
          <button class="icon-btn archive-btn" data-id="${task.id}" title="Archivieren">⊠</button>
        </div>
      </div>
    `;
  }

  private repeatLabel(task: Task): string {
    const map: Record<string, string> = {
      none: "Einmalig", daily: "Täglich", weekly: "Wöchentlich", monthly: "Monatlich",
    };
    const base = map[task.repeat.unit] ?? task.repeat.unit;
    if (task.repeat.endDate && task.repeat.unit !== "none") {
      const d = new Date(task.repeat.endDate + "T00:00:00");
      return `${base} bis ${d.toLocaleDateString("de-AT", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    return base;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
