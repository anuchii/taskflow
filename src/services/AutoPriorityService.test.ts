// ============================================================
// services/AutoPriorityService.test.ts
// computeChanges() ist zustandslos — kein Storage, kein Mock nötig.
// Alle Datumsangaben sind relativ zu today() damit der Test
// an jedem Tag korrekt läuft.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { AutoPriorityService } from "./AutoPriorityService.js";
import { today, addDays } from "../utils/DateUtils.js";
import type { Task, CompletionLog } from "../models/Task.js";

const svc = new AutoPriorityService();

// ─── Testdaten-Fabrik ─────────────────────────────────────────────────────────
// Alle Felder haben sinnvolle Standardwerte — Tests überschreiben nur was nötig.

function makeTask(overrides: Partial<Task> & Pick<Task, "id">): Task {
  return {
    title:       "Testaufgabe",
    description: "",
    category:    "sonstiges",
    createdAt:   today() + "T08:00:00.000Z",
    startDate:   today(),
    repeat:      { unit: "none", interval: 1, endDate: null },
    archived:    false,
    ...overrides,
  };
}

// ─── Regel 1: dueDate ist morgen ──────────────────────────────────────────────

test("Regel 1: dueDate morgen → patch mit priority:high und isAutoPrioritized:true", () => {
  const task    = makeTask({ id: "r1", dueDate: addDays(today(), 1) });
  const changes = svc.computeChanges([task], []);

  assert.equal(changes.length, 1);
  assert.equal(changes[0].id, "r1");
  assert.deepEqual(changes[0].patch, { priority: "high", isAutoPrioritized: true });
});

test("Regel 1: dueDate übermorgen (in 2 Tagen) → kein patch", () => {
  const task = makeTask({ id: "r1b", dueDate: addDays(today(), 2) });
  assert.equal(svc.computeChanges([task], []).length, 0);
});

// ─── Regel 2: dueDate > 2 Tage überfällig ────────────────────────────────────

test("Regel 2: dueDate vor 3 Tagen → patch", () => {
  const task    = makeTask({ id: "r2a", dueDate: addDays(today(), -3) });
  const changes = svc.computeChanges([task], []);

  assert.equal(changes.length, 1);
  assert.equal(changes[0].id, "r2a");
});

test("Regel 2: dueDate vor genau 2 Tagen → kein patch (Schwelle ist > 2, nicht >= 2)", () => {
  const task = makeTask({ id: "r2b", dueDate: addDays(today(), -2) });
  assert.equal(svc.computeChanges([task], []).length, 0);
});

test("Regel 2: dueDate gestern (1 Tag überfällig) → kein patch", () => {
  const task = makeTask({ id: "r2c", dueDate: addDays(today(), -1) });
  assert.equal(svc.computeChanges([task], []).length, 0);
});

// ─── Regel 3: Einmalige Aufgabe, startDate > 2 Tage vergangen ────────────────

test("Regel 3: einmalige Aufgabe, startDate vor 3 Tagen → patch", () => {
  const task    = makeTask({ id: "r3a", startDate: addDays(today(), -3) });
  const changes = svc.computeChanges([task], []);

  assert.equal(changes.length, 1);
  assert.equal(changes[0].id, "r3a");
});

test("Regel 3: einmalige Aufgabe, startDate vor 2 Tagen → kein patch", () => {
  const task = makeTask({ id: "r3b", startDate: addDays(today(), -2) });
  assert.equal(svc.computeChanges([task], []).length, 0);
});

test("Regel 3: daily-Aufgabe mit startDate vor 3 Tagen → kein patch (nur 'none' gilt)", () => {
  const task = makeTask({
    id:     "r3c",
    startDate: addDays(today(), -3),
    repeat: { unit: "daily", interval: 1, endDate: null },
  });
  assert.equal(svc.computeChanges([task], []).length, 0);
});

// ─── Schutz: manuelle "high" Priorität bleibt ────────────────────────────────

test("Schutz: priority:high ohne isAutoPrioritized → kein Überschreiben", () => {
  const task = makeTask({
    id:               "manual",
    dueDate:          addDays(today(), 1),
    priority:         "high",
    isAutoPrioritized: false,
  });
  assert.equal(svc.computeChanges([task], []).length, 0);
});

test("Schutz: bereits auto-priorisierte Aufgabe wird erneut gepatcht (idempotent)", () => {
  // isAutoPrioritized:true → Schutz-Filter greift nicht → Patch kommt trotzdem
  const task = makeTask({
    id:               "auto",
    dueDate:          addDays(today(), 1),
    priority:         "high",
    isAutoPrioritized: true,
  });
  assert.equal(svc.computeChanges([task], []).length, 1);
});

// ─── Erledigte & archivierte Tasks werden ignoriert ───────────────────────────

test("Erledigte Aufgaben werden ignoriert", () => {
  const task:        Task          = makeTask({ id: "done", dueDate: addDays(today(), 1) });
  const completions: CompletionLog[] = [{ taskId: "done", completedAt: today() + "T10:00:00.000Z" }];

  assert.equal(svc.computeChanges([task], completions).length, 0);
});

test("Archivierte Aufgaben werden ignoriert", () => {
  const task = makeTask({ id: "arch", dueDate: addDays(today(), 1), archived: true });
  assert.equal(svc.computeChanges([task], []).length, 0);
});

// ─── Edge-Case: leeres Array ──────────────────────────────────────────────────

test("Edge-Case: leeres Task-Array gibt leeres Array zurück", () => {
  assert.deepEqual(svc.computeChanges([], []), []);
});
