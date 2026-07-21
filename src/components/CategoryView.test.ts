// ============================================================
// components/CategoryView.test.ts
// DOM-Tests für CategoryView: Aufgabenliste, Toggle, Löschen.
// jsdom liefert ein virtuelles Browser-DOM im Node-Prozess,
// da CategoryView ausschließlich DOM-APIs verwendet und sich
// nicht sinnvoll in reine Service-Logik aufsplitten lässt.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { TaskService } from "../services/TaskService.js";
import { CategoryView } from "./CategoryView.js";
import type { Task, AppData, Category } from "../models/Task.js";

// ─── jsdom global setup ───────────────────────────────────
// Muss vor dem ersten DOM-Aufruf gesetzt sein.
// CategoryView-Methoden greifen auf globalThis.document zu,
// daher ersetzen wir es durch das jsdom-Dokument.
const dom = new JSDOM("<!DOCTYPE html><body></body>", { url: "http://localhost" });
(globalThis as any).document = dom.window.document;
(globalThis as any).MouseEvent = dom.window.MouseEvent;

// ─── FakeStorageService ───────────────────────────────────
class FakeStorageService {
  private data: AppData;

  constructor(initial: Partial<AppData> = {}) {
    this.data = {
      version: 1, tasks: [], completions: [],
      categories: [],
      ...initial,
    };
  }

  async load(): Promise<AppData> { return structuredClone(this.data); }
  async save(data: AppData): Promise<void> { this.data = structuredClone(data); }
  snapshot(): AppData { return structuredClone(this.data); }
}

// ─── FakeTaskFormModal ────────────────────────────────────
class FakeTaskFormModal {
  lastOpened: Task | undefined = undefined;
  open(task?: Task) { this.lastOpened = task; }
}

// ─── Testkonstanten ───────────────────────────────────────
const DAILY = { unit: "daily" as const, interval: 1, endDate: null };
const CAT_A: Category = { id: "cat-a", label: "Arbeit", color: "#5b8dee" };
const CAT_B: Category = { id: "cat-b", label: "Schule", color: "#a78bfa" };

// ─── Hilfsfunktionen ──────────────────────────────────────

async function setup(tasksForA = 0, tasksForB = 0) {
  const storage = new FakeStorageService({ categories: [CAT_A, CAT_B] });
  const svc = new TaskService(storage as any);

  for (let i = 0; i < tasksForA; i++) {
    await svc.createTask(`A-Task ${i + 1}`, "", "cat-a", DAILY);
  }
  for (let i = 0; i < tasksForB; i++) {
    await svc.createTask(`B-Task ${i + 1}`, "", "cat-b", DAILY);
  }

  const modal = new FakeTaskFormModal();
  const container = dom.window.document.createElement("div");
  const view = new CategoryView(svc, container, modal as any);
  await view.render();

  return { container, modal, svc, storage };
}

// Wartet einen Tick, damit async-Event-Handler (click → await service)
// vollständig abgeschlossen sind bevor Assertions folgen.
function settle(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function click(el: Element): void {
  el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function getCatRow(container: Element, catId: string): Element {
  return container.querySelector(`.cat-item[data-cat-id="${catId}"] .cat-item-row--clickable`)!;
}

// ─── Render ───────────────────────────────────────────────

test("render: zeigt beide Kategorien als klickbare Zeilen", async () => {
  const { container } = await setup();
  assert.equal(container.querySelectorAll(".cat-item-row--clickable").length, 2);
});

test("render: Aufgaben-Zähler stimmt mit der Datenlage überein", async () => {
  const { container } = await setup(2, 1);
  const items = container.querySelectorAll(".cat-item");
  assert.match(items[0].querySelector(".cat-item-count")!.textContent!, /2 Aufgaben/);
  assert.match(items[1].querySelector(".cat-item-count")!.textContent!, /1 Aufgabe$/);
});

// ─── Toggle ───────────────────────────────────────────────

test("toggle: Klick auf Kategorie-Zeile öffnet das Task-Panel", async () => {
  const { container } = await setup(1);
  click(getCatRow(container, "cat-a"));
  await settle();
  assert.ok(container.querySelector(".cat-task-list"), "Task-Panel soll erscheinen");
});

test("toggle: zweiter Klick schließt das Task-Panel wieder", async () => {
  const { container } = await setup(1);
  const row = getCatRow(container, "cat-a");
  click(row); await settle();
  click(row); await settle();
  assert.equal(container.querySelector(".cat-task-list"), null);
});

test("toggle: Chevron wechselt von ▸ zu ▾ beim Öffnen", async () => {
  const { container } = await setup();
  const item = container.querySelector(`.cat-item[data-cat-id="cat-a"]`)!;
  assert.equal(item.querySelector(".cat-chevron")!.textContent, "▸");
  click(getCatRow(container, "cat-a"));
  await settle();
  assert.equal(item.querySelector(".cat-chevron")!.textContent, "▾");
});

test("toggle: Chevron kehrt zu ▸ zurück beim Schließen", async () => {
  const { container } = await setup();
  const row = getCatRow(container, "cat-a");
  click(row); await settle();
  click(row); await settle();
  const chevron = container.querySelector(`.cat-item[data-cat-id="cat-a"] .cat-chevron`)!;
  assert.equal(chevron.textContent, "▸");
});

// ─── Aufgabenliste Inhalt ─────────────────────────────────

test("Aufgabenliste: zeigt nur Tasks der geklickten Kategorie", async () => {
  const { container } = await setup(2, 3);
  click(getCatRow(container, "cat-a"));
  await settle();
  assert.equal(container.querySelectorAll(".cat-task-item").length, 2);
});

test("Aufgabenliste: zeigt Leer-Zustand wenn Kategorie keine Tasks hat", async () => {
  const { container } = await setup(0, 1);
  click(getCatRow(container, "cat-a"));
  await settle();
  assert.ok(container.querySelector(".cat-task-empty"));
  assert.equal(container.querySelectorAll(".cat-task-item").length, 0);
});

// ─── Aufgabe bearbeiten ───────────────────────────────────

test("Task-Klick: öffnet das Modal mit der richtigen Aufgabe", async () => {
  const { container, modal } = await setup(1);
  click(getCatRow(container, "cat-a"));
  await settle();
  click(container.querySelector(".cat-task-item")!);
  assert.ok(modal.lastOpened, "modal.open() soll aufgerufen worden sein");
  assert.match(modal.lastOpened!.title, /A-Task/);
});

// ─── Aufgabe löschen ──────────────────────────────────────

test("löschen: entfernt die Task-Zeile aus dem Panel", async () => {
  const { container } = await setup(2);
  click(getCatRow(container, "cat-a"));
  await settle();
  click(container.querySelector<HTMLButtonElement>(".cat-task-delete-btn")!);
  await settle();
  assert.equal(container.querySelectorAll(".cat-task-item").length, 1);
});

test("löschen: aktualisiert den Aufgaben-Zähler der Kategorie", async () => {
  const { container } = await setup(2);
  click(getCatRow(container, "cat-a"));
  await settle();
  click(container.querySelector<HTMLButtonElement>(".cat-task-delete-btn")!);
  await settle();
  const countText = container.querySelector(`.cat-item[data-cat-id="cat-a"] .cat-item-count`)!.textContent!;
  assert.match(countText, /1 Aufgabe$/);
});

test("löschen: zeigt Leer-Zustand nach dem letzten Task", async () => {
  const { container } = await setup(1);
  click(getCatRow(container, "cat-a"));
  await settle();
  click(container.querySelector<HTMLButtonElement>(".cat-task-delete-btn")!);
  await settle();
  assert.ok(container.querySelector(".cat-task-empty"));
  assert.equal(container.querySelectorAll(".cat-task-item").length, 0);
});

test("löschen: archiviert den Task im Storage", async () => {
  const { container, storage } = await setup(1);
  click(getCatRow(container, "cat-a"));
  await settle();
  click(container.querySelector<HTMLButtonElement>(".cat-task-delete-btn")!);
  await settle();
  const tasks = storage.snapshot().tasks;
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].archived, true);
});

// ─── stopPropagation ──────────────────────────────────────

test("stopPropagation: Kategorie-Edit-Button öffnet NICHT das Task-Panel", async () => {
  const { container } = await setup(1);
  click(container.querySelector<HTMLButtonElement>(`.cat-item[data-cat-id="cat-a"] .cat-edit-btn`)!);
  await settle();
  assert.equal(container.querySelector(".cat-task-list"), null);
});

test("stopPropagation: Kategorie-Löschen-Button öffnet NICHT das Task-Panel", async () => {
  const { container } = await setup(1);
  // deleteCategory gibt count > 0 zurück (Task existiert) → kein render(), kein Schließen
  click(container.querySelector<HTMLButtonElement>(`.cat-item[data-cat-id="cat-a"] .cat-delete-btn`)!);
  await settle();
  assert.equal(container.querySelector(".cat-task-list"), null);
});

test("stopPropagation: Task-Löschen-Button öffnet NICHT das Bearbeitungs-Modal", async () => {
  const { container, modal } = await setup(1);
  click(getCatRow(container, "cat-a"));
  await settle();
  click(container.querySelector<HTMLButtonElement>(".cat-task-delete-btn")!);
  await settle();
  assert.equal(modal.lastOpened, undefined, "modal.open() darf nicht durch den Löschen-Button ausgelöst werden");
});
