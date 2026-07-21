// ============================================================
// utils/VacationUtils.test.ts
// Node built-in test runner — kein externes Framework nötig
// Ausführen: npm test
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { isVacationActive, isVacationDueForAutoEnd } from "./VacationUtils.js";
import type { VacationMode } from "../models/Task.js";

// ─── isVacationActive() ─────────────────────────────────────────────────────

test("isVacationActive() ist false, wenn der Modus inaktiv ist", () => {
  const mode: VacationMode = { active: false, startDate: "2026-07-01", endDate: null };
  assert.equal(isVacationActive(mode, "2026-07-10"), false);
});

test("isVacationActive() ist false, wenn kein Modus gesetzt ist (undefined)", () => {
  assert.equal(isVacationActive(undefined, "2026-07-10"), false);
});

test("isVacationActive() ist false vor dem Startdatum", () => {
  const mode: VacationMode = { active: true, startDate: "2026-07-10", endDate: null };
  assert.equal(isVacationActive(mode, "2026-07-09"), false);
});

test("isVacationActive() ist true am Startdatum und unbegrenzt danach, wenn endDate null ist", () => {
  const mode: VacationMode = { active: true, startDate: "2026-07-10", endDate: null };
  assert.equal(isVacationActive(mode, "2026-07-10"), true);
  assert.equal(isVacationActive(mode, "2027-01-01"), true);
});

test("isVacationActive() ist true innerhalb und false außerhalb eines begrenzten Zeitraums", () => {
  const mode: VacationMode = { active: true, startDate: "2026-07-10", endDate: "2026-07-20" };
  assert.equal(isVacationActive(mode, "2026-07-09"), false);
  assert.equal(isVacationActive(mode, "2026-07-10"), true);
  assert.equal(isVacationActive(mode, "2026-07-20"), true);
  assert.equal(isVacationActive(mode, "2026-07-21"), false);
});

// ─── isVacationDueForAutoEnd() ──────────────────────────────────────────────

test("isVacationDueForAutoEnd() ist false ohne endDate (unbegrenzt)", () => {
  const mode: VacationMode = { active: true, startDate: "2026-07-10", endDate: null };
  assert.equal(isVacationDueForAutoEnd(mode, "2030-01-01"), false);
});

test("isVacationDueForAutoEnd() ist false vor dem Enddatum", () => {
  const mode: VacationMode = { active: true, startDate: "2026-07-10", endDate: "2026-07-20" };
  assert.equal(isVacationDueForAutoEnd(mode, "2026-07-19"), false);
});

test("isVacationDueForAutoEnd() ist true am und nach dem Enddatum", () => {
  const mode: VacationMode = { active: true, startDate: "2026-07-10", endDate: "2026-07-20" };
  assert.equal(isVacationDueForAutoEnd(mode, "2026-07-20"), true);
  assert.equal(isVacationDueForAutoEnd(mode, "2026-07-25"), true);
});

test("isVacationDueForAutoEnd() ist false, wenn der Modus bereits inaktiv ist", () => {
  const mode: VacationMode = { active: false, startDate: "2026-07-10", endDate: "2026-07-20" };
  assert.equal(isVacationDueForAutoEnd(mode, "2026-07-25"), false);
});
