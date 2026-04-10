// ============================================================
// app.ts — Entry point
// ============================================================

import { StorageService } from "./services/StorageService.js";
import { TaskService } from "./services/TaskService.js";
import { TaskFormModal } from "./components/TaskFormModal.js";
import { TodoView } from "./components/TodoView.js";
import { StatsView } from "./components/StatsView.js";
import { CategoryView } from "./components/CategoryView.js";

type Route = "todo" | "stats" | "kategorien";

class App {
  private readonly storage = new StorageService();
  private readonly taskService = new TaskService(this.storage);
  private readonly modal: TaskFormModal;
  private readonly todoView: TodoView;
  private readonly statsView: StatsView;
  private readonly categoryView: CategoryView;
  private readonly mainEl: HTMLElement;

  constructor() {
    this.mainEl = document.getElementById("main-content")!;
    this.modal = new TaskFormModal(this.taskService);
    this.todoView = new TodoView(this.taskService, this.modal, this.mainEl);
    this.statsView = new StatsView(this.taskService, this.mainEl);
    this.categoryView = new CategoryView(this.taskService, this.mainEl);

    this.modal.onTaskSaved(async () => {
      const route = this.currentRoute();
      if (route === "todo") await this.todoView.render();
      else if (route === "stats") await this.statsView.render();
    });

    this.setupNav();
    this.setupImportExport();
    this.navigate(this.currentRoute());
  }

  private currentRoute(): Route {
    const h = location.hash.replace("#", "") as Route;
    if (h === "stats") return "stats";
    if (h === "kategorien") return "kategorien";
    return "todo";
  }

  private navigate(route: Route): void {
    location.hash = route;
    document.querySelectorAll(".nav-link").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-route") === route);
    });
    if (route === "todo") this.todoView.render();
    else if (route === "stats") this.statsView.render();
    else if (route === "kategorien") this.categoryView.render();
  }

  private setupNav(): void {
    document.querySelectorAll<HTMLElement>(".nav-link").forEach((el) => {
      el.addEventListener("click", () => this.navigate(el.dataset.route as Route));
    });
    window.addEventListener("hashchange", () => this.navigate(this.currentRoute()));
  }

  private setupImportExport(): void {
    document.getElementById("btn-export")?.addEventListener("click", () => {
      this.storage.exportJSON();
    });

    const fileInput = document.getElementById("f-import") as HTMLInputElement;
    document.getElementById("btn-import")?.addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const btn = document.getElementById("btn-import") as HTMLButtonElement;
      btn.textContent = "Importiere…";
      btn.disabled = true;
      try {
        await this.storage.importJSON(file);
        this.navigate(this.currentRoute());
      } catch {
        alert("Fehler beim Importieren. Bitte prüfe das JSON-Format.");
      } finally {
        btn.textContent = "↑ Import JSON";
        btn.disabled = false;
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new App();
});
