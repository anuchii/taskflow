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

class FakeStorageService {
  private data: AppData = { version: 1, tasks: [], completions: [], categories: [] };
  async load(): Promise<AppData> { return structuredClone(this.data); }
  async save(data: AppData): Promise<void> { this.data = structuredClone(data); }
  snapshot(): AppData { return structuredClone(this.data); }
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
  const view = new EsquemaView(svc, container);
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
  const view = new EsquemaView(svc, container);
  await view.render(() => {});

  const g = container.querySelector<SVGGElement>(".esquema-task")!;
  assert.equal(g.getAttribute("data-completed"), "true");

  const rectEl = g.querySelector("rect")!;
  rectEl.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await tick();

  assert.equal(await svc.isCompletedOn(task.id, today()), false);
});
