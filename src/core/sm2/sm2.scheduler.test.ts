import { test } from "node:test";
import assert from "node:assert/strict";
import { FlashcardScheduler } from "./sm2.scheduler.js";
import type { Flashcard } from "../../models/Task.js";

const DAY_MS = 86_400_000;

function makeCard(overrides: Pick<Flashcard, "id"> & Partial<Flashcard>): Flashcard {
  return {
    question:   "Testfrage",
    tags:       [],
    createdAt:  new Date().toISOString(),
    reps:       1,
    easeFactor: 2.5,
    interval:   1,
    ...overrides,
  };
}

// ─── Queue-order test ─────────────────────────────────────────────────────────

test("getNextDueCard gibt immer die dringendste Karte zurück", () => {
  const yesterday     = new Date(Date.now() -     DAY_MS).toISOString();
  const threeDaysAgo  = new Date(Date.now() - 3 * DAY_MS).toISOString();
  const tomorrow      = new Date(Date.now() +     DAY_MS).toISOString();

  const cards: Flashcard[] = [
    makeCard({ id: "a", nextReviewDate: yesterday }),
    makeCard({ id: "b", nextReviewDate: threeDaysAgo }), // älteste Fälligkeit → muss zuerst kommen
    makeCard({ id: "c", nextReviewDate: tomorrow }),      // noch nicht fällig → darf nie erscheinen
  ];

  const scheduler = new FlashcardScheduler(cards);

  const first = scheduler.getNextDueCard();
  assert.equal(first?.id, "b", "Die älteste überfällige Karte muss zuerst kommen");

  scheduler.reviewCard("b", 4); // Karte b reviewen → aus der Fälligkeits-Queue entfernen

  const second = scheduler.getNextDueCard();
  assert.equal(second?.id, "a", "Nach b muss a die nächste sein");

  scheduler.reviewCard("a", 4);

  const third = scheduler.getNextDueCard();
  assert.equal(third, null, "Keine weiteren fälligen Karten — c ist noch nicht fällig");
});

// ─── Learning-card priority test ──────────────────────────────────────────────

test("Lernkarten (reps === 0) haben Priorität vor reifen Karten", () => {
  const yesterday = new Date(Date.now() - DAY_MS).toISOString();

  const cards: Flashcard[] = [
    makeCard({ id: "mature", reps: 5, nextReviewDate: yesterday }),
    makeCard({ id: "new",    reps: 0, nextReviewDate: yesterday }),
  ];

  const scheduler = new FlashcardScheduler(cards);
  const next = scheduler.getNextDueCard();

  assert.equal(next?.id, "new", "Lernkarte (reps=0) muss vor reifer Karte angezeigt werden");
});
