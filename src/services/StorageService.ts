// ============================================================
// services/StorageService.ts
// Firestore-Persistenz — Daten pro User gespeichert
// ============================================================

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { AppData, Category } from "../models/Task.js";

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
  categories:  [
    { id: "arbeit",      label: "Arbeit",      color: "#5b8dee" },
    { id: "schule",      label: "Schule",      color: "#a78bfa" },
    { id: "gesundheit",  label: "Gesundheit",  color: "#4caf82" },
    { id: "haushalt",    label: "Haushalt",    color: "#f5a623" },
    { id: "persoenlich", label: "Persönlich",  color: "#f472b6" },
    { id: "sonstiges",   label: "Sonstiges",   color: "#7a7a8c" },
  ],
};

export const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

export class StorageService {
  private cache: AppData | null = null;

 
  private dataRef() {
    const auth = getAuth(firebaseApp);
    const user = auth.currentUser;
    if (!user) throw new Error("Kein User eingeloggt!");
    return doc(db, "users", user.uid, "appdata", "main");
  }


  clearCache(): void {
    this.cache = null;
  }


  async load(): Promise<AppData> {
    if (this.cache) return structuredClone(this.cache);
    try {
      const snapshot = await getDoc(this.dataRef());
      const data = snapshot.exists()
        ? (snapshot.data() as AppData)
        : structuredClone(EMPTY_DATA);
      this.cache = data;
      return structuredClone(data);
    } catch (e) {
      console.error("[StorageService] Fehler beim Laden:", e);
      return structuredClone(EMPTY_DATA);
    }
  }

  
  async save(data: AppData): Promise<void> {
    try {
      await setDoc(this.dataRef(), JSON.parse(JSON.stringify(data)));
      this.cache = structuredClone(data);
    } catch (e) {
      console.error("[StorageService] Fehler beim Speichern:", e);
      throw e;
    }
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
}