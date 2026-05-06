import { supermemo } from "./sm2.algorithm.js";
import type { SuperMemoGrade } from "./sm2.types.js";
import type { Flashcard } from "../../models/Task.js";

// SM2 spec: every new card starts with this ease factor
const DEFAULT_EASE_FACTOR = 2.5;

export class FlashcardScheduler {
  private cards: Flashcard[];

  constructor(cards: Flashcard[]) {
    // Defensive copy: the scheduler owns its queue so that mutations here
    // never silently affect the caller's original array — important for
    // the stateless contract (Angular services expect immutable inputs).
    this.cards = [...cards];
  }

  getNextDueCard(): Flashcard | null {
    const now = new Date();

    const dueCards = this.cards.filter((card) => {
      if (!card.nextReviewDate) return true; // no review date → always due (new card)
      return new Date(card.nextReviewDate) <= now;
    });

    if (dueCards.length === 0) return null;

    // Two-level sort mirrors Anki's queue logic:
    //   1. Learning cards (reps === 0) before mature cards — they need short-interval reinforcement first
    //   2. Among equal reps-status, the most overdue card comes first (smallest timestamp = oldest due date)
    dueCards.sort((a, b) => {
      const aReps = a.reps ?? 0;
      const bReps = b.reps ?? 0;

      if (aReps === 0 && bReps !== 0) return -1;
      if (aReps !== 0 && bReps === 0) return 1;

      const aTime = a.nextReviewDate ? new Date(a.nextReviewDate).getTime() : 0;
      const bTime = b.nextReviewDate ? new Date(b.nextReviewDate).getTime() : 0;
      return aTime - bTime;
    });

    return dueCards[0];
  }

  reviewCard(cardId: string, quality: number): Flashcard {
    const idx = this.cards.findIndex((c) => c.id === cardId);
    if (idx === -1) throw new Error(`Flashcard "${cardId}" not found in scheduler.`);

    const card = this.cards[idx];

    // Map Flashcard fields → SuperMemoItem, falling back to SM2 initial values for new cards
    const smResult = supermemo(
      {
        interval:   card.interval   ?? 0,
        repetition: card.reps       ?? 0,
        efactor:    card.easeFactor ?? DEFAULT_EASE_FACTOR,
      },
      quality as SuperMemoGrade
    );

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + smResult.interval);

    const updated: Flashcard = {
      ...card,
      interval:       smResult.interval,
      reps:           smResult.repetition,
      easeFactor:     smResult.efactor,
      nextReviewDate: nextReviewDate.toISOString(),
    };

    this.cards[idx] = updated;

    // Return the updated card so the caller (FlashcardService) can persist it —
    // the scheduler itself never writes to storage, keeping the layers clean.
    return updated;
  }
}
