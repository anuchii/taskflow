// ============================================================
// services/TaskService.crud.test.ts
// Tests für createTask, updateTask, archiveTask, markDone.
// FakeStorageService ersetzt Firestore durch In-Memory-RAM.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { TaskService } from "./TaskService.js";
import type { AppData } from "../models/Task.js";
import { today } from "../utils/DateUtils.js";

// ─── FakeStorageService ───────────────────────────────────
// Implementiert nur load() und save() im RAM.
// structuredClone stellt sicher, dass der Service immer eine
// eigene Kopie bearbeitet — kein versehentliches Teilen von
// Referenzen zwischen Methodenaufrufen (entspricht Firestores
// Verhalten: jeder load() liefert einen frischen Snapshot).

class FakeStorageService {
  private data: AppData = {
    version: 1,
    tasks: [],
    completions: [],
    categories: [],
    flashcards: [],
    decks: [],
  };

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

const DAILY = { unit: "daily" as const, interval: 1, endDate: null };

// ─── createTask ───────────────────────────────────────────

test("createTask: generiert eine nicht-leere ID", async () => {
  const svc = new TaskService(new FakeStorageService() as any);
  const task = await svc.createTask("Lernen", "", "sonstiges", DAILY);
  assert.ok(task.id.length > 0);
});

test("createTask: id ist bei jedem Aufruf unterschiedlich", async () => {
  const svc = new TaskService(new FakeStorageService() as any);
  const a = await svc.createTask("A", "", "sonstiges", DAILY);
  const b = await svc.createTask("B", "", "sonstiges", DAILY);
  assert.notEqual(a.id, b.id);
});

test("createTask: setzt createdAt auf einen ISO-String", async () => {
  const svc = new TaskService(new FakeStorageService() as any);
  const before = new Date().toISOString();
  const task = await svc.createTask("Aufgabe", "", "sonstiges", DAILY);
  const after = new Date().toISOString();
  assert.ok(task.createdAt >= before && task.createdAt <= after);
});

test("createTask: startDate wird aus Parameter übernommen", async () => {
  const svc = new TaskService(new FakeStorageService() as any);
  const task = await svc.createTask("Aufgabe", "", "sonstiges", DAILY, "2026-06-01");
  assert.equal(task.startDate, "2026-06-01");
});

test("createTask: startDate fällt auf heute wenn kein Parameter", async () => {
  const svc = new TaskService(new FakeStorageService() as any);
  const task = await svc.createTask("Aufgabe", "", "sonstiges", DAILY);
  assert.equal(task.startDate, today());
});

test("createTask: leere category wird zu 'sonstiges'", async () => {
  const svc = new TaskService(new FakeStorageService() as any);
  const task = await svc.createTask("Aufgabe", "", "", DAILY);
  assert.equal(task.category, "sonstiges");
});

test("createTask: Aufgabe wird im Storage gespeichert", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);
  const task = await svc.createTask("Gespeichert", "", "sonstiges", DAILY);
  const saved = storage.snapshot().tasks;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, task.id);
});

// ─── updateTask ───────────────────────────────────────────

test("updateTask: patcht nur die angegebenen Felder", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);
  const task = await svc.createTask("Original", "Beschreibung", "sonstiges", DAILY);

  await svc.updateTask(task.id, { title: "Geändert" });

  const updated = storage.snapshot().tasks[0];
  assert.equal(updated.title, "Geändert");
  assert.equal(updated.description, "Beschreibung"); // unberührt
  assert.equal(updated.category, "sonstiges");       // unberührt
});

test("updateTask: setzt isAutoPrioritized zurück wenn explizit übergeben", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);
  const task = await svc.createTask("Prio-Aufgabe", "", "sonstiges", DAILY);

  // Zuerst auto-priorisiert setzen
  await svc.updateTask(task.id, { priority: "high", isAutoPrioritized: true });
  assert.equal(storage.snapshot().tasks[0].isAutoPrioritized, true);

  // Dann User-Speicherung: Flag muss zurückgesetzt werden
  await svc.updateTask(task.id, { priority: "high", isAutoPrioritized: false });
  assert.equal(storage.snapshot().tasks[0].isAutoPrioritized, false);
});

test("updateTask: unbekannte ID wird ohne Fehler ignoriert", async () => {
  const svc = new TaskService(new FakeStorageService() as any);
  await assert.doesNotReject(() => svc.updateTask("nicht-vorhanden", { title: "X" }));
});

// ─── archiveTask ──────────────────────────────────────────

test("archiveTask: setzt archived auf true", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);
  const task = await svc.createTask("Archivieren", "", "sonstiges", DAILY);

  await svc.archiveTask(task.id);

  assert.equal(storage.snapshot().tasks[0].archived, true);
});

test("archiveTask: ändert keine anderen Felder", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);
  const task = await svc.createTask("Titel bleibt", "Desc", "sonstiges", DAILY);

  await svc.archiveTask(task.id);

  const archived = storage.snapshot().tasks[0];
  assert.equal(archived.title, "Titel bleibt");
  assert.equal(archived.description, "Desc");
});

// ─── markDone ─────────────────────────────────────────────

test("markDone: fügt eine Completion für heute hinzu", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);
  const task = await svc.createTask("Erledigen", "", "sonstiges", DAILY);

  await svc.markDone(task.id);

  const completions = storage.snapshot().completions;
  assert.equal(completions.length, 1);
  assert.equal(completions[0].taskId, task.id);
  assert.ok(completions[0].completedAt.startsWith(today()));
});

test("markDone: ist idempotent — zweiter Aufruf erzeugt keine Duplikate", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);
  const task = await svc.createTask("Erledigen", "", "sonstiges", DAILY);

  await svc.markDone(task.id);
  await svc.markDone(task.id);

  assert.equal(storage.snapshot().completions.length, 1);
});

test("markDone: isCompletedOn gibt danach true zurück", async () => {
  const svc = new TaskService(new FakeStorageService() as any);
  const task = await svc.createTask("Erledigen", "", "sonstiges", DAILY);

  await svc.markDone(task.id);

  assert.equal(await svc.isCompletedOn(task.id, today()), true);
});
