/**
 * Connects the vanity wall's settings to the shared job record, so a
 * measurement lives in one place:
 *
 * - wall width and ceiling come from the floor plan (read only here)
 * - studs, finish, open or finished, first stud: the wall record (shared with framing)
 * - "who is this bathroom for": the job's preset
 * - the toilet: the floor plan's toilet on this wall (heights kept on it)
 * - the vanity's width, depth and place: the floor plan's vanity item
 *
 * Moving the vanity in the floor plan makes the vanity screen use that spot
 * ("Set from left"); centering it on the vanity screen moves it in the plan.
 */
import type { Id, Item, JobDoc, Preset, StudSize, Wall } from '../data/model';
import { formatInches, parseInches } from '../lib/inches';
import { TOILET_REACH, newPlanItem } from '../plan/items';
import { STUD_DEPTH } from '../plan/room';
import { DEF, PRESETS, PRESET_KEYS, type VanityD } from './settings';
import { solve } from './solve';

const fmtN = (v: number) => formatInches(v, { mark: false });
const num = (s: string | undefined): number | null => parseInches(String(s ?? ''));

/** Keys whose values come from elsewhere on the record and aren't stored with the settings. */
const DERIVED = ['wall', 'ceil', 'studd', 'wfin', 'wallc', 'stud', 'wc', 'wcx', 'wcri', 'wcmove', 'wcseat', 'wct', 'wch', 'wcs', 'qtoilet'];

/** Toilet heights kept on the toilet item, by setting key. */
const TOILET_PROPS: Record<string, string> = { wcseat: 'seat', wct: 'tankTop', wch: 'supplyHeight', wcs: 'supplyOffset' };

const pick = (items: Item[]) => items.find((i) => i.status === 'new') ?? items[0] ?? null;
export const vanityItemOf = (doc: JobDoc, wallId: Id): Item | null =>
  pick(doc.items.filter((i) => i.wallId === wallId && i.type === 'vanity' && i.status !== 'remove'));
export const toiletItemOf = (doc: JobDoc, wallId: Id): Item | null =>
  pick(doc.items.filter((i) => i.wallId === wallId && i.type === 'toilet' && i.status !== 'remove'));

function wallAndRoom(doc: JobDoc, wallId: Id) {
  const wall = doc.walls.find((w) => w.id === wallId);
  if (!wall) throw new Error('Wall not found.');
  const room = doc.rooms.find((r) => r.id === wall.roomId);
  return { wall, ceiling: room?.ceilingHeight ?? 96 };
}

/** The vanity settings for a wall, with everything shared filled in from the record. */
export function readVanity(doc: JobDoc, wallId: Id): VanityD {
  const { wall, ceiling } = wallAndRoom(doc, wallId);
  const stored = wall.vanity ?? null;
  const D: VanityD = { ...DEF, ...(stored ?? {}) };
  const jobKey = PRESET_KEYS[doc.job.preset] ?? 'std';

  D.wall = fmtN(wall.length);
  D.ceil = fmtN(ceiling);
  D.studd = String(STUD_DEPTH[wall.studSize]);
  D.wfin = fmtN(wall.finishThickness);
  D.wallc = wall.open ? 'open' : 'closed';
  D.stud = wall.firstStud === null ? '' : fmtN(wall.firstStud);

  const t = toiletItemOf(doc, wallId);
  if (t) {
    const ri = typeof t.props.roughIn === 'number' ? t.props.roughIn : 12;
    D.wc = 'left';
    D.wcx = fmtN(t.position + t.width / 2);
    D.wcri = fmtN(ri);
    D.wcmove = t.props.flange === 'move' || t.props.flange === 'keep' ? t.props.flange : t.status === 'new' ? 'move' : 'keep';
    for (const [k, prop] of Object.entries(TOILET_PROPS)) {
      const v = t.props[prop];
      if (typeof v === 'number') D[k] = fmtN(v);
    }
  } else D.wc = 'none';

  // A preset picked on the job (or never applied here) sets its starting heights, like picking it in the old tool.
  if (!stored || stored.preset !== jobKey) {
    Object.assign(D, PRESETS[jobKey]);
    D.preset = jobKey;
  }

  const v = vanityItemOf(doc, wallId);
  if (v) {
    if (D.sink === 'ped') {
      D.pw = fmtN(v.width);
      D.pd = fmtN(v.depth);
    } else {
      D.vw = fmtN(v.width);
      D.vd = fmtN(v.depth);
    }
    // Moved in the floor plan since: use that spot.
    const R = solve(D);
    if (Math.abs(R.x0 - v.position) > 1 / 32) {
      D.vpos = 'left';
      D.voff = fmtN(v.position);
    }
  }
  return D;
}

/** Save vanity settings, writing shared values back where they live. */
export function writeVanity(doc: JobDoc, wallId: Id, D: VanityD): void {
  const { wall } = wallAndRoom(doc, wallId);
  const keep: VanityD = {};
  for (const [k, val] of Object.entries(D)) if (!DERIVED.includes(k)) keep[k] = val;
  wall.vanity = keep;

  const studd = num(D.studd);
  const size = (Object.keys(STUD_DEPTH) as StudSize[]).find((s) => studd !== null && Math.abs(STUD_DEPTH[s] - studd) < 0.01);
  if (size) wall.studSize = size;
  const fin = num(D.wfin);
  if (fin !== null && fin >= 0) wall.finishThickness = fin;
  wall.open = D.wallc !== 'closed';
  wall.firstStud = num(D.stud);

  const preset = (Object.keys(PRESET_KEYS) as Preset[]).find((p) => PRESET_KEYS[p] === D.preset);
  if (preset) doc.job.preset = preset;

  const t = toiletItemOf(doc, wallId);
  if (t) {
    const c = num(D.wcx);
    if (c !== null) t.position = c - t.width / 2;
    const ri = num(D.wcri);
    if (ri !== null && ri > 0) {
      t.props.roughIn = ri;
      t.depth = ri + TOILET_REACH;
    }
    if (D.wcmove === 'move' || D.wcmove === 'keep') t.props.flange = D.wcmove;
    for (const [k, prop] of Object.entries(TOILET_PROPS)) {
      const v = num(D[k]);
      if (v !== null) t.props[prop] = v;
    }
  }

  const v = vanityItemOf(doc, wallId);
  if (v) {
    const R = solve(D);
    v.position = R.x0;
    v.width = R.vw;
    const dep = num(D.sink === 'ped' ? D.pd : D.vd);
    if (dep !== null && dep > 0) v.depth = dep;
  }
}

/** Put a new vanity on a wall, centered, and start its settings. */
export function addVanity(doc: JobDoc, wall: Wall): Item {
  const D = readVanity(doc, wall.id);
  const it = newPlanItem('vanity', wall.id, 'new');
  it.width = num(D.vw) ?? 36;
  it.depth = num(D.vd) ?? 21;
  it.position = Math.max(0, Math.round(((wall.length - it.width) / 2) * 16) / 16);
  doc.items.push(it);
  writeVanity(doc, wall.id, { ...readVanity(doc, wall.id), vpos: 'center' });
  return it;
}
