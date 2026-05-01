// ============================================================
// services/FlashcardService.ts
// ============================================================

import type { Flashcard } from "../models/Task.js";
import type { StorageService } from "./StorageService.js";

export class FlashcardService {
  constructor(private readonly storage: StorageService) {}

  async getAll(): Promise<Flashcard[]> {
    const data = await this.storage.load();
    return (data.flashcards ?? [])
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(question: string, tags: string[] = []): Promise<Flashcard> {
    const trimmed = question.trim();
    if (!trimmed) throw new Error("Frage darf nicht leer sein.");

    const data = await this.storage.load();
    const card: Flashcard = {
      id: crypto.randomUUID(),
      question: trimmed,
      tags,
      createdAt: new Date().toISOString(),
    };

    data.flashcards.push(card);
    await this.storage.save(data);
    return card;
  }

  async update(
    id: string,
    updates: { question?: string; answer?: string; tags?: string[] }
  ): Promise<void> {
    const data = await this.storage.load();
    const idx = data.flashcards.findIndex((c) => c.id === id);
    if (idx === -1) return;

    const card = data.flashcards[idx];
    const hadAnswer = !!card.answer?.trim();
    const newAnswer = updates.answer?.trim();
    const getsAnswer = !hadAnswer && !!newAnswer;

    data.flashcards[idx] = {
      ...card,
      ...(updates.question !== undefined
        ? { question: updates.question.trim() || card.question }
        : {}),
      answer: newAnswer || undefined,
      ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
      ...(getsAnswer ? { answeredAt: new Date().toISOString() } : {}),
    };

    await this.storage.save(data);
  }

  async delete(id: string): Promise<void> {
    const data = await this.storage.load();
    data.flashcards = data.flashcards.filter((c) => c.id !== id);
    await this.storage.save(data);
  }

  async recordReview(id: string): Promise<void> {
    const data = await this.storage.load();
    const idx = data.flashcards.findIndex((c) => c.id === id);
    if (idx === -1) return;
    data.flashcards[idx] = {
      ...data.flashcards[idx],
      lastReviewed: new Date().toISOString(),
    };
    await this.storage.save(data);
  }
}
