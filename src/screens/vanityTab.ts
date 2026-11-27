/**
 * The wall screen's Vanity tab: the old Vanity Wall Solver rebuilt on the
 * shared job record: setup questions, then the elevation (or presentation)
 * drawing, checks with quick fixes and undo, and the rough-in schedule.
 */
import { h, toast } from '../lib/dom';
import { formatInches, parseInches } from '../lib/inches';
import { keypadAttrs, keypadHeight, onKeypadChange } from '../lib/keypad';
import { href } from '../router';
import { addVanity, readVanity, vanityItemOf, writeVanity } from '../vanity/bind';
import { drawElevation, type ElevationView } from '../vanity/draw';
import { FIELDS, HAS, PRESETS, READ_ONLY, SECTIONS, STEPS, optsOf, txt, type ChoiceField, type Field, type NumField, type VanityD } from '../vanity/settings';
import { checks, schedule, solve, vOf, type Fix } from '../vanity/solve';
import type { WallCtx } from './wallScreen';

const landscape = matchMedia('(orientation: landscape) and (min-width: 600px)');

export function renderVanityTab(c: WallCtx): void {
  const { doc, wall, number, jobId, bar, saver, store } = c;
  const main = c.body;
  const wallId = wall.id;
  let D: VanityD = readVanity(doc, wallId);
  let undoD: VanityD | null = null;
  let view: ElevationView = 'elev';
  let qi = 0;
  const open = new Map<number, boolean>(SECTIONS.map((s, i) => [i, !!s.open]));

  const save = () => {
    writeVanity(doc, wallId, D);
    saver.schedule();
  };

  /* ---------- no vanity yet ---------- */
  if (!vanityItemOf(doc, wallId)) {
    main.append(
      h(
        'section',
        { class: 'card stack' },
        h('h2', {}, 'Vanity'),
        h('p', {}, `Wall ${number} is ${formatInches(wall.length)} long and has no vanity yet.`),
        h('p', { class: 'small muted' }, 'Adding one puts a vanity on this wall in the floor plan too, centered to start.'),
        h(
          'button',
          {
            class: 'btn primary',
            type: 'button',
            onclick: async () => {
              addVanity(doc, wall);
              await store.save(doc);
              void c.rerender();
            },
          },
          'Add a vanity to this wall',
        ),
      ),
    );
    return;
  }

  /* ---------- fields ---------- */
  function chips(f: { id: string; label: string }, options: [string, string][], current: string, onPick: (v: string) => void) {
    return h(
      'div',
      { class: 'chips', role: 'radiogroup', 'aria-label': f.label },
      options.map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === current), onclick: () => onPick(k) }, l)),
    );
  }

  function fieldEl(f: Field): HTMLElement | null {
    if (f.show && !f.show(D)) return null;
    if (f.t === 'snap') {
      const snap = (where: 'L' | 'R' | 'A') => () => {
        const w = vOf(D, 'cabw');
        D.cabx = where === 'L' ? '0' : where === 'R' ? formatInches(Math.max(0, vOf(D, 'wall') - w), { mark: false }) : '';
        undoD = null;
        changed(true);
      };
      return h(
        'div',
        { class: 'field wide' },
        h('span', {}, f.label),
        h(
          'div',
          { class: 'chips' },
          h('button', { type: 'button', onclick: snap('L') }, 'Tight to left wall'),
          h('button', { type: 'button', onclick: snap('R') }, 'Tight to right wall'),
          h('button', { type: 'button', onclick: snap('A') }, '15″ past the toilet'),
        ),
      );
    }
    if (f.t === 'has') {
      return h(
        'div',
        { class: 'field wide' },
        h('span', {}, f.label),
        h(
          'div',
          { class: 'chips', role: 'group', 'aria-label': f.label },
          h('button', { type: 'button', 'aria-pressed': 'true', disabled: true }, 'Vanity or sink'),
          h('button', { type: 'button', 'aria-pressed': String(D.wc !== 'none'), disabled: true, title: 'Add or remove the toilet in the floor plan' }, D.wc !== 'none' ? 'Toilet (from floor plan)' : 'No toilet in the floor plan'),
          HAS.map(([k, l, on, set]) =>
            h(
              'button',
              {
                type: 'button',
                'aria-pressed': String(on(D)),
                onclick: () => {
                  set(D, !on(D));
                  undoD = null;
                  changed(true);
                },
                'data-has': k,
              },
              l,
            ),
          ),
        ),
      );
    }
    return valueField(f as NumField | ChoiceField);
  }

  function valueField(f: NumField | ChoiceField): HTMLElement {
    const label = txt(f.label, D);
    const hint = txt(f.hint, D);
    if (f.t === 'num') {
      if (READ_ONLY.has(f.id)) {
        return h(
          'div',
          { class: 'field' },
          h('span', {}, label),
          h('div', { class: 'readonly' }, formatInches(vOf(D, f.id))),
          h('small', { class: 'muted' }, h('a', { href: href({ name: 'plan', jobId }) }, 'Change it in the floor plan')),
        );
      }
      const input = h('input', { type: 'text', autocomplete: 'off', value: D[f.id] ?? '', ...keypadAttrs({ nudge: true }) });
      input.addEventListener('input', () => {
        D[f.id] = input.value;
        undoD = null;
        input.setAttribute('aria-invalid', String(input.value.trim() !== '' && parseInches(input.value) === null));
        changed(false);
      });
      return h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', { class: 'muted' }, hint) : null);
    }
    return h(
      'div',
      { class: 'field wide' },
      h('span', {}, label),
      chips({ id: f.id, label }, optsOf(f.opts, D), D[f.id] ?? '', (k) => {
        D[f.id] = k;
        if (f.id === 'preset' && PRESETS[k]) Object.assign(D, PRESETS[k]);
        undoD = null;
        changed(true);
      }),
      hint ? h('small', { class: 'muted' }, hint) : null,
    );
  }

  /* ---------- setup questions ---------- */
  const visSteps = () => STEPS.filter((st) => !st.show || st.show(D));
  function renderWizard() {
    const vs = visSteps();
    qi = Math.max(0, Math.min(qi, vs.length - 1));
    const st = vs[qi]!;
    const last = qi === vs.length - 1;
    const go = (to: 'back' | 'next' | 'done') => () => {
      if (to === 'back') qi = Math.max(0, qi - 1);
      else if (to === 'next') qi++;
      else D.qdone = '1';
      save();
      render();
      window.scrollTo(0, 0);
    };
    main.replaceChildren(
      h(
        'section',
        { class: 'card stack' },
        h('p', { class: 'small muted', style: 'margin:0' }, `Vanity setup · step ${qi + 1} of ${vs.length}`),
        h('h2', {}, st.t),
        st.p ? h('p', { class: 'muted', style: 'margin:0' }, st.p) : null,
        h('div', { class: 'form-grid' }, st.f.map((id) => fieldEl(FIELDS[id]!)).filter((x): x is HTMLElement => !!x)),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn', type: 'button', disabled: qi === 0, onclick: go('back') }, 'Back'),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn primary', type: 'button', onclick: go(last ? 'done' : 'next') }, last ? 'See the layout' : 'Next'),
        ),
        h('button', { class: 'btn link-btn', type: 'button', onclick: go('done') }, 'Skip to the layout'),
      ),
    );
  }

  /* ---------- results ---------- */
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Drawing' });
  const svgWrap = h('div', { class: 'plan-svg' });
  const pinned = h('div', { class: 'pinned' }, h('div', { class: 'pin-bar' }, tabs), h('section', { class: 'card plan-card' }, svgWrap));
  const checksList = h('ul', { class: 'checks' });
  const undoBtn = h('button', { class: 'btn small-btn', type: 'button' }, 'Undo fix');
  const schedBody = h('div', {});
  const formBody = h('div', { class: 'stack' });
  const side = h(
    'div',
    { class: 'plan-side stack' },
    h('section', { class: 'card stack' }, h('div', { class: 'row' }, h('h2', {}, 'Checks'), h('span', { class: 'spacer' }), undoBtn), checksList),
    h(
      'section',
      { class: 'card stack' },
      h(
        'div',
        { class: 'row' },
        h('h2', {}, 'Rough-in schedule'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn small-btn', type: 'button', onclick: () => void copySchedule() }, 'Copy'),
      ),
      schedBody,
      h('p', { class: 'note' }, 'Horizontal locations are from the left end of the wall (finished face of the left wall or obstruction), as you face it.'),
    ),
    formBody,
  );
  const layout = h('div', { class: 'plan-layout' }, pinned, side);

  undoBtn.addEventListener('click', () => {
    if (!undoD) return;
    D = undoD;
    undoD = null;
    save();
    render();
  });

  function renderTabs() {
    tabs.replaceChildren(
      ...(
        [
          ['elev', 'Elevation'],
          ['pres', 'Presentation'],
        ] as [ElevationView, string][]
      ).map(([v, l]) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': String(v === view),
            onclick: () => {
              view = v;
              renderTabs();
              refresh();
            },
          },
          l,
        ),
      ),
    );
  }

  function refresh() {
    const R = solve(D);
    svgWrap.innerHTML = drawElevation(D, R, view);
    const ck = checks(D, R);
    checksList.replaceChildren(
      ...ck.map(([level, text, fixes]) =>
        h(
          'li',
          { class: level === 'ans' ? 'answer' : '' },
          h('i', { class: `dot ${level === 'good' ? 'ok' : level === 'ans' ? 'ans' : level}` }),
          h(
            'span',
            {},
            text,
            fixes && fixes.length && level !== 'good'
              ? h(
                  'span',
                  { class: 'fixes' },
                  fixes.map(([label, fn]: Fix) =>
                    h(
                      'button',
                      {
                        class: 'btn small-btn fix',
                        type: 'button',
                        onclick: () => {
                          undoD = structuredClone(D);
                          fn(D);
                          save();
                          render();
                        },
                      },
                      label,
                    ),
                  ),
                )
              : null,
          ),
        ),
      ),
    );
    undoBtn.hidden = !undoD;
    const rows = schedule(D, R);
    schedBody.replaceChildren(
      h(
        'table',
        { class: 'schedule' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Item'), h('th', {}, 'From left'), h('th', {}, 'AFF'))),
        h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))),
      ),
    );
  }

  async function copySchedule() {
    const R = solve(D);
    const rows = schedule(D, R);
    const ck = checks(D, R);
    const text = [
      `VANITY WALL ROUGH-IN — ${doc.job.name}, wall ${number}`,
      `Wall ${formatInches(R.Wd)}, ceiling ${formatInches(R.H)}. From left = from the left end of the wall. AFF = above finished floor.`,
      '',
      ...rows.map((r) => `${r[0]}: ${r[1]}${r[2] ? ' · ' + r[2] + ' AFF' : ''}`),
      '',
      ...ck.filter((c) => c[0] !== 'good').map((c) => '! ' + c[1]),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('Rough-in schedule copied');
    } catch {
      toast('Could not copy on this device.', 'error');
    }
  }

  function renderForm() {
    formBody.replaceChildren(
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          {
            class: 'btn small-btn',
            type: 'button',
            onclick: () => {
              D.qdone = '';
              qi = 0;
              save();
              render();
            },
          },
          'Redo setup questions',
        ),
      ),
      ...SECTIONS.map((s, i) => {
        const fields = s.fields.map(fieldEl).filter((x): x is HTMLElement => !!x);
        if (s.title === 'Toilet' && D.wc === 'none') return null;
        const d = h('details', { class: 'card sec', open: open.get(i) }, h('summary', {}, h('h2', {}, s.title)), h('div', { class: 'form-grid' }, fields));
        d.addEventListener('toggle', () => open.set(i, d.open));
        return d;
      }).filter((x): x is HTMLDetailsElement => !!x),
    );
  }

  /** Something changed: save, and redraw (re-render the fields if what's shown may change). */
  function changed(structural: boolean) {
    save();
    if (D.qdone !== '1') {
      if (structural) renderWizard();
      return;
    }
    refresh();
    if (structural) renderForm();
  }

  function layoutPinned() {
    const topH = bar.offsetHeight;
    const rootStyle = document.documentElement.style;
    pinned.style.top = `${topH}px`;
    rootStyle.setProperty('--topbar-h', `${topH}px`);
    const kp = keypadHeight();
    rootStyle.scrollPaddingBottom = kp ? `${kp + 8}px` : '';
    if (landscape.matches) {
      svgWrap.style.height = '';
      rootStyle.setProperty('--keypad-left', `${Math.round(side.getBoundingClientRect().left - 8)}px`);
      rootStyle.scrollPaddingTop = `${topH + 8}px`;
      return;
    }
    rootStyle.removeProperty('--keypad-left');
    let h0 = window.innerHeight * 0.45;
    if (kp) h0 = Math.min(h0, window.innerHeight - topH - kp - 52 - 150);
    svgWrap.style.height = `${Math.round(Math.max(140, h0))}px`;
    rootStyle.scrollPaddingTop = `${topH + pinned.offsetHeight + 8}px`;
  }
  const offKeypad = onKeypadChange(() => {
    layoutPinned();
    const a = document.activeElement;
    if (a instanceof HTMLElement && keypadHeight()) a.scrollIntoView({ block: 'nearest' });
  });
  window.addEventListener('resize', layoutPinned);
  landscape.addEventListener('change', layoutPinned);
  window.addEventListener(
    'hashchange',
    () => {
      offKeypad();
      window.removeEventListener('resize', layoutPinned);
      landscape.removeEventListener('change', layoutPinned);
      const s = document.documentElement.style;
      s.removeProperty('--keypad-left');
      s.scrollPaddingTop = '';
      s.scrollPaddingBottom = '';
    },
    { once: true },
  );

  function render() {
    if (D.qdone !== '1') {
      renderWizard();
      return;
    }
    main.replaceChildren(layout);
    renderTabs();
    refresh();
    renderForm();
    layoutPinned();
  }
  render();
}
