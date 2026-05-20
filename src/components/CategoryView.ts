// ============================================================
// components/CategoryView.ts
// ============================================================

import type { Category } from "../models/Task.js";
import type { TaskService } from "../services/TaskService.js";
import type { TaskFormModal } from "./TaskFormModal.js";

export class CategoryView {
  constructor(
    private readonly taskService: TaskService,
    private readonly container: HTMLElement,
    private readonly modal: TaskFormModal
  ) {}

  async render(): Promise<void> {
    this.container.innerHTML = `<div class="loading">Lädt…</div>`;
    const cats = await this.taskService.getCategories();
    const allTasks = (await this.taskService.getAllTasks()).filter(t => !t.archived);

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Kategorien</h1>
          <p class="view-subtitle">${cats.length} Kategorie${cats.length !== 1 ? "n" : ""} verwalten</p>
        </div>
        <button class="btn btn-primary" id="btn-new-cat">+ Kategorie</button>
      </div>
      <div class="cat-list" id="cat-list">
        ${cats.map(c => this.catItem(c, allTasks.filter(t => t.category === c.id).length)).join("")}
      </div>
    `;

    this.attachEvents();
  }

  private catItem(cat: Category, taskCount: number): string {
    return `
      <div class="cat-item" data-cat-id="${cat.id}">
        <div class="cat-item-row cat-item-row--clickable" data-cat-id="${cat.id}">
          <span class="cat-swatch" style="background:${cat.color}"></span>
          <span class="cat-item-label">${escapeHtml(cat.label)}</span>
          <span class="cat-item-count">${taskCount} Aufgabe${taskCount !== 1 ? "n" : ""}</span>
          <button class="icon-btn cat-edit-btn" data-id="${cat.id}" title="Bearbeiten">✎</button>
          <button class="icon-btn cat-delete-btn" data-id="${cat.id}" title="Löschen">✕</button>
          <span class="cat-chevron" aria-hidden="true">▸</span>
        </div>
      </div>
    `;
  }

  private attachEvents(): void {
    this.container.querySelector("#btn-new-cat")?.addEventListener("click", () => {
      this.showNewForm();
    });

    this.container.querySelectorAll<HTMLElement>(".cat-item-row--clickable").forEach(row => {
      row.addEventListener("click", () => this.toggleTaskList(row.dataset.catId!));
    });

    this.container.querySelectorAll<HTMLButtonElement>(".cat-edit-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id!;
        const cats = await this.taskService.getCategories();
        const cat = cats.find(c => c.id === id);
        if (cat) this.showEditForm(cat);
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>(".cat-delete-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id!;
        const count = await this.taskService.deleteCategory(id);
        if (count > 0) {
          showToast(`Kategorie wird von ${count} Aufgabe${count !== 1 ? "n" : ""} verwendet – bitte zuerst neu zuweisen.`, "error");
        } else {
          await this.render();
        }
      });
    });
  }

  private async toggleTaskList(catId: string): Promise<void> {
    const item = this.container.querySelector<HTMLElement>(`.cat-item[data-cat-id="${catId}"]`);
    if (!item) return;

    const existing = item.querySelector(".cat-task-list");
    const chevron = item.querySelector<HTMLElement>(".cat-chevron")!;

    if (existing) {
      existing.remove();
      chevron.textContent = "▸";
      return;
    }

    chevron.textContent = "▾";

    const tasks = (await this.taskService.getAllTasks()).filter(t => !t.archived && t.category === catId);
    const panel = document.createElement("div");
    panel.className = "cat-task-list";

    if (tasks.length === 0) {
      panel.innerHTML = `<p class="cat-task-empty">Keine Aufgaben in dieser Kategorie.</p>`;
    } else {
      panel.innerHTML = tasks.map(t => `
        <div class="cat-task-item" data-task-id="${t.id}">
          <span class="cat-task-title">${escapeHtml(t.title)}</span>
          <div class="cat-task-actions">
            <span class="cat-task-edit-hint" aria-hidden="true">✎</span>
            <button class="icon-btn cat-task-delete-btn" data-task-id="${t.id}" title="Archivieren">✕</button>
          </div>
        </div>
      `).join("");

      panel.querySelectorAll<HTMLElement>(".cat-task-item").forEach(el => {
        const taskId = el.dataset.taskId!;
        const task = tasks.find(t => t.id === taskId)!;
        el.addEventListener("click", () => this.modal.open(task));
      });

      panel.querySelectorAll<HTMLButtonElement>(".cat-task-delete-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await this.taskService.archiveTask(btn.dataset.taskId!);
          this.removeTaskRow(btn.dataset.taskId!, catId, panel);
        });
      });
    }

    // Edit-Formular bleibt immer unten — Task-Panel davor einfügen falls es schon offen ist
    const editForm = item.querySelector(".cat-edit-form");
    if (editForm) {
      item.insertBefore(panel, editForm);
    } else {
      item.appendChild(panel);
    }
  }

  private removeTaskRow(taskId: string, catId: string, panel: HTMLElement): void {
    panel.querySelector<HTMLElement>(`.cat-task-item[data-task-id="${taskId}"]`)?.remove();

    const remaining = panel.querySelectorAll(".cat-task-item").length;
    if (remaining === 0) {
      panel.innerHTML = `<p class="cat-task-empty">Keine Aufgaben in dieser Kategorie.</p>`;
    }

    const countEl = this.container.querySelector<HTMLElement>(`.cat-item[data-cat-id="${catId}"] .cat-item-count`);
    if (countEl) {
      const n = remaining;
      countEl.textContent = `${n} Aufgabe${n !== 1 ? "n" : ""}`;
    }
  }

  private showEditForm(cat: Category): void {
    this.container.querySelectorAll(".cat-edit-form").forEach(el => el.remove());
    const item = this.container.querySelector<HTMLElement>(`.cat-item[data-cat-id="${cat.id}"]`);
    if (!item) return;

    const form = document.createElement("div");
    form.className = "cat-edit-form";
    form.innerHTML = `
      <div class="cat-edit-row">
        <input type="text" class="cat-edit-label" value="${escapeHtml(cat.label)}" placeholder="Name der Kategorie" maxlength="40" />
        <input type="color" class="cat-edit-color" value="${cat.color}" />
      </div>
      <div class="cat-edit-actions">
        <button class="btn btn-ghost cat-edit-cancel">Abbrechen</button>
        <button class="btn btn-primary cat-edit-save">Speichern</button>
      </div>
    `;
    item.appendChild(form);
    form.querySelector<HTMLInputElement>(".cat-edit-label")!.focus();

    form.querySelector(".cat-edit-cancel")!.addEventListener("click", () => form.remove());
    form.querySelector(".cat-edit-save")!.addEventListener("click", async () => {
      const label = form.querySelector<HTMLInputElement>(".cat-edit-label")!.value.trim();
      if (!label) { form.querySelector<HTMLInputElement>(".cat-edit-label")!.focus(); return; }
      const color = form.querySelector<HTMLInputElement>(".cat-edit-color")!.value;
      const saveBtn = form.querySelector<HTMLButtonElement>(".cat-edit-save")!;
      saveBtn.disabled = true;
      saveBtn.textContent = "Speichert…";
      try {
        await this.taskService.updateCategory(cat.id, label, color);
        await this.render();
      } catch (e) {
        console.error("[CategoryView] Kategorie konnte nicht gespeichert werden:", e);
        showToast("Fehler beim Speichern – Internetverbindung prüfen.", "error");
        saveBtn.disabled = false;
        saveBtn.textContent = "Speichern";
      }
    });
  }

  private showNewForm(): void {
    this.container.querySelectorAll(".cat-edit-form").forEach(el => el.remove());
    const list = this.container.querySelector<HTMLElement>("#cat-list")!;

    const item = document.createElement("div");
    item.className = "cat-item";
    item.innerHTML = `
      <div class="cat-edit-form no-top-border">
        <div class="cat-edit-row">
          <input type="text" class="cat-edit-label" placeholder="Name der Kategorie" maxlength="40" />
          <input type="color" class="cat-edit-color" value="#5b8dee" />
        </div>
        <div class="cat-edit-actions">
          <button class="btn btn-ghost cat-edit-cancel">Abbrechen</button>
          <button class="btn btn-primary cat-edit-save">Erstellen</button>
        </div>
      </div>
    `;
    list.appendChild(item);
    item.querySelector<HTMLInputElement>(".cat-edit-label")!.focus();

    item.querySelector(".cat-edit-cancel")!.addEventListener("click", () => item.remove());
    item.querySelector(".cat-edit-save")!.addEventListener("click", async () => {
      const label = item.querySelector<HTMLInputElement>(".cat-edit-label")!.value.trim();
      if (!label) { item.querySelector<HTMLInputElement>(".cat-edit-label")!.focus(); return; }
      const color = item.querySelector<HTMLInputElement>(".cat-edit-color")!.value;
      const saveBtn = item.querySelector<HTMLButtonElement>(".cat-edit-save")!;
      saveBtn.disabled = true;
      saveBtn.textContent = "Erstellt…";
      try {
        await this.taskService.createCategory(label, color);
        await this.render();
      } catch (e) {
        console.error("[CategoryView] Kategorie konnte nicht erstellt werden:", e);
        showToast("Fehler beim Erstellen – Internetverbindung prüfen.", "error");
        saveBtn.disabled = false;
        saveBtn.textContent = "Erstellen";
      }
    });
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
