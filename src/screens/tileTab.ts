/**
 * The wall screen's Tile tab: the old Niche Rough-In Planner rebuilt on the
 * shared job record. Setup questions one step at a time, then the layout:
 * best options, the tile / presentation / framing drawings and sheets A-1
 * and A-2, fine-tuning the niche by whole courses, inside-the-niche choices,
 * the rough-in sheet, the cuts and the Adjust card. Same flow and words as
 * the old tool.
 */
import { h, toast } from '../lib/dom';
import { parseInches } from '../lib/inches';
import { keypadAttrs, keypadHeight, onKeypadChange } from '../lib/keypad';
import { href } from '../router';
import { DRAW_ONLY, UI0, readTile, writeTile, type TileUI } from '../tile/bind';
import { drawTile, drawFraming, sheetA1, sheetA2, type Svg } from '../tile/draw';
import { ADJ, STEPS, answers, lab, type Field, type Key, type Step } from '../tile/fields';
import { DEF, isPrefab, normalize, type TileS } from '../tile/settings';
import {
  PILL,
  bu,
  canAdjust,
  courseRoom,
  cutsFor,
  cutsPlain,
  ext,
  fmt,
  isPlain,
  centerName,
  keepSpot,
  layout,
  lineMoves,
  optTitle,
  optionLine,
  snapInfo,
  solve,
  spotOf,
  worstOf,
  type Layout,
  type Opt,
  type SheetRow,
} from '../tile/solve';
import { LOOKS, SHAPES, lookLine, lookName, shapeOf, solveLook, studBound, type LookKey, type LookResult, type Shape } from '../tile/looks';
import type { WallCtx } from './wallScreen';

const landscape = matchMedia('(orientation: landscape) and (min-width: 600px)');
const LAST = STEPS.length - 1;
const SVGNS = 'http://www.w3.org/2000/svg';

const get = (S: TileS, k: Key) => (S as unknown as Record<string, unknown>)[k];
const set = (S: TileS, k: Key, v: unknown) => void ((S as unknown as Record<string, unknown>)[k] = v);

function svgEl(cls: string, label: string): SVGSVGElement {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('class', cls);
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', label);
  return s;
}
const paint = (svg: SVGSVGElement, d: Svg) => {
  svg.setAttribute('viewBox', d.vb);
  svg.innerHTML = d.h;
};

export function renderTileTab(c: WallCtx): void {
  const { doc, wall, number, jobId, bar, saver } = c;
  const main = c.body;
  const planLink = () => h('a', { href: href({ name: 'plan', jobId }) }, 'Change it in the floor plan');

  if (wall.length < 12) {
    main.replaceChildren(
      h(
        'section',
        { class: 'card stack' },
        h('h2', {}, 'Tile and niche'),
        h('p', {}, `Wall ${number} has no length yet. Enter it in the floor plan first; the tile layout starts from it.`),
        h('a', { class: 'btn primary', href: href({ name: 'plan', jobId }) }, 'Open the floor plan'),
      ),
    );
    return;
  }

  const read = readTile(doc, wall.id);
  let S: TileS = read.S;
  let ui: TileUI = read.ui;
  let ret = false;
  if (!isPlain(S) && !S.framed) ui.cur = 0;
  while (ui.cur > 0 && STEPS[ui.cur]?.skip?.(S)) ui.cur--;
  if (ui.cur < 0 || ui.cur > LAST) ui.cur = 0;

  const save = () => {
    normalize(S);
    writeTile(doc, wall.id, S, ui);
    saver.schedule();
  };

  /* ---------- fields ---------- */

  /** A field changed: `structural` when what's shown may change (redraw everything). */
  let onChange: (structural: boolean) => void = () => {};

  function chips(label: string, options: [string | number, string, (string | null)?][], current: unknown, pick: (v: string | number) => void, big = false) {
    return h(
      'div',
      { class: 'chips' + (big ? ' big' : ''), role: 'radiogroup', 'aria-label': label },
      options.map(([v, l, sub]) =>
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === current), onclick: () => pick(v) }, big ? h('b', {}, l) : l, big && sub ? h('span', {}, sub) : null),
      ),
    );
  }

  function numInput(value: number, min: number, max: number, commit: (v: number) => void): HTMLInputElement {
    const input = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', value: fmt(value, false), ...keypadAttrs({ nudge: true }) });
    input.addEventListener('input', () => {
      const v = parseInches(input.value);
      const ok = v !== null && v >= min && v <= max;
      input.setAttribute('aria-invalid', String(!ok && input.value.trim() !== ''));
      if (ok) commit(Math.round(v * 1e6) / 1e6);
    });
    input.addEventListener('blur', () => {
      if (input.getAttribute('aria-invalid') === 'true' || input.value.trim() === '') {
        input.value = fmt(value, false);
        input.setAttribute('aria-invalid', 'false');
      }
    });
    return input;
  }

  function fieldEl(fd: Field): HTMLElement | null {
    if (fd.nicheOnly && isPlain(S)) return null;
    if (fd.show && !fd.show(S)) return null;
    const hint = 'hint' in fd ? lab(fd.hint, S) : '';
    const small = hint ? h('small', { class: 'muted' }, hint) : null;
    switch (fd.t) {
      case 'num': {
        const input = numInput(get(S, fd.id) as number, fd.min, fd.max, (v) => {
          set(S, fd.id, v);
          onChange(false);
        });
        return h('label', { class: 'field' }, h('span', {}, lab(fd.label, S)), input, small);
      }
      case 'choice': {
        const opts = fd.opts.filter((o) => !o[3] || o[3](S)).map((o) => [o[0], o[1], o[2]] as [string | number, string, string | null | undefined]);
        return h(
          'div',
          { class: 'field wide' },
          fd.label ? h('span', {}, lab(fd.label, S)) : null,
          chips(
            lab(fd.label, S),
            opts,
            get(S, fd.id),
            (v) => {
              set(S, fd.id, v);
              fd.on?.(S, v);
              onChange(true);
            },
            fd.big,
          ),
          small,
        );
      }
      case 'check': {
        const box = h('input', { type: 'checkbox', checked: !!get(S, fd.id) });
        box.addEventListener('change', () => {
          set(S, fd.id, box.checked);
          if (fd.id === 'ceilLevel' && !box.checked && S.ceilR === S.ceilL) S.ceilR = S.ceilL;
          onChange(true);
        });
        return h('label', { class: 'check wide' }, box, ' ', lab(fd.label, S));
      }
      case 'text': {
        const input = h('input', { type: 'text', autocomplete: 'off', value: String(get(S, fd.id) ?? '') });
        input.addEventListener('input', () => {
          set(S, fd.id, input.value);
          onChange(false);
        });
        return h('label', { class: 'field wide' }, h('span', {}, lab(fd.label, S)), input, small);
      }
      case 'info':
        return h('p', { class: 'note wide', 'data-info': fd.key }, fd.text(S));
      case 'read':
        return h('div', { class: 'field' }, h('span', {}, lab(fd.label, S)), h('div', { class: 'readonly' }, fd.text(S)), h('small', { class: 'muted' }, hint ? hint + '. ' : '', planLink()));
    }
  }
  const infoText = new Map(STEPS.flatMap((st) => st.fields).flatMap((f) => (f.t === 'info' ? ([[f.key, f.text]] as const) : [])));
  const refreshInfo = () =>
    main.querySelectorAll<HTMLElement>('[data-info]').forEach((n) => {
      const fn = infoText.get(n.dataset.info ?? '');
      if (fn) n.textContent = fn(S);
    });

  /* ---------- setup questions ---------- */

  function go(to: number) {
    ui.cur = to;
    save();
    render();
    window.scrollTo(0, 0);
  }
  const skipped = (i: number) => !!STEPS[i]?.skip?.(S);

  function renderStep(st: Step) {
    const preview = st.preview ? svgEl('tile-svg tile-preview', 'Sketch of the wall and tub') : null;
    const redraw = () => preview && paint(preview, drawTile(S, null));
    onChange = (structural) => {
      save();
      if (structural) render();
      else {
        redraw();
        refreshInfo();
      }
    };
    const nextStep = () => {
      let i = ret ? LAST : Math.min(ui.cur + 1, LAST);
      while (i < LAST && skipped(i)) i++;
      return i;
    };
    const next = () => {
      const i = nextStep();
      if (i === LAST) ret = false;
      go(i);
    };
    const back = () => {
      let i = Math.max(0, ui.cur - 1);
      while (i > 0 && skipped(i)) i--;
      ret = false;
      go(i);
    };
    main.replaceChildren(
      h(
        'section',
        { class: 'card stack tile-step' },
        h('p', { class: 'small muted', style: 'margin:0' }, `Tile setup · step ${ui.cur + 1} of ${LAST}`),
        h('h2', {}, lab(st.title, S)),
        st.sub ? h('p', { class: 'muted', style: 'margin:0' }, lab(st.sub, S)) : null,
        preview ? h('div', { class: 'tile-draw tile-pv' }, preview) : null,
        h('div', { class: 'form-grid' }, st.fields.map(fieldEl)),
        h(
          'div',
          { class: 'row' },
          ui.cur > 0 ? h('button', { class: 'btn', type: 'button', onclick: back }, 'Back') : null,
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn primary', type: 'button', disabled: st.id === 'start' && !isPlain(S) && !S.framed, onclick: next }, ret || nextStep() === LAST ? 'See layout' : 'Next'),
        ),
      ),
    );
    redraw();
  }

  /* ---------- results ---------- */

  let cacheK = '';
  let res: Opt[] = [];
  /** Solve again when an answer that changes the options changed; keep = keep the picked option. */
  function solveIfChanged(keep: boolean) {
    const k = solveKey();
    if (k === cacheK) return;
    // The first solve on opening keeps the saved option and course moves.
    const first = cacheK === '';
    cacheK = k;
    // Where the niche was, to put it back after the options are worked out again.
    const was = !first && lastL && !lastL.r.plain ? spotOf(lastL.r) : null;
    const moved = !!(ui.adjH || ui.adjS || ui.adjHin || ui.adjSin);
    res = solve(S);
    if (first) return;
    const back = was ? keepSpot(S, res, was) : null;
    if (back) {
      ui.optIdx = back.optIdx;
      Object.assign(ui, back.adj);
      return;
    }
    ui.adjH = ui.adjS = ui.adjHin = ui.adjSin = 0;
    if (!keep) ui.optIdx = 0;
    if (moved) toast('The courses moved, so the niche went back to the planner’s size. Fine-tune it again if needed.');
  }

  const viewTabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Drawing' });
  const draw = svgEl('tile-svg', 'Wall elevation with tile layout');
  const drawWrap = h('div', { class: 'tile-draw' }, draw);
  const pinned = h('div', { class: 'pinned' }, h('div', { class: 'pin-bar' }, viewTabs), h('section', { class: 'card plan-card' }, drawWrap));
  const side = h('div', { class: 'plan-side stack' });
  const grid = h('div', { class: 'plan-layout' }, pinned, side);
  let lastL: Layout | null = null;

  /* ---------- style (auto mode) ---------- */

  const solveKey = () => JSON.stringify(S, (key, v) => (DRAW_ONLY.includes(key) ? undefined : v));
  /** Settings a style chooses; changing them doesn't change what the styles start from. */
  const LOOK_KEYS = ['style', 'pattern', 'grout', 'shift', 'onCenter', 'sideLegs', 'center', 'nPos', 'studs', 'bayL', 'nPreset', 'nW', 'nH', 'nSill', 'shelves'];
  const fingerprint = () => JSON.stringify([S, ui.optIdx, ui.adjH, ui.adjS, ui.adjHin, ui.adjSin]);
  const modified = () => !!ui.look && fingerprint() !== ui.lookKey;
  /** "Classic", "Modified Classic", or '' when no style is in use. */
  const lookLabel = () => (ui.look ? (modified() ? 'Modified ' : '') + lookName(ui.look) : '');
  const nicheLooks = () => !isPlain(S) && S.framed === 'no' && !isPrefab(S);
  /** Shapes on offer: a niche in a stud bay can't be linear. */
  const shapesOn = (): Shape[] => (studBound(S) ? ['square', 'tall'] : (Object.keys(SHAPES) as Shape[]));
  const curShape = (): Shape | null => {
    if (!nicheLooks()) return null;
    const sh = (ui.shape as Shape) || shapeOf(S);
    return shapesOn().includes(sh) ? sh : 'tall';
  };
  /** Styles on offer: Simple only for a niche bound by studs. */
  const stylesOn = () => LOOKS.filter((l) => l.key !== 'simple' || studBound(S));
  let looksKey = '';
  let looksBase: TileS = S;
  const looks = new Map<LookKey, LookResult>();
  let looksTimer: ReturnType<typeof setTimeout> | undefined;
  const looksEl = h('section', { class: 'card stack looks' });
  const style = (): LookKey | null => {
    const k = S.style as LookKey | '';
    return k && stylesOn().some((l) => l.key === k) ? k : null;
  };
  /** The chosen style's layout needs putting on the wall: just picked, or the answers it starts from changed. */
  const needsApply = () => !!style() && (ui.look !== style() || ui.lookBase !== looksKey);
  let applying = false;
  function autoApply() {
    const k = style();
    const R = k ? looks.get(k) : undefined;
    if (!R || !R.L || applying || !needsApply()) return;
    applying = true;
    // After the current redraw finishes.
    setTimeout(() => {
      applying = false;
      if (needsApply() && looks.get(k!) === R) applyLook(R);
    }, 0);
  }

  /** Work the styles out again when the answers they start from change: the chosen style first, one at a time so the screen stays live. */
  function refreshLooks() {
    const key = JSON.stringify([S, curShape()], (k, v) => (LOOK_KEYS.includes(k) || DRAW_ONLY.includes(k) ? undefined : v));
    if (key !== looksKey) {
      looksKey = key;
      looksBase = { ...S };
      looks.clear();
      clearTimeout(looksTimer);
      const first = style();
      const todo = LOOKS.map((l) => l.key).sort((a, b) => (a === first ? -1 : b === first ? 1 : 0));
      const next = () => {
        const k = todo.shift();
        if (!k) return;
        looks.set(k, solveLook(k, looksBase, curShape()));
        paintLooks();
        autoApply();
        looksTimer = setTimeout(next, 0);
      };
      looksTimer = setTimeout(next, 0);
    }
    paintLooks();
    autoApply();
  }

  function applyLook(R: LookResult) {
    if (!R.S) return;
    S = { ...R.S, style: R.look };
    normalize(S);
    ui.optIdx = R.optIdx;
    Object.assign(ui, R.adj);
    ui.look = R.look;
    ui.lookShape = curShape() ?? '';
    ui.lookBase = looksKey;
    cacheK = solveKey();
    res = R.options;
    ui.lookKey = fingerprint();
    results(true, true);
  }

  function paintLooks() {
    const shape = curShape();
    const k = style();
    const R = k ? looks.get(k) : undefined;
    const name = k ? lookName(k) : '';
    const close = !!R?.L && R.broken.length > 0;
    const inUse = !!k && ui.look === k && !needsApply();
    const parts: (HTMLElement | null)[] = [
      h('h2', {}, 'Style'),
      h(
        'div',
        { class: 'field wide' },
        chips(
          'Style',
          stylesOn().map((l) => [l.key, l.name]),
          k ?? '',
          (v) => {
            S.style = v as TileS['style'];
            save();
            refreshLooks();
          },
        ),
        h('small', { class: 'muted' }, k ? LOOKS.find((l) => l.key === k)!.blurb : 'Pick the style the tile was ordered for. The planner fits the niche to it.'),
      ),
      shape
        ? h(
            'div',
            { class: 'field wide' },
            h('span', {}, 'Niche shape'),
            chips(
              'Niche shape',
              shapesOn().map((s2) => [s2, `${SHAPES[s2].name} ${fmt(SHAPES[s2].w, false)} × ${fmt(SHAPES[s2].h, false)}`]),
              shape,
              (v) => {
                ui.shape = String(v);
                save();
                refreshLooks();
              },
            ),
          )
        : null,
      !k
        ? null
        : !R
          ? h('p', { class: 'note' }, `Working out ${name}…`)
          : !R.L
            ? h('p', { class: 'note' }, R.reason)
            : h(
                'div',
                { class: 'opt look', 'aria-pressed': String(inUse) },
                h('small', {}, inUse && modified() ? 'In use, modified' : inUse ? 'In use' : 'Putting it on the wall…'),
                h('b', {}, (inUse && modified() ? 'Modified ' : '') + name),
                h('span', {}, lookLine(R)),
                close ? h('span', { class: 'breaks' }, (R.broken.length > 1 ? 'Breaks these rules: ' : 'Breaks a rule: ') + R.broken.join('; ')) : null,
                h('i', { class: `dot ${close ? 'warn' : 'ok'}`, 'aria-label': close ? 'Breaks a rule' : 'Keeps the rules' }),
              ),
      h(
        'div',
        { class: 'row' },
        R?.L && inUse && modified() ? h('button', { class: 'btn small-btn', type: 'button', onclick: () => applyLook(R) }, `Back to ${name}`) : null,
        k === 'organic'
          ? h(
              'button',
              {
                class: 'btn small-btn',
                type: 'button',
                onclick: () => {
                  S.seed = (S.seed || 1) + 1;
                  save();
                  refreshLooks();
                },
              },
              'Shuffle the offsets',
            )
          : null,
      ),
      close ? h('p', { class: 'muted small', style: 'margin:0' }, 'This wall can’t keep every rule in this style; this is the closest fit.') : null,
    ];
    looksEl.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
  }

  function rowsDl(rows: SheetRow[]) {
    return h(
      'dl',
      { class: 'tile-rows' },
      rows.map(([a, b, hl]) =>
        h(
          'div',
          { class: hl ? 'hl' : '' },
          h('dt', {}, a),
          h(
            'dd',
            {},
            b.split('<br>').flatMap((part, i) => (i ? [h('br'), part] : [part])),
          ),
        ),
      ),
    );
  }

  const inChips = (k: Key, label: string, opts: [string, string][]) =>
    h(
      'div',
      { class: 'field wide' },
      h('span', {}, label),
      chips(label, opts, get(S, k), (v) => {
        if (k === 'shelfPos' && v === 'custom' && lastL) {
          const s = lastL.r.int.shelves;
          if (s[0] != null) S.shelf1 = Math.round(s[0] * 16) / 16;
          if (s[1] != null) S.shelf2 = Math.round(s[1] * 16) / 16;
        }
        set(S, k, v);
        results(true, true);
      }),
    );
  const uiChips = <K extends 'sheet' | 'presIn'>(k: K, label: string, opts: [TileUI[K], string][]) =>
    h(
      'div',
      { class: 'field wide' },
      h('span', {}, label),
      chips(label, opts, ui[k], (v) => {
        ui[k] = v as TileUI[K];
        results(true, true);
      }),
    );

  function optionsCard(L: Layout) {
    return h(
      'section',
      { class: 'card stack' },
      h('h2', {}, L.options.length > 1 ? 'Planner’s options' : 'Planner’s option'),
      h('p', { class: 'muted small', style: 'margin:0' }, 'The planner’s own picks, to fine-tune by hand.'),
      h(
        'div',
        { class: 'opts' },
        L.options.map((o, i) => {
          const w = worstOf(o.plain ? cutsPlain(L.S, o) : cutsFor(L.S, o));
          return h(
            'button',
            {
              type: 'button',
              class: 'opt',
              'aria-pressed': String(i === L.optIdx),
              onclick: () => {
                ui.optIdx = i;
                ui.adjH = ui.adjS = ui.adjHin = ui.adjSin = 0;
                results(true, false);
              },
            },
            h('small', {}, `Option ${i + 1}`),
            h('b', {}, optTitle(L.S, o)),
            h('span', {}, optionLine(L.S, o)),
            h('i', { class: `dot ${w === 'bad' ? 'bad' : w === 'warn' ? 'warn' : 'ok'}`, 'aria-label': w === 'bad' ? 'Has slivers' : w === 'warn' ? 'Has small cuts' : 'Clean' }),
          );
        }),
      ),
    );
  }

  function viewCard(L: Layout) {
    const PL = !!L.r.plain;
    const fr = L.fr;
    const nBad = L.items.filter((i) => i[2] === 'bad').length;
    const nWarn = L.items.filter((i) => i[2] === 'warn').length;
    const head =
      nBad || nWarn ? [nBad ? nBad + (nBad > 1 ? ' slivers' : ' sliver') : '', nWarn ? nWarn + (nWarn > 1 ? ' small cuts' : ' small cut') : ''].filter(Boolean).join(', ') : 'No slivers anywhere';
    const fHead = PL ? `Wall framing · ${fr.studs.length} studs` : `Niche blocked on all four sides${fr.cripples.length ? ` · ${fr.cripples.length} cripple${fr.cripples.length > 1 ? 's' : ''}` : ''}`;
    const sw = (bg: string, t: string) => h('span', {}, h('i', { style: `background:${bg}` }), t);
    const ln = (cls: string, t: string) => h('span', {}, h('i', { class: 'ln ' + cls }), t);
    let headline: HTMLElement;
    let extra: (HTMLElement | null)[];
    if (ui.view === 'draw') {
      headline = h('div', { class: 'headline' }, h('span', {}, ui.sheet === 'a2' && !PL && !isPrefab(S) ? 'Sheet A-2 · Niche section' : 'Sheet A-1 · Construction drawings'));
      extra = [
        PL || isPrefab(S) ? null : h('div', { class: 'form-grid' }, uiChips('sheet', 'Sheet', [['a1', 'A-1 Elevations'], ['a2', 'A-2 Niche section']])),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => downloadSheet(L) }, 'Download sheet (SVG)')),
        h('p', { class: 'note' }, 'The download opens in any browser full size, to zoom or print at 11×17.'),
      ];
    } else if (ui.view === 'present') {
      headline = h('div', { class: 'headline' }, h('span', {}, 'Presentation view'));
      extra = [
        h('p', { class: 'note' }, 'Black and white for sharing with clients. Cut colors, the rough opening and the ledger line are hidden.'),
        h('div', { class: 'form-grid' }, uiChips('presIn', 'Inside the niche', [['hide', 'Blank back wall'], ['show', 'Show tile']])),
      ];
    } else if (ui.view === 'frame') {
      headline = h('div', { class: 'headline' }, h('i', { class: 'dot ok' }), h('span', {}, fHead));
      extra = [
        h('div', { class: 'legend' }, sw('var(--wood)', 'Studs and plates'), sw('var(--block)', 'Niche blocking'), PL ? null : ln('', 'Rough opening'), S.base === 'tub' ? ln('mut', 'Tub') : null),
        rowsDl(L.frRows),
        h(
          'div',
          { class: 'form-grid' },
          PL ? null : inChips('sides', 'Niche sides', [['full', 'Full-height studs'], ['block', 'Blocks between sill and head']]),
          fr.bayMode ? null : inChips('studStart', 'Stud layout starts at', [['left', 'Left corner'], ['right', 'Right corner']]),
          PL ? null : inChips('block', 'Blocking', [['flat', 'Flat, 1 1/2″'], ['edge', 'On edge, 3 1/2″']]),
        ),
      ];
    } else {
      headline = h('div', { class: 'headline' }, h('i', { class: `dot ${nBad ? 'bad' : nWarn ? 'warn' : 'ok'}` }), h('span', {}, head));
      extra = [
        h(
          'div',
          { class: 'legend' },
          sw('var(--tile)', 'Full'),
          sw('var(--tile-cut)', 'Cut'),
          sw('var(--warn-fill)', 'Small cut'),
          sw('var(--bad-fill)', 'Sliver'),
          ext(L.S) || L.S.edge !== 'none' ? sw('var(--border-tile)', 'Bullnose') : null,
          PL ? null : ln('', 'Niche center line'),
          ln('acc', 'Ledger line'),
        ),
      ];
    }
    return h('section', { class: 'card stack tile-view tile-legend-colors' }, headline, ...extra);
  }

  /** Niche in an existing stud bay: move it a bay left or right. */
  function bayRow(): HTMLElement | null {
    if (S.framed === 'yes' || S.studs !== 'bay') return null;
    const fits = (to: number) => to >= 0 && solve({ ...S, bayL: to }).length > 0;
    const move = (dir: -1 | 1) => () => {
      S.bayL = Math.round((S.bayL + dir * S.studOC) * 16) / 16;
      results(true, true);
    };
    const l = S.bayL - S.studOC;
    const r = S.bayL + S.studOC;
    return h(
      'div',
      { class: 'tune' },
      h('span', { class: 'lab' }, 'Stud bay'),
      h('button', { class: 'btn small-btn', type: 'button', disabled: !fits(l), onclick: move(-1) }, 'Left 1 bay'),
      h('b', {}, `Bay starts ${fmt(S.bayL)} from left corner`),
      h('button', { class: 'btn small-btn', type: 'button', disabled: !fits(r), onclick: move(1) }, 'Right 1 bay'),
    );
  }

  function tuneCard(L: Layout) {
    const r = L.r;
    const TS = L.S;
    const room = courseRoom(TS, r);
    const nm = ext(TS) ? 'border' : 'niche';
    const a = (dh: number, ds: number, hi = 0, si = 0) => ({ adjH: ui.adjH + dh, adjS: ui.adjS + ds, adjHin: ui.adjHin + hi, adjSin: ui.adjSin + si });
    const btn = (label: string, ok: boolean, run: () => void, ghost = true) =>
      h('button', { class: 'btn small-btn' + (ghost ? '' : ' primary'), type: 'button', disabled: !ok, onclick: run }, label);
    const move = (dh: number, ds: number) => () => {
      ui.adjH += dh;
      ui.adjS += ds;
      results(true, true);
    };
    const snap = (hi: number, si: number) => () => {
      ui.adjHin += hi;
      ui.adjSin += si;
      results(true, true);
    };
    const sn = snapInfo(TS, r);
    const any = ui.adjH || ui.adjS || ui.adjHin || ui.adjSin;
    return h(
      'section',
      { class: 'card stack' },
      h(
        'div',
        { class: 'row' },
        h('h2', {}, 'Fine-tune the niche'),
        h('span', { class: 'spacer' }),
        any
          ? h(
              'button',
              {
                class: 'btn small-btn',
                type: 'button',
                onclick: () => {
                  ui.adjH = ui.adjS = ui.adjHin = ui.adjSin = 0;
                  results(true, true);
                },
              },
              'Back to original size',
            )
          : null,
      ),
      isPrefab(TS)
        ? h('p', { class: 'note' }, sn.sOn ? `The niche bottom lands on a grout line; the head is where the niche’s ${fmt(r.hF)} height puts it.` : 'The niche bottom is off a grout line: move it a course.')
        : sn.hOn && sn.sOn
        ? h('p', { class: 'note' }, `The ${nm} sill and head both land on grout lines.`)
        : h(
            'div',
            { class: 'stack' },
            sn.hOn
              ? null
              : h(
                  'div',
                  { class: 'tune' },
                  h('span', { class: 'lab' }, `Head is ${fmt(Math.min(sn.hd, sn.hu))} off a grout line`),
                  btn('Lower head ' + fmt(sn.hd), canAdjust(TS, L.r0, a(0, 0, -sn.hd, 0)), snap(-sn.hd, 0), false),
                  h('b'),
                  btn('Raise head ' + fmt(sn.hu), canAdjust(TS, L.r0, a(0, 0, sn.hu, 0)), snap(sn.hu, 0), false),
                ),
            sn.sOn
              ? null
              : h(
                  'div',
                  { class: 'tune' },
                  h('span', { class: 'lab' }, `Sill is ${fmt(Math.min(sn.sd, sn.su))} off a grout line`),
                  btn('Lower sill ' + fmt(sn.sd), canAdjust(TS, L.r0, a(0, 0, 0, -sn.sd)), snap(0, -sn.sd), false),
                  h('b'),
                  btn('Raise sill ' + fmt(sn.su), canAdjust(TS, L.r0, a(0, 0, 0, sn.su)), snap(0, sn.su), false),
                ),
          ),
      isPrefab(TS)
        ? null
        : h(
            'div',
            { class: 'tune' },
            h('span', { class: 'lab' }, 'Height'),
            btn('− 1 course', canAdjust(TS, L.r0, a(-1, 0)), move(-1, 0)),
            h('b', {}, `${fmt(r.hF)} finished`),
            btn('+ 1 course', canAdjust(TS, L.r0, a(1, 0)), move(1, 0)),
          ),
      h(
        'div',
        { class: 'tune' },
        h('span', { class: 'lab' }, 'Position'),
        btn('Down 1 course', canAdjust(TS, L.r0, a(0, -1)), move(0, -1)),
        h('b', {}, `Rough sill ${fmt(isPrefab(TS) ? L.fr.ys : r.sF - bu(TS))}`),
        btn('Up 1 course', canAdjust(TS, L.r0, a(0, 1)), move(0, 1)),
      ),
      bayRow(),
      h(
        'p',
        { class: 'note' },
        `Full courses below the ${nm}: ${room.below} · above: ${room.above}. Each step moves the edges a whole course so they stay on grout lines, and keeps at least one full course above and below.`,
      ),
    );
  }

  function insideCard(L: Layout) {
    const r = L.r;
    const sh = S.shelves > 0 && r.int.shelves.length > 0;
    const shelfNum = (k: 'shelf1' | 'shelf2', label: string) =>
      h(
        'label',
        { class: 'field' },
        h('span', {}, label),
        numInput(S[k], 0, 120, (v) => {
          S[k] = v;
          results(false, true);
        }),
        h('small', { class: 'muted' }, 'Finished sill to underside'),
      );
    return h(
      'section',
      { class: 'card stack' },
      h('h2', {}, 'Inside the niche'),
      h(
        'div',
        { class: 'form-grid' },
        inChips('start', 'Courses start', [
          ['bottom', sh && !r.int.over ? 'Full tile on sill and shelf' : 'Full tile on sill'],
          ['top', sh && !r.int.over ? 'Full tile under shelf and head' : 'Full tile under head'],
          ['balance', 'Equal cuts top and bottom'],
          ['match', 'Match field grout lines'],
        ]),
        sh ? inChips('shelfPos', 'Shelf position', [['center', S.shelves > 1 ? 'Evenly spaced' : 'Centered'], ['auto', 'On whole courses'], ['custom', 'Custom height']]) : null,
        sh && r.int.over ? h('p', { class: 'note wide' }, 'Tile runs straight up behind the shelf. Which pieces get trimmed around it is a field call.') : null,
        sh && S.shelfPos === 'custom' ? shelfNum('shelf1', 'Shelf 1 height') : null,
        sh && S.shelfPos === 'custom' && S.shelves > 1 ? shelfNum('shelf2', 'Shelf 2 height') : null,
        inChips('pat', 'Pattern inside', [['wall', 'Same as wall'], ['stack', 'Stacked']]),
        inChips('side', 'Side to side', [['auto', 'Cleanest side cuts'], ['tile', 'Centered tile'], ['joint', 'Centered joint']]),
      ),
    );
  }

  function sheetCard(L: Layout) {
    const PL = !!L.r.plain;
    return h(
      'section',
      { class: 'card stack' },
      h('div', { class: 'row' }, h('h2', {}, (PL ? 'Layout sheet' : 'Rough-in sheet') + (lookLabel() ? ' · ' + lookLabel() : '')), h('span', { class: 'spacer' }), h('button', { class: 'btn small-btn', type: 'button', onclick: () => void copySheet(L) }, 'Copy')),
      rowsDl(L.sheet),
    );
  }

  function lineFix(L: Layout): HTMLElement | null {
    const mv = lineMoves(S, L);
    if (!mv) return null;
    const what = centerName(L.S);
    const go = (shift: number) => () => {
      S.shift = shift;
      results(true, true);
    };
    const btn = (m: { shift: number; min: number }) =>
      h(
        'button',
        { class: 'btn small-btn primary fix', type: 'button', onclick: go(m.shift) },
        `Move it ${fmt(Math.abs(m.shift))} ${m.shift < 0 ? 'left' : 'right'}: corner pieces ${fmt(m.min)} and up`,
      );
    const moved = S.shift
      ? h(
          'p',
          { class: 'note' },
          `The layout line is moved ${fmt(Math.abs(S.shift))} ${S.shift < 0 ? 'left' : 'right'} of the ${what}’s center. Smallest corner piece: ${fmt(mv.now)}.`,
        )
      : h(
          'p',
          { class: 'note' },
          mv.left || mv.right
            ? `Centered on the ${what}, the corner pieces get down to ${fmt(mv.now)}. Moving the layout line off center gives bigger ones; the tile size and the wall stay the same.`
            : `Centered on the ${what}, the corner pieces get down to ${fmt(mv.now)}. That’s as big as they get on this wall with this pattern: moving the layout line doesn’t help.`,
        );
    return h(
      'div',
      { class: 'stack line-fix' },
      moved,
      h(
        'div',
        { class: 'fixes' },
        mv.left && Math.abs(mv.left.shift - S.shift) > 1e-6 ? btn(mv.left) : null,
        mv.right && Math.abs(mv.right.shift - S.shift) > 1e-6 ? btn(mv.right) : null,
        S.shift ? h('button', { class: 'btn small-btn fix', type: 'button', onclick: go(0) }, `Center it on the ${what} again`) : null,
      ),
    );
  }

  function cutsCard(L: Layout) {
    return h(
      'section',
      { class: 'card stack' },
      h('h2', {}, 'Cuts'),
      lineFix(L),
      h(
        'ul',
        { class: 'tile-cuts' },
        L.items.map(([l, v, st, pl]) => h('li', { class: 's-' + st }, h('span', {}, l), h('span', { class: 'res-v' }, v), h('span', { class: 'pill' }, pl || PILL[st]))),
      ),
    );
  }

  function adjustCard() {
    return h('section', { class: 'card stack' }, h('h2', {}, 'Adjust'), h('div', { class: 'form-grid' }, ADJ.map(fieldEl)));
  }

  function answersCard() {
    return h(
      'section',
      { class: 'card stack' },
      h(
        'div',
        { class: 'row' },
        h('h2', {}, 'Your answers'),
        h('span', { class: 'spacer' }),
        h(
          'button',
          {
            class: 'btn small-btn',
            type: 'button',
            onclick: () => {
              if (!confirm('Start this wall’s tile layout over? Measurements from the floor plan stay.')) return;
              const keep = readTile(doc, wall.id).S;
              S = { ...DEF };
              for (const k of ['wallW', 'ceilL', 'ceilR', 'base', 'tubPos', 'tubL', 'tubH', 'studD', 'stud1', 'widthRef'] as Key[]) set(S, k, get(keep, k));
              ui = { ...UI0 };
              ret = false;
              go(0);
            },
          },
          'Start over',
        ),
      ),
      h(
        'ul',
        { class: 'tile-answers' },
        answers(S).map(([i, a, b]) =>
          h(
            'li',
            {},
            h('div', {}, h('b', {}, a), h('span', {}, b)),
            h(
              'button',
              {
                class: 'btn small-btn',
                type: 'button',
                'aria-label': `Edit ${a}`,
                onclick: () => {
                  ret = true;
                  go(i);
                },
              },
              'Edit',
            ),
          ),
        ),
      ),
    );
  }

  const howCard = () =>
    h(
      'section',
      { class: 'card' },
      h(
        'details',
        {},
        h('summary', {}, 'How this works'),
        h(
          'ul',
          { class: 'how' },
          h('li', {}, 'It tries every starting height for the first course in 1/16″ steps, sets the niche sill on a grout line, then sizes the niche so the head and the inside land on whole tiles where it can.'),
          h('li', {}, 'Rough numbers are framing. Finished numbers are inside the tile, smaller by the build-up on each face.'),
          h('li', {}, 'The ledger line is the bottom of the 2nd course. Set the first course last, cut to fit the tub.'),
          h('li', {}, 'A small leftover inside a niche bay, up to about two grout joints, is treated as caulk joint.'),
          h('li', {}, 'Check the tub and ceiling with a level before cutting. Enter both ceiling heights if they differ.'),
          h('li', {}, 'The wall width is stud to stud, from the floor plan: the wall’s length there plus 1/2″ of drywall at each corner.'),
        ),
      ),
    );

  function renderTabs() {
    viewTabs.replaceChildren(
      ...(
        [
          ['tile', 'Tile'],
          ['present', 'Presentation'],
          ['frame', 'Framing'],
          ['draw', 'Sheets'],
        ] as [TileUI['view'], string][]
      ).map(([v, l]) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': String(v === ui.view),
            onclick: () => {
              ui.view = v;
              results(true, true);
            },
          },
          l,
        ),
      ),
    );
  }

  const sheetDate = () => new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const sheetInfo = () => ({ date: sheetDate(), job: `${doc.job.name}, wall ${number}`, look: lookLabel() });

  function paintDrawing(L: Layout) {
    const PL = !!L.r.plain;
    draw.classList.toggle('mono', ui.view === 'present');
    draw.classList.toggle('hidein', ui.view === 'present' && ui.presIn !== 'show');
    draw.classList.toggle('sheet-view', ui.view === 'draw');
    if (ui.view === 'draw') {
      draw.setAttribute('viewBox', '0 0 1700 1100');
      draw.innerHTML = '<g class="sheet">' + (ui.sheet === 'a2' && !PL && !isPrefab(S) ? sheetA2(L.S, L.r, L.fr, sheetInfo()) : sheetA1(L.S, L.r, L.fr, sheetInfo())) + '</g>';
      draw.setAttribute('aria-label', 'Construction sheet with framing and tile elevations');
    } else if (ui.view === 'frame') {
      paint(draw, drawFraming(L.S, L.r, L.fr));
      draw.setAttribute('aria-label', 'Framing elevation with studs, plates and niche blocking');
    } else {
      paint(draw, drawTile(L.S, L.r));
      draw.setAttribute('aria-label', 'Wall elevation with tile layout and niche');
    }
  }

  function downloadSheet(L: Layout) {
    const PL = !!L.r.plain;
    const a2 = ui.sheet === 'a2' && !PL && !isPrefab(S);
    const inner = a2 ? sheetA2(L.S, L.r, L.fr, sheetInfo()) : sheetA1(L.S, L.r, L.fr, sheetInfo());
    const text = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="17in" height="11in" viewBox="0 0 1700 1100"><g class="sheet">${inner}</g></svg>`;
    const name = `${doc.job.name} wall ${number}`.replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '-') || 'tile-wall';
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    const a = h('a', { href: url, download: name + (a2 ? '-A2.svg' : '-A1.svg') });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function copySheet(L: Layout) {
    const rows = L.sheet.concat([['FRAMING', '']], L.frRows);
    const text = [`${L.r.plain ? 'Tile layout' : 'Niche rough-in'} — ${doc.job.name}, wall ${number}${lookLabel() ? ' · ' + lookLabel() : ''}`]
      .concat(rows.map(([a, v]) => (v ? a + ': ' + String(v).replace(/<br>/g, '; ') : a)))
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast(L.r.plain ? 'Layout sheet copied' : 'Rough-in sheet copied');
    } catch {
      toast('Could not copy on this device.', 'error');
    }
  }

  /** The cards that hold fields being typed in; kept while typing, so the field keeps focus. */
  let keepInside: HTMLElement | null = null;
  let keepAdjust: HTMLElement | null = null;

  /**
   * Redraw the results. `keep`: keep the picked option when the answers changed
   * (a change made on the results screen's inside or framing choices).
   * `rebuild`: redraw the cards with fields too (not while typing in one).
   */
  function results(rebuild: boolean, keep: boolean, dirty = true) {
    normalize(S);
    solveIfChanged(keep);
    const L = layout(S, ui.optIdx, ui, res);
    if (L && !L.adjusted) ui.adjH = ui.adjS = ui.adjHin = ui.adjSin = 0;
    if (L) ui.optIdx = L.optIdx;
    lastL = L;
    if (dirty) save();
    onChange = (structural) => results(structural, false);
    if (main.firstChild !== grid) main.replaceChildren(grid);
    renderTabs();
    if (!L) {
      draw.setAttribute('viewBox', '0 0 10 10');
      draw.innerHTML = '';
      side.replaceChildren(
        h('section', { class: 'card stack' }, h('h2', {}, 'No layout fits'), h('p', {}, 'The niche doesn’t fit on this wall with these sizes. Check the wall height, the niche size and where it sits, then try again.')),
        answersCard(),
      );
      layoutPinned();
      return;
    }
    paintDrawing(L);
    if (rebuild || !keepAdjust) {
      keepAdjust = adjustCard();
      keepInside = L.r.plain ? null : insideCard(L);
    }
    refreshLooks();
    place(side, [looksEl, optionsCard(L), viewCard(L), ...(L.r.plain ? [] : [tuneCard(L), keepInside!]), sheetCard(L), cutsCard(L), keepAdjust, answersCard(), howCard()]);
    layoutPinned();
  }

  /* ---------- pinned drawing (as the vanity tab) ---------- */

  function layoutPinned() {
    const topH = bar.offsetHeight;
    const rootStyle = document.documentElement.style;
    pinned.style.top = `${topH}px`;
    rootStyle.setProperty('--topbar-h', `${topH}px`);
    const kp = keypadHeight();
    rootStyle.scrollPaddingBottom = kp ? `${kp + 8}px` : '';
    if (!main.contains(grid)) return;
    if (landscape.matches) {
      drawWrap.style.height = '';
      rootStyle.setProperty('--keypad-left', `${Math.round(side.getBoundingClientRect().left - 8)}px`);
      rootStyle.scrollPaddingTop = `${topH + 8}px`;
      return;
    }
    rootStyle.removeProperty('--keypad-left');
    let h0 = window.innerHeight * 0.45;
    if (kp) h0 = Math.min(h0, window.innerHeight - topH - kp - 52 - 150);
    drawWrap.style.height = `${Math.round(Math.max(140, h0))}px`;
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
    normalize(S);
    const st = STEPS[ui.cur]!;
    if (st.id === 'results') {
      results(true, true, false);
      return;
    }
    const s = document.documentElement.style;
    s.scrollPaddingTop = '';
    renderStep(st);
  }
  render();
}

/**
 * Put these cards in the column in order, leaving cards that are already there
 * in place (so a field being typed in keeps its focus and the number pad).
 */
function place(col: HTMLElement, cards: HTMLElement[]): void {
  for (const ch of [...col.children]) if (!cards.includes(ch as HTMLElement)) ch.remove();
  cards.forEach((card, i) => {
    if (col.children[i] !== card) col.insertBefore(card, col.children[i] ?? null);
  });
}
