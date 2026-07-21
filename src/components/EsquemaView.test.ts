// ============================================================
// components/EsquemaView.test.ts
// Regressionstest für den Klick-Bug: Aufgaben-Blase im Esquema-Modus
// ließ sich nicht als erledigt markieren (siehe Erklärung in EsquemaView.ts,
// attachEvents() — g.dataset war in manchen WebView-Umgebungen unzuverlässig).
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { TaskService } from "../services/TaskService.js";
import { EsquemaView } from "./EsquemaView.js";
import type { AppData } from "../models/Task.js";
import { today } from "../utils/DateUtils.js";

const dom = new JSDOM("<!DOCTYPE html><body></body>", { url: "http://localhost" });
(globalThis as any).document = dom.window.document;
(globalThis as any).MouseEvent = dom.window.MouseEvent;

// jsdom implementiert document.elementFromPoint() nicht (wirft "is not a
// function") — Standard-Stub liefert "nichts getroffen", einzelne Tests
// überschreiben ihn gezielt, um eine Aufgaben-Blase am Loslass-Punkt zu simulieren.
(dom.window.document as any).elementFromPoint = () => null;

class FakeStorageService {
  private data: AppData = { version: 1, tasks: [], completions: [], categories: [] };
  async load(): Promise<AppData> { return structuredClone(this.data); }
  async save(data: AppData): Promise<void> { this.data = structuredClone(data); }
  snapshot(): AppData { return structuredClone(this.data); }
}

// EsquemaView ruft vom Modal nur open() auf (Drag-Out-Geste, siehe
// attachCreateByDrag()) — ein vollständiger Fake reicht für diese Tests.
class FakeTaskFormModal {
  openCount = 0;
  open() { this.openCount++; }
}

const DAILY = { unit: "daily" as const, interval: 1, endDate: null };

async function tick() {
  await new Promise((r) => setTimeout(r, 0));
}

test("Klick auf eine offene Aufgaben-Blase markiert sie als erledigt", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);
  await svc.createTask("Testaufgabe", "", "sonstiges", DAILY);

  const container = dom.window.document.createElement("div");
  const view = new EsquemaView(svc, new FakeTaskFormModal() as any, container);
  await view.render(() => {});

  const g = container.querySelector<SVGGElement>(".esquema-task")!;
  assert.equal(g.getAttribute("data-completed"), "false");

  // Klick auf ein verschachteltes Kind-Element (wie in der echten UI), nicht
  // direkt auf <g> — testet dass closest() korrekt nach oben traversiert.
  const textEl = g.querySelector("text")!;
  textEl.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await tick();

  assert.equal(storage.snapshot().completions.length, 1);
});

test("Klick auf eine erledigte Aufgaben-Blase macht die Erledigung rückgängig", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);
  const task = await svc.createTask("Testaufgabe", "", "sonstiges", DAILY);
  await svc.markDone(task.id);

  const container = dom.window.document.createElement("div");
  const view = new EsquemaView(svc, new FakeTaskFormModal() as any, container);
  await view.render(() => {});

  const g = container.querySelector<SVGGElement>(".esquema-task")!;
  assert.equal(g.getAttribute("data-completed"), "true");

  const rectEl = g.querySelector("rect")!;
  rectEl.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await tick();

  assert.equal(await svc.isCompletedOn(task.id, today()), false);
});

// ─── Neue Aufgabe durch Herausziehen aus der Tages-Blase ────
// jsdom implementiert keine echte SVG-Geometrie (createSVGPoint/getScreenCTM
// fehlen), daher wird toSvgPoint() hier direkt gestubbt — die eigentliche
// Koordinatenumrechnung ist reines Browser-API-Plumbing und lässt sich nur
// manuell im echten Browser verifizieren; getestet wird die Entscheidungs-
// logik danach (innerhalb/außerhalb der Blase, auf einer Aufgabe oder nicht).

test("Herausziehen aus der Tages-Blase und Loslassen auf freier Fläche öffnet das Formular", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);
  const fakeModal = new FakeTaskFormModal();

  const container = dom.window.document.createElement("div");
  const view = new EsquemaView(svc, fakeModal as any, container);
  await view.render(() => {});

  // Weit außerhalb der Tages-Blasen-Ellipse simulieren
  (view as any).toSvgPoint = () => ({ x: (view as any).centerX + 500, y: (view as any).centerY });

  const dayBubble = container.querySelector<SVGGElement>(".esquema-day-bubble")!;
  dayBubble.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true }));
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));

  assert.equal(fakeModal.openCount, 1);
});

test("Loslassen noch innerhalb der Tages-Blase öffnet nichts (kein echtes Herausziehen)", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);
  const fakeModal = new FakeTaskFormModal();

  const container = dom.window.document.createElement("div");
  const view = new EsquemaView(svc, fakeModal as any, container);
  await view.render(() => {});

  // Loslass-Punkt = exakt der Mittelpunkt → eindeutig innerhalb der Ellipse
  (view as any).toSvgPoint = () => ({ x: (view as any).centerX, y: (view as any).centerY });

  const dayBubble = container.querySelector<SVGGElement>(".esquema-day-bubble")!;
  dayBubble.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true }));
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));

  assert.equal(fakeModal.openCount, 0);
});

test("Loslassen auf einer bestehenden Aufgaben-Blase öffnet nichts", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);
  await svc.createTask("Bestehende Aufgabe", "", "sonstiges", DAILY);
  const fakeModal = new FakeTaskFormModal();

  const container = dom.window.document.createElement("div");
  const view = new EsquemaView(svc, fakeModal as any, container);
  await view.render(() => {});

  (view as any).toSvgPoint = () => ({ x: (view as any).centerX + 500, y: (view as any).centerY });

  const existingBubble = container.querySelector<SVGGElement>(".esquema-task")!;
  (dom.window.document as any).elementFromPoint = () => existingBubble;

  const dayBubble = container.querySelector<SVGGElement>(".esquema-day-bubble")!;
  dayBubble.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true }));
  dom.window.document.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));

  (dom.window.document as any).elementFromPoint = () => null;

  assert.equal(fakeModal.openCount, 0);
});
