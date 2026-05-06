// ============================================================
// components/LearningView.ts
// Lernkarten — Hierarchische Deck-Struktur + Session-Modus
// ============================================================

import type { Deck, Flashcard } from "../models/Task.js";
import type { FlashcardService } from "../services/FlashcardService.js";
import { FlashcardScheduler } from "../core/sm2/index.js";

// Internes Sub-Routing — spiegelt das Konzept von Angular Child-Routes:
// jede Route entspricht einer eigenständigen View innerhalb der Lernkarten-Komponente.
type LearningRoute = "dashboard" | "collection" | "deck-detail" | "session";

type FilterType = "all" | "pending" | "answered";

// SM2-Qualitätsstufen für die vier Bewertungs-Buttons
const RATING_AGAIN  = 1; // falsch → Reset
const RATING_HARD   = 3; // richtig, aber schwer → minimales Intervallwachstum
const RATING_GOOD   = 4; // richtig, normaler Aufwand
const RATING_EASY   = 5; // sofort gewusst → maximales Intervallwachstum

const DECK_COLORS = [
  "#5b8dee", "#a78bfa", "#4caf82", "#f5a623",
  "#f472b6", "#7a7a8c", "#38bdf8", "#fb923c",
];

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
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function countDue(cards: Flashcard[]): number {
  const now = new Date();
  return cards.filter((c) => !c.nextReviewDate || new Date(c.nextReviewDate) <= now).length;
}

export class LearningView {
  // ─── Sub-Routing State ────────────────────────────────────
  private currentRoute: LearningRoute = "dashboard";
  private selectedTopicId: string | null = null;
  private selectedDeckId:  string | null = null;

  // ─── Deck-Detail Filter / Draft ───────────────────────────
  private currentFilter: FilterType = "all";
  private draftQuestion = "";
  private draftTags     = "";

  // ─── Session State ────────────────────────────────────────
  private sessionActive        = false;
  private scheduler:            FlashcardScheduler | null = null;
  private sessionTotal         = 0;
  private sessionDone          = 0;
  private revealed             = false;
  private currentCard:          Flashcard | null = null;
  private exitedSession        = false;
  private sessionKeyController: AbortController | null = null;
  // Karten-ID der zuletzt bewerteten Karte — für die Slide-In-Animation
  private lastRatedCardId:      string | null = null;

  private readonly editOverlay: HTMLElement;

  constructor(
    private readonly service: FlashcardService,
    private readonly container: HTMLElement
  ) {
    this.editOverlay = this.buildEditOverlay();
    document.body.appendChild(this.editOverlay);
  }

  // ─── Public API ───────────────────────────────────────────

  async startLearning(): Promise<void> {
    this.exitedSession   = false;
    this.currentRoute    = "dashboard";
    this.selectedTopicId = null;
    this.selectedDeckId  = null;
    await this.render();
  }

  async render(): Promise<void> {
    if (this.sessionActive) { this.renderSession(); return; }

    switch (this.currentRoute) {
      case "dashboard":    await this.renderDashboard();      break;
      case "collection":   await this.renderCollectionView(); break;
      case "deck-detail":  await this.renderDeckDetail();     break;
    }
  }

  destroy(): void {
    this.editOverlay.remove();
  }

  // ─── Dashboard (Themen-Übersicht) ─────────────────────────

  private async renderDashboard(): Promise<void> {
    const [decks, allCards] = await Promise.all([
      this.service.getDecks(),
      this.service.getAll(),
    ]);

    const topics = decks.filter((d) => d.parentId === null);
    const collections = decks.filter((d) => d.parentId !== null);

    // Karten ohne deckId gelten als "Ungruppiert"
    const ungroupedCards = allCards.filter((c) => !c.deckId);
    const ungroupedDue   = countDue(ungroupedCards);

    const topicHtml = topics.map((topic) => {
      const childDecks  = collections.filter((c) => c.parentId === topic.id);
      const topicCards  = allCards.filter((c) => childDecks.some((d) => d.id === c.deckId));
      const due         = countDue(topicCards);
      const color       = topic.color ?? "#5b8dee";

      return `
        <div class="fc-topic-card" data-topic-id="${topic.id}" style="--topic-color:${color}">
          <div class="fc-topic-card__color-bar"></div>
          <div class="fc-topic-card__body">
            <div class="fc-topic-card__name">${escapeHtml(topic.name)}</div>
            <div class="fc-topic-card__meta">
              ${childDecks.length} Sammlung${childDecks.length !== 1 ? "en" : ""}
              · ${topicCards.length} Karte${topicCards.length !== 1 ? "n" : ""}
            </div>
            ${due > 0
              ? `<div class="fc-due-badge">${due} fällig</div>`
              : `<div class="fc-due-badge fc-due-badge--none">Alles gelernt ✓</div>`}
          </div>
          <button class="btn btn-ghost fc-topic-card__delete" data-topic-id="${topic.id}" title="Thema löschen">✕</button>
        </div>
      `;
    }).join("");

    const ungroupedHtml = ungroupedCards.length > 0 ? `
      <div class="fc-topic-card fc-topic-card--ungrouped" data-topic-id="__ungrouped">
        <div class="fc-topic-card__color-bar" style="background:#7a7a8c"></div>
        <div class="fc-topic-card__body">
          <div class="fc-topic-card__name">Ungruppierte Karten</div>
          <div class="fc-topic-card__meta">${ungroupedCards.length} Karte${ungroupedCards.length !== 1 ? "n" : ""}</div>
          ${ungroupedDue > 0
            ? `<div class="fc-due-badge">${ungroupedDue} fällig</div>`
            : `<div class="fc-due-badge fc-due-badge--none">Alles gelernt ✓</div>`}
        </div>
      </div>
    ` : "";

    // Globale Session über alle fälligen Karten
    const totalDue = countDue(allCards);

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Lernkarten</h1>
          <p class="view-subtitle">${allCards.length} Karten gesamt · ${totalDue > 0 ? `${totalDue} heute fällig` : "Alle gelernt"}</p>
        </div>
        ${totalDue > 0
          ? `<button class="btn btn-primary" id="btn-start-all">▶ Alle ${totalDue} lernen</button>`
          : ""}
      </div>

      <div class="fc-dashboard-header">
        <h2 class="fc-section-title">Themen</h2>
        <button class="btn btn-ghost" id="btn-new-topic">+ Neues Thema</button>
      </div>

      <div id="fc-new-topic-form" class="fc-inline-form hidden">
        <input class="fc-inline-input" id="input-topic-name" type="text" placeholder="Thema benennen…" />
        <div class="fc-inline-form-colors" id="topic-color-picker">
          ${DECK_COLORS.map((c, i) => `
            <button class="fc-color-dot ${i === 0 ? "selected" : ""}" data-color="${c}" style="background:${c}" title="${c}"></button>
          `).join("")}
        </div>
        <div class="fc-inline-form-footer">
          <button class="btn btn-ghost" id="btn-cancel-topic">Abbrechen</button>
          <button class="btn btn-primary" id="btn-save-topic">Speichern</button>
        </div>
      </div>

      <div class="fc-topic-grid">
        ${topicHtml}
        ${ungroupedHtml}
        ${topics.length === 0 && ungroupedCards.length === 0
          ? `<div class="empty-state"><p>Noch kein Thema. Erstelle dein erstes Thema, um Karten zu organisieren.</p></div>`
          : ""}
      </div>
    `;

    this.attachDashboardEvents(topics, allCards);
  }

  private attachDashboardEvents(topics: Deck[], allCards: Flashcard[]): void {
    const totalDue = countDue(allCards);

    document.getElementById("btn-start-all")?.addEventListener("click", () => {
      this.startSession(allCards);
    });

    // Thema-Formular ein-/ausblenden
    const form = document.getElementById("fc-new-topic-form")!;
    document.getElementById("btn-new-topic")?.addEventListener("click", () => {
      form.classList.toggle("hidden");
      document.getElementById("input-topic-name")?.focus();
    });
    document.getElementById("btn-cancel-topic")?.addEventListener("click", () => {
      form.classList.add("hidden");
    });

    // Farb-Picker
    let selectedColor = DECK_COLORS[0];
    form.querySelectorAll<HTMLButtonElement>(".fc-color-dot").forEach((btn) => {
      btn.addEventListener("click", () => {
        form.querySelectorAll(".fc-color-dot").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedColor = btn.dataset.color!;
      });
    });

    // Thema speichern
    const saveTheme = async () => {
      const input = document.getElementById("input-topic-name") as HTMLInputElement;
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      await this.service.createDeck(name, null, selectedColor);
      await this.renderDashboard();
    };
    document.getElementById("btn-save-topic")?.addEventListener("click", saveTheme);
    document.getElementById("input-topic-name")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveTheme();
    });

    // Thema löschen
    this.container.querySelectorAll<HTMLButtonElement>(".fc-topic-card__delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.topicId!;
        const topic = topics.find((t) => t.id === id);
        if (!confirm(`Thema "${topic?.name}" und alle darin enthaltenen Sammlungen und Karten löschen?`)) return;
        await this.service.deleteDeck(id);
        await this.renderDashboard();
      });
    });

    // Navigation zu Sammlung-View oder Session
    this.container.querySelectorAll<HTMLElement>(".fc-topic-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        const id = card.dataset.topicId!;
        if (id === "__ungrouped") {
          // Ungrouped → direkt in "flat" Deck-Detail ohne deckId-Filter
          this.selectedDeckId  = null;
          this.selectedTopicId = null;
          this.currentRoute    = "deck-detail";
        } else {
          this.selectedTopicId = id;
          this.currentRoute    = "collection";
        }
        this.render();
      });
    });
  }

  // ─── Collection View (Sammlungen eines Themas) ────────────

  private async renderCollectionView(): Promise<void> {
    const [decks, allCards] = await Promise.all([
      this.service.getDecks(),
      this.service.getAll(),
    ]);

    const topic       = decks.find((d) => d.id === this.selectedTopicId);
    const collections = decks.filter((d) => d.parentId === this.selectedTopicId);
    const topicCards  = allCards.filter((c) => collections.some((d) => d.id === c.deckId));
    const topicDue    = countDue(topicCards);

    const colHtml = collections.map((col) => {
      const cards = allCards.filter((c) => c.deckId === col.id);
      const due   = countDue(cards);
      const color = col.color ?? topic?.color ?? "#5b8dee";
      return `
        <div class="fc-deck-card" data-deck-id="${col.id}" style="--deck-color:${color}">
          <div class="fc-deck-card__color-dot" style="background:${color}"></div>
          <div class="fc-deck-card__body">
            <div class="fc-deck-card__name">${escapeHtml(col.name)}</div>
            <div class="fc-deck-card__meta">${cards.length} Karte${cards.length !== 1 ? "n" : ""}</div>
            ${due > 0
              ? `<div class="fc-due-badge">${due} fällig</div>`
              : `<div class="fc-due-badge fc-due-badge--none">✓</div>`}
          </div>
          <button class="btn btn-ghost fc-deck-card__delete" data-deck-id="${col.id}" title="Sammlung löschen">✕</button>
        </div>
      `;
    }).join("");

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <button class="btn btn-ghost fc-back-btn" id="btn-back-dashboard">← Zurück</button>
          <h1 class="view-title">${escapeHtml(topic?.name ?? "Thema")}</h1>
          <p class="view-subtitle">${topicCards.length} Karten · ${topicDue > 0 ? `${topicDue} fällig` : "Alle gelernt"}</p>
        </div>
        ${topicDue > 0
          ? `<button class="btn btn-primary" id="btn-start-topic">▶ ${topicDue} lernen</button>`
          : ""}
      </div>

      <div class="fc-dashboard-header">
        <h2 class="fc-section-title">Sammlungen</h2>
        <button class="btn btn-ghost" id="btn-new-collection">+ Neue Sammlung</button>
      </div>

      <div id="fc-new-col-form" class="fc-inline-form hidden">
        <input class="fc-inline-input" id="input-col-name" type="text" placeholder="Sammlung benennen…" />
        <div class="fc-inline-form-footer">
          <button class="btn btn-ghost" id="btn-cancel-col">Abbrechen</button>
          <button class="btn btn-primary" id="btn-save-col">Speichern</button>
        </div>
      </div>

      <div class="fc-topic-grid">
        ${colHtml}
        ${collections.length === 0
          ? `<div class="empty-state"><p>Noch keine Sammlung. Erstelle eine, um Karten hinzuzufügen.</p></div>`
          : ""}
      </div>
    `;

    this.attachCollectionEvents(collections, allCards);
  }

  private attachCollectionEvents(collections: Deck[], allCards: Flashcard[]): void {
    document.getElementById("btn-back-dashboard")?.addEventListener("click", () => {
      this.currentRoute = "dashboard";
      this.render();
    });

    document.getElementById("btn-start-topic")?.addEventListener("click", () => {
      const topicCards = allCards.filter((c) => collections.some((d) => d.id === c.deckId));
      this.startSession(topicCards);
    });

    const form = document.getElementById("fc-new-col-form")!;
    document.getElementById("btn-new-collection")?.addEventListener("click", () => {
      form.classList.toggle("hidden");
      document.getElementById("input-col-name")?.focus();
    });
    document.getElementById("btn-cancel-col")?.addEventListener("click", () => form.classList.add("hidden"));

    const saveCol = async () => {
      const input = document.getElementById("input-col-name") as HTMLInputElement;
      const name  = input.value.trim();
      if (!name) { input.focus(); return; }
      await this.service.createDeck(name, this.selectedTopicId!);
      await this.renderCollectionView();
    };
    document.getElementById("btn-save-col")?.addEventListener("click", saveCol);
    document.getElementById("input-col-name")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveCol();
    });

    this.container.querySelectorAll<HTMLButtonElement>(".fc-deck-card__delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id  = btn.dataset.deckId!;
        const col = collections.find((c) => c.id === id);
        if (!confirm(`Sammlung "${col?.name}" und alle darin enthaltenen Karten löschen?`)) return;
        await this.service.deleteDeck(id);
        await this.renderCollectionView();
      });
    });

    this.container.querySelectorAll<HTMLElement>(".fc-deck-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        this.selectedDeckId = card.dataset.deckId!;
        this.currentRoute   = "deck-detail";
        this.render();
      });
    });
  }

  // ─── Deck-Detail (Statistik + Kartenliste) ────────────────

  private async renderDeckDetail(): Promise<void> {
    this.saveDraft();

    const [decks, deckCards] = await Promise.all([
      this.service.getDecks(),
      this.selectedDeckId
        ? this.service.getCardsByDeck(this.selectedDeckId)
        : this.service.getAll().then((all) => all.filter((c) => !c.deckId)),
    ]);

    const deck  = decks.find((d) => d.id === this.selectedDeckId);
    const topic = deck ? decks.find((d) => d.id === deck.parentId) : null;

    const answered = deckCards.filter((c) => !!c.answer?.trim()).length;
    const pending  = deckCards.length - answered;
    const due      = countDue(deckCards);
    const filtered = this.applyFilter(deckCards);

    const backRoute = topic ? "collection" : "dashboard";

    this.container.innerHTML = `
      <div class="view-header">
        <div>
          <button class="btn btn-ghost fc-back-btn" id="btn-back-deck">
            ← ${escapeHtml(topic?.name ?? "Übersicht")}
          </button>
          <h1 class="view-title">${escapeHtml(deck?.name ?? "Ungruppierte Karten")}</h1>
          <p class="view-subtitle">${deckCards.length} gesamt · ${answered} beantwortet · ${pending} ausstehend</p>
        </div>
        <div class="fc-header-actions">
          ${due > 0
            ? `<button class="btn btn-primary" id="btn-start-deck">▶ ${due} lernen</button>`
            : ""}
        </div>
      </div>

      <div class="fc-stats-row">
        <div class="fc-stat-chip"><span class="fc-stat-num">${deckCards.length}</span><span class="fc-stat-label">Gesamt</span></div>
        <div class="fc-stat-chip"><span class="fc-stat-num">${answered}</span><span class="fc-stat-label">Beantwortet</span></div>
        <div class="fc-stat-chip fc-stat-chip--due"><span class="fc-stat-num">${due}</span><span class="fc-stat-label">Fällig</span></div>
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
        <button class="tab-btn ${this.currentFilter === "all" ? "active" : ""}" data-filter="all">Alle (${deckCards.length})</button>
        <button class="tab-btn ${this.currentFilter === "pending" ? "active" : ""}" data-filter="pending">Ausstehend (${pending})</button>
        <button class="tab-btn ${this.currentFilter === "answered" ? "active" : ""}" data-filter="answered">Beantwortet (${answered})</button>
      </div>

      ${filtered.length === 0
        ? this.emptyStateHtml()
        : `<div class="fc-grid">${filtered.map((c) => this.cardHtml(c)).join("")}</div>`}
    `;

    this.attachDeckDetailEvents(deckCards, backRoute);
  }

  private attachDeckDetailEvents(deckCards: Flashcard[], backRoute: LearningRoute): void {
    document.getElementById("btn-back-deck")?.addEventListener("click", () => {
      this.currentRoute = backRoute;
      this.render();
    });

    document.getElementById("btn-start-deck")?.addEventListener("click", () => {
      this.startSession(deckCards);
    });

    this.attachCaptureEvents();
    this.attachFilterEvents();
    this.attachCardEvents();
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
    if (this.currentFilter === "pending")  return cards.filter((c) => !c.answer?.trim());
    if (this.currentFilter === "answered") return cards.filter((c) => !!c.answer?.trim());
    return cards;
  }

  // ─── Card HTML ────────────────────────────────────────────

  private cardHtml(card: Flashcard): string {
    const hasAnswer     = !!card.answer?.trim();
    const question      = escapeHtml(card.question);
    const answer        = card.answer ? escapeHtml(card.answer) : "";
    const tagsHtml      = card.tags.length
      ? `<div class="fc-tags">${card.tags.map((t) => `<span class="fc-tag">${escapeHtml(t)}</span>`).join("")}</div>`
      : "";
    const createdLabel  = formatDatetime(card.createdAt);
    const answeredLabel = card.answeredAt  ? formatDatetime(card.answeredAt)  : null;
    const reviewedLabel = card.lastReviewed ? formatDatetime(card.lastReviewed) : null;

    const backContent = hasAnswer
      ? `<p class="fc-answer">${answer}</p>`
      : `<div class="fc-pending">
           <span class="fc-pending-dot"></span>
           <span>Noch keine Antwort</span>
         </div>`;

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
              ${reviewedLabel ? `<span class="fc-meta-item">◷ ${reviewedLabel}</span>` : ""}
              <div class="fc-actions">
                ${hasAnswer
                  ? `<button class="btn btn-ghost fc-btn-review" data-id="${card.id}" title="Als gelernt markieren">✓ Gelernt</button>`
                  : `<button class="btn btn-primary fc-btn-answer" data-id="${card.id}">+ Antwort</button>`}
                <button class="btn btn-ghost fc-btn-edit"   data-id="${card.id}" title="Bearbeiten">✎</button>
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
      all:      "Noch keine Lernkarten. Notiere deine erste Frage oben.",
      pending:  "Keine offenen Fragen – alle beantwortet!",
      answered: "Noch keine beantworteten Karten.",
    };
    return `<div class="empty-state"><p>${messages[this.currentFilter]}</p></div>`;
  }

  // ─── Event-Wiring (Deck-Detail) ───────────────────────────

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
        const id    = btn.dataset.id!;
        const cards = this.selectedDeckId
          ? await this.service.getCardsByDeck(this.selectedDeckId)
          : (await this.service.getAll()).filter((c) => !c.deckId);
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

  // ─── Create Card ──────────────────────────────────────────

  private async handleCreate(): Promise<void> {
    const qInput  = this.container.querySelector<HTMLTextAreaElement>("#capture-q")!;
    const tInput  = this.container.querySelector<HTMLInputElement>("#capture-tags")!;
    const addBtn  = this.container.querySelector<HTMLButtonElement>("#btn-add-card")!;

    const question = qInput.value.trim();
    if (!question) {
      qInput.focus();
      qInput.classList.add("capture-error");
      setTimeout(() => qInput.classList.remove("capture-error"), 900);
      return;
    }

    const tags = tInput.value.split(",").map((t) => t.trim()).filter(Boolean);

    qInput.value        = "";
    tInput.value        = "";
    this.draftQuestion  = "";
    this.draftTags      = "";
    addBtn.disabled     = true;
    addBtn.textContent  = "Speichert…";

    try {
      // Neue Karte erhält automatisch die deckId der aktuellen Sammlung
      await this.service.create(question, tags, this.selectedDeckId ?? undefined);
      await this.render();
    } catch {
      qInput.value       = question;
      tInput.value       = tags.join(", ");
      addBtn.disabled    = false;
      addBtn.textContent = "+ Hinzufügen";
    }
  }

  // ─── Edit Overlay ─────────────────────────────────────────

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

    el.querySelector(".fc-overlay-cancel")!.addEventListener("click", () => el.classList.add("hidden"));
    el.addEventListener("click", (e) => { if (e.target === el) el.classList.add("hidden"); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.classList.contains("hidden")) el.classList.add("hidden");
    });

    return el;
  }

  private openEditOverlay(card: Flashcard): void {
    const el     = this.editOverlay;
    const qEl    = el.querySelector<HTMLTextAreaElement>(".fc-overlay-q")!;
    const aEl    = el.querySelector<HTMLTextAreaElement>(".fc-overlay-a")!;
    const tagsEl = el.querySelector<HTMLInputElement>(".fc-overlay-tags")!;

    qEl.value    = card.question;
    aEl.value    = card.answer ?? "";
    tagsEl.value = card.tags.join(", ");
    el.classList.remove("hidden");
    setTimeout(() => (card.answer ? qEl : aEl).focus(), 60);

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
      const tags   = tagsEl.value.split(",").map((t) => t.trim()).filter(Boolean);
      el.classList.add("hidden");
      await this.service.update(card.id, { question, answer, tags });
      await this.render();
    });
  }

  // ─── Session: Start ───────────────────────────────────────

  private startSession(cards: Flashcard[], forceAll = false): void {
    const sessionCards  = forceAll
      ? cards.map((c) => ({ ...c, nextReviewDate: undefined }))
      : cards;
    const now           = new Date();
    this.scheduler      = new FlashcardScheduler(sessionCards);
    this.sessionTotal   = forceAll
      ? cards.length
      : cards.filter((c) => !c.nextReviewDate || new Date(c.nextReviewDate) <= now).length;
    this.sessionDone    = 0;
    this.revealed       = false;
    this.lastRatedCardId = null;
    this.currentCard    = this.scheduler.getNextDueCard();
    this.sessionActive  = true;
    this.renderSession();
  }

  // ─── Session: Render ──────────────────────────────────────

  private renderSession(): void {
    if (!this.currentCard) { this.renderSessionDone(); return; }

    const card     = this.currentCard;
    const progress = this.sessionTotal > 0 ? (this.sessionDone / this.sessionTotal) * 100 : 0;
    const tagsHtml = card.tags.length
      ? `<div class="fc-tags fc-session-tags">${card.tags.map((t) => `<span class="fc-tag">${escapeHtml(t)}</span>`).join("")}</div>`
      : "";
    const answerHtml = card.answer?.trim()
      ? escapeHtml(card.answer)
      : `<span class="fc-session-no-answer">Noch keine Antwort hinterlegt — trage sie im Karteneditor ein.</span>`;

    // fc-session-card--entering löst die Slide-In-Animation aus; sie wird nach
    // dem ersten Frame wieder entfernt damit keine Doppel-Animation beim Reveal entsteht.
    const enterClass = this.lastRatedCardId ? " fc-session-card--entering" : "";

    this.container.innerHTML = `
      <div class="fc-session">
        <div class="fc-session-header">
          <div class="fc-session-progress-track">
            <div class="fc-session-progress-fill" style="width:${progress}%"></div>
          </div>
          <span class="fc-session-count">${this.sessionDone} / ${this.sessionTotal}</span>
          <button class="btn btn-ghost fc-session-exit">✕ Beenden</button>
        </div>

        <div class="fc-session-card${enterClass}${this.revealed ? " is-revealed" : ""}">
          <div class="fc-session-faces">

            <div class="fc-session-face fc-session-front">
              <div class="fc-session-label">FRAGE</div>
              <p class="fc-session-question">${escapeHtml(card.question)}</p>
              ${tagsHtml}
              <button class="btn btn-primary fc-session-btn-reveal">
                Antwort zeigen <kbd class="fc-key-hint">Leertaste</kbd>
              </button>
            </div>

            <div class="fc-session-face fc-session-back">
              <div class="fc-session-label">ANTWORT</div>
              <p class="fc-session-answer">${answerHtml}</p>
              <div class="fc-rating-bar">
                <button class="btn fc-rating-btn fc-rating-again" data-quality="${RATING_AGAIN}">
                  <kbd class="fc-key-hint">1</kbd> Nochmal
                </button>
                <button class="btn fc-rating-btn fc-rating-hard" data-quality="${RATING_HARD}">
                  <kbd class="fc-key-hint">2</kbd> Schwer
                </button>
                <button class="btn fc-rating-btn fc-rating-good" data-quality="${RATING_GOOD}">
                  <kbd class="fc-key-hint">3</kbd> Gut ✓
                </button>
                <button class="btn fc-rating-btn fc-rating-easy" data-quality="${RATING_EASY}">
                  <kbd class="fc-key-hint">4</kbd> Einfach ★
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    // Animation-Klasse nach erstem Frame entfernen damit sie beim nächsten Reveal nicht nochmal feuert
    requestAnimationFrame(() => {
      this.container.querySelector(".fc-session-card--entering")?.classList.remove("fc-session-card--entering");
    });

    this.attachSessionEvents();
  }

  private renderSessionDone(): void {
    this.sessionKeyController?.abort();
    this.sessionKeyController = null;

    this.container.innerHTML = `
      <div class="fc-session">
        <div class="fc-session-done">
          <div class="fc-session-done-icon">✓</div>
          <h2 class="fc-session-done-title">Session abgeschlossen</h2>
          <p class="fc-session-done-sub">${this.sessionDone} Karte${this.sessionDone !== 1 ? "n" : ""} gelernt</p>
          <button class="btn btn-primary" id="fc-btn-back">Zurück zur Übersicht</button>
        </div>
      </div>
    `;

    this.container.querySelector("#fc-btn-back")?.addEventListener("click", () => {
      this.sessionActive = false;
      this.scheduler     = null;
      this.render();
    });
  }

  // ─── Session: Events ──────────────────────────────────────

  private attachSessionEvents(): void {
    const sessionCard = this.container.querySelector<HTMLElement>(".fc-session-card");

    this.sessionKeyController?.abort();
    this.sessionKeyController = new AbortController();
    const { signal } = this.sessionKeyController;

    this.container.querySelector(".fc-session-exit")?.addEventListener("click", () => {
      this.sessionKeyController?.abort();
      this.sessionKeyController = null;
      this.exitedSession  = true;
      this.sessionActive  = false;
      this.scheduler      = null;
      this.render();
    });

    this.container.querySelector(".fc-session-btn-reveal")?.addEventListener("click", () => {
      this.revealed = true;
      sessionCard?.classList.add("is-revealed");
    });

    this.container.querySelectorAll<HTMLButtonElement>(".fc-rating-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const quality = parseInt(btn.dataset.quality ?? "4", 10);
        await this.handleRating(quality);
      });
    });

    // Leertaste → Reveal; 1/2/3/4 → Bewertung (nur wenn bereits aufgedeckt)
    document.addEventListener("keydown", async (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (!this.revealed && e.key === " ") {
        e.preventDefault();
        this.revealed = true;
        sessionCard?.classList.add("is-revealed");
      } else if (this.revealed) {
        if      (e.key === "1") { e.preventDefault(); await this.handleRating(RATING_AGAIN); }
        else if (e.key === "2") { e.preventDefault(); await this.handleRating(RATING_HARD);  }
        else if (e.key === "3") { e.preventDefault(); await this.handleRating(RATING_GOOD);  }
        else if (e.key === "4") { e.preventDefault(); await this.handleRating(RATING_EASY);  }
      }
    }, { signal });
  }

  private async handleRating(quality: number): Promise<void> {
    if (!this.currentCard || !this.scheduler) return;
    this.lastRatedCardId = this.currentCard.id;
    const updated        = this.scheduler.reviewCard(this.currentCard.id, quality);
    await this.service.saveReview(updated);
    this.sessionDone++;
    this.revealed    = false;
    this.currentCard = this.scheduler.getNextDueCard();
    this.renderSession();
  }
}
