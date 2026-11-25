/**
 * The app's own number pad for measurements, so the phone's keyboard never
 * pops up over the drawing. Measurement fields opt in with `data-keypad`;
 * they get inputmode="none" so the phone keeps its keyboard down, and this
 * pad docks at the bottom of the screen instead.
 *
 * Fields with `data-nudge` also get a row of nudge buttons (−1″ … +1″).
 * A feet box (`data-unit="ft"`) hands off to the next field on "ft" or a fraction.
 *
 * Only on touch screens; with a mouse and keyboard, fields work as usual.
 */
import { formatInches, parseInches } from './inches';
import { h } from './dom';

/** Nudge steps in inches. Customize later. */
export const NUDGES = [1, 1 / 8];

const EIGHTHS = ['1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];
const SIXTEENTHS = ['1/16', '3/16', '5/16', '7/16', '9/16', '11/16', '13/16', '15/16'];

export function keypadEnabled(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/** Attributes for a measurement input. */
export function keypadAttrs(opts: { nudge?: boolean; unit?: 'ft' | 'in' } = {}): Record<string, string> {
  const on = keypadEnabled();
  const a: Record<string, string> = { inputmode: on ? 'none' : 'decimal', 'data-keypad': '' };
  if (opts.nudge) a['data-nudge'] = '';
  if (opts.unit === 'ft') a['data-unit'] = 'ft';
  return a;
}

/* ---------- editing rules (pure, tested) ---------- */

const FRACTION_END = /(\s*-?\s*\d+\s*\/\s*\d+)$/;

export type Key = { digit: string } | { fraction: string } | 'dot' | 'back' | 'clear' | 'feet';

/**
 * Apply a key to a field's text. `fresh` means the field was just entered:
 * the first digit replaces the old value, while a fraction keeps its whole inches.
 */
export function applyKey(value: string, key: Key, fresh: boolean): string {
  if (key === 'clear') return '';
  if (key === 'back') return value.trimEnd().slice(0, -1);
  if (typeof key === 'object' && 'digit' in key) {
    // A fraction finishes a measurement, so a digit after one starts a new number.
    return (fresh || FRACTION_END.test(value.trim()) ? '' : value) + key.digit;
  }
  if (key === 'dot') {
    if (fresh) return '.';
    const last = value.split(/[\s'-]+/).pop() ?? '';
    return last.includes('.') || last.includes('/') ? value : value + '.';
  }
  if (key === 'feet') {
    const v = fresh ? '' : value.trim();
    if (!v || v.includes("'")) return value;
    return `${v}' `;
  }
  // Fraction: replace a trailing fraction, or add one after the whole inches.
  const f = key.fraction;
  let base = value.trim();
  if (FRACTION_END.test(base)) base = base.replace(FRACTION_END, '').trim();
  else if (fresh) base = base.replace(/\.\d*$/, '').trim(); // 59.5 → keep 59
  if (!base || /'$/.test(base)) return base ? `${base} ${f}` : f;
  if (/\d$/.test(base)) return `${base} ${f}`;
  return base + f;
}

/** Nudge a field's value by `delta` inches, never below zero. Null if the value isn't a number. */
export function nudgeValue(value: string, delta: number): string | null {
  const v = value.trim() === '' ? 0 : parseInches(value);
  if (v === null) return null;
  return formatInches(Math.max(0, Math.round((v + delta) * 16) / 16), { mark: false });
}

/* ---------- the pad ---------- */

let pad: HTMLElement | null = null;
let target: HTMLInputElement | null = null;
let fresh = false;
let sixteenths = false;
const listeners = new Set<() => void>();

/** Height of the pad while it's showing, else 0. */
export function keypadHeight(): number {
  return pad && !pad.hidden ? pad.offsetHeight : 0;
}

/** Called whenever the pad shows, hides or changes size. Returns an unsubscribe function. */
export function onKeypadChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  document.documentElement.style.setProperty('--keypad-h', `${keypadHeight()}px`);
  listeners.forEach((fn) => fn());
}

function fields(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>('input[data-keypad]')].filter(
    (el) => !el.disabled && el.offsetParent !== null,
  );
}

function setValue(input: HTMLInputElement, v: string) {
  input.value = v;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function moveNext(): HTMLInputElement | null {
  if (!target) return null;
  const all = fields();
  const next = all[all.indexOf(target) + 1];
  if (next) {
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return next;
  }
  target.blur();
  return null;
}

function press(action: string) {
  const input = target;
  if (!input) return;
  const isFt = input.dataset.unit === 'ft';
  if (action === 'done') {
    input.blur();
    return;
  }
  if (action === 'next') {
    moveNext();
    return;
  }
  if (action === '16ths') {
    sixteenths = !sixteenths;
    render();
    return;
  }
  if (action.startsWith('nudge:')) {
    const v = nudgeValue(input.value, Number(action.slice(6)));
    if (v !== null) setValue(input, v);
    fresh = false;
    return;
  }
  let key: Key;
  if (action === 'back') key = 'back';
  else if (action === 'clear') key = 'clear';
  else if (action === 'dot') key = 'dot';
  else if (action === 'feet') {
    if (isFt) {
      moveNext();
      return;
    }
    key = 'feet';
  } else if (action.includes('/')) {
    if (isFt) {
      // Feet are whole numbers: the fraction belongs in the inches box.
      const next = moveNext();
      if (next) {
        setValue(next, applyKey(next.value, { fraction: action }, true));
        fresh = false;
      }
      return;
    }
    key = { fraction: action };
  } else key = { digit: action };
  setValue(input, applyKey(input.value, key, fresh));
  fresh = false;
  input.classList.remove('kp-fresh');
}

function keyBtn(label: string, action: string, cls = ''): HTMLElement {
  const b = h('button', { type: 'button', tabindex: '-1', class: `kp-key ${cls}`, 'data-action': action }, label);
  return b;
}

function render() {
  if (!pad) return;
  const fr = sixteenths ? SIXTEENTHS : [...EIGHTHS, 'clear'];
  const frKey = (i: number) => {
    const v = fr[i]!;
    return v === 'clear' ? keyBtn('Clear', 'clear', 'kp-fn') : keyBtn(v, v, 'kp-frac');
  };
  const nudge = !!target?.hasAttribute('data-nudge');
  const steps = [...NUDGES].sort((a, b) => b - a);
  pad.replaceChildren(
    ...(nudge
      ? [
          h(
            'div',
            { class: 'kp-nudges' },
            ...steps.map((s) => keyBtn(`−${formatInches(s)}`, `nudge:${-s}`, 'kp-nudge')),
            ...[...steps].reverse().map((s) => keyBtn(`+${formatInches(s)}`, `nudge:${s}`, 'kp-nudge')),
          ),
        ]
      : []),
    h(
      'div',
      { class: 'kp-grid' },
      keyBtn('7', '7'), keyBtn('8', '8'), keyBtn('9', '9'), frKey(0), frKey(1), keyBtn('⌫', 'back', 'kp-fn'),
      keyBtn('4', '4'), keyBtn('5', '5'), keyBtn('6', '6'), frKey(2), frKey(3), keyBtn('ft', 'feet', 'kp-fn'),
      keyBtn('1', '1'), keyBtn('2', '2'), keyBtn('3', '3'), frKey(4), frKey(5), keyBtn('Next', 'next', 'kp-fn'),
      keyBtn('.', 'dot'), keyBtn('0', '0'), keyBtn(sixteenths ? '8ths' : '16ths', '16ths', 'kp-fn'), frKey(6), frKey(7), keyBtn('Done', 'done', 'kp-done'),
    ),
  );
}

function show(input: HTMLInputElement) {
  if (!pad) return;
  const changed = target !== input || pad.hidden;
  if (target !== input) sixteenths = false; // each field starts in eighths
  target = input;
  fresh = true;
  input.classList.add('kp-fresh');
  render();
  pad.hidden = false;
  if (changed) notify();
}

function hide() {
  if (!pad || pad.hidden) return;
  target?.classList.remove('kp-fresh');
  target = null;
  pad.hidden = true;
  notify();
}

/** Set up the pad once for the whole app. */
export function installKeypad(): void {
  if (pad || !keypadEnabled()) return;
  pad = h('div', { class: 'keypad', role: 'group', 'aria-label': 'Number pad' });
  pad.hidden = true;
  document.body.append(pad);

  // Act on pointerdown and cancel it, so the field keeps focus (and the cursor) while keys are tapped.
  pad.addEventListener('pointerdown', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-action]');
    e.preventDefault();
    if (b) press(b.dataset.action!);
  });
  // Keyboard activation (no pointer) still works.
  pad.addEventListener('click', (e) => {
    if ((e as MouseEvent).detail !== 0) return;
    const b = (e.target as Element).closest<HTMLElement>('[data-action]');
    if (b) press(b.dataset.action!);
  });

  document.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement;
    if (el instanceof HTMLInputElement && el.hasAttribute('data-keypad')) show(el);
  });
  document.addEventListener('focusout', (e) => {
    const el = e.target as HTMLElement;
    if (el === target) el.classList.remove('kp-fresh');
    // Wait a tick: focus may be moving to another measurement field.
    setTimeout(() => {
      const a = document.activeElement;
      if (!(a instanceof HTMLInputElement && a.hasAttribute('data-keypad'))) hide();
    }, 0);
  });
  window.addEventListener('hashchange', hide);
}
