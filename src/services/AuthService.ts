// ============================================================
// services/AuthService.ts
// ============================================================

import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { firebaseApp } from "./StorageService.js";

export class AuthService {
  private readonly auth = getAuth(firebaseApp);
  private readonly provider = new GoogleAuthProvider();

  async login(): Promise<User> {
    this.provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(this.auth, this.provider);
    return result.user;
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  onAuthChange(callback: (user: User | null) => void): void {
    onAuthStateChanged(this.auth, callback);
  }
}