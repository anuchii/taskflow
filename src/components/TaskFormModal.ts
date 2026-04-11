// ============================================================
// components/TaskFormModal.ts
// ============================================================

import type { Task, RepeatConfig, RepeatUnit } from "../models/Task.js";
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
          <label for="f-date" id="f-date-label">Datum</label>
          <input id="f-date" type="date" />
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

    if (task) {
      title.value = task.title;
      desc.value = task.description;
      repeat.value = task.repeat.unit;
      startDate.value = task.startDate ?? task.createdAt.slice(0, 10);
      endDate.value = task.repeat.endDate ?? "";
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

    const repeat: RepeatConfig = {
      unit: repeatUnit,
      interval: 1,
      endDate: repeatUnit !== "none" && endDateVal ? endDateVal : null,
    };

    const saveBtn = this.overlay.querySelector<HTMLButtonElement>("#f-save")!;
    saveBtn.textContent = "Speichern…";
    saveBtn.disabled = true;

    if (this.editingId) {
      await this.taskService.updateTask(this.editingId, { title, description: desc, category: selectedCat, repeat, startDate: startDateVal });
    } else {
      await this.taskService.createTask(title, desc, selectedCat, repeat, startDateVal);
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
