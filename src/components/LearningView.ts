// ============================================================
// components/LearningView.ts
// Lernkarten – Quick Capture + Card-Flip View
// ============================================================

import type { Flashcard } from "../models/Task.js";
import type { FlashcardService } from "../services/FlashcardService.js";

type FilterType = "all" | "pending" | "answered";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export class LearningView {
  private currentFilter: FilterType = "all";
  private draftQuestion = "";
  private draftTags = "";

  private readonly editOverlay: HTMLElement;

  constructor(
    private readonly service: FlashcardService,
    private readonly container: HTMLElement
  ) {
    this.editOverlay = this.buildEditOverlay();
    document.body.appendChild(this.editOverlay);
  }

  // ─── Public ───────────────────────────────────────────────

  async render(): Promise<void> {
    this.saveDraft();

    const all = await this.service.getAll();
    const answered = all.filter((c) => !!c.answer?.trim()).length;
    const pending = all.length - answered;
    const filtered = this.applyFilter(all);

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Lernkarten</h1>
          <p class="view-subtitle">${all.length} gesamt · ${answered} beantwortet · ${pending} ausstehend</p>
        </div>
      </div>

      <div class="capture-bar">
        <textarea
          id="capture-q"
          class="capture-input"
          placeholder="Neue Frage notieren… (Strg+Enter zum Speichern)"
          rows="2"
        >${escapeHtml(this.draftQuestion)}</textarea>
        <div class="capture-footer">
          <input
            id="capture-tags"
            class="capture-tags-input"
            type="text"
            placeholder="Tags: kommagetrennt"
            value="${escapeHtml(this.draftTags)}"
          />
          <button class="btn btn-primary" id="btn-add-card">+ Hinzufügen</button>
        </div>
      </div>

      <div class="filter-tabs">
        <button class="tab-btn ${this.currentFilter === "all" ? "active" : ""}" data-filter="all">Alle (${all.length})</button>
        <button class="tab-btn ${this.currentFilter === "pending" ? "active" : ""}" data-filter="pending">Ausstehend (${pending})</button>
        <button class="tab-btn ${this.currentFilter === "answered" ? "active" : ""}" data-filter="answered">Beantwortet (${answered})</button>
      </div>

      ${
        filtered.length === 0
          ? this.emptyStateHtml()
          : `<div class="fc-grid">${filtered.map((c) => this.cardHtml(c)).join("")}</div>`
      }
    `;

    this.attachEvents();
  }

  destroy(): void {
    this.editOverlay.remove();
  }

  // ─── Draft persistence ────────────────────────────────────

  private saveDraft(): void {
    const q = this.container.querySelector<HTMLTextAreaElement>("#capture-q");
    const t = this.container.querySelector<HTMLInputElement>("#capture-tags");
    if (q) this.draftQuestion = q.value;
    if (t) this.draftTags = t.value;
  }

  // ─── Filtering ────────────────────────────────────────────

  private applyFilter(cards: Flashcard[]): Flashcard[] {
    if (this.currentFilter === "pending") return cards.filter((c) => !c.answer?.trim());
    if (this.currentFilter === "answered") return cards.filter((c) => !!c.answer?.trim());
    return cards;
  }

  // ─── HTML builders ────────────────────────────────────────

  private cardHtml(card: Flashcard): string {
    const hasAnswer = !!card.answer?.trim();
    const question = escapeHtml(card.question);
    const answer = card.answer ? escapeHtml(card.answer) : "";
    const tagsHtml = card.tags.length
      ? `<div class="fc-tags">${card.tags.map((t) => `<span class="fc-tag">${escapeHtml(t)}</span>`).join("")}</div>`
      : "";
    const createdLabel = formatDatetime(card.createdAt);
    const answeredLabel = card.answeredAt ? formatDatetime(card.answeredAt) : null;
    const reviewedLabel = card.lastReviewed ? formatDatetime(card.lastReviewed) : null;

    const backContent = hasAnswer
      ? `<p class="fc-answer">${answer}</p>`
      : `<div class="fc-pending">
           <span class="fc-pending-dot"></span>
           <span>Noch keine Antwort</span>
         </div>`;

    const reviewedLine = reviewedLabel
      ? `<span class="fc-meta-item">◷ ${reviewedLabel}</span>`
      : "";

    return `
      <div class="fc-wrapper" data-id="${card.id}">
        <div class="fc-inner">

          <div class="fc-face fc-front">
            <div class="fc-face-label">FRAGE</div>
            <p class="fc-question">${question}</p>
            ${tagsHtml}
            <div class="fc-face-footer">
              <span class="fc-meta-item">+ ${createdLabel}</span>
              <span class="fc-flip-hint">↺</span>
            </div>
          </div>

          <div class="fc-face fc-back">
            <div class="fc-face-label">${hasAnswer ? "ANTWORT" : "AUSSTEHEND"}</div>
            ${backContent}
            <div class="fc-face-footer">
              ${answeredLabel ? `<span class="fc-meta-item fc-answered-at">✓ ${answeredLabel}</span>` : ""}
              ${reviewedLine}
              <div class="fc-actions">
                ${
                  hasAnswer
                    ? `<button class="btn btn-ghost fc-btn-review" data-id="${card.id}" title="Als gelernt markieren">✓ Gelernt</button>`
                    : `<button class="btn btn-primary fc-btn-answer" data-id="${card.id}">+ Antwort</button>`
                }
                <button class="btn btn-ghost fc-btn-edit" data-id="${card.id}" title="Bearbeiten">✎</button>
                <button class="btn btn-ghost fc-btn-delete fc-btn-danger" data-id="${card.id}" title="Löschen">✕</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  private emptyStateHtml(): string {
    const messages: Record<FilterType, string> = {
      all: "Noch keine Lernkarten. Notiere deine erste Frage oben.",
      pending: "Keine offenen Fragen – alle beantwortet!",
      answered: "Noch keine beantworteten Karten.",
    };
    return `<div class="empty-state"><p>${messages[this.currentFilter]}</p></div>`;
  }

  // ─── Event wiring ─────────────────────────────────────────

  private attachEvents(): void {
    this.attachCaptureEvents();
    this.attachFilterEvents();
    this.attachCardEvents();
  }

  private attachCaptureEvents(): void {
    const addBtn = this.container.querySelector<HTMLButtonElement>("#btn-add-card")!;
    const qInput = this.container.querySelector<HTMLTextAreaElement>("#capture-q")!;

    addBtn.addEventListener("click", () => this.handleCreate());
    qInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleCreate();
      }
    });
  }

  private attachFilterEvents(): void {
    this.container.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        this.currentFilter = btn.dataset.filter as FilterType;
        await this.render();
      });
    });
  }

  private attachCardEvents(): void {
    this.container.querySelectorAll<HTMLElement>(".fc-wrapper").forEach((wrapper) => {
      wrapper.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        wrapper.classList.toggle("is-flipped");
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>(".fc-btn-answer, .fc-btn-edit").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id!;
        const cards = await this.service.getAll();
        const card = cards.find((c) => c.id === id);
        if (card) this.openEditOverlay(card);
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>(".fc-btn-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("Karte unwiderruflich löschen?")) return;
        await this.service.delete(btn.dataset.id!);
        await this.render();
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>(".fc-btn-review").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.service.recordReview(btn.dataset.id!);
        const wrapper = btn.closest<HTMLElement>(".fc-wrapper");
        wrapper?.classList.add("fc-just-reviewed");
        setTimeout(() => wrapper?.classList.remove("fc-just-reviewed"), 1200);
      });
    });
  }

  // ─── Create handler ───────────────────────────────────────

  private async handleCreate(): Promise<void> {
    const qInput = this.container.querySelector<HTMLTextAreaElement>("#capture-q")!;
    const tagsInput = this.container.querySelector<HTMLInputElement>("#capture-tags")!;
    const addBtn = this.container.querySelector<HTMLButtonElement>("#btn-add-card")!;

    const question = qInput.value.trim();
    if (!question) {
      qInput.focus();
      qInput.classList.add("capture-error");
      setTimeout(() => qInput.classList.remove("capture-error"), 900);
      return;
    }

    const tags = tagsInput.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Clear inputs immediately for fast capture feel
    qInput.value = "";
    tagsInput.value = "";
    this.draftQuestion = "";
    this.draftTags = "";
    addBtn.disabled = true;
    addBtn.textContent = "Speichert…";

    try {
      await this.service.create(question, tags);
      await this.render();
    } catch {
      qInput.value = question;
      tagsInput.value = tags.join(", ");
      addBtn.disabled = false;
      addBtn.textContent = "+ Hinzufügen";
    }
  }

  // ─── Edit overlay ─────────────────────────────────────────

  private buildEditOverlay(): HTMLElement {
    const el = document.createElement("div");
    el.className = "fc-overlay hidden";
    el.innerHTML = `
      <div class="fc-overlay-panel" role="dialog" aria-modal="true" aria-label="Karte bearbeiten">
        <h3 class="fc-overlay-heading">Karte bearbeiten</h3>

        <label class="fc-overlay-label">Frage <span class="fc-required">*</span></label>
        <textarea class="fc-overlay-q" rows="3" placeholder="Frage eingeben…"></textarea>

        <label class="fc-overlay-label">Antwort</label>
        <textarea class="fc-overlay-a" rows="4" placeholder="Antwort eingeben… (kann leer bleiben)"></textarea>

        <label class="fc-overlay-label">Tags <span class="fc-overlay-hint">kommagetrennt</span></label>
        <input class="fc-overlay-tags" type="text" placeholder="z.B. python, algorithmen, big-o" />

        <div class="fc-overlay-footer">
          <button class="btn btn-ghost fc-overlay-cancel">Abbrechen</button>
          <button class="btn btn-primary fc-overlay-save">Speichern</button>
        </div>
      </div>
    `;

    el.querySelector(".fc-overlay-cancel")!.addEventListener("click", () => {
      el.classList.add("hidden");
    });

    el.addEventListener("click", (e) => {
      if (e.target === el) el.classList.add("hidden");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.classList.contains("hidden")) {
        el.classList.add("hidden");
      }
    });

    return el;
  }

  private openEditOverlay(card: Flashcard): void {
    const el = this.editOverlay;
    const qEl = el.querySelector<HTMLTextAreaElement>(".fc-overlay-q")!;
    const aEl = el.querySelector<HTMLTextAreaElement>(".fc-overlay-a")!;
    const tagsEl = el.querySelector<HTMLInputElement>(".fc-overlay-tags")!;

    qEl.value = card.question;
    aEl.value = card.answer ?? "";
    tagsEl.value = card.tags.join(", ");

    el.classList.remove("hidden");

    setTimeout(() => (card.answer ? qEl : aEl).focus(), 60);

    // Replace save button to avoid stale closures
    const oldSave = el.querySelector<HTMLButtonElement>(".fc-overlay-save")!;
    const newSave = oldSave.cloneNode(true) as HTMLButtonElement;
    oldSave.replaceWith(newSave);

    newSave.addEventListener("click", async () => {
      const question = qEl.value.trim();
      if (!question) {
        qEl.focus();
        qEl.classList.add("capture-error");
        setTimeout(() => qEl.classList.remove("capture-error"), 900);
        return;
      }

      const answer = aEl.value.trim() || undefined;
      const tags = tagsEl.value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      el.classList.add("hidden");
      await this.service.update(card.id, { question, answer, tags });
      await this.render();
    });
  }
}
