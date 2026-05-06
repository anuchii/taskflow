import type { SuperMemoItem, SuperMemoGrade } from "./sm2.types.js";

export function supermemo(item: SuperMemoItem, grade: SuperMemoGrade): SuperMemoItem {
  let nextInterval:   number;
  let nextRepetition: number;

  if (grade >= 3) {
    if (item.repetition === 0) {
      nextInterval   = 1;
      nextRepetition = 1;
    } else if (item.repetition === 1) {
      nextInterval   = 6;
      nextRepetition = 2;
    } else {
      // Intervall wächst multiplikativ – der eFactor steuert wie schnell
      nextInterval   = Math.round(item.interval * item.efactor);
      nextRepetition = item.repetition + 1;
    }
  } else {
    // Bei Fehler wird die Karte zurückgesetzt, damit sie neu gelernt wird
    nextInterval   = 1;
    nextRepetition = 0;
  }

  let nextEfactor = item.efactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));

  // Untergrenze verhindert, dass Karten zu häufig wiederholt werden müssen
  if (nextEfactor < 1.3) nextEfactor = 1.3;

  return {
    interval:   nextInterval,
    repetition: nextRepetition,
    efactor:    nextEfactor,
  };
}
