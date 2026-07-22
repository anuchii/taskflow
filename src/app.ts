// ============================================================
// app.ts
// Entry point — prüft Auth-Status und zeigt Login oder App
// ============================================================

import { AuthService } from "./services/AuthService.js";
import { ThemeService } from "./services/ThemeService.js";
import { TaskService } from "./services/TaskService.js";
import { TaskFormModal } from "./components/TaskFormModal.js";
import { TodoView } from "./components/TodoView.js";
import { UpcomingView } from "./components/UpcomingView.js";
import { StatsView } from "./components/StatsView.js";
import { CategoryView } from "./components/CategoryView.js";
import { ReflectionView } from "./components/ReflectionView.js";
import { SettingsView } from "./components/SettingsView.js";
import { LoginView } from "./components/LoginView.js";
import { getAuth, getRedirectResult } from "firebase/auth";
import { StorageService, firebaseApp } from "./services/StorageService.js";
import { VacationService } from "./services/VacationService.js";

type Route = "todo" | "upcoming" | "stats" | "kategorien" | "reflexion" | "einstellungen";

// Seitentitel für die Topbar (Tablet/Desktop) — auf Mobil zeigt die Topbar
// stattdessen die Marke, siehe .rail-visible-only / .rail-hidden-only in
// layout/_topbar.css.
const PAGE_TITLES: Record<Route, string> = {
  todo: "Aufgaben",
  upcoming: "Upcoming",
  stats: "Statistik",
  kategorien: "Kategorien",
  reflexion: "Reflexion",
  einstellungen: "Einstellungen",
};

class App {
  private readonly authService = new AuthService();
  private readonly themeService = new ThemeService();
  private readonly storage = new StorageService();
  private readonly taskService = new TaskService(this.storage);
  private readonly vacationService = new VacationService(this.storage);
  private readonly mainEl: HTMLElement;
  private readonly appChromeEl: HTMLElement;
  private readonly topbarTitleEl: HTMLElement;
  private readonly topbarAvatarEl: HTMLElement;
  private readonly viewToggleEl: HTMLElement;
  private readonly moreMenuEl: HTMLElement;
  private modal!: TaskFormModal;
  private todoView!: TodoView;
  private upcomingView!: UpcomingView;
  private statsView!: StatsView;
  private categoryView!: CategoryView;
  private reflectionView!: ReflectionView;
  private settingsView!: SettingsView;
  private loginView: LoginView;

  constructor() {
    this.mainEl = document.getElementById("main-content")!;
    this.appChromeEl = document.getElementById("app-chrome")!;
    this.topbarTitleEl = document.getElementById("topbar-title")!;
    this.topbarAvatarEl = document.getElementById("topbar-avatar")!;
    this.viewToggleEl = document.getElementById("view-toggle")!;
    this.moreMenuEl = document.getElementById("topbar-more-menu")!;
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
    this.appChromeEl.classList.add("hidden");
    this.loginView.render();
  }

  // ─── App initialisieren ───────────────────────────────────

  private async initApp(displayName: string): Promise<void> {
    this.appChromeEl.classList.remove("hidden");
    this.topbarAvatarEl.textContent = this.initials(displayName);

    this.modal = new TaskFormModal(this.taskService);
    this.todoView = new TodoView(this.taskService, this.modal, this.mainEl);
    this.upcomingView = new UpcomingView(this.taskService, this.modal, this.mainEl);
    this.statsView = new StatsView(this.taskService, this.mainEl);
    this.categoryView = new CategoryView(this.taskService, this.mainEl, this.modal);
    this.reflectionView = new ReflectionView(this.taskService, this.mainEl);
    this.settingsView = new SettingsView(this.vacationService, this.mainEl);

    this.modal.onTaskSaved(async () => {
      const r = this.currentRoute();
      if (r === "todo") await this.todoView.render();
      else if (r === "upcoming") await this.upcomingView.render();
      else if (r === "kategorien") await this.categoryView.render();
      else await this.statsView.render();
    });

    // Geplantes Urlaubsende prüfen, BEVOR irgendeine Ansicht rendert — sonst
    // würde z.B. die TodoView noch mit dem alten (aktiven) Status laden.
    await this.vacationService.checkAutoEnd();
    await this.taskService.runAutoPrioritization();
    this.setupNav();
    this.setupButtons();
    this.setupTopbarMore();
    this.setupViewToggle();
    this.setupFab();
    this.themeService.syncButtonLabel();
    this.navigate(this.currentRoute());
  }

  private initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // ─── Navigation ───────────────────────────────────────────

  private currentRoute(): Route {
    const h = location.hash.replace("#", "") as Route;
    if (h === "stats") return "stats";
    if (h === "kategorien") return "kategorien";
    if (h === "reflexion") return "reflexion";
    if (h === "upcoming") return "upcoming";
    if (h === "einstellungen") return "einstellungen";
    return "todo";
  }

  private navigate(route: Route): void {
    location.hash = route;
    document.querySelectorAll(".nav-link").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-route") === route);
    });
    this.topbarTitleEl.textContent = PAGE_TITLES[route];
    this.closeMoreMenu();
    this.syncViewToggle(route);

    if (route === "stats") this.statsView.render();
    else if (route === "kategorien") this.categoryView.render();
    else if (route === "reflexion") this.reflectionView.render();
    else if (route === "upcoming") this.upcomingView.render();
    else if (route === "einstellungen") this.settingsView.render();
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

  // ─── Liste/Schema-Umschalter (Topbar) ──────────────────────
  // Lebt in app.ts statt in TodoView, weil er app-weit zur Route "todo"
  // gehört (Topbar ist Teil der Shell, nicht der einzelnen Ansicht) —
  // TodoView bleibt so unabhängig davon, WO der Umschalter angezeigt wird.

  private setupViewToggle(): void {
    this.viewToggleEl.querySelectorAll<HTMLButtonElement>(".view-toggle-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.todoView.setEsquemaMode(btn.dataset.view === "schema");
        this.syncViewToggle(this.currentRoute());
      });
    });
  }

  private syncViewToggle(route: Route): void {
    this.viewToggleEl.classList.toggle("hidden", route !== "todo");
    if (route !== "todo") return;
    const isSchema = this.todoView.getEsquemaMode();
    this.viewToggleEl.querySelectorAll<HTMLButtonElement>(".view-toggle-opt").forEach((btn) => {
      btn.classList.toggle("active", (btn.dataset.view === "schema") === isSchema);
    });
  }

  // ─── "⋯"-Overflow-Menü (mobil: Reflexion/Einstellungen + Konto-Aktionen) ──

  private setupTopbarMore(): void {
    const btn = document.getElementById("btn-topbar-more");
    btn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.moreMenuEl.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
      if (!this.moreMenuEl.classList.contains("hidden") && !this.moreMenuEl.contains(e.target as Node)) {
        this.closeMoreMenu();
      }
    });
    // Konto-Aktionen im mobilen Menü delegieren an die bereits verdrahteten
    // Icon-Rail-Buttons, statt dieselbe Export/Import/Theme/Logout-Logik
    // ein zweites Mal zu implementieren.
    const delegate = (mobileId: string, targetId: string) => {
      document.getElementById(mobileId)?.addEventListener("click", () => {
        document.getElementById(targetId)?.click();
        this.closeMoreMenu();
      });
    };
    delegate("btn-export-mobile", "btn-export");
    delegate("btn-import-mobile", "btn-import");
    delegate("btn-theme-toggle-mobile", "btn-theme-toggle");
    delegate("btn-logout-mobile", "btn-logout");
  }

  private closeMoreMenu(): void {
    this.moreMenuEl.classList.add("hidden");
  }

  // ─── FAB (mobil) ────────────────────────────────────────────
  // Öffnet dasselbe Modal wie die "+ Aufgabe"-Buttons der Views — siehe
  // layout/_fab.css für die Begründung, warum das routenunabhängig ist.

  private setupFab(): void {
    document.getElementById("fab-new-task")?.addEventListener("click", () => {
      this.modal.open();
    });
  }

  private setupButtons(): void {
    document.getElementById("btn-export")?.addEventListener("click", () => {
      this.storage.exportJSON();
    });

    document.getElementById("btn-import")?.addEventListener("click", async () => {
      try {
        await this.storage.importJSON();
        this.navigate(this.currentRoute());
      } catch (e) {
        console.error("[App] Import fehlgeschlagen:", e);
      }
    });

    document.getElementById("btn-theme-toggle")?.addEventListener("click", () => {
      this.themeService.toggle();
      this.themeService.syncButtonLabel();
    });

    document.getElementById("btn-logout")?.addEventListener("click", async () => {
      await this.authService.logout();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new App();
});
