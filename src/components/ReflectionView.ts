// ============================================================
// components/ReflectionView.ts
// ============================================================

import type { Task } from "../models/Task.js";
import type { TaskService } from "../services/TaskService.js";
import { today, formatDisplay } from "../utils/DateUtils.js";

export class ReflectionView {
  constructor(
    private readonly taskService: TaskService,
    private readonly container: HTMLElement
  ) {}

  async render(): Promise<void> {
    this.container.innerHTML = `<div class="loading">Lädt…</div>`;
    const todayStr = today();

    const [existing, todayTasks] = await Promise.all([
      this.taskService.getReflectionForDate(todayStr),
      this.taskService.getTasksForDateWithOverdue(todayStr),
    ]);

    const completedTasks: Task[] = [];
    for (const t of todayTasks) {
      if (await this.taskService.isCompletedOn(t.id, todayStr)) completedTasks.push(t);
    }

    const alreadySaved = existing != null;

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Reflexion</h1>
          <p class="view-subtitle">${formatDisplay(todayStr)}${alreadySaved ? " · bereits gespeichert" : ""}</p>
        </div>
      </div>

      <div class="reflection-sections">

        <div class="reflection-section">
          <h2 class="reflection-question">Wie war mein Tag?</h2>
          <div class="rating-circles" id="rating-day">
            ${this.ratingCirclesHtml(existing?.dayRating)}
          </div>
        </div>

        <div class="reflection-section">
          <h2 class="reflection-question">War ich motiviert?</h2>
          <div class="rating-circles" id="rating-motivation">
            ${this.ratingCirclesHtml(existing?.motivationRating)}
          </div>
        </div>

        ${completedTasks.length > 0 ? `
          <div class="reflection-section">
            <h2 class="reflection-question">Welche Aufgaben haben mir heute Spaß gemacht?</h2>
            <p class="reflection-hint">Mehrfachauswahl möglich</p>
            <div class="fun-tasks-picker" id="fun-tasks">
              ${completedTasks.map((t) => `
                <button class="fun-task-chip ${existing?.funTaskIds.includes(t.id) ? "selected" : ""}"
                  data-id="${t.id}" type="button">
                  ${escapeHtml(t.title)}
                </button>`).join("")}
            </div>
          </div>` : ""}

        <div class="reflection-actions">
          <button class="btn btn-primary" id="btn-save-reflection">
            ${alreadySaved ? "Reflexion aktualisieren" : "Reflexion speichern"}
          </button>
        </div>

      </div>
    `;

    this.container.querySelectorAll(".rating-circles").forEach((group) => {
      group.querySelectorAll<HTMLButtonElement>(".rating-circle").forEach((btn) => {
        btn.addEventListener("click", () => {
          group.querySelectorAll(".rating-circle").forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
        });
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>(".fun-task-chip").forEach((chip) => {
      chip.addEventListener("click", () => chip.classList.toggle("selected"));
    });

    this.container.querySelector("#btn-save-reflection")?.addEventListener("click", async () => {
      await this.save(todayStr, completedTasks);
    });
  }

  private ratingCirclesHtml(selected?: number): string {
    return Array.from({ length: 10 }, (_, i) => {
      const val = i + 1;
      return `<button class="rating-circle ${selected === val ? "selected" : ""}" data-value="${val}" type="button">${val}</button>`;
    }).join("");
  }

  private async save(dateStr: string, completedTasks: Task[]): Promise<void> {
    const dayRating = parseInt(
      this.container.querySelector<HTMLButtonElement>("#rating-day .rating-circle.selected")?.dataset.value ?? "0"
    );
    const motivationRating = parseInt(
      this.container.querySelector<HTMLButtonElement>("#rating-motivation .rating-circle.selected")?.dataset.value ?? "0"
    );

    if (dayRating === 0 || motivationRating === 0) {
      showToast("Bitte beide Bewertungen ausfüllen.", "error");
      return;
    }

    const funTaskIds = Array.from(
      this.container.querySelectorAll<HTMLButtonElement>(".fun-task-chip.selected")
    ).map((el) => el.dataset.id!);

    const funCategoryIds = [...new Set(
      completedTasks.filter((t) => funTaskIds.includes(t.id)).map((t) => t.category)
    )];

    const saveBtn = this.container.querySelector<HTMLButtonElement>("#btn-save-reflection")!;
    saveBtn.textContent = "Speichern…";
    saveBtn.disabled = true;

    await this.taskService.saveReflection({ date: dateStr, dayRating, motivationRating, funTaskIds, funCategoryIds });

    saveBtn.textContent = "Gespeichert ✓";
    saveBtn.disabled = false;
    showToast("Reflexion gespeichert!", "success");
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showToast(message: string, type: "success" | "error" | "info" = "info"): void {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
