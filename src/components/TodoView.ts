// ============================================================
// components/TodoView.ts
// ============================================================

import type { Task } from "../models/Task.js";
import type { TaskService } from "../services/TaskService.js";
import type { TaskFormModal } from "./TaskFormModal.js";
import { today, formatDisplay } from "../utils/DateUtils.js";

type TaskWithOverdue = Task & { daysOverdue: number };

export class TodoView {
  constructor(
    private readonly taskService: TaskService,
    private readonly modal: TaskFormModal,
    private readonly container: HTMLElement
  ) {}

  async render(): Promise<void> {
    this.container.innerHTML = `<div class="loading">Lädt…</div>`;
    const todayStr = today();
    const tasks = await this.taskService.getTasksForDateWithOverdue(todayStr);

    const pending: TaskWithOverdue[] = [];
    const done: TaskWithOverdue[] = [];
    for (const t of tasks) {
      if (await this.taskService.isCompletedOn(t.id, todayStr)) done.push(t);
      else pending.push(t);
    }

    const pendingCards = await Promise.all(pending.map((t) => this.taskCard(t, false)));
    const doneCards = await Promise.all(
      done.map(async (t) => {
        const actual = await this.taskService.getActualMinutes(t.id, todayStr);
        return this.taskCard(t, true, actual);
      })
    );

    const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0);
    const timeLabel = totalMinutes > 0 ? ` · ~${formatEstimatedTime(totalMinutes)} geplant` : "";

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Aufgaben</h1>
          <p class="view-subtitle">${formatDisplay(todayStr)} · ${done.length}/${tasks.length} erledigt${timeLabel}</p>
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
          const task = tasks.find((t) => t.id === id);
          setTimeout(() => {
            this.showTimeDialog(task?.estimatedMinutes, async (actualMinutes) => {
              await this.taskService.markDone(id);
              if (actualMinutes != null) {
                await this.taskService.logActualTime(id, todayStr, actualMinutes);
              }
              await this.render();
            });
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

    this.container.querySelectorAll<HTMLButtonElement>(".log-time-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id!;
        const pre = btn.dataset.est ?? "";
        const timeLog = btn.closest<HTMLElement>(".time-log")!;
        timeLog.innerHTML = `
          <div class="log-time-inline">
            <input type="number" class="log-time-input" value="${pre}" min="1" max="1440" placeholder="Min" />
            <button class="log-time-confirm" title="Speichern">✓</button>
            <button class="log-time-cancel" title="Abbrechen">✕</button>
          </div>`;
        const input = timeLog.querySelector<HTMLInputElement>(".log-time-input")!;
        input.focus();
        input.select();

        timeLog.querySelector(".log-time-confirm")!.addEventListener("click", async () => {
          const mins = parseInt(input.value, 10);
          if (mins > 0) {
            await this.taskService.logActualTime(id, todayStr, mins);
            await this.render();
          }
        });
        input.addEventListener("keydown", async (e) => {
          if (e.key === "Enter") {
            const mins = parseInt(input.value, 10);
            if (mins > 0) {
              await this.taskService.logActualTime(id, todayStr, mins);
              await this.render();
            }
          }
        });
        timeLog.querySelector(".log-time-cancel")!.addEventListener("click", () => this.render());
      });
    });
  }

  private showTimeDialog(estimated: number | undefined, onConfirm: (minutes: number | undefined) => void): void {
    const overlay = document.createElement("div");
    overlay.className = "time-dialog-overlay";
    overlay.innerHTML = `
      <div class="time-dialog-card">
        <p class="time-dialog-title">Wie lange hast du gebraucht?</p>
        ${estimated != null
          ? `<p class="time-dialog-hint">Schätzung: ${estimated} Min — Enter zum Übernehmen</p>`
          : `<p class="time-dialog-hint">Minuten eingeben oder überspringen</p>`}
        <div class="time-dialog-row">
          <input type="number" class="time-dialog-input" placeholder="${estimated ?? "z.B. 30"}" min="1" max="1440" />
          <span class="time-dialog-unit">Min</span>
        </div>
        <div class="time-dialog-actions">
          <button class="btn btn-ghost time-dialog-skip">Überspringen</button>
          <button class="btn btn-primary time-dialog-confirm">Speichern</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector<HTMLInputElement>(".time-dialog-input")!;
    setTimeout(() => input.focus(), 50);

    const confirm = () => {
      const val = input.value.trim();
      const mins = val ? parseInt(val, 10) : estimated;
      overlay.remove();
      onConfirm(mins && mins > 0 ? mins : undefined);
    };
    const skip = () => { overlay.remove(); onConfirm(undefined); };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirm();
      if (e.key === "Escape") skip();
    });
    overlay.querySelector(".time-dialog-confirm")!.addEventListener("click", confirm);
    overlay.querySelector(".time-dialog-skip")!.addEventListener("click", skip);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) skip(); });
  }

  private async taskCard(task: TaskWithOverdue, isDone: boolean, actualMinutes?: number): Promise<string> {
    const cat = await this.taskService.getCategoryById(task.category);
    const repeatLabel = this.repeatLabel(task);
    const overdue = !isDone && task.daysOverdue > 0;
    const overdueLabel = task.daysOverdue === 1 ? "1 Tag überfällig" : `${task.daysOverdue} Tage überfällig`;

    const timeLogHtml = isDone ? `
      <div class="time-log" data-id="${task.id}">
        ${task.estimatedMinutes != null ? `<span class="time-est">⏱ ${task.estimatedMinutes} Min geplant</span>` : ""}
        ${actualMinutes != null
          ? `<span class="time-actual">✓ ${actualMinutes} Min</span>`
          : `<button class="log-time-btn" data-id="${task.id}" data-est="${task.estimatedMinutes ?? ""}">Zeit eintragen</button>`}
      </div>` : "";

    return `
      <div class="task-card ${isDone ? "is-done" : ""} ${overdue ? "is-overdue" : ""}" data-id="${task.id}">
        <button class="check-btn ${isDone ? "checked" : ""}" data-id="${task.id}" data-done="${isDone}">
          ${isDone ? "✓" : ""}
        </button>
        <div class="task-body">
          <div class="task-top">
            <span class="task-title">${escapeHtml(task.title)}</span>
            ${overdue ? `<span class="overdue-badge">${overdueLabel}</span>` : ""}
            ${cat ? `<span class="cat-badge" style="--cat-color:${cat.color}">${escapeHtml(cat.label)}</span>` : ""}
          </div>
          ${task.description ? `<span class="task-desc">${escapeHtml(task.description)}</span>` : ""}
          <span class="task-meta">${repeatLabel}</span>
          ${timeLogHtml}
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
    if (task.repeat.unit === "none") {
      const sd = task.startDate ?? task.createdAt.slice(0, 10);
      const d = new Date(sd + "T00:00:00");
      return `${base} · ${d.toLocaleDateString("de-AT", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    if (task.repeat.endDate) {
      const d = new Date(task.repeat.endDate + "T00:00:00");
      return `${base} bis ${d.toLocaleDateString("de-AT", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    return base;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatEstimatedTime(minutes: number): string {
  if (minutes < 60) return `${minutes} Min`;
  const rounded = Math.round((minutes / 60) * 2) / 2;
  const display = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1).replace(".", ",");
  return `${display} Std`;
}
