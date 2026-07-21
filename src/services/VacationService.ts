// ============================================================
// services/VacationService.ts
// Steuert den Urlaubsmodus: aktivieren, beenden (manuell/automatisch)
// und das echte Verschieben pausierter Aufgaben-Termine.
// ============================================================

import type { AppData, Task, VacationMode } from "../models/Task.js";
import { StorageService } from "./StorageService.js";
import { today } from "../utils/DateUtils.js";
import { isVacationDueForAutoEnd } from "../utils/VacationUtils.js";

export class VacationService {
  constructor(private readonly storage: StorageService) {}

  async getMode(): Promise<VacationMode | null> {
    const data = await this.storage.load();
    return data.vacationMode ?? null;
  }

  // ─── Aktivieren ───────────────────────────────────────────

  async start(endDate: string | null): Promise<void> {
    const data = await this.storage.load();
    data.vacationMode = { active: true, startDate: today(), endDate };
    await this.storage.save(data);
  }

  // ─── Manuelles Beenden ────────────────────────────────────

  // Zeigt an, wie viele Aufgaben beim Beenden verschoben würden — Grundlage
  // für den Bestätigungsdialog, ohne dabei schon Daten zu verändern.
  async countAffectedTasks(): Promise<number> {
    const data = await this.storage.load();
    if (!data.vacationMode?.active) return 0;
    return data.tasks.filter((t) => this.wouldBeShifted(t, data, today())).length;
  }

  // Manuelles Beenden: Der Nutzer hat sich bewusst entschieden, jetzt aufzuhören
  // (z.B. bei unbegrenztem Modus) — Verschiebungs-Ziel ist daher der heutige Tag.
  async endNow(): Promise<number> {
    const data = await this.storage.load();
    const mode = data.vacationMode;
    if (!mode?.active) return 0;
    const count = this.applyShiftAndDeactivate(data, mode, today());
    await this.storage.save(data);
    return count;
  }

  // ─── Automatisches Beenden ────────────────────────────────

  // Beim App-Start geprüft (wie runAutoPrioritization). Anders als beim
  // manuellen Beenden ist das Ziel-Datum hier das geplante Enddatum selbst,
  // nicht der aktuelle Tag — der Urlaub sollte ja "an diesem Tag" enden,
  // auch wenn die App erst später wieder geöffnet wird.
  async checkAutoEnd(): Promise<number> {
    const data = await this.storage.load();
    const mode = data.vacationMode;
    if (!isVacationDueForAutoEnd(mode, today())) return 0;
    const count = this.applyShiftAndDeactivate(data, mode!, mode!.endDate!);
    await this.storage.save(data);
    return count;
  }

  // ─── Gemeinsame Verschiebe-Logik ──────────────────────────

  // Eine Aufgabe wird verschoben, wenn ihr eigenes Datum (startDate bei
  // einmaligen Aufgaben, dueDate bei terminierten) bis zum Urlaubsende in der
  // Vergangenheit liegt und sie nicht erledigt wurde — unabhängig davon, ob
  // dieses Datum vor oder erst während des Urlaubs lag. Der Urlaubsmodus
  // unterdrückt die "zu spät"-Markierung für die GESAMTE aktive Dauer, daher
  // muss beim Beenden auch jede in dieser Zeit verdeckte Verspätung nachgeholt
  // werden — nicht nur die, die exakt in den Urlaubszeitraum fällt.
  private wouldBeShifted(task: Task, data: AppData, effectiveEnd: string): boolean {
    if (task.archived) return false;
    const alreadyDone = data.completions.some((c) => c.taskId === task.id);
    if (alreadyDone) return false;

    if (task.repeat.unit === "none") {
      const sd = task.startDate ?? task.createdAt.slice(0, 10);
      if (sd <= effectiveEnd) return true;
    }
    if (task.dueDate && task.dueDate <= effectiveEnd) return true;
    return false;
  }

  private applyShiftAndDeactivate(data: AppData, mode: VacationMode, effectiveEnd: string): number {
    let shiftedCount = 0;

    for (const task of data.tasks) {
      if (!this.wouldBeShifted(task, data, effectiveEnd)) continue;

      // Wiederkehrende Aufgaben brauchen keine Datumsverschiebung: sie generieren
      // sich über isActiveOn() für jeden Tag neu und laufen ab morgen einfach
      // normal weiter. Nur einmalige Aufgaben (startDate) und dueDate-Termine
      // "verschwinden" sonst dauerhaft im Urlaubszeitraum — die holen wir hier
      // aktiv auf das Urlaubsende nach.
      if (task.repeat.unit === "none") task.startDate = effectiveEnd;
      if (task.dueDate) task.dueDate = effectiveEnd;
      task.dateShiftedByVacation = true;
      shiftedCount++;
    }

    data.vacationMode = { ...mode, active: false };
    return shiftedCount;
  }
}
