/**
 * Floor plan: the room, its walls, and the doors, windows and fixtures on
 * them, with existing and design views and clearance checks.
 *
 * The room is entered by walking it: start in a corner, enter each wall's
 * length and the turn to the next. Everything is stored on the shared job
 * record, so the wall screens see the same walls and items.
 */
import { newId, type Item, type ItemStatus, type JobDoc, type Room, type StudSize, type Wall } from '../data/model';
import { jobs } from '../data/storage';
import { autosave } from '../lib/autosave';
import { h, icon, ICONS, menuButton, toast } from '../lib/dom';
import { formatInches, parseInches } from '../lib/inches';
import { runChecks } from '../plan/checks';
import { drawPlan, type PlanView } from '../plan/draw';
import { blockingText, framing } from '../plan/framing';
import { closingTurn, toLocal, type RoomGeom } from '../plan/geometry';
import {
  CHOICE_FIELDS,
  ITEM_NAMES,
  NUMBER_FIELDS,
  PLAN_ITEM_TYPES,
  isPlanItem,
  newPlanItem,
  type PlanItemType,
} from '../plan/items';
import { closeRoom, deleteWall, ensureRoom, geometry, insertWall, makeRectangle, roomWalls, squareGap } from '../plan/room';
import { href } from '../router';
import { topbar } from './shell';

const HINTS: Record<PlanView, string> = {
  existing:
    'Existing conditions as measured. Walls are numbered in the order you walked them; distances run from the left corner as you face each wall from inside the room. Drag a fixture, door or window to slide it along its wall.',
  design:
    'Existing items stay, new items show in orange, removed items are dashed. Shaded areas are the clear floor space checked below. Drag to try other locations.',
  framing:
    'Framing for the design: 2×4 or 2×6 studs at 16″ OC from the left end of each plate, single top plate, king and jack studs at openings. Orange bars are blocking. Layout assumes framing ½″ behind the finished face.',
};

const STATUS_OPTIONS: [ItemStatus, string][] = [
  ['existing', 'Existing'],
  ['new', 'New'],
  ['remove', 'Remove'],
];

/* ---------- drawing size, remembered on this device ---------- */

type PlanSize = 'half' | 'large' | 'hidden';
const SIZE_KEY = 'bathroom-tools:plan-size';
function loadPlanSize(): PlanSize {
  try {
    const v = localStorage.getItem(SIZE_KEY);
    if (v === 'large' || v === 'hidden') return v;
  } catch {
    /* storage blocked */
  }
  return 'half';
}
function savePlanSize(v: PlanSize): void {
  try {
    localStorage.setItem(SIZE_KEY, v);
  } catch {
    /* storage blocked */
  }
}

/* ---------- small input pieces ---------- */

function chips<T extends string | number>(
  label: string,
  options: [T, string][],
  current: T,
  onPick: (v: T) => void,
): HTMLElement {
  return h(
    'div',
    { class: 'chips', role: 'radiogroup', 'aria-label': label },
    options.map(([v, text]) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === current), onclick: () => onPick(v) }, text),
    ),
  );
}

const inchText = (v: number) => (v ? formatInches(v, { mark: false }) : '');

/** Text input for inches; calls back only with valid numbers. */
function inchInput(label: string, value: number, onValue: (v: number) => void, attrs: Record<string, string> = {}): HTMLElement {
  const input = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: inchText(value), ...attrs });
  input.addEventListener('input', () => {
    const v = input.value.trim() === '' ? 0 : parseInches(input.value);
    input.setAttribute('aria-invalid', String(v === null || v < 0));
    if (v !== null && v >= 0) onValue(v);
  });
  return h('label', { class: 'field' }, h('span', {}, label), input);
}

/** Feet and inches boxes for a wall length. */
function feetInches(label: string, value: number, onValue: (v: number) => void): HTMLElement {
  const ft = value > 0 ? Math.floor(value / 12 + 1e-9) : 0;
  const inch = value > 0 ? value - ft * 12 : 0;
  const ftIn = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: value > 0 ? String(ft) : '', 'aria-label': `${label} feet` });
  const inIn = h('input', {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    value: value > 0 && inch > 0 ? formatInches(inch, { mark: false }) : '',
    'aria-label': `${label} inches`,
  });
  const update = () => {
    const f = ftIn.value.trim() === '' ? 0 : Number(ftIn.value);
    const i = inIn.value.trim() === '' ? 0 : parseInches(inIn.value);
    const badF = !Number.isFinite(f) || f < 0;
    const badI = i === null || i < 0;
    ftIn.setAttribute('aria-invalid', String(badF));
    inIn.setAttribute('aria-invalid', String(badI));
    if (!badF && !badI) onValue(f * 12 + (i ?? 0));
  };
  ftIn.addEventListener('input', update);
  inIn.addEventListener('input', update);
  return h(
    'div',
    { class: 'field' },
    h('span', {}, label),
    h('div', { class: 'ftin' }, ftIn, h('span', { class: 'unit' }, 'ft'), inIn, h('span', { class: 'unit' }, 'in')),
  );
}

/* ---------- the screen ---------- */

export async function renderFloorPlan(root: HTMLElement, jobId: string): Promise<void> {
  const store = jobs();
  let loaded: JobDoc | null = null;
  try {
    loaded = await store.get(jobId);
  } catch {
    toast('Could not open that job.', 'error');
  }
  if (!loaded) {
    root.replaceChildren(
      topbar('Job not found', { back: href({ name: 'jobs' }) }),
      h('main', {}, h('p', { class: 'empty' }, 'That job is not saved on this phone.')),
    );
    return;
  }
  const doc: JobDoc = loaded;
  const hadRoom = doc.rooms.length > 0;
  const room: Room = ensureRoom(doc);

  let view: PlanView = 'existing';
  let dragId: string | null = null;
  let lastWallId: string | null = null;
  /** What's being edited below the drawing, so the drawing can point it out. */
  let focusWallId: string | null = null;
  let focusItemId: string | null = null;
  let size = loadPlanSize();

  const savedNote = h('span', { class: 'saved-note', 'aria-live': 'polite' }, '');
  const saver = autosave(store, () => doc, (t) => (savedNote.textContent = t));
  if (!hadRoom) saver.schedule();

  const walls = (): Wall[] => roomWalls(doc, room.id);
  const geom = (): RoomGeom => geometry(doc, room.id);

  /* ----- layout ----- */
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Plan view' });
  const svgWrap = h('div', { class: 'plan-svg' });
  const hint = h('p', { class: 'note' });
  const checksList = h('ul', { class: 'checks' });
  const roomBody = h('div', { class: 'stack' });
  const closeStatus = h('p', { class: 'note', role: 'status' });
  const itemsBody = h('div', { class: 'stack' });
  const framingCard = h('section', { class: 'card stack' });

  const sizeBtn = h('button', { class: 'icon-btn size-btn', type: 'button' });
  const planCard = h('section', { class: 'card plan-card' }, svgWrap);
  // The drawing stays pinned under the top bar while the fields scroll underneath.
  const pinned = h('div', { class: 'pinned' }, h('div', { class: 'pin-bar' }, tabs, sizeBtn), planCard);
  const main = h(
    'main',
    { class: 'stack' },
    pinned,
    hint,
    h('section', { class: 'card stack' }, h('h2', {}, 'Checks'), checksList),
    framingCard,
    h('section', { class: 'card stack' }, h('h2', {}, 'Room'), roomBody),
    h('section', { class: 'card stack' }, h('h2', {}, 'Doors, windows, fixtures'), itemsBody),
  );
  const bar = topbar(doc.job.name, { back: href({ name: 'job', jobId }), actions: [savedNote] });
  root.replaceChildren(bar, main);

  /** Keep fields that get focus from scrolling up under the pinned drawing. */
  function layoutPinned() {
    pinned.dataset.size = size;
    sizeBtn.replaceChildren(icon(size === 'half' ? ICONS.expand : size === 'large' ? ICONS.collapse : ICONS.show));
    const next = size === 'half' ? 'Make the drawing bigger' : size === 'large' ? 'Hide the drawing' : 'Show the drawing';
    sizeBtn.setAttribute('aria-label', next);
    sizeBtn.title = next;
    // With the phone keyboard up there's much less screen: shrink the drawing to leave room for the field.
    const vv = window.visualViewport;
    const vh = vv ? vv.height : window.innerHeight;
    const keyboard = vh < window.innerHeight * 0.8;
    const frac = size === 'large' ? (keyboard ? 0.4 : 0.62) : keyboard ? 0.28 : 0.42;
    svgWrap.style.height = `${Math.round(vh * frac)}px`;
    const topH = bar.offsetHeight;
    pinned.style.top = `${topH}px`;
    document.documentElement.style.scrollPaddingTop = `${topH + pinned.offsetHeight + 8}px`;
  }
  sizeBtn.addEventListener('click', () => {
    size = size === 'half' ? 'large' : size === 'large' ? 'hidden' : 'half';
    savePlanSize(size);
    layoutPinned();
  });
  window.addEventListener('resize', layoutPinned);
  window.visualViewport?.addEventListener('resize', layoutPinned);
  window.addEventListener(
    'hashchange',
    () => {
      window.removeEventListener('resize', layoutPinned);
      window.visualViewport?.removeEventListener('resize', layoutPinned);
      document.documentElement.style.scrollPaddingTop = '';
    },
    { once: true },
  );

  /** Point out the wall or item whose fields you're touching. */
  function trackFocus(e: Event) {
    const t = e.target as Element;
    const wallEl = t.closest('[data-wall]');
    const itemEl = t.closest('[data-item-card]');
    const nextWall = wallEl?.getAttribute('data-wall') ?? (itemEl ? doc.items.find((i) => i.id === itemEl.getAttribute('data-item-card'))?.wallId ?? null : null);
    const nextItem = itemEl?.getAttribute('data-item-card') ?? null;
    if (nextWall === focusWallId && nextItem === focusItemId) return;
    focusWallId = nextWall;
    focusItemId = nextItem;
    renderPlan();
  }
  for (const area of [roomBody, itemsBody]) {
    for (const type of ['focusin', 'pointerdown']) area.addEventListener(type, trackFocus);
  }

  /* ----- rendering ----- */
  function renderTabs() {
    tabs.replaceChildren(
      ...(
        [
          ['existing', 'Existing'],
          ['framing', 'Framing'],
          ['design', 'Design'],
        ] as [PlanView, string][]
      ).map(([v, label]) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': String(v === view),
            onclick: () => {
              view = v;
              renderPlan();
              renderTabs();
            },
          },
          label,
        ),
      ),
    );
  }

  function renderPlan() {
    const g = geom();
    const ws = walls();
    const { checks, zones } = runChecks({ room: g, walls: ws, items: doc.items });
    const F = view === 'framing' && g.closed && !g.problems.length ? framing(g, ws, doc.items) : undefined;
    const hl = focusWallId ? ws.findIndex((w) => w.id === focusWallId) : -1;
    svgWrap.innerHTML = ws.length
      ? drawPlan({ room: g, walls: ws, items: doc.items, view, zones, activeId: dragId ?? focusItemId, framing: F, highlightWall: hl >= 0 ? hl : null })
      : '';
    renderFraming(F, g);
    if (!ws.length) svgWrap.append(h('p', { class: 'empty' }, 'Enter the room below to see the plan.'));
    hint.textContent = HINTS[view];

    checksList.replaceChildren(
      ...(checks.length
        ? checks.map((c) => h('li', {}, h('i', { class: `dot ${c.level}` }), h('span', {}, c.text)))
        : [h('li', {}, h('i', { class: 'dot ok' }), h('span', {}, 'Add fixtures to check clearances.'))]),
    );
    renderCloseStatus(g, ws);
  }

  function table(head: string[], rows: string[][]): HTMLElement {
    return h(
      'table',
      { class: 'schedule' },
      h('thead', {}, h('tr', {}, head.map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))),
    );
  }

  function renderFraming(F: ReturnType<typeof framing> | undefined, g: RoomGeom) {
    framingCard.hidden = view !== 'framing';
    if (view !== 'framing') return;
    if (!F) {
      framingCard.replaceChildren(h('h2', {}, 'Framing'), h('p', { class: 'note' }, 'Close the room to see its framing.'));
      return;
    }
    framingCard.replaceChildren(
      h('h2', {}, 'Rough-in locations'),
      F.rough.length ? table(['Item', 'Wall', 'Location'], F.rough.map((r) => [r.item, r.wall, r.location])) : h('p', { class: 'note' }, 'No fixtures yet.'),
      h('h2', {}, 'Blocking'),
      F.blocking.length
        ? table(['Wall', 'From left corner framing', 'For'], F.blocking.map((b) => [String(b.wall + 1), blockingText(F, b, g), b.label]))
        : h('p', { class: 'note' }, 'None.'),
      h('h2', {}, 'Framing takeoff'),
      table(
        ['Item', 'Quantity'],
        [
          ['Studs', `${F.studs} (all walls, before waste)`],
          ['Plates', `${Math.ceil(F.plate / 12)} ft (bottom + single top)`],
          ...F.headers.map((hd) => [`Header, wall ${hd.wall + 1}`, `${formatInches(hd.width + 3)} long for a ${formatInches(hd.width)} ${hd.type} RO`]),
        ],
      ),
      ...(F.angledCorners
        ? [h('p', { class: 'note' }, 'This room has corners that aren’t square. Their plates are laid out to the framing faces; check those corners by hand.')]
        : []),
    );
  }

  function renderCloseStatus(g: RoomGeom, ws: Wall[]) {
    if (ws.length === 0) {
      closeStatus.textContent = '';
      return;
    }
    const missing = ws.find((w) => !(w.length > 0));
    if (ws.length < 3) closeStatus.textContent = 'Keep adding walls until you are back at the starting corner.';
    else if (missing) closeStatus.textContent = `Wall ${missing.number} needs a length. Or leave the last two blank and tap “Fill in last two walls”.`;
    else if (g.closed) closeStatus.textContent = `The room closes. Floor area ${(g.area / 144).toFixed(1)} sq ft.`;
    else {
      const gap = Math.hypot(g.gap.x, g.gap.y);
      const sq = squareGap(g);
      let t = `The walls miss the starting corner by ${formatInches(gap)}.`;
      if (sq) {
        const parts: string[] = [];
        if (sq.across > 1 / 32) parts.push(`walls running across are off by ${formatInches(sq.across)}`);
        if (sq.upDown > 1 / 32) parts.push(`walls running up and down are off by ${formatInches(sq.upDown)}`);
        t += ` The ${parts.join(', and the ')}. Recheck those, or fill in the last two walls.`;
      }
      closeStatus.textContent = t;
    }
    closeStatus.classList.toggle('bad', ws.length >= 3 && !g.closed && !missing);
  }

  function changed(structural = false) {
    saver.schedule();
    if (structural) renderAll();
    else renderPlan();
  }

  /* ----- room: walls ----- */
  function quickStart(): HTMLElement {
    let a = 0;
    let b = 0;
    return h(
      'div',
      { class: 'stack' },
      h('p', { class: 'muted' }, 'Start in a corner of the room. Wall 1 runs from that corner and is drawn going up.'),
      h(
        'div',
        { class: 'subcard stack' },
        h('h3', {}, 'Rectangle'),
        h('div', { class: 'form-grid' }, feetInches('Wall 1 (and 3)', 0, (v) => (a = v)), feetInches('Wall 2 (and 4)', 0, (v) => (b = v))),
        h(
          'button',
          {
            class: 'btn primary',
            type: 'button',
            onclick: () => {
              if (!(a > 0 && b > 0)) return toast('Enter both lengths.', 'error');
              makeRectangle(doc, room.id, a, b);
              changed(true);
            },
          },
          'Make rectangle',
        ),
      ),
      h(
        'div',
        { class: 'subcard stack' },
        h('h3', {}, 'Any other shape'),
        h('p', { class: 'small muted' }, 'Go around the room from your sketch: each wall’s length, then which way you turn to the next one.'),
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: () => {
              focusNewWall(insertWall(doc, room.id));
            },
          },
          'Walk the room',
        ),
      ),
    );
  }

  function turnControls(w: Wall): HTMLElement {
    const mag = Math.abs(w.turn) || 90;
    const dir = w.turn < 0 ? -1 : 1;
    const kind = w.turn === 90 ? 'right' : w.turn === -90 ? 'left' : 'other';
    const wrap = h(
      'div',
      { class: 'field' },
      h('span', {}, `Then turn to wall ${w.number + 1}`),
      chips(
        `Turn after wall ${w.number}`,
        [
          ['right', 'Right 90°'],
          ['left', 'Left 90°'],
          ['other', 'Other'],
        ],
        kind,
        (v) => {
          w.turn = v === 'right' ? 90 : v === 'left' ? -90 : dir * (mag === 90 ? 45 : mag);
          changed(true);
        },
      ),
    );
    if (kind === 'other') {
      const deg = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: String(mag), 'aria-label': 'Angle in degrees' });
      deg.addEventListener('input', () => {
        const v = Number(deg.value);
        const ok = Number.isFinite(v) && v >= 1 && v <= 135;
        deg.setAttribute('aria-invalid', String(!ok));
        if (ok) {
          w.turn = dir * v;
          changed();
        }
      });
      wrap.append(
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'deg' }, deg, h('span', { class: 'unit' }, '°')),
          chips(
            'Direction',
            [
              [1, 'Right'],
              [-1, 'Left'],
            ],
            dir,
            (d) => {
              w.turn = d * mag;
              changed(true);
            },
          ),
        ),
      );
    }
    return wrap;
  }

  function wallRow(w: Wall, isLast: boolean, closed: boolean): HTMLElement {
    const closing = closingTurn(walls());
    const lastNote = `Then back to the start${Math.abs(closing) > 0.01 ? ` (a ${Math.abs(Math.round(closing * 10) / 10)}° ${closing > 0 ? 'right' : 'left'} turn into wall 1)` : ''}.`;
    return h(
      'div',
      { class: 'wall-row', 'data-wall': w.id },
      h('div', { class: 'wall-num', 'aria-hidden': 'true' }, String(w.number)),
      h(
        'div',
        { class: 'wall-fields' },
        h(
          'div',
          { class: 'wall-top' },
          feetInches(`Wall ${w.number}`, w.length, (v) => {
            w.length = v;
            changed();
          }),
          h(
          'div',
          { class: 'field' },
          h('span', {}, 'Studs'),
          chips<StudSize>(
            `Wall ${w.number} studs`,
            [
              ['2x4', '2×4'],
              ['2x6', '2×6'],
            ],
            w.studSize,
            (v) => {
              w.studSize = v;
              changed(true);
            },
          ),
        ),
        ),
        isLast && closed ? h('p', { class: 'small muted', style: 'margin:0' }, lastNote) : turnControls(w),
      ),
      menuButton(`Wall ${w.number} actions`, [
        {
          label: 'Insert a wall after this one',
          run: () => {
            focusNewWall(insertWall(doc, room.id, w.id));
          },
        },
        {
          label: 'Delete this wall',
          danger: true,
          run: () => {
            const n = doc.items.filter((it) => it.wallId === w.id).length;
            if (n && !confirm(`Wall ${w.number} has ${n} item${n > 1 ? 's' : ''} on it. Delete the wall and ${n > 1 ? 'them' : 'it'}?`)) return;
            deleteWall(doc, w.id);
            changed(true);
          },
        },
      ]),
    );
  }

  function renderRoom() {
    const ws = walls();
    const closed = geom().closed;
    if (!ws.length) {
      roomBody.replaceChildren(quickStart());
      return;
    }
    roomBody.replaceChildren(
      h('p', { class: 'small muted', style: 'margin:0' }, 'Start in a corner. Wall 1 runs from there and is drawn going up. Enter each wall in the order you walk the room.'),
      h('div', { class: 'wall-list' }, ws.map((w, i) => wallRow(w, i === ws.length - 1, closed))),
      closeStatus,
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: () => {
              focusNewWall(insertWall(doc, room.id));
            },
          },
          'Add wall',
        ),
        ws.length >= 3
          ? h(
              'button',
              {
                class: 'btn',
                type: 'button',
                onclick: () => {
                  const last2 = ws.slice(-2);
                  if (last2.some((w) => w.length > 0) && !confirm(`Replace the lengths of walls ${last2[0]!.number} and ${last2[1]!.number}?`)) return;
                  if (!closeRoom(doc, room.id)) {
                    toast('Those walls can’t close the room. Check the turns.', 'error');
                    return;
                  }
                  changed(true);
                },
              },
              'Fill in last two walls',
            )
          : null,
        menuButton('More room actions', [
          {
            label: 'Start over',
            danger: true,
            run: () => {
              if (!confirm('Delete all the walls, and the doors, windows and fixtures on them?')) return;
              for (const w of walls()) deleteWall(doc, w.id);
              changed(true);
            },
          },
        ]),
      ),
      h(
        'div',
        { class: 'form-grid' },
        inchInput('Ceiling height', room.ceilingHeight, (v) => {
          room.ceilingHeight = v;
          saver.schedule();
        }),
      ),
    );
  }

  /* ----- items ----- */
  function itemCard(it: Item & { type: PlanItemType }, ws: Wall[]): HTMLElement {
    const fields = NUMBER_FIELDS[it.type].map((f) =>
      inchInput(f.label, f.get(it), (v) => {
        f.set(it, v);
        changed();
      }, { 'data-item': it.id, 'data-field': f.key }),
    );
    const choiceFields = CHOICE_FIELDS[it.type].map((f) =>
      h(
        'div',
        { class: 'field' },
        h('span', {}, f.label),
        chips(f.label, f.options, f.get(it), (v) => {
          f.set(it, v);
          changed(true);
        }),
      ),
    );
    return h(
      'div',
      { class: 'subcard stack', 'data-item-card': it.id },
      h(
        'div',
        { class: 'row' },
        h('h3', {}, ITEM_NAMES[it.type]),
        h('span', { class: 'spacer' }),
        chips(`${ITEM_NAMES[it.type]} status`, STATUS_OPTIONS, it.status, (v) => {
          it.status = v;
          changed(true);
        }),
      ),
      h(
        'div',
        { class: 'field' },
        h('span', {}, 'Wall'),
        chips(
          `${ITEM_NAMES[it.type]} wall`,
          ws.map((w) => [w.id, String(w.number)] as [string, string]),
          it.wallId,
          (v) => {
            it.wallId = v;
            lastWallId = v;
            changed(true);
          },
        ),
      ),
      h('div', { class: 'form-grid' }, fields, choiceFields),
      h(
        'div',
        { class: 'row' },
        it.status === 'existing'
          ? h(
              'button',
              {
                class: 'btn small-btn',
                type: 'button',
                onclick: () => {
                  const copy: Item = { ...structuredClone(it), id: newId(), status: 'new' };
                  it.status = 'remove';
                  doc.items.push(copy);
                  view = 'design';
                  renderTabs();
                  changed(true);
                },
              },
              'Move it in the design',
            )
          : null,
        h(
          'button',
          {
            class: 'btn small-btn danger',
            type: 'button',
            onclick: () => {
              if (!confirm(`Delete this ${ITEM_NAMES[it.type].toLowerCase()}?`)) return;
              doc.items = doc.items.filter((x) => x !== it);
              changed(true);
            },
          },
          'Delete',
        ),
      ),
    );
  }

  function renderItems() {
    const ws = walls();
    if (!ws.length) {
      itemsBody.replaceChildren(h('p', { class: 'note' }, 'Enter the room first.'));
      return;
    }
    const ids = new Set(ws.map((w) => w.id));
    const list = doc.items.filter((it) => ids.has(it.wallId) && isPlanItem(it)) as (Item & { type: PlanItemType })[];
    itemsBody.replaceChildren(
      h(
        'div',
        { class: 'row' },
        h('span', { class: 'small muted' }, 'Add:'),
        PLAN_ITEM_TYPES.map((t) =>
          h(
            'button',
            {
              class: 'btn small-btn',
              type: 'button',
              onclick: () => {
                const wallId = lastWallId && ids.has(lastWallId) ? lastWallId : ws[0]!.id;
                doc.items.push(newPlanItem(t, wallId, view === 'existing' ? 'existing' : 'new'));
                changed(true);
              },
            },
            ITEM_NAMES[t],
          ),
        ),
      ),
      ...(list.length ? list.map((it) => itemCard(it, ws)) : [h('p', { class: 'note' }, 'Nothing yet. Add the door first, then fixtures.')]),
    );
  }

  /** After adding a wall: show it, and put the cursor in its length. */
  function focusNewWall(w: Wall) {
    focusWallId = w.id;
    focusItemId = null;
    changed(true);
    const input = roomBody.querySelector<HTMLInputElement>(`[data-wall="${w.id}"] input`);
    input?.focus();
    input?.scrollIntoView({ block: 'nearest' });
  }

  function renderAll() {
    renderTabs();
    renderRoom();
    renderItems();
    renderPlan();
    layoutPinned();
  }

  /* ----- tap an item to edit it, or slide it along its wall ----- */
  // A touch that moves less than this many screen pixels is a tap, not a drag.
  const TAP_SLOP = 8;
  let grab = 0;
  let start: { x: number; y: number } | null = null;
  let moved = false;
  const local = (e: PointerEvent, wallIndex: number) => {
    const svg = svgWrap.querySelector('svg');
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return toLocal(geom().walls[wallIndex]!, { x: p.x, y: p.y });
  };
  const itemWall = (it: Item) => walls().findIndex((w) => w.id === it.wallId);

  /** Scroll to an item's fields and put the cursor in its first one. */
  function editItem(it: Item) {
    const card = itemsBody.querySelector<HTMLElement>(`[data-item-card="${it.id}"]`);
    const input = card?.querySelector<HTMLInputElement>('input');
    if (!card || !input) return;
    card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    input.focus({ preventScroll: true });
    input.select();
  }

  svgWrap.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element).closest('[data-id]');
    const it = el && doc.items.find((x) => x.id === el.getAttribute('data-id'));
    if (!it) return;
    const p = local(e, itemWall(it));
    if (!p) return;
    dragId = it.id;
    focusItemId = it.id;
    focusWallId = it.wallId;
    grab = p.x - it.position;
    start = { x: e.clientX, y: e.clientY };
    moved = false;
    svgWrap.setPointerCapture(e.pointerId);
    e.preventDefault();
    renderPlan();
  });
  svgWrap.addEventListener('pointermove', (e) => {
    if (!dragId || !start) return;
    if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < TAP_SLOP) return;
    moved = true;
    const it = doc.items.find((x) => x.id === dragId);
    if (!it) return;
    const k = itemWall(it);
    const p = local(e, k);
    if (!p) return;
    const len = geom().walls[k]!.length;
    let pos = Math.round((p.x - grab) * 4) / 4;
    pos = Math.min(Math.max(pos, 0), Math.max(0, len - it.width));
    if (pos === it.position) return;
    it.position = pos;
    // Keep the matching input in step.
    const field = NUMBER_FIELDS[it.type as PlanItemType]?.[0];
    const input = itemsBody.querySelector<HTMLInputElement>(`input[data-item="${it.id}"][data-field="${field?.key}"]`);
    if (input && field) input.value = inchText(field.get(it));
    renderPlan();
  });
  const endDrag = (e: PointerEvent) => {
    if (!dragId) return;
    const it = doc.items.find((x) => x.id === dragId);
    const wasTap = !moved && e.type === 'pointerup';
    dragId = null;
    start = null;
    if (moved) saver.schedule();
    renderPlan();
    if (wasTap && it) editItem(it);
  };
  svgWrap.addEventListener('pointerup', endDrag);
  svgWrap.addEventListener('pointercancel', endDrag);

  renderAll();
}
