// ============================================================
// components/CategoryView.ts
// ============================================================

import type { Category } from "../models/Task.js";
import type { TaskService } from "../services/TaskService.js";

export class CategoryView {
  constructor(
    private readonly taskService: TaskService,
    private readonly container: HTMLElement
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
        <div class="cat-item-row">
          <span class="cat-swatch" style="background:${cat.color}"></span>
          <span class="cat-item-label">${escapeHtml(cat.label)}</span>
          <span class="cat-item-count">${taskCount} Aufgabe${taskCount !== 1 ? "n" : ""}</span>
          <button class="icon-btn cat-edit-btn" data-id="${cat.id}" title="Bearbeiten">✎</button>
          <button class="icon-btn cat-delete-btn" data-id="${cat.id}" title="Löschen">✕</button>
        </div>
      </div>
    `;
  }

  private attachEvents(): void {
    this.container.querySelector("#btn-new-cat")?.addEventListener("click", () => {
      this.showNewForm();
    });

    this.container.querySelectorAll<HTMLButtonElement>(".cat-edit-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id!;
        const cats = await this.taskService.getCategories();
        const cat = cats.find(c => c.id === id);
        if (cat) this.showEditForm(cat);
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>(".cat-delete-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id!;
        const count = await this.taskService.deleteCategory(id);
        if (count > 0) {
          alert(`Diese Kategorie wird von ${count} Aufgabe${count !== 1 ? "n" : ""} verwendet.\nBitte weise ihnen zuerst eine andere Kategorie zu.`);
        } else {
          await this.render();
        }
      });
    });
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
      await this.taskService.updateCategory(cat.id, label, color);
      await this.render();
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
      await this.taskService.createCategory(label, color);
      await this.render();
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
