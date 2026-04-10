// ============================================================
// models/Task.ts
// ============================================================

export type RepeatUnit = "none" | "daily" | "weekly" | "monthly";

export interface RepeatConfig {
  unit: RepeatUnit;
  interval: number;
  endDate: string | null;
}

export interface Category {
  id: string;
  label: string;
  color: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "arbeit",      label: "Arbeit",      color: "#5b8dee" },
  { id: "schule",      label: "Schule",      color: "#a78bfa" },
  { id: "gesundheit",  label: "Gesundheit",  color: "#4caf82" },
  { id: "haushalt",    label: "Haushalt",    color: "#f5a623" },
  { id: "persoenlich", label: "Persönlich",  color: "#f472b6" },
  { id: "sonstiges",   label: "Sonstiges",   color: "#7a7a8c" },
];

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  createdAt: string;
  repeat: RepeatConfig;
  archived: boolean;
}

export interface CompletionLog {
  taskId: string;
  completedAt: string;
}

export interface AppData {
  version: number;
  tasks: Task[];
  completions: CompletionLog[];
  categories: Category[];
}
