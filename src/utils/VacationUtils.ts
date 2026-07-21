// ============================================================
// utils/VacationUtils.ts
// Reine Funktionen für die Urlaubsmodus-Zeitraum-Logik.
// ============================================================

import type { VacationMode } from "../models/Task.js";

// Liegt dateStr innerhalb des aktiven Urlaubszeitraums?
// endDate === null bedeutet "unbegrenzt" → nur die untere Grenze zählt.
export function isVacationActive(mode: VacationMode | undefined, dateStr: string): boolean {
  if (!mode?.active) return false;
  if (dateStr < mode.startDate) return false;
  if (mode.endDate && dateStr > mode.endDate) return false;
  return true;
}

// Soll der Urlaubsmodus automatisch beendet werden, weil das geplante
// Enddatum erreicht oder überschritten wurde? (unbegrenzter Modus hat
// kein endDate und kann daher nie automatisch enden.)
export function isVacationDueForAutoEnd(mode: VacationMode | undefined, todayStr: string): boolean {
  return !!mode?.active && mode.endDate != null && todayStr >= mode.endDate;
}
