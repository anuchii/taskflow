// ============================================================
// components/TaskFormModal.ts
// ============================================================

import type { Task, RepeatConfig, RepeatUnit, Priority } from "../models/Task.js";
import type { TaskService } from "../services/TaskService.js";
import { today, addDays } from "../utils/DateUtils.js";

export class TaskFormModal {
  private overlay: HTMLElement;
  private onSaved: (() => void) | null = null;
  private editingId: string | null = null;

  constructor(private readonly taskService: TaskService) {
    this.overlay = this.buildDOM();
    document.body.appendChild(this.overlay);
    this.attachEvents();
  }

  open(task?: Task): void {
    this.editingId = task?.id ?? null;
    this.reset(task);
    this.overlay.classList.add("active");
  }

  close(): void {
    this.overlay.classList.remove("active");
    this.editingId = null;
  }

  onTaskSaved(cb: () => void): void {
    this.onSaved = cb;
  }

  private buildDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = "modal-overlay";
    el.innerHTML = `
      <div class="modal-card">
        <button class="modal-close" aria-label="Schließen">✕</button>
        <h2 class="modal-title">Neue Aufgabe</h2>

        <div class="form-group">
          <label for="f-title">Titel *</label>
          <input id="f-title" type="text" placeholder="Was ist zu tun?" maxlength="80" />
        </div>

        <div class="form-group">
          <label for="f-desc">Beschreibung</label>
          <textarea id="f-desc" rows="2" placeholder="Optional…"></textarea>
        </div>

        <div class="form-group">
          <label>Kategorie</label>
          <div class="category-picker" id="f-category"></div>
        </div>

        <div class="form-group">
          <label>Priorität</label>
          <div class="priority-picker" id="f-priority">
            <button type="button" class="priority-chip" data-value="high">↑ Hoch</button>
            <button type="button" class="priority-chip" data-value="medium">→ Mittel</button>
            <button type="button" class="priority-chip" data-value="low">↓ Niedrig</button>
          </div>
        </div>

        <div class="form-group">
          <label for="f-date" id="f-date-label">Datum</label>
          <input id="f-date" type="date" />
        </div>

        <div class="form-group">
          <label for="f-est">Zeitschätzung (Min)</label>
          <input id="f-est" type="number" min="1" max="1440" placeholder="z.B. 45" />
        </div>

        <div class="form-group">
          <label for="f-repeat">Wiederholung</label>
          <select id="f-repeat">
            <option value="none">Einmalig</option>
            <option value="daily">Täglich</option>
            <option value="weekly">Wöchentlich</option>
            <option value="monthly">Monatlich</option>
          </select>
        </div>

        <div class="form-group hidden" id="f-end-group">
          <label for="f-end">Wiederholung bis</label>
          <input id="f-end" type="date" />
        </div>

        <div class="form-group">
          <label for="f-due">Fälligkeitsdatum (optional)</label>
          <input id="f-due" type="date" />
        </div>

        <div class="form-actions">
          <button class="btn btn-ghost" id="f-cancel">Abbrechen</button>
          <button class="btn btn-primary" id="f-save">Speichern</button>
        </div>
      </div>
    `;
    return el;
  }

  private attachEvents(): void {
    this.overlay.querySelector(".modal-close")!.addEventListener("click", () => this.close());
    this.overlay.querySelector("#f-cancel")!.addEventListener("click", () => this.close());
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.overlay.querySelectorAll<HTMLButtonElement>(".priority-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const isSelected = btn.classList.contains("selected");
        this.overlay.querySelectorAll(".priority-chip").forEach(b => b.classList.remove("selected"));
        if (!isSelected) btn.classList.add("selected");
      });
    });

    const repeatSel = this.overlay.querySelector<HTMLSelectElement>("#f-repeat")!;
    const endGroup = this.overlay.querySelector<HTMLElement>("#f-end-group")!;
    const dateLabel = this.overlay.querySelector<HTMLElement>("#f-date-label")!;
    repeatSel.addEventListener("change", () => {
      const isOnce = repeatSel.value === "none";
      endGroup.classList.toggle("hidden", isOnce);
      dateLabel.textContent = isOnce ? "Datum" : "Startdatum";
    });

    this.overlay.querySelector("#f-save")!.addEventListener("click", () => this.save());
  }

  private async reset(task?: Task): Promise<void> {
    const title = this.overlay.querySelector<HTMLInputElement>("#f-title")!;
    const desc = this.overlay.querySelector<HTMLTextAreaElement>("#f-desc")!;
    const repeat = this.overlay.querySelector<HTMLSelectElement>("#f-repeat")!;
    const startDate = this.overlay.querySelector<HTMLInputElement>("#f-date")!;
    const dateLabel = this.overlay.querySelector<HTMLElement>("#f-date-label")!;
    const endDate = this.overlay.querySelector<HTMLInputElement>("#f-end")!;
    const endGroup = this.overlay.querySelector<HTMLElement>("#f-end-group")!;
    const modalTitle = this.overlay.querySelector<HTMLElement>(".modal-title")!;
    const est = this.overlay.querySelector<HTMLInputElement>("#f-est")!;
    const dueDate = this.overlay.querySelector<HTMLInputElement>("#f-due")!;
    const priorityPicker = this.overlay.querySelector<HTMLElement>("#f-priority")!;

    // Rebuild category chips dynamically
    const catPicker = this.overlay.querySelector<HTMLElement>("#f-category")!;
    const cats = await this.taskService.getCategories();
    const selectedCatId = task?.category
      ?? cats.find(c => c.id === "sonstiges")?.id
      ?? cats[0]?.id
      ?? "";

    catPicker.innerHTML = cats.map(c => `
      <button type="button" class="cat-chip${c.id === selectedCatId ? " selected" : ""}"
        data-id="${c.id}" style="--cat-color:${c.color}">
        ${escapeHtml(c.label)}
      </button>
    `).join("");

    catPicker.querySelectorAll<HTMLButtonElement>(".cat-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        catPicker.querySelectorAll(".cat-chip").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });

    priorityPicker.querySelectorAll(".priority-chip").forEach(b => b.classList.remove("selected"));

    if (task) {
      title.value = task.title;
      desc.value = task.description;
      repeat.value = task.repeat.unit;
      startDate.value = task.startDate ?? task.createdAt.slice(0, 10);
      endDate.value = task.repeat.endDate ?? "";
      est.value = task.estimatedMinutes != null ? String(task.estimatedMinutes) : "";
      dueDate.value = task.dueDate ?? "";
      if (task.priority) {
        priorityPicker.querySelector<HTMLButtonElement>(`[data-value="${task.priority}"]`)?.classList.add("selected");
      }
      const isOnce = task.repeat.unit === "none";
      endGroup.classList.toggle("hidden", isOnce);
      dateLabel.textContent = isOnce ? "Datum" : "Startdatum";
      modalTitle.textContent = "Aufgabe bearbeiten";
    } else {
      title.value = "";
      desc.value = "";
      repeat.value = "none";
      startDate.value = today();
      endDate.value = addDays(today(), 30);
      est.value = "";
      dueDate.value = "";
      endGroup.classList.add("hidden");
      dateLabel.textContent = "Datum";
      modalTitle.textContent = "Neue Aufgabe";
    }
  }

  private async save(): Promise<void> {
    const titleEl = this.overlay.querySelector<HTMLInputElement>("#f-title")!;
    const title = titleEl.value.trim();
    if (!title) { titleEl.focus(); return; }

    const desc = this.overlay.querySelector<HTMLTextAreaElement>("#f-desc")!.value.trim();
    const repeatUnit = this.overlay.querySelector<HTMLSelectElement>("#f-repeat")!.value as RepeatUnit;
    const startDateVal = this.overlay.querySelector<HTMLInputElement>("#f-date")!.value || today();
    const endDateVal = this.overlay.querySelector<HTMLInputElement>("#f-end")!.value;
    const catPicker = this.overlay.querySelector<HTMLElement>("#f-category")!;
    const selectedCat = catPicker.querySelector<HTMLButtonElement>(".cat-chip.selected")?.dataset.id ?? "sonstiges";
    const estRaw = this.overlay.querySelector<HTMLInputElement>("#f-est")!.value;
    const estimatedMinutes = estRaw ? Math.max(1, parseInt(estRaw, 10)) : undefined;
    const dueDateVal = this.overlay.querySelector<HTMLInputElement>("#f-due")!.value || undefined;
    const priority = (this.overlay.querySelector<HTMLButtonElement>("#f-priority .priority-chip.selected")?.dataset.value ?? undefined) as Priority | undefined;

    const repeat: RepeatConfig = {
      unit: repeatUnit,
      interval: 1,
      endDate: repeatUnit !== "none" && endDateVal ? endDateVal : null,
    };

    const saveBtn = this.overlay.querySelector<HTMLButtonElement>("#f-save")!;
    saveBtn.textContent = "Speichern…";
    saveBtn.disabled = true;

    if (this.editingId) {
      await this.taskService.updateTask(this.editingId, { title, description: desc, category: selectedCat, repeat, startDate: startDateVal, estimatedMinutes, dueDate: dueDateVal, priority });
    } else {
      await this.taskService.createTask(title, desc, selectedCat, repeat, startDateVal, estimatedMinutes, dueDateVal, priority);
    }

    saveBtn.textContent = "Speichern";
    saveBtn.disabled = false;
    this.close();
    this.onSaved?.();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
