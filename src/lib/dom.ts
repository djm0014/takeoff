/**
 * Small DOM helpers. No framework: screens build their elements with `h()`
 * and re-render themselves when their data changes.
 */

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'class') {
      el.className = String(value);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/** Inline SVG icon from a path string (24×24 viewBox, stroked). */
export function icon(d: string, label?: string): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

export const ICONS = {
  back: 'M15 18l-6-6 6-6',
  more: 'M12 6h.01M12 12h.01M12 18h.01',
  plus: 'M12 5v14M5 12h14',
  theme: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z',
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = h('div', { class: `toast ${kind === 'error' ? 'error' : ''}`, role: 'status' }, message);
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3000);
}

/** A "⋮" button that opens a small menu of actions. */
export function menuButton(label: string, actions: { label: string; danger?: boolean; run: () => void }[]): HTMLElement {
  const wrap = h('div', { class: 'menu-wrap' });
  const button = h(
    'button',
    { class: 'icon-btn', type: 'button', 'aria-label': label, 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
    icon(ICONS.more),
  );
  let menu: HTMLElement | null = null;
  const close = () => {
    menu?.remove();
    menu = null;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocClick, true);
  };
  const onDocClick = (e: Event) => {
    if (!wrap.contains(e.target as Node)) close();
  };
  button.addEventListener('click', () => {
    if (menu) return close();
    menu = h(
      'div',
      { class: 'menu', role: 'menu' },
      actions.map((a) =>
        h(
          'button',
          {
            type: 'button',
            role: 'menuitem',
            class: a.danger ? 'danger' : '',
            onclick: () => {
              close();
              a.run();
            },
          },
          a.label,
        ),
      ),
    );
    wrap.append(menu);
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onDocClick, true);
  });
  wrap.append(button);
  return wrap;
}

/** Save text as a file on the device. */
export function downloadText(fileName: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ask the user to pick a file and return its text, or null if they cancel. */
export function pickTextFile(accept = '.json,application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
