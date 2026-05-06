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
}

export interface CompletionLog {
  taskId: string;
  completedAt: string;
  actualMinutes?: number;
}

// Deck repräsentiert einen Ordner (parentId === null) oder eine Sammlung (parentId = Ordner-ID).
// Die zwei-Ebenen-Hierarchie spiegelt Angulars Router-Konzept: Parent-Route (Thema) → Child-Route (Sammlung).
export interface Deck {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  createdAt: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer?: string;
  tags: string[];
  createdAt: string;
  answeredAt?: string;
  lastReviewed?: string;
  deckId?: string;         // Referenz zur Sammlung (Deck mit parentId !== null)
  // SM2 Spaced-Repetition state — optional so existing cards without review history stay valid
  reps?: number;           // consecutive correct answers; 0 means new or reset card
  easeFactor?: number;     // interval growth multiplier; starts at 2.5 per SM2 spec
  interval?: number;       // days until the next review
  nextReviewDate?: string; // ISO timestamp of the next scheduled review
}
  
export interface DailyReflection {
  date: string;
  dayRating: number;
  motivationRating: number;
  funTaskIds: string[];
  funCategoryIds: string[];
}

export interface AppData {
  version: number;
  tasks: Task[];
  completions: CompletionLog[];
  categories: Category[];
  flashcards: Flashcard[];
  decks: Deck[];
  reflections?: DailyReflection[];
}
