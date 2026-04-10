// ============================================================
// services/TaskService.ts
// ============================================================

import type { Task, Category, RepeatConfig } from "../models/Task.js";
import { DEFAULT_CATEGORIES } from "../models/Task.js";
import { StorageService } from "./StorageService.js";
import { today, parseDate } from "../utils/DateUtils.js";

export interface DayStat {
  date: string;
  total: number;
  completed: number;
}

export class TaskService {
  constructor(private readonly storage: StorageService) {}

  // ─── Task CRUD ────────────────────────────────────────────

  async createTask(title: string, description: string, category: string, repeat: RepeatConfig): Promise<Task> {
    const data = await this.storage.load();
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      description,
      category: category || "sonstiges",
      createdAt: new Date().toISOString(),
      repeat,
      archived: false,
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
    if (!data.categories) return;
    const idx = data.categories.findIndex(c => c.id === id);
    if (idx === -1) return;
    data.categories[idx] = { ...data.categories[idx], label, color };
    await this.storage.save(data);
  }

  /** Returns 0 on success, or the count of active tasks using this category (blocking deletion). */
  async deleteCategory(id: string): Promise<number> {
    const data = await this.storage.load();
    if (!data.categories) return 0;
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
    const createdDate = task.createdAt.slice(0, 10);
    if (dateStr < createdDate) return false;
    const { unit, endDate } = task.repeat;
    if (endDate && dateStr > endDate) return false;
    if (unit === "none") return dateStr === createdDate;
    if (unit === "daily") return true;
    if (unit === "weekly") {
      const diffDays = Math.round(
        (parseDate(dateStr).getTime() - parseDate(createdDate).getTime()) / 86_400_000
      );
      return diffDays % 7 === 0;
    }
    if (unit === "monthly") {
      return parseDate(createdDate).getDate() === parseDate(dateStr).getDate();
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
}
