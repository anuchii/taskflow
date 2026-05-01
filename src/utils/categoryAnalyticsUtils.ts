// ============================================================
// utils/categoryAnalyticsUtils.ts
// Pure analytics functions for category-level insights.
// No side effects, no service calls — accepts raw AppData arrays.
//
// Three metrics are computed:
//   1. Top-Volumen   — category with the most completions this week
//   2. Pünktlichkeit — category with the lowest on-time rate
//                      (completion date ≤ dueDate), all time
//   3. Tages-Streak  — consecutive days with at least one completion
//                      per category, walking back from today
//
// Angular migration:
//   - computeCategoryAnalytics() becomes a method on AnalyticsService
//   - CategoryAnalytics becomes the @Input() type for
//     CategoryAnalyticsWidgetComponent
//   - The on-time logic (completedAt ≤ dueDate) is intentionally
//     aligned with the flashcard "delayed review" concept: both
//     measure whether knowledge/work was applied before the deadline.
// ============================================================

import type { Task, Category, CompletionLog } from "../models/Task.js";
import { today, addDays } from "./DateUtils.js";

// ─── Output interfaces ────────────────────────────────────

/** Category with the most task completions in the given week range. */
export interface TopVolumeCategory {
  categoryId: string;
  name: string;
  color: string;
  completedCount: number;
  weekTotal: number;
}


export interface OnTimeCategory {
  categoryId: string;
  name: string;
  color: string;
  onTimeRate: number; // 0–100 (rounded)
  onTime: number;
  total: number;
}

/** Consecutive days (ending today) with ≥ 1 completion in a category. */
export interface CategoryStreak {
  categoryId: string;
  name: string;
  color: string;
  currentStreak: number;
}

export interface CategoryAnalytics {
  topVolume: TopVolumeCategory | null;
  lowestOnTime: OnTimeCategory | null;
  streaks: CategoryStreak[]; // sorted desc, max 5 entries
}


export function computeCategoryAnalytics(
  tasks: Task[],
  completions: CompletionLog[],
  categories: Category[],
  weekRange: string[]
): CategoryAnalytics {
  return {
    topVolume: computeTopVolume(tasks, completions, categories, weekRange),
    lowestOnTime: computeLowestOnTime(tasks, completions, categories),
    streaks: computeStreaks(tasks, completions, categories),
  };
}

// ─── Top volume ───────────────────────────────────────────

function computeTopVolume(
  tasks: Task[],
  completions: CompletionLog[],
  categories: Category[],
  weekRange: string[]
): TopVolumeCategory | null {
  const dateSet = new Set(weekRange);
  const catCount = new Map<string, number>();
  let weekTotal = 0;

  for (const c of completions) {
    if (!dateSet.has(c.completedAt.slice(0, 10))) continue;
    const task = tasks.find((t) => t.id === c.taskId);
    if (!task || task.archived) continue;
    const catId = task.category || "sonstiges";
    catCount.set(catId, (catCount.get(catId) ?? 0) + 1);
    weekTotal++;
  }

  if (catCount.size === 0) return null;

  let topId = "";
  let topCount = 0;
  for (const [id, n] of catCount) {
    if (n > topCount) {
      topCount = n;
      topId = id;
    }
  }

  const cat = categories.find((c) => c.id === topId);
  return {
    categoryId: topId,
    name: cat?.label ?? topId,
    color: cat?.color ?? "#7a7a8c",
    completedCount: topCount,
    weekTotal,
  };
}

// ─── On-time rate ─────────────────────────────────────────

function computeLowestOnTime(
  tasks: Task[],
  completions: CompletionLog[],
  categories: Category[]
): OnTimeCategory | null {
  const catStats = new Map<string, { onTime: number; total: number }>();

  for (const c of completions) {
    const task = tasks.find((t) => t.id === c.taskId);
    if (!task || task.archived || !task.dueDate) continue;

    const catId = task.category || "sonstiges";
    const entry = catStats.get(catId) ?? { onTime: 0, total: 0 };
    entry.total++;
    if (c.completedAt.slice(0, 10) <= task.dueDate) entry.onTime++;
    catStats.set(catId, entry);
  }

  let lowestRate = 101;
  let lowestId = "";

  for (const [id, { onTime, total }] of catStats) {
    if (total < 2) continue;
    const rate = (onTime / total) * 100;
    if (rate < lowestRate) {
      lowestRate = rate;
      lowestId = id;
    }
  }

  if (!lowestId) return null;

  const { onTime, total } = catStats.get(lowestId)!;
  const cat = categories.find((c) => c.id === lowestId);
  return {
    categoryId: lowestId,
    name: cat?.label ?? lowestId,
    color: cat?.color ?? "#7a7a8c",
    onTimeRate: Math.round((onTime / total) * 100),
    onTime,
    total,
  };
}

// ─── Streaks ──────────────────────────────────────────────

function computeStreaks(
  tasks: Task[],
  completions: CompletionLog[],
  categories: Category[]
): CategoryStreak[] {
  const catDates = new Map<string, Set<string>>();

  for (const c of completions) {
    const task = tasks.find((t) => t.id === c.taskId);
    if (!task || task.archived) continue;
    const catId = task.category || "sonstiges";
    if (!catDates.has(catId)) catDates.set(catId, new Set());
    catDates.get(catId)!.add(c.completedAt.slice(0, 10));
  }

  const todayStr = today();
  const result: CategoryStreak[] = [];

  for (const [catId, dates] of catDates) {
    let streak = 0;
    let d = todayStr;
    for (let i = 0; i < 365; i++) {
      if (!dates.has(d)) break;
      streak++;
      d = addDays(d, -1);
    }
    if (streak === 0) continue;

    const cat = categories.find((c) => c.id === catId);
    result.push({
      categoryId: catId,
      name: cat?.label ?? catId,
      color: cat?.color ?? "#7a7a8c",
      currentStreak: streak,
    });
  }

  return result.sort((a, b) => b.currentStreak - a.currentStreak).slice(0, 5);
}
