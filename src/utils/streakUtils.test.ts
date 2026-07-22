// ============================================================
// utils/streakUtils.test.ts
// Node built-in test runner — kein externes Framework nötig
// Ausführen: npm test
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreak } from "./streakUtils.js";
import type { DayStat } from "../services/TaskService.js";

function day(date: string, total: number, completed: number): DayStat {
  return { date, total, completed };
}

test("computeStreak() ist 0 ohne Daten", () => {
  assert.equal(computeStreak([]), 0);
});

test("computeStreak() zählt aufeinanderfolgende volle Tage rückwärts", () => {
  const stats = [
    day("2026-07-18", 3, 3),
    day("2026-07-19", 2, 2),
    day("2026-07-20", 4, 4),
  ];
  assert.equal(computeStreak(stats), 3);
});

test("computeStreak() bricht bei einem unvollständigen Tag ab", () => {
  const stats = [
    day("2026-07-17", 2, 2),
    day("2026-07-18", 3, 1), // nicht vollständig -> bricht die Serie davor ab
    day("2026-07-19", 2, 2),
    day("2026-07-20", 4, 4),
  ];
  assert.equal(computeStreak(stats), 2);
});

test("computeStreak() überspringt den letzten Tag, wenn er noch nicht fertig ist", () => {
  const stats = [
    day("2026-07-18", 3, 3),
    day("2026-07-19", 2, 2),
    day("2026-07-20", 4, 1), // heute, noch nicht fertig -> darf Serie nicht brechen
  ];
  assert.equal(computeStreak(stats), 2);
});

test("computeStreak() behandelt einen Tag ganz ohne Aufgaben als Abbruch", () => {
  const stats = [
    day("2026-07-18", 0, 0),
    day("2026-07-19", 2, 2),
    day("2026-07-20", 4, 4),
  ];
  assert.equal(computeStreak(stats), 2);
});

test("computeStreak() sortiert die Eingabe unabhängig von der Reihenfolge", () => {
  const stats = [
    day("2026-07-20", 4, 4),
    day("2026-07-18", 3, 3),
    day("2026-07-19", 2, 2),
  ];
  assert.equal(computeStreak(stats), 3);
});
