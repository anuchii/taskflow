// ============================================================
// services/TaskService.isActiveOn.test.ts
// isActiveOn() ist synchron und liest kein Storage —
// deshalb wird TaskService mit null initialisiert.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { TaskService } from "./TaskService.js";
import type { StorageService } from "./StorageService.js";
import type { Task, RepeatConfig } from "../models/Task.js";

// isActiveOn() greift nie auf this.storage zu — null ist hier sicher.
const svc = new TaskService(null as unknown as StorageService);

function makeTask(startDate: string, repeat: RepeatConfig): Task {
  return {
    id:          crypto.randomUUID(),
    title:       "Testaufgabe",
    description: "",
    category:    "sonstiges",
    createdAt:   startDate + "T08:00:00.000Z",
    startDate,
    repeat,
    archived:    false,
  };
}

function none(startDate: string, endDate: string | null = null): Task {
  return makeTask(startDate, { unit: "none", interval: 1, endDate });
}
function daily(startDate: string, endDate: string | null = null): Task {
  return makeTask(startDate, { unit: "daily", interval: 1, endDate });
}
function weekly(startDate: string, endDate: string | null = null): Task {
  return makeTask(startDate, { unit: "weekly", interval: 1, endDate });
}
function monthly(startDate: string, endDate: string | null = null): Task {
  return makeTask(startDate, { unit: "monthly", interval: 1, endDate });
}

// ─── Einmalige Aufgaben (unit: "none") ────────────────────────────────────────

test("none: aktiv genau am startDate", () => {
  assert.equal(svc.isActiveOn(none("2024-03-15"), "2024-03-15"), true);
});

test("none: nicht aktiv am Tag davor", () => {
  assert.equal(svc.isActiveOn(none("2024-03-15"), "2024-03-14"), false);
});

test("none: nicht aktiv am Tag danach", () => {
  assert.equal(svc.isActiveOn(none("2024-03-15"), "2024-03-16"), false);
});

// ─── Tägliche Aufgaben (unit: "daily") ────────────────────────────────────────

test("daily: aktiv am startDate", () => {
  assert.equal(svc.isActiveOn(daily("2024-03-01"), "2024-03-01"), true);
});

test("daily: aktiv am nächsten Tag", () => {
  assert.equal(svc.isActiveOn(daily("2024-03-01"), "2024-03-02"), true);
});

test("daily: aktiv 30 Tage später", () => {
  assert.equal(svc.isActiveOn(daily("2024-03-01"), "2024-03-31"), true);
});

test("daily: nicht aktiv vor startDate", () => {
  assert.equal(svc.isActiveOn(daily("2024-03-01"), "2024-02-29"), false);
});

// ─── Wöchentliche Aufgaben (unit: "weekly") ───────────────────────────────────

test("weekly: aktiv am startDate (Tag 0)", () => {
  assert.equal(svc.isActiveOn(weekly("2024-03-04"), "2024-03-04"), true);
});

test("weekly: aktiv genau 7 Tage später", () => {
  assert.equal(svc.isActiveOn(weekly("2024-03-04"), "2024-03-11"), true);
});

test("weekly: aktiv genau 14 Tage später", () => {
  assert.equal(svc.isActiveOn(weekly("2024-03-04"), "2024-03-18"), true);
});

test("weekly: nicht aktiv 1 Tag nach startDate", () => {
  assert.equal(svc.isActiveOn(weekly("2024-03-04"), "2024-03-05"), false);
});

test("weekly: nicht aktiv 6 Tage nach startDate", () => {
  assert.equal(svc.isActiveOn(weekly("2024-03-04"), "2024-03-10"), false);
});

// ─── Monatliche Aufgaben (unit: "monthly") ────────────────────────────────────

test("monthly: aktiv am startDate", () => {
  assert.equal(svc.isActiveOn(monthly("2024-03-15"), "2024-03-15"), true);
});

test("monthly: aktiv am selben Tag des nächsten Monats", () => {
  assert.equal(svc.isActiveOn(monthly("2024-03-15"), "2024-04-15"), true);
});

test("monthly: aktiv am selben Tag mehrere Monate später", () => {
  assert.equal(svc.isActiveOn(monthly("2024-01-10"), "2024-12-10"), true);
});

test("monthly: nicht aktiv an einem anderen Tag im selben Monat", () => {
  assert.equal(svc.isActiveOn(monthly("2024-03-15"), "2024-03-16"), false);
});

test("monthly: Edge-Case 31. — nicht aktiv in Monaten ohne 31. Tag", () => {
  // Die Implementierung prüft nur getDate() === getDate() —
  // ein Monat ohne 31. (z.B. April) hat keinen passenden Tag.
  const task = monthly("2024-01-31");
  assert.equal(svc.isActiveOn(task, "2024-04-30"), false); // April hat nur 30 Tage
  assert.equal(svc.isActiveOn(task, "2024-03-31"), true);  // März hat 31 Tage
});

// ─── endDate wird respektiert ─────────────────────────────────────────────────

test("endDate: daily aktiv am letzten erlaubten Tag (endDate selbst)", () => {
  assert.equal(svc.isActiveOn(daily("2024-03-01", "2024-03-10"), "2024-03-10"), true);
});

test("endDate: daily nicht mehr aktiv einen Tag nach endDate", () => {
  assert.equal(svc.isActiveOn(daily("2024-03-01", "2024-03-10"), "2024-03-11"), false);
});

test("endDate: weekly nicht aktiv nach endDate obwohl Wochentag passt", () => {
  // startDate = Montag 4. März; endDate = 10. März; 11. März wäre der nächste Montag
  assert.equal(svc.isActiveOn(weekly("2024-03-04", "2024-03-10"), "2024-03-11"), false);
});

test("endDate: monthly nicht aktiv nach endDate obwohl Tag im Monat passt", () => {
  assert.equal(svc.isActiveOn(monthly("2024-01-15", "2024-03-14"), "2024-03-15"), false);
});
