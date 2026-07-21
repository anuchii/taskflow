// ============================================================
// services/VacationService.test.ts
// FakeStorageService ersetzt Firestore durch In-Memory-RAM
// (gleiches Muster wie TaskService.crud.test.ts).
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { VacationService } from "./VacationService.js";
import type { AppData, Task } from "../models/Task.js";
import { today, addDays } from "../utils/DateUtils.js";

class FakeStorageService {
  constructor(private data: AppData) {}

  async load(): Promise<AppData> {
    return structuredClone(this.data);
  }

  async save(data: AppData): Promise<void> {
    this.data = structuredClone(data);
  }

  snapshot(): AppData {
    return structuredClone(this.data);
  }
}

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: "Test",
    description: "",
    category: "sonstiges",
    createdAt: new Date().toISOString(),
    startDate: today(),
    repeat: { unit: "none", interval: 1, endDate: null },
    archived: false,
    ...overrides,
  };
}

function emptyData(tasks: Task[] = []): AppData {
  return { version: 1, tasks, completions: [], categories: [] };
}

// ─── start() ────────────────────────────────────────────────

test("start(): aktiviert den Modus mit heutigem Startdatum", async () => {
  const storage = new FakeStorageService(emptyData());
  const svc = new VacationService(storage as any);
  await svc.start("2026-08-01");
  const mode = await svc.getMode();
  assert.equal(mode?.active, true);
  assert.equal(mode?.startDate, today());
  assert.equal(mode?.endDate, "2026-08-01");
});

test("start(null): unbegrenzter Modus hat endDate === null", async () => {
  const storage = new FakeStorageService(emptyData());
  const svc = new VacationService(storage as any);
  await svc.start(null);
  const mode = await svc.getMode();
  assert.equal(mode?.endDate, null);
});

// ─── countAffectedTasks() ───────────────────────────────────

test("countAffectedTasks(): 0, solange kein Urlaubsmodus aktiv ist", async () => {
  const t = makeTask({ startDate: addDays(today(), -3) });
  const storage = new FakeStorageService(emptyData([t]));
  const svc = new VacationService(storage as any);
  assert.equal(await svc.countAffectedTasks(), 0);
});

test("countAffectedTasks(): zählt eine unerledigte einmalige Aufgabe im Urlaubszeitraum", async () => {
  const t = makeTask({ startDate: addDays(today(), -1) });
  const storage = new FakeStorageService(emptyData([t]));
  const svc = new VacationService(storage as any);
  await svc.start(addDays(today(), 5));
  assert.equal(await svc.countAffectedTasks(), 1);
});

test("countAffectedTasks(): zählt bereits erledigte Aufgaben nicht", async () => {
  const t = makeTask({ startDate: addDays(today(), -1) });
  const data = emptyData([t]);
  data.completions.push({ taskId: t.id, completedAt: `${today()}T10:00:00` });
  const storage = new FakeStorageService(data);
  const svc = new VacationService(storage as any);
  await svc.start(null);
  assert.equal(await svc.countAffectedTasks(), 0);
});

test("countAffectedTasks(): zählt wiederkehrende Aufgaben ohne dueDate nicht", async () => {
  const t = makeTask({ repeat: { unit: "daily", interval: 1, endDate: null }, startDate: addDays(today(), -5) });
  const storage = new FakeStorageService(emptyData([t]));
  const svc = new VacationService(storage as any);
  await svc.start(null);
  assert.equal(await svc.countAffectedTasks(), 0);
});

// ─── endNow() ────────────────────────────────────────────────

test("endNow(): verschiebt startDate einer einmaligen Aufgabe auf heute und markiert sie", async () => {
  const t = makeTask({ startDate: addDays(today(), -2) });
  const storage = new FakeStorageService(emptyData([t]));
  const svc = new VacationService(storage as any);
  await svc.start(null);

  const count = await svc.endNow();
  assert.equal(count, 1);

  const saved = storage.snapshot().tasks[0];
  assert.equal(saved.startDate, today());
  assert.equal(saved.dateShiftedByVacation, true);
});

test("endNow(): verschiebt dueDate, lässt startDate bei repeat!=none unangetastet", async () => {
  const t = makeTask({
    repeat: { unit: "weekly", interval: 1, endDate: null },
    startDate: addDays(today(), -10),
    dueDate: addDays(today(), -1),
  });
  const storage = new FakeStorageService(emptyData([t]));
  const svc = new VacationService(storage as any);
  await svc.start(null);

  await svc.endNow();
  const saved = storage.snapshot().tasks[0];
  assert.equal(saved.dueDate, today());
  assert.equal(saved.startDate, addDays(today(), -10)); // unverändert
});

test("endNow(): deaktiviert den Urlaubsmodus", async () => {
  const storage = new FakeStorageService(emptyData());
  const svc = new VacationService(storage as any);
  await svc.start(null);
  await svc.endNow();
  const mode = await svc.getMode();
  assert.equal(mode?.active, false);
});

test("endNow(): ohne aktiven Modus passiert nichts, gibt 0 zurück", async () => {
  const t = makeTask({ startDate: addDays(today(), -2) });
  const storage = new FakeStorageService(emptyData([t]));
  const svc = new VacationService(storage as any);
  assert.equal(await svc.endNow(), 0);
  assert.equal(storage.snapshot().tasks[0].startDate, addDays(today(), -2));
});

// ─── checkAutoEnd() ──────────────────────────────────────────

test("checkAutoEnd(): tut nichts, wenn endDate in der Zukunft liegt", async () => {
  const storage = new FakeStorageService(emptyData());
  const svc = new VacationService(storage as any);
  await svc.start(addDays(today(), 5));
  assert.equal(await svc.checkAutoEnd(), 0);
  assert.equal((await svc.getMode())?.active, true);
});

test("checkAutoEnd(): tut nichts bei unbegrenztem Modus (endDate null)", async () => {
  const storage = new FakeStorageService(emptyData());
  const svc = new VacationService(storage as any);
  await svc.start(null);
  assert.equal(await svc.checkAutoEnd(), 0);
});

test("checkAutoEnd(): beendet und verschiebt auf das geplante Enddatum, wenn dieses erreicht ist", async () => {
  const t = makeTask({ startDate: addDays(today(), -3) });
  const storage = new FakeStorageService(emptyData([t]));
  const svc = new VacationService(storage as any);
  // Enddatum liegt auf "heute" → gilt als erreicht
  await svc.start(today());

  const count = await svc.checkAutoEnd();
  assert.equal(count, 1);
  assert.equal(storage.snapshot().tasks[0].startDate, today());
  assert.equal((await svc.getMode())?.active, false);
});
