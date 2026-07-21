// ============================================================
// components/SettingsView.test.ts
// DOM-Tests für SettingsView: Aktivieren, Beenden, Bestätigungsdialog.
// jsdom liefert ein virtuelles Browser-DOM im Node-Prozess (gleiches
// Muster wie CategoryView.test.ts).
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { VacationService } from "../services/VacationService.js";
import { SettingsView } from "./SettingsView.js";
import type { AppData } from "../models/Task.js";
import { today, addDays } from "../utils/DateUtils.js";

// ─── jsdom global setup ───────────────────────────────────
const dom = new JSDOM("<!DOCTYPE html><body></body>", { url: "http://localhost" });
(globalThis as any).document = dom.window.document;

// ─── FakeStorageService ───────────────────────────────────
class FakeStorageService {
  private data: AppData = { version: 1, tasks: [], completions: [], categories: [] };
  async load(): Promise<AppData> { return structuredClone(this.data); }
  async save(data: AppData): Promise<void> { this.data = structuredClone(data); }
}

// Bewusst NICHT an document.body anhängen: mehrere Test-Container mit
// denselben IDs im selben jsdom-Dokument verwirren nwsapis #id-Fastpath
// (querySelector('#x') kann dann fälschlich null liefern). Ein freistehendes
// Element funktioniert für querySelector genauso gut (gleiches Muster wie
// CategoryView.test.ts).
function makeContainer(): HTMLElement {
  return dom.window.document.createElement("div");
}

// ─── Inaktiver Zustand: Aktivierungsformular ──────────────

test("render(): zeigt das Aktivierungsformular, wenn kein Urlaubsmodus aktiv ist", async () => {
  const svc = new VacationService(new FakeStorageService() as any);
  const container = makeContainer();
  const view = new SettingsView(svc, container);

  await view.render();

  assert.ok(container.querySelector("#btn-vacation-start"));
  assert.ok(container.querySelector('input[name="vacation-mode"]'));
  assert.equal(container.querySelector("#btn-vacation-end"), null);
});

test("Aktivieren mit 'Unbegrenzt' ruft start(null) auf und zeigt danach den aktiven Status", async () => {
  const svc = new VacationService(new FakeStorageService() as any);
  const container = makeContainer();
  const view = new SettingsView(svc, container);
  await view.render();

  const unlimitedRadio = container.querySelector<HTMLInputElement>('input[value="unlimited"]')!;
  unlimitedRadio.checked = true;
  container.querySelector<HTMLButtonElement>("#btn-vacation-start")!.click();

  // Klick-Handler ist async — auf die nächste Microtask-Runde warten
  await new Promise((r) => setTimeout(r, 0));

  const mode = await svc.getMode();
  assert.equal(mode?.active, true);
  assert.equal(mode?.endDate, null);
  assert.ok(container.querySelector("#btn-vacation-end"));
});

// ─── Aktiver Zustand: Status + Beenden ────────────────────

test("render(): zeigt Status und 'Jetzt beenden', wenn Urlaubsmodus aktiv ist", async () => {
  const svc = new VacationService(new FakeStorageService() as any);
  await svc.start(addDays(today(), 5));
  const container = makeContainer();
  const view = new SettingsView(svc, container);

  await view.render();

  assert.ok(container.querySelector("#btn-vacation-end"));
  assert.equal(container.querySelector("#btn-vacation-start"), null);
  assert.match(container.querySelector(".settings-vacation-status")!.textContent!, /Aktiv seit/);
});

test("'Jetzt beenden' fragt per confirm() nach und beendet erst nach Bestätigung", async () => {
  const svc = new VacationService(new FakeStorageService() as any);
  await svc.start(null);
  const container = makeContainer();
  const view = new SettingsView(svc, container);
  await view.render();

  const originalConfirm = (globalThis as any).confirm;
  let confirmCalled = false;
  (globalThis as any).confirm = () => { confirmCalled = true; return false; };

  container.querySelector<HTMLButtonElement>("#btn-vacation-end")!.click();
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(confirmCalled, true);
  // Abgelehnt → Modus bleibt aktiv
  assert.equal((await svc.getMode())?.active, true);

  (globalThis as any).confirm = () => true;
  container.querySelector<HTMLButtonElement>("#btn-vacation-end")!.click();
  await new Promise((r) => setTimeout(r, 0));

  assert.equal((await svc.getMode())?.active, false);
  (globalThis as any).confirm = originalConfirm;
});
