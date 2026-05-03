// ============================================================
// services/AutoPriorityService.ts
// ============================================================
// Zustandslose Klasse ohne direkten Speicher-Zugriff.
// Empfängt Rohdaten, berechnet Änderungen, gibt sie zurück.
// In Angular: @Injectable({ providedIn: 'root' }) — kein Umbau nötig.

import type { Task, CompletionLog } from "../models/Task.js";
import { today, addDays, parseDate } from "../utils/DateUtils.js";

export interface AutoPriorityChange {
  id: string;
  patch: { priority: "high"; isAutoPrioritized: true };
}

export class AutoPriorityService {
  computeChanges(tasks: Task[], completions: CompletionLog[]): AutoPriorityChange[] {
    const todayStr = today();
    const tomorrowStr = addDays(todayStr, 1);

    return tasks
      .filter(t => !t.archived)
      // Bereits erledigte Aufgaben bleiben unverändert (identisch zu isOverdue-Logik in TaskService)
      .filter(t => !completions.some(c => c.taskId === t.id))
      // Vom User explizit auf "high" gesetzte Priorität nicht mit System-Flag überschreiben
      .filter(t => !(t.priority === "high" && !t.isAutoPrioritized))
      .filter(t => t.dueDate === tomorrowStr || this.getDaysOverdue(t, todayStr) > 2)
      .map(t => ({ id: t.id, patch: { priority: "high" as const, isAutoPrioritized: true as const } }));
  }

  private getDaysOverdue(task: Task, todayStr: string): number {
    if (task.dueDate && task.dueDate < todayStr) {
      return Math.round(
        (parseDate(todayStr).getTime() - parseDate(task.dueDate).getTime()) / 86_400_000
      );
    }
    // Einmalige Aufgabe ohne dueDate, deren Startdatum bereits verstrichen ist
    if (task.repeat.unit === "none") {
      const startDate = task.startDate ?? task.createdAt.slice(0, 10);
      if (startDate < todayStr) {
        return Math.round(
          (parseDate(todayStr).getTime() - parseDate(startDate).getTime()) / 86_400_000
        );
      }
    }
    return 0;
  }
}
