type Theme = 'dark' | 'light';

const STORAGE_KEY = 'ueberblick-theme';

export class ThemeService {
  private current: Theme;

  constructor() {
    this.current = (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'dark';
    this.apply(this.current);
  }

  toggle(): void {
    this.current = this.current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, this.current);
    this.apply(this.current);
  }

  getTheme(): Theme {
    return this.current;
  }

  getToggleLabel(): string {
    return this.current === 'dark' ? '☀ Light Mode' : '☾ Dark Mode';
  }

  // Wird nach dem Rendern des Buttons aufgerufen, damit das Label stimmt
  syncButtonLabel(): void {
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.textContent = this.getToggleLabel();
  }

  private apply(theme: Theme): void {
    document.documentElement.dataset['theme'] = theme;
  }
}
