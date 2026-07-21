// ============================================================
// models/Task.ts
// ============================================================

export type RepeatUnit = "none" | "daily" | "weekly" | "monthly";

export type Priority = "high" | "medium" | "low";

export interface RepeatConfig {
  unit: RepeatUnit;
  interval: number;
  endDate: string | null;
}

export interface Category {
  id: string;
  label: string;
  color: string;
  parentId?: string | null;
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
  startDate: string;
  repeat: RepeatConfig;
  archived: boolean;
  estimatedMinutes?: number;
  dueDate?: string;
  priority?: Priority;
  isAutoPrioritized?: boolean;
  // true = startDate/dueDate wurde beim Beenden des Urlaubsmodus automatisch
  // verschoben (echtes Update, kein reiner Anzeige-Wert) — steuert die kleine
  // Markierung auf der Task-Karte, damit der Nutzer den Grund der Verschiebung erkennt.
  dateShiftedByVacation?: boolean;
}

export interface CompletionLog {
  taskId: string;
  completedAt: string;
  actualMinutes?: number;
}

export interface DailyReflection {
  date: string;
  dayRating: number;
  motivationRating: number;
  funTaskIds: string[];
  funCategoryIds: string[];
}

// Ein Objekt statt eines reinen Booleans, weil "an/aus" allein nicht reicht:
// wir müssen uns merken SEIT WANN pausiert wird (startDate) und OB/WANN es
// automatisch enden soll (endDate). endDate = null ist die bewusste
// Entscheidung "unbegrenzt", kein vergessener Wert.
export interface VacationMode {
  active: boolean;
  startDate: string;
  endDate: string | null;
}

export interface AppData {
  version: number;
  tasks: Task[];
  completions: CompletionLog[];
  categories: Category[];
  reflections?: DailyReflection[];
  vacationMode?: VacationMode;
}
