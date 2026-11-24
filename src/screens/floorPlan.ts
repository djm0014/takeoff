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
import { h, menuButton, toast } from '../lib/dom';
import { formatInches, parseInches } from '../lib/inches';
import { runChecks } from '../plan/checks';
import { drawPlan, type PlanView } from '../plan/draw';
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
};

const STATUS_OPTIONS: [ItemStatus, string][] = [
  ['existing', 'Existing'],
  ['new', 'New'],
  ['remove', 'Remove'],
];

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

  const main = h(
    'main',
    { class: 'stack' },
    h('div', { class: 'row' }, tabs, h('span', { class: 'spacer' }), savedNote),
    h('section', { class: 'card plan-card' }, svgWrap, hint),
    h('section', { class: 'card stack' }, h('h2', {}, 'Checks'), checksList),
    h('section', { class: 'card stack' }, h('h2', {}, 'Room'), roomBody),
    h('section', { class: 'card stack' }, h('h2', {}, 'Doors, windows, fixtures'), itemsBody),
  );
  root.replaceChildren(topbar(doc.job.name, { back: href({ name: 'job', jobId }) }), main);

  /* ----- rendering ----- */
  function renderTabs() {
    tabs.replaceChildren(
      ...(
        [
          ['existing', 'Existing'],
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
    svgWrap.innerHTML = ws.length ? drawPlan({ room: g, walls: ws, items: doc.items, view, zones, activeId: dragId }) : '';
    if (!ws.length) svgWrap.append(h('p', { class: 'empty' }, 'Enter the room below to see the plan.'));
    hint.textContent = HINTS[view];

    checksList.replaceChildren(
      ...(checks.length
        ? checks.map((c) => h('li', {}, h('i', { class: `dot ${c.level}` }), h('span', {}, c.text)))
        : [h('li', {}, h('i', { class: 'dot ok' }), h('span', {}, 'Add fixtures to check clearances.'))]),
    );
    renderCloseStatus(g, ws);
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
              insertWall(doc, room.id);
              changed(true);
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
      { class: 'wall-row' },
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
            insertWall(doc, room.id, w.id);
            changed(true);
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
              insertWall(doc, room.id);
              changed(true);
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
      { class: 'subcard stack' },
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

  function renderAll() {
    renderTabs();
    renderRoom();
    renderItems();
    renderPlan();
  }

  /* ----- drag along a wall ----- */
  let grab = 0;
  const local = (e: PointerEvent, wallIndex: number) => {
    const svg = svgWrap.querySelector('svg');
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return toLocal(geom().walls[wallIndex]!, { x: p.x, y: p.y });
  };
  const itemWall = (it: Item) => walls().findIndex((w) => w.id === it.wallId);

  svgWrap.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element).closest('[data-id]');
    const it = el && doc.items.find((x) => x.id === el.getAttribute('data-id'));
    if (!it) return;
    const p = local(e, itemWall(it));
    if (!p) return;
    dragId = it.id;
    grab = p.x - it.position;
    svgWrap.setPointerCapture(e.pointerId);
    e.preventDefault();
    renderPlan();
  });
  svgWrap.addEventListener('pointermove', (e) => {
    if (!dragId) return;
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
  const endDrag = () => {
    if (!dragId) return;
    dragId = null;
    saver.schedule();
    renderPlan();
  };
  svgWrap.addEventListener('pointerup', endDrag);
  svgWrap.addEventListener('pointercancel', endDrag);

  renderAll();
}
