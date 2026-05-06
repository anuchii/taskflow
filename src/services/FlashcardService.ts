// ============================================================
// services/FlashcardService.ts
// ============================================================

import type { Deck, Flashcard } from "../models/Task.js";
import type { StorageService } from "./StorageService.js";

export class FlashcardService {
  constructor(private readonly storage: StorageService) {}

  async getAll(): Promise<Flashcard[]> {
    const data = await this.storage.load();
    return (data.flashcards ?? [])
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(question: string, tags: string[] = [], deckId?: string): Promise<Flashcard> {
    const trimmed = question.trim();
    if (!trimmed) throw new Error("Frage darf nicht leer sein.");

    const data = await this.storage.load();
    const card: Flashcard = {
      id: crypto.randomUUID(),
      question: trimmed,
      tags,
      createdAt: new Date().toISOString(),
      ...(deckId ? { deckId } : {}),
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

  async saveReview(card: Flashcard): Promise<void> {
    const data = await this.storage.load();
    const idx = data.flashcards.findIndex((c) => c.id === card.id);
    if (idx === -1) return;
    // Persist the full SM2-updated card; lastReviewed is set here so the
    // scheduler stays focused on SM2 fields and doesn't need to know about it.
    data.flashcards[idx] = { ...card, lastReviewed: new Date().toISOString() };
    await this.storage.save(data);
  }

  // ─── Deck CRUD ─────────────────────────────────────────────

  async getDecks(): Promise<Deck[]> {
    const data = await this.storage.load();
    return (data.decks ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  async createDeck(name: string, parentId: string | null, color?: string): Promise<Deck> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Deck-Name darf nicht leer sein.");
    const data = await this.storage.load();
    const deck: Deck = {
      id: crypto.randomUUID(),
      name: trimmed,
      parentId,
      createdAt: new Date().toISOString(),
      ...(color ? { color } : {}),
    };
    data.decks = [...(data.decks ?? []), deck];
    await this.storage.save(data);
    return deck;
  }

  async deleteDeck(id: string): Promise<void> {
    const data = await this.storage.load();
    // Kinder-Decks und alle zugehörigen Karten werden mitgelöscht,
    // damit keine verwaisten deckId-Referenzen im Storage bleiben.
    const childIds = (data.decks ?? [])
      .filter((d) => d.parentId === id)
      .map((d) => d.id);
    const allRemovedIds = new Set([id, ...childIds]);
    data.decks      = (data.decks ?? []).filter((d) => !allRemovedIds.has(d.id));
    data.flashcards = data.flashcards.filter((c) => !c.deckId || !allRemovedIds.has(c.deckId));
    await this.storage.save(data);
  }

  async getCardsByDeck(deckId: string): Promise<Flashcard[]> {
    const data = await this.storage.load();
    return data.flashcards
      .filter((c) => c.deckId === deckId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
