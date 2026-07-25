// ============================================================
import type { Category } from "../models/Task.js";

// Neue Kategorien werden ohne Farbwahl erstellt (Inline-Erstellung per #-Tag) —
// gleicher Default-Farbton wie im "Neue Kategorie"-Formular in CategoryView.ts,
// damit beide Erstellungswege optisch konsistent bleiben.
export const NEW_CATEGORY_COLOR = "#5b8dee";

type DropdownItem =
  | { kind: "category"; category: Category }
  | { kind: "create"; label: string };

/**
 * Kapselt die komplette #-Tagging-Logik (Trigger-Erkennung, Autocomplete-Dropdown,
 * Tastatur-Navigation, kompakte Tag-Anzeige) losgelöst von einem konkreten Formular.
 * Kennt weder TaskFormModal noch TaskService direkt — Kategorien werden von außen
 * gesetzt (setCategories) und neue Kategorien über eine injizierte Funktion erstellt.
 * Das hält die Komponente orthogonal: sie lässt sich unverändert in jedem anderen
 * Formular wiederverwenden, das ein Titel-/Textfeld mit Kategorie-Zuordnung braucht.
 */
export class CategoryTagInput {
 
  private categories: Category[] = [];
  private selectedId: string | null = null;
  private dropdown: HTMLElement | null = null;
  private items: DropdownItem[] = [];
  private activeIndex = 0;

  constructor(
    private readonly input: HTMLInputElement,
    private readonly anchor: HTMLElement,
    private readonly tagHost: HTMLElement,
    private readonly createCategory: (label: string) => Promise<Category>
  ) {
    this.attachEvents();
    this.renderTag();
  }

  setCategories(categories: Category[]): void {
    this.categories = categories;
  }

  setSelected(categoryId: string | null): void {
    this.selectedId = categoryId;
    this.renderTag();
  }

  getSelected(): string | null {
    return this.selectedId;
  }

  private attachEvents(): void {
    this.input.addEventListener("input", () => this.handleInput());
    this.input.addEventListener("keydown", (e) => this.handleKeydown(e));
    // Außerhalb klicken schließt das Dropdown (gleiches Muster wie MiniCalendarPicker)
    document.addEventListener("click", (e) => {
      if (this.dropdown && e.target !== this.input && !this.dropdown.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });
  }

  // Sucht ab der Cursor-Position rückwärts nach einem "#wort"-Token, das noch nicht
  // durch ein Leerzeichen abgeschlossen wurde — nur so ein Token gilt als aktiver Trigger.
  private currentMatch(): { start: number; query: string } | null {
    const caret = this.input.selectionStart ?? this.input.value.length;
    const upToCaret = this.input.value.slice(0, caret);
    const match = /#([^\s#]*)$/.exec(upToCaret);
    if (!match) return null;
    return { start: match.index, query: match[1] };
  }

  private handleInput(): void {
    const match = this.currentMatch();
    if (!match) { this.closeDropdown(); return; }
    this.updateItems(match.query);
    if (!this.dropdown) this.openDropdown();
    this.renderDropdown();
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (!this.dropdown || this.items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % this.items.length;
      this.renderDropdown();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.activeIndex = (this.activeIndex - 1 + this.items.length) % this.items.length;
      this.renderDropdown();
    } else if (e.key === "Enter") {
      e.preventDefault();
      this.selectItem(this.items[this.activeIndex]);
    } else if (e.key === "Escape") {
      this.closeDropdown();
    }
  }

  private updateItems(query: string): void {
    const q = query.toLowerCase();
    const matches = this.categories.filter(c => c.label.toLowerCase().includes(q));
    const exists = this.categories.some(c => c.label.toLowerCase() === q);

    this.items = matches.map((category): DropdownItem => ({ kind: "category", category }));
    if (query.trim() && !exists) {
      this.items.push({ kind: "create", label: query.trim() });
    }
    this.activeIndex = 0;
  }

  private openDropdown(): void {
    this.dropdown = document.createElement("div");
    this.dropdown.className = "cat-tag-dropdown";
    this.dropdown.setAttribute("role", "listbox");
    // Klick im Dropdown darf den document-Listener oben nicht auslösen
    this.dropdown.addEventListener("mousedown", (e) => e.preventDefault());
    this.anchor.appendChild(this.dropdown);
  }

  private closeDropdown(): void {
    this.dropdown?.remove();
    this.dropdown = null;
  }

  private renderDropdown(): void {
    if (!this.dropdown) return;

    if (this.items.length === 0) {
      this.closeDropdown();
      return;
    }

    this.dropdown.innerHTML = this.items.map((item, i) => {
      const active = i === this.activeIndex ? " active" : "";
      if (item.kind === "create") {
        return `<div class="cat-tag-option cat-tag-option--create${active}" role="option" data-index="${i}">
          + Neu: „${escapeHtml(item.label)}“
        </div>`;
      }
      return `<div class="cat-tag-option${active}" role="option" data-index="${i}" style="--cat-color:${item.category.color}">
        <span class="cat-tag-dot"></span>${escapeHtml(item.category.label)}
      </div>`;
    }).join("");

    this.dropdown.querySelectorAll<HTMLElement>(".cat-tag-option").forEach(el => {
      el.addEventListener("click", () => this.selectItem(this.items[Number(el.dataset.index)]));
    });
  }

  private async selectItem(item: DropdownItem): Promise<void> {
    const match = this.currentMatch();
    const category = item.kind === "create" ? await this.createCategory(item.label) : item.category;

    if (item.kind === "create") this.categories.push(category);

    // Das getippte "#query"-Token wird durch die Auswahl ersetzt — der Titel
    // bleibt danach frei von Tag-Syntax, die Kategorie existiert nur noch als Badge.
    if (match) {
      const before = this.input.value.slice(0, match.start);
      const after = this.input.value.slice(match.start + 1 + match.query.length);
      this.input.value = before + after;
      const caret = before.length;
      this.input.setSelectionRange(caret, caret);
      this.input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    this.selectedId = category.id;
    this.renderTag();
    this.closeDropdown();
    this.input.focus();
  }

  private renderTag(): void {
    if (!this.selectedId) {
      this.tagHost.innerHTML = `<span class="cat-tag-hint">Tippe „#“ im Titel, um eine Kategorie zu wählen</span>`;
      return;
    }
    const cat = this.categories.find(c => c.id === this.selectedId);
    if (!cat) { this.tagHost.innerHTML = ""; return; }

    this.tagHost.innerHTML = `
      <span class="cat-tag" style="--cat-color:${cat.color}">
        ${escapeHtml(cat.label)}
        <button type="button" class="cat-tag-remove" aria-label="Kategorie entfernen">×</button>
      </span>
    `;
    this.tagHost.querySelector<HTMLButtonElement>(".cat-tag-remove")!.addEventListener("click", () => {
      this.selectedId = null;
      this.renderTag();
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
