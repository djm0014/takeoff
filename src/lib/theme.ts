/** Light, dark, or follow the phone. Remembered on this device only. */
export type ThemeChoice = 'auto' | 'light' | 'dark';

const KEY = 'bathroom-tools:theme';

export function loadTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* storage blocked */
  }
  return 'auto';
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* storage blocked */
  }
}

export function nextTheme(choice: ThemeChoice): ThemeChoice {
  return choice === 'auto' ? 'light' : choice === 'light' ? 'dark' : 'auto';
}

export const THEME_LABELS: Record<ThemeChoice, string> = {
  auto: 'Theme: match phone',
  light: 'Theme: light',
  dark: 'Theme: dark',
};
