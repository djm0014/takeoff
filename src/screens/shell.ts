import { h, icon, ICONS } from '../lib/dom';
import { applyTheme, loadTheme, nextTheme, THEME_LABELS } from '../lib/theme';

/** The top bar every screen shares. */
export function topbar(title: string, opts: { back?: string; actions?: HTMLElement[] } = {}): HTMLElement {
  let theme = loadTheme();
  const themeBtn = h(
    'button',
    { class: 'icon-btn', type: 'button', 'aria-label': THEME_LABELS[theme], title: THEME_LABELS[theme] },
    icon(ICONS.theme),
  );
  themeBtn.addEventListener('click', () => {
    theme = nextTheme(theme);
    applyTheme(theme);
    themeBtn.setAttribute('aria-label', THEME_LABELS[theme]);
    themeBtn.title = THEME_LABELS[theme];
  });

  return h(
    'header',
    { class: 'topbar' },
    opts.back ? h('a', { class: 'icon-btn', href: opts.back, 'aria-label': 'Back' }, icon(ICONS.back)) : null,
    h('h1', {}, title),
    ...(opts.actions ?? []),
    themeBtn,
  );
}
