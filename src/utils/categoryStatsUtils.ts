// ============================================================
// utils/categoryStatsUtils.ts
// Pure data-transformation for the category time stats widget.
// No side effects, no service calls — accepts raw data as args.
//
// Angular migration: becomes a standalone pipe (CategoryStatsPipe)
// or a static helper method on a StatsService. The CategoryTimeStat
// interface becomes the @Input() type for CategoryTimeStatsWidgetComponent.
// ============================================================

import type { Task, Category, CompletionLog } from "../models/Task.js";

/**
 * Aggregated time data for one category over a given date range.
 * Angular migration: use as @Input() stats: CategoryTimeStat[] on the widget component.
 */
export interface CategoryTimeStat {
  categoryId: string;
  name: string;
  color: string;
  estimatedHours: number;
  actualHours: number;
}

/**
 * Aggregates actual vs. estimated time per category for the given date range.
 * Only counts completion entries whose date falls within weekRange.
 * Entries with no time data (no estimate and no actual) are excluded.
 *
 * @param tasks       Full task list from storage
 * @param completions Full completion log from storage
 * @param categories  Full category list from storage
 * @param weekRange   ISO date strings (YYYY-MM-DD) to aggregate over
 */
export function aggregateCategoryStats(
  tasks: Task[],
  completions: CompletionLog[],
  categories: Category[],
  weekRange: string[]
): CategoryTimeStat[] {
  const dateSet = new Set(weekRange);
  const map = new Map<string, { estimated: number; actual: number }>();

  for (const c of completions) {
    const dateStr = c.completedAt.slice(0, 10);
    if (!dateSet.has(dateStr)) continue;

    const task = tasks.find((t) => t.id === c.taskId);
    if (!task) continue;
    if (task.estimatedMinutes == null && c.actualMinutes == null) continue;

    const catId = task.category || "sonstiges";
    const entry = map.get(catId) ?? { estimated: 0, actual: 0 };
    entry.estimated += task.estimatedMinutes ?? 0;
    entry.actual += c.actualMinutes ?? 0;
    map.set(catId, entry);
  }

  const result: CategoryTimeStat[] = [];
  for (const [catId, { estimated, actual }] of map.entries()) {
    const cat = categories.find((c) => c.id === catId);
    result.push({
      categoryId: catId,
      name: cat?.label ?? catId,
      color: cat?.color ?? "#7a7a8c",
      estimatedHours: Math.round((estimated / 60) * 10) / 10,
      actualHours: Math.round((actual / 60) * 10) / 10,
    });
  }

  return result.sort((a, b) => b.actualHours - a.actualHours);
}
