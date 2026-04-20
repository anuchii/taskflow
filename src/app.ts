// ============================================================
// app.ts
// Entry point — prüft Auth-Status und zeigt Login oder App
// ============================================================

import { AuthService } from "./services/AuthService.js";
import { TaskService } from "./services/TaskService.js";
import { TaskFormModal } from "./components/TaskFormModal.js";
import { TodoView } from "./components/TodoView.js";
import { UpcomingView } from "./components/UpcomingView.js";
import { StatsView } from "./components/StatsView.js";
import { CategoryView } from "./components/CategoryView.js";
import { LoginView } from "./components/LoginView.js";
import { getAuth, getRedirectResult } from "firebase/auth";
import { StorageService, firebaseApp } from "./services/StorageService.js";

type Route = "todo" | "upcoming" | "stats" | "kategorien" | "reflexion";

class App {
  private readonly authService = new AuthService();
  private readonly storage = new StorageService();
  private readonly taskService = new TaskService(this.storage);
  private readonly mainEl: HTMLElement;
  private readonly sidebarEl: HTMLElement;
  private modal!: TaskFormModal;
  private todoView!: TodoView;
  private upcomingView!: UpcomingView;
  private statsView!: StatsView;
  private categoryView!: CategoryView;
  private loginView: LoginView;

  constructor() {
    this.mainEl = document.getElementById("main-content")!;
    this.sidebarEl = document.querySelector(".sidebar")!;
    this.loginView = new LoginView(this.authService, this.mainEl);

    
    getRedirectResult(getAuth(firebaseApp)).catch(console.error);


    this.authService.onAuthChange((user) => {
      if (user) {
        console.log("[App] Eingeloggt als:", user.displayName);
        this.initApp(user.displayName ?? "User");
      } else {
        console.log("[App] Nicht eingeloggt");
        this.showLogin();
      }
    });
  }

  // ─── Login-Screen ─────────────────────────────────────────

  private showLogin(): void {
    this.storage.clearCache(); // Cache leeren, damit beim nächsten Login frische Daten aus Firestore geladen werden
    this.sidebarEl.classList.add("hidden");
    this.loginView.render();
  }

  // ─── App initialisieren ───────────────────────────────────

  private initApp(displayName: string): void {
    this.sidebarEl.classList.remove("hidden");

    const footer = document.querySelector(".sidebar-footer")!;
    footer.innerHTML = `
      <div class="user-info">
        <span class="user-name">${displayName}</span>
      </div>
      <button class="btn btn-ghost" id="btn-export" style="width:100%;justify-content:center;">
        ↓ Export JSON
      </button>
      <button class="btn btn-ghost" id="btn-logout" style="width:100%;justify-content:center;margin-top:6px;">
        Abmelden
      </button>
    `;

    this.modal = new TaskFormModal(this.taskService);
    this.todoView = new TodoView(this.taskService, this.modal, this.mainEl);
    this.upcomingView = new UpcomingView(this.taskService, this.modal, this.mainEl);
    this.statsView = new StatsView(this.taskService, this.mainEl);
    this.categoryView = new CategoryView(this.taskService, this.mainEl);

    this.modal.onTaskSaved(async () => {
      const r = this.currentRoute();
      if (r === "todo") await this.todoView.render();
      else if (r === "upcoming") await this.upcomingView.render();
      else if (r === "kategorien") await this.categoryView.render();
      else await this.statsView.render();
    });

    this.setupNav();
    this.setupButtons();
    this.navigate(this.currentRoute());
  }

  // ─── Navigation ───────────────────────────────────────────

  private currentRoute(): Route {
    const h = location.hash.replace("#", "") as Route;
    if (h === "stats") return "stats";
    if (h === "kategorien") return "kategorien";
    if (h === "reflexion") return "reflexion";
    if (h === "upcoming") return "upcoming";
    return "todo";
  }

  private navigate(route: Route): void {
    location.hash = route;
    document.querySelectorAll(".nav-link").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-route") === route);
    });
    if (route === "stats") this.statsView.render();
    else if (route === "kategorien") this.categoryView.render();
    else if (route === "reflexion") this.reflectionView.render();
    else if (route === "upcoming") this.upcomingView.render();
    else this.todoView.render();
  }
  private navInitialized = false;

  private setupNav(): void {
    if (this.navInitialized) return;
    this.navInitialized = true;

    document.querySelectorAll<HTMLElement>(".nav-link").forEach((el) => {
      el.addEventListener("click", () => this.navigate(el.dataset.route as Route));
    });

    window.addEventListener("hashchange", () => this.navigate(this.currentRoute()));
  }

  private setupButtons(): void {
    document.getElementById("btn-export")?.addEventListener("click", () => {
      this.storage.exportJSON();
    });

    document.getElementById("btn-logout")?.addEventListener("click", async () => {
      await this.authService.logout();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new App();
});