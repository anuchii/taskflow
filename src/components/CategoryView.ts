// ============================================================
// components/CategoryView.ts
// ============================================================

import type { Category, Task } from "../models/Task.js";
import type { TaskService } from "../services/TaskService.js";
import type { CategoryService } from "../services/CategoryService.js";
import type { TaskFormModal } from "./TaskFormModal.js";

export class CategoryView {
  constructor(
    private readonly taskService: TaskService,
    private readonly categoryService: CategoryService,
    private readonly container: HTMLElement,
    private readonly modal: TaskFormModal
  ) {}

  async render(): Promise<void> {
    this.container.innerHTML = `<div class="loading">Lädt…</div>`;
    const cats = await this.categoryService.getCategories();
    const allTasks = (await this.taskService.getAllTasks()).filter(t => !t.archived);

    const subMap = this.buildSubMap(cats);
    const topLevel = cats.filter(c => !c.parentId);

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Kategorien</h1>
          <p class="view-subtitle">${cats.length} Kategorie${cats.length !== 1 ? "n" : ""} verwalten</p>
        </div>
        <button class="btn btn-primary" id="btn-new-cat">+ Kategorie</button>
      </div>
      <div class="cat-list" id="cat-list">
        ${topLevel.map(c => this.catItem(c, allTasks, subMap)).join("")}
      </div>
    `;

    this.attachEvents();
    this.attachDragDrop();
  }

  // Baut eine Map parentId → Kinder-Array.
  // Verwaiste Einträge (parentId zeigt auf gelöschte Kategorie) werden als Top-Level behandelt,
  // indem wir sie hier einfach nicht aufnehmen — render() filtert nur c.parentId weg.
  private buildSubMap(cats: Category[]): Map<string, Category[]> {
    const allIds = new Set(cats.map(c => c.id));
    const map = new Map<string, Category[]>();
    for (const c of cats) {
      if (!c.parentId || !allIds.has(c.parentId)) continue;
      const list = map.get(c.parentId) ?? [];
      list.push(c);
      map.set(c.parentId, list);
    }
    return map;
  }

  private catItem(cat: Category, allTasks: Task[], subMap: Map<string, Category[]>): string {
    const taskCount = allTasks.filter(t => t.category === cat.id).length;
    const children = subMap.get(cat.id) ?? [];

    return `
      <div class="cat-item" data-cat-id="${cat.id}" draggable="true">
        <div class="cat-item-row cat-item-row--clickable" data-cat-id="${cat.id}">
          <span class="cat-swatch" style="background:${cat.color}"></span>
          <span class="cat-item-label">${escapeHtml(cat.label)}</span>
          <span class="cat-item-count">${taskCount} Aufgabe${taskCount !== 1 ? "n" : ""}</span>
          <button class="icon-btn cat-edit-btn" data-id="${cat.id}" title="Bearbeiten">✎</button>
          <button class="icon-btn cat-delete-btn" data-id="${cat.id}" title="Löschen">✕</button>
          <span class="cat-chevron" aria-hidden="true">▸</span>
        </div>
        ${children.length > 0 ? `
          <div class="cat-subcategory-list" style="--parent-color: ${cat.color}">
            ${children.map(child => this.catSubItem(child, allTasks)).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  private catSubItem(cat: Category, allTasks: Task[]): string {
    const taskCount = allTasks.filter(t => t.category === cat.id).length;
    return `
      <div class="cat-item cat-item--sub" data-cat-id="${cat.id}" draggable="true">
        <div class="cat-item-row cat-item-row--clickable" data-cat-id="${cat.id}">
          <span class="cat-sub-indent" aria-hidden="true">↳</span>
          <span class="cat-swatch" style="background:${cat.color}"></span>
          <span class="cat-item-label">${escapeHtml(cat.label)}</span>
          <span class="cat-item-count">${taskCount} Aufgabe${taskCount !== 1 ? "n" : ""}</span>
          <button class="icon-btn cat-detach-btn" data-id="${cat.id}" title="Aus Überordnung entfernen">↑</button>
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
        const cats = await this.categoryService.getCategories();
        const cat = cats.find(c => c.id === id);
        if (cat) this.showEditForm(cat);
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>(".cat-delete-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id!;
        const count = await this.categoryService.deleteCategory(id);
        if (count > 0) {
          showToast(`Kategorie wird von ${count} Aufgabe${count !== 1 ? "n" : ""} verwendet – bitte zuerst neu zuweisen.`, "error");
        } else {
          await this.render();
        }
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>(".cat-detach-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.categoryService.setCategoryParent(btn.dataset.id!, null);
        await this.render();
      });
    });
  }

  // Drag & Drop: jedes cat-item ist Drag-Quelle; nur Top-Level-Items sind Drop-Ziele.
  // Zwei-Ebenen-Grenze wird durch den Guard enforced: wer selbst Kinder hat, darf kein Kind werden.
  private attachDragDrop(): void {
    let draggedId: string | null = null;

    this.container.querySelectorAll<HTMLElement>(".cat-item[draggable]").forEach(item => {
      item.addEventListener("dragstart", e => {
        // dragstart bubblt — e.target ist das Original-Element, nicht das Element des Listeners.
        // Ohne diesen Guard würde ein Sub-Item-Drag den Handler des Eltern-Items triggern
        // und draggedId mit der falschen (Eltern-)ID überschreiben.
        if (e.target !== item) return;
        draggedId = item.dataset.catId!;
        e.dataTransfer!.effectAllowed = "move";
        requestAnimationFrame(() => item.classList.add("cat-item--dragging"));
      });

      item.addEventListener("dragend", e => {
        if (e.target !== item) return;
        draggedId = null;
        item.classList.remove("cat-item--dragging");
        this.container.querySelectorAll(".cat-item--drag-over")
          .forEach(el => el.classList.remove("cat-item--drag-over"));
      });
    });

    this.container.querySelectorAll<HTMLElement>(".cat-item:not(.cat-item--sub)").forEach(target => {
      const targetId = target.dataset.catId!;

      target.addEventListener("dragover", e => {
        if (!draggedId || draggedId === targetId) return;
        // Unterdrücken wenn das gezogene Element bereits ein Kind dieses Targets ist
        const draggedEl = this.container.querySelector<HTMLElement>(`.cat-item[data-cat-id="${draggedId}"]`);
        if (draggedEl && target.contains(draggedEl)) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
        target.classList.add("cat-item--drag-over");
      });

      target.addEventListener("dragleave", e => {
        // relatedTarget prüfen: Klasse nur entfernen wenn wir den Container wirklich verlassen
        if (!target.contains(e.relatedTarget as Node)) {
          target.classList.remove("cat-item--drag-over");
        }
      });

      target.addEventListener("drop", async e => {
        e.preventDefault();
        target.classList.remove("cat-item--drag-over");
        if (!draggedId || draggedId === targetId) return;

        const draggedEl = this.container.querySelector<HTMLElement>(`.cat-item[data-cat-id="${draggedId}"]`);
        if (draggedEl && target.contains(draggedEl)) return;

        // Verhindert 3-stufige Hierarchie: eine Kategorie mit Kindern darf selbst kein Kind werden
        if (draggedEl?.querySelector(".cat-subcategory-list")) {
          showToast("Kategorien mit Unterkategorien können nicht verschoben werden.", "info");
          return;
        }

        await this.categoryService.setCategoryParent(draggedId, targetId);
        await this.render();
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
        await this.categoryService.updateCategory(cat.id, label, color);
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
        await this.categoryService.createCategory(label, color);
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
