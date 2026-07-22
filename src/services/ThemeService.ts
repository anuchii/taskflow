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

  // Icon-only-Variante für die Icon-Rail (Tablet/Desktop hat dort keinen
  // Platz für Text neben dem Icon, siehe layout/_icon-rail.css).
  getToggleIcon(): string {
    return this.current === 'dark' ? '☀' : '☾';
  }

  // Wird nach dem Rendern der Buttons aufgerufen, damit Icon (Rail) und
  // Label (mobiles Overflow-Menü) den aktuellen Zustand zeigen.
  syncButtonLabel(): void {
    const iconBtn = document.getElementById('btn-theme-toggle');
    if (iconBtn) iconBtn.textContent = this.getToggleIcon();
    const mobileBtn = document.getElementById('btn-theme-toggle-mobile');
    if (mobileBtn) mobileBtn.textContent = this.getToggleLabel();
  }

  private apply(theme: Theme): void {
    document.documentElement.dataset['theme'] = theme;
  }
}
