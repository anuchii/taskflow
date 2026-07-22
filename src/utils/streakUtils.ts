// ============================================================
// utils/streakUtils.ts
// Reine Funktion: aktuelle "Tage in Folge"-Serie aus DayStat[] ableiten.
// Genutzt vom TodayOverviewCard-Widget (Aufgaben-Übersicht).
// ============================================================

import type { DayStat } from "../services/TaskService.js";

export function computeStreak(stats: DayStat[]): number {
  if (stats.length === 0) return 0;

  const ordered = [...stats].sort((a, b) => a.date.localeCompare(b.date));
  let i = ordered.length - 1;

  // Der letzte Eintrag (in der Praxis: heute) zählt nur mit, wenn er bereits
  // vollständig erledigt ist. Ist er es nicht, wird er übersprungen statt die
  // Serie zu unterbrechen — sonst würde die Serie jeden Morgen auf 0 fallen,
  // noch bevor überhaupt etwas erledigt werden konnte.
  const last = ordered[i];
  if (!(last.total > 0 && last.completed === last.total)) i--;

  let streak = 0;
  for (; i >= 0; i--) {
    const day = ordered[i];
    if (day.total > 0 && day.completed === day.total) streak++;
    else break;
  }
  return streak;
}
