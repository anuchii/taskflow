// ============================================================
// services/TaskService.runAutoPrioritization.test.ts
// Integrationstests: TaskService orchestriert AutoPriorityService
// und schreibt die Ergebnisse in den Storage.
// Die Unit-Tests für computeChanges() stehen in AutoPriorityService.test.ts.
// Hier wird das Zusammenspiel der beiden Klassen + der Speichervorgang geprüft.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { TaskService } from "./TaskService.js";
import { today, addDays } from "../utils/DateUtils.js";
import type { AppData } from "../models/Task.js";

// ─── FakeStorageService mit Save-Spy ─────────────────────
// saveCallCount ermöglicht zu prüfen ob save() aufgerufen wurde,
// ohne das echte Speicherverhalten zu simulieren.

class FakeStorageService {
  saveCallCount = 0;
  private data: AppData = {
    version: 1, tasks: [], completions: [],
    categories: [], flashcards: [], decks: [],
  };

  async load(): Promise<AppData> { return structuredClone(this.data); }
  async save(data: AppData): Promise<void> {
    this.saveCallCount++;
    this.data = structuredClone(data);
  }
  snapshot(): AppData { return structuredClone(this.data); }
}

const NONE = { unit: "none" as const, interval: 1, endDate: null };

// ─── Tests ───────────────────────────────────────────────

test("runAutoPrioritization: überfällige Task wird auf priority:high gesetzt und im Storage gespeichert", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);

  // Einmalige Aufgabe mit startDate vor 3 Tagen → computeChanges erkennt sie als überfällig
  await svc.createTask("Überfällige Aufgabe", "", "sonstiges", NONE, addDays(today(), -3));

  storage.saveCallCount = 0; // Reset nach Setup — nur runAutoPrioritization() zählt
  await svc.runAutoPrioritization();

  const task = storage.snapshot().tasks[0];
  assert.equal(task.priority, "high");
  assert.equal(task.isAutoPrioritized, true);
  assert.equal(storage.saveCallCount, 1);
});

test("runAutoPrioritization: storage.save wird NICHT aufgerufen wenn es keine Änderungen gibt", async () => {
  const storage = new FakeStorageService();
  const svc = new TaskService(storage as any);

  // Task mit heutigem startDate → kein Handlungsbedarf für AutoPriorityService
  await svc.createTask("Aktuelle Aufgabe", "", "sonstiges", NONE);

  storage.saveCallCount = 0; // Reset nach Setup
  await svc.runAutoPrioritization();

  assert.equal(storage.saveCallCount, 0);
});
