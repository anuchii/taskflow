// ============================================================
// services/TaskService.ts
// ============================================================

import type { Task, Category, RepeatConfig } from "../models/Task.js";

export interface TimeEntry {
  task: Task;
  date: string;
  estimated?: number;
  actual?: number;
}
import { DEFAULT_CATEGORIES } from "../models/Task.js";
import { StorageService } from "./StorageService.js";
import { today, parseDate, addDays } from "../utils/DateUtils.js";

export interface DayStat {
  date: string;
  total: number;
  completed: number;
}

export class TaskService {
  constructor(private readonly storage: StorageService) {}

  // ─── Task CRUD ────────────────────────────────────────────

  async createTask(title: string, description: string, category: string, repeat: RepeatConfig, startDate?: string, estimatedMinutes?: number, dueDate?: string): Promise<Task> {
    const data = await this.storage.load();
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      description,
      category: category || "sonstiges",
      createdAt: new Date().toISOString(),
      startDate: startDate ?? today(),
      repeat,
      archived: false,
      ...(estimatedMinutes != null && { estimatedMinutes }),
      ...(dueDate ? { dueDate } : {}),
    };
    data.tasks.push(task);
    await this.storage.save(data);
    return task;
  }

  async updateTask(id: string, patch: Partial<Omit<Task, "id" | "createdAt">>): Promise<void> {
    const data = await this.storage.load();
    const idx = data.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return;
    data.tasks[idx] = { ...data.tasks[idx], ...patch };
    await this.storage.save(data);
  }

  async archiveTask(id: string): Promise<void> {
    await this.updateTask(id, { archived: true });
  }

  async getAllTasks(): Promise<Task[]> {
    return (await this.storage.load()).tasks;
  }

  // ─── Categories ───────────────────────────────────────────

  async getCategories(): Promise<Category[]> {
    const data = await this.storage.load();
    return data.categories ?? DEFAULT_CATEGORIES.map(c => ({ ...c }));
  }

  async getCategoryById(id: string): Promise<Category | null> {
    const cats = await this.getCategories();
    return cats.find(c => c.id === id)
      ?? cats.find(c => c.id === "sonstiges")
      ?? cats[cats.length - 1]
      ?? null;
  }

  async createCategory(label: string, color: string): Promise<Category> {
    const data = await this.storage.load();
    if (!data.categories) data.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
    const cat: Category = { id: crypto.randomUUID(), label, color };
    data.categories.push(cat);
    await this.storage.save(data);
    return cat;
  }

  async updateCategory(id: string, label: string, color: string): Promise<void> {
    const data = await this.storage.load();
    if (!data.categories) data.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
    const idx = data.categories.findIndex(c => c.id === id);
    if (idx === -1) return;
    data.categories[idx] = { ...data.categories[idx], label, color };
    await this.storage.save(data);
  }

  async deleteCategory(id: string): Promise<number> {
    const data = await this.storage.load();
    if (!data.categories) data.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
    const usedCount = data.tasks.filter(t => !t.archived && t.category === id).length;
    if (usedCount > 0) return usedCount;
    data.categories = data.categories.filter(c => c.id !== id);
    await this.storage.save(data);
    return 0;
  }

  // ─── Scheduling ───────────────────────────────────────────

  async getTasksForDate(dateStr: string): Promise<Task[]> {
    const data = await this.storage.load();
    return data.tasks.filter((t) => !t.archived && this.isActiveOn(t, dateStr));
  }

  isActiveOn(task: Task, dateStr: string): boolean {
    const startDate = task.startDate ?? task.createdAt.slice(0, 10);
    if (dateStr < startDate) return false;
    const { unit, endDate } = task.repeat;
    if (endDate && dateStr > endDate) return false;
    if (unit === "none") return dateStr === startDate;
    if (unit === "daily") return true;
    if (unit === "weekly") {
      const diffDays = Math.round(
        (parseDate(dateStr).getTime() - parseDate(startDate).getTime()) / 86_400_000
      );
      return diffDays % 7 === 0;
    }
    if (unit === "monthly") {
      return parseDate(startDate).getDate() === parseDate(dateStr).getDate();
    }
    return false;
  }

  // ─── Completions ──────────────────────────────────────────

  async markDone(taskId: string): Promise<void> {
    const data = await this.storage.load();
    const dateKey = today();
    if (data.completions.some((c) => c.taskId === taskId && c.completedAt.startsWith(dateKey))) return;
    data.completions.push({ taskId, completedAt: new Date().toISOString() });
    await this.storage.save(data);
  }

  async unmarkDone(taskId: string, dateStr?: string): Promise<void> {
    const data = await this.storage.load();
    const key = dateStr ?? today();
    data.completions = data.completions.filter(
      (c) => !(c.taskId === taskId && c.completedAt.startsWith(key))
    );
    await this.storage.save(data);
  }

  async isCompletedOn(taskId: string, dateStr: string): Promise<boolean> {
    const data = await this.storage.load();
    return data.completions.some((c) => c.taskId === taskId && c.completedAt.startsWith(dateStr));
  }

  async getActualMinutes(taskId: string, dateStr: string): Promise<number | undefined> {
    const data = await this.storage.load();
    return data.completions.find(
      (c) => c.taskId === taskId && c.completedAt.startsWith(dateStr)
    )?.actualMinutes;
  }

  async logActualTime(taskId: string, dateStr: string, minutes: number): Promise<void> {
    const data = await this.storage.load();
    const idx = data.completions.findIndex(
      (c) => c.taskId === taskId && c.completedAt.startsWith(dateStr)
    );
    if (idx === -1) return;
    data.completions[idx] = { ...data.completions[idx], actualMinutes: minutes };
    await this.storage.save(data);
  }

  async getUpcomingByDate(days = 30): Promise<{ date: string; tasks: Task[] }[]> {
    const data = await this.storage.load();
    const result: { date: string; tasks: Task[] }[] = [];
    for (let i = 1; i <= days; i++) {
      const dateStr = addDays(today(), i);
      const tasks = data.tasks.filter((t) => !t.archived && this.isActiveOn(t, dateStr));
      if (tasks.length > 0) result.push({ date: dateStr, tasks });
    }
    return result;
  }

  async getTimeComparisonForDates(dates: string[]): Promise<TimeEntry[]> {
    const data = await this.storage.load();
    const results: TimeEntry[] = [];
    for (const dateStr of dates) {
      for (const c of data.completions.filter((c) => c.completedAt.startsWith(dateStr))) {
        const task = data.tasks.find((t) => t.id === c.taskId);
        if (!task) continue;
        if (task.estimatedMinutes == null && c.actualMinutes == null) continue;
        results.push({ task, date: dateStr, estimated: task.estimatedMinutes, actual: c.actualMinutes });
      }
    }
    return results;
  }

  async getStatsForDates(dates: string[]): Promise<DayStat[]> {
    const data = await this.storage.load();
    return dates.map((date) => {
      const tasks = data.tasks.filter((t) => !t.archived && this.isActiveOn(t, date));
      const completed = tasks.filter((t) =>
        data.completions.some((c) => c.taskId === t.id && c.completedAt.startsWith(date))
      ).length;
      return { date, total: tasks.length, completed };
    });
  }
  // ─── Überfällige Aufgaben ────────────────────────────

  isOverdue(task: Task, data: { completions: Array<{ taskId: string; completedAt: string }> }): number {
    const todayStr = today();
    const hasAnyCompletion = data.completions.some(c => c.taskId === task.id);

    // Condition 1: dueDate exceeded
    if (task.dueDate && task.dueDate < todayStr) {
      if (!hasAnyCompletion) {
        return Math.round(
          (parseDate(todayStr).getTime() - parseDate(task.dueDate).getTime()) / 86_400_000
        );
      }
      return 0;
    }

    // Condition 2: one-time task not done on its day
    if (task.repeat.unit === "none") {
      const startDate = task.startDate ?? task.createdAt.slice(0, 10);
      if (startDate >= todayStr || hasAnyCompletion) return 0;
      return Math.round(
        (parseDate(todayStr).getTime() - parseDate(startDate).getTime()) / 86_400_000
      );
    }

    return 0;
  }

  async getTasksForDateWithOverdue(dateStr: string): Promise<(Task & { daysOverdue: number })[]> {
    const data = await this.storage.load();

    const scheduledTasks = data.tasks.filter((t) => !t.archived && this.isActiveOn(t, dateStr));

    const overdueOnceTasks = data.tasks.filter((t) => {
      if (t.archived || t.repeat.unit !== "none") return false;
      const sd = t.startDate ?? t.createdAt.slice(0, 10);
      if (sd >= dateStr) return false;
      return !data.completions.some(c => c.taskId === t.id);
    });

    const overdueDueDateTasks = data.tasks.filter((t) => {
      if (t.archived || !t.dueDate || t.dueDate >= dateStr) return false;
      return !data.completions.some(c => c.taskId === t.id);
    });

    const seen = new Set(scheduledTasks.map(t => t.id));
    const combined = [
      ...scheduledTasks,
      ...overdueOnceTasks.filter(t => !seen.has(t.id)),
      ...overdueDueDateTasks.filter(t => { const isNew = !seen.has(t.id); seen.add(t.id); return isNew; }),
    ];

    return combined.map((t) => ({
      ...t,
      daysOverdue: this.isOverdue(t, data),
    }));
  }
}
