// ============================================================
// utils/DateUtils.test.ts
// Node built-in test runner — kein externes Framework nötig
// Ausführen: npm test
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { today, parseDate, addDays, weekDates, lastNDays } from "./DateUtils.js";

// ─── today() ──────────────────────────────────────────────────────────────────

test("today() hat das Format YYYY-MM-DD", () => {
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
});

test("today() gibt die lokale Systemzeit zurück, nicht UTC", () => {
  const now = new Date();
  const expected =
    `${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, "0")}-` +
    `${String(now.getDate()).padStart(2, "0")}`;
  assert.equal(today(), expected);
});

// ─── parseDate() ──────────────────────────────────────────────────────────────

test("parseDate() setzt die Uhrzeit auf 00:00:00 Ortszeit", () => {
  const d = parseDate("2024-06-15");
  assert.equal(d.getHours(),   0);
  assert.equal(d.getMinutes(), 0);
  assert.equal(d.getSeconds(), 0);
});

test("parseDate() liest Jahr, Monat, Tag korrekt (kein Zeitzonen-Versatz)", () => {
  const d = parseDate("2024-06-15");
  assert.equal(d.getFullYear(), 2024);
  assert.equal(d.getMonth(),    5);   // getMonth() ist 0-basiert: Juni = 5
  assert.equal(d.getDate(),     15);
});

// ─── addDays() ────────────────────────────────────────────────────────────────

test("addDays() addiert Tage korrekt (Normalfall)", () => {
  assert.equal(addDays("2024-03-01", 5), "2024-03-06");
});

test("addDays() überquert die Monatsgrenze", () => {
  assert.equal(addDays("2024-01-31", 1), "2024-02-01");
});

test("addDays() überquert die Jahresgrenze", () => {
  assert.equal(addDays("2024-12-31", 1), "2025-01-01");
});

test("addDays() behandelt Schaltjahre: 28. Feb → 29. Feb 2024", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-02-29", 1), "2024-03-01");
});

test("addDays() behandelt Nicht-Schaltjahr: 28. Feb → 1. März 2023", () => {
  assert.equal(addDays("2023-02-28", 1), "2023-03-01");
});

test("addDays() überquert den Sommerzeit-Übergang (31. März 2024)", () => {
  // setDate() arbeitet auf Kalendertagen, nicht auf Millisekunden —
  // eine 23-Stunden-Nacht ändert das Datum trotzdem korrekt um einen Tag.
  assert.equal(addDays("2024-03-30", 1), "2024-03-31");
  assert.equal(addDays("2024-03-31", 1), "2024-04-01");
});

test("addDays() subtrahiert Tage korrekt (negative Zahl)", () => {
  assert.equal(addDays("2024-03-06", -5),  "2024-03-01");
  assert.equal(addDays("2024-03-01", -1),  "2024-02-29"); // Schaltjahr rückwärts
  assert.equal(addDays("2025-01-01", -1),  "2024-12-31"); // Jahresgrenze rückwärts
});

// ─── weekDates() ──────────────────────────────────────────────────────────────

test("weekDates(0) gibt genau 7 Daten zurück", () => {
  assert.equal(weekDates(0).length, 7);
});

test("weekDates(0) beginnt mit einem Montag", () => {
  const dates    = weekDates(0);
  const firstDay = parseDate(dates[0]).getDay(); // 0=So, 1=Mo, …
  assert.equal(firstDay, 1, "Erster Tag muss Montag sein (getDay() === 1)");
});

test("weekDates() gibt aufeinanderfolgende Tage zurück", () => {
  const dates = weekDates(0);
  for (let i = 1; i < dates.length; i++) {
    assert.equal(dates[i], addDays(dates[i - 1], 1));
  }
});

test("weekDates(1) startet genau 7 Tage nach weekDates(0)", () => {
  const thisWeek = weekDates(0);
  const nextWeek = weekDates(1);
  assert.equal(nextWeek[0], addDays(thisWeek[0], 7));
});

test("weekDates(-1) startet genau 7 Tage vor weekDates(0)", () => {
  const thisWeek = weekDates(0);
  const lastWeek = weekDates(-1);
  assert.equal(addDays(lastWeek[0], 7), thisWeek[0]);
});

// ─── lastNDays() ──────────────────────────────────────────────────────────────

test("lastNDays(7) gibt genau 7 Daten zurück", () => {
  assert.equal(lastNDays(7).length, 7);
});

test("lastNDays() endet mit dem heutigen Tag", () => {
  const days = lastNDays(7);
  assert.equal(days[days.length - 1], today());
});

test("lastNDays() gibt aufsteigende aufeinanderfolgende Daten zurück", () => {
  const days = lastNDays(10);
  for (let i = 1; i < days.length; i++) {
    assert.equal(days[i], addDays(days[i - 1], 1));
  }
});

test("lastNDays(1) gibt nur den heutigen Tag zurück", () => {
  assert.deepEqual(lastNDays(1), [today()]);
});
