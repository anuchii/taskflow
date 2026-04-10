// ============================================================
// services/StorageService.ts
// Firestore-basierte Persistenz
// ============================================================

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import type { AppData } from "../models/Task.js";
import { DEFAULT_CATEGORIES } from "../models/Task.js";

const firebaseConfig = {
  apiKey: "AIzaSyAx0cbGnKHyYY_yHusCO_WPE3qas-Bk1Dw",
  authDomain: "taskflow-7db97.firebaseapp.com",
  projectId: "taskflow-7db97",
  storageBucket: "taskflow-7db97.firebasestorage.app",
  messagingSenderId: "329643365939",
  appId: "1:329643365939:web:69c7096cfe6d90e8647546",
  measurementId: "G-S17CY65GJ1",
};

const CURRENT_VERSION = 1;

const EMPTY_DATA: AppData = {
  version: CURRENT_VERSION,
  tasks: [],
  completions: [],
  categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const dataRef = () => doc(db, "appdata", "main");

export class StorageService {
  async load(): Promise<AppData> {
    try {
      const snapshot = await getDoc(dataRef());
      if (!snapshot.exists()) return structuredClone(EMPTY_DATA);
      const data = snapshot.data() as AppData;
      return this.migrate(data);
    } catch (e) {
      console.error("[StorageService] Fehler beim Laden:", e);
      return structuredClone(EMPTY_DATA);
    }
  }

  async save(data: AppData): Promise<void> {
    try {
      await setDoc(dataRef(), JSON.parse(JSON.stringify(data)));
    } catch (e) {
      console.error("[StorageService] Fehler beim Speichern:", e);
    }
  }

  private migrate(data: AppData): AppData {
    if (!data.categories) {
      data.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
    }
    return data;
  }

  async exportJSON(): Promise<void> {
    const data = await this.load();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tasks_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importJSON(file: File): Promise<void> {
    const text = await file.text();
    const incoming = JSON.parse(text) as AppData;
    const current = await this.load();

    // Merge tasks
    const taskIds = new Set(current.tasks.map((t) => t.id));
    for (const t of incoming.tasks ?? []) {
      if (!taskIds.has(t.id)) current.tasks.push(t);
    }

    // Merge completions
    const logKeys = new Set(
      current.completions.map((c) => c.taskId + c.completedAt)
    );
    for (const c of incoming.completions ?? []) {
      if (!logKeys.has(c.taskId + c.completedAt)) current.completions.push(c);
    }

    // Merge categories
    if (Array.isArray(incoming.categories)) {
      const catIds = new Set(current.categories.map((c) => c.id));
      for (const c of incoming.categories) {
        if (!catIds.has(c.id)) current.categories.push(c);
      }
    }

    await this.save(current);
  }
}
