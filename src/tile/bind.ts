/**
 * Connects the tile tab's settings to the shared job record, so a
 * measurement lives in one place:
 *
 * - wall width, stud to stud: the floor plan's wall length plus the framing
 *   offset at each corner (the floor plan frames 1/2″ behind the finished face)
 * - ceiling: the room's ceiling height (the right end of a sloped ceiling is
 *   kept with the tile settings)
 * - the tub: the floor plan's tub on this wall, or a tub on the next wall whose
 *   end is in this wall's corner (an end wall of a tub alcove). Its length and
 *   where it sits come from the plan; its height is kept on the tub item.
 * - stud depth and the first stud: the wall record (shared with the vanity wall)
 * - the build-up (board + thinset + tile) is the wall's finish thickness
 *
 * Everything else is kept on the wall's tile layout. Tile size and grout are
 * its tileWidth / tileHeight / grout; the rest, with the results screen's
 * choices (option, course moves, view), is in tileLayout.settings.
 */
import type { Id, Item, JobDoc, StudSize, TileLayout, Wall } from '../data/model';
import { frameWalls } from '../plan/framing';
import { geometry, roomWalls, STUD_DEPTH } from '../plan/room';
import { DEF, IN_KEYS, fromSaved, normalize, type TileS } from './settings';
import { bu, isPlain, layout, NO_ADJ, type Adjust } from './solve';

/** Results-screen choices kept with the settings. */
export interface TileUI extends Adjust {
  /** Setup step showing; the last step is the results. */
  cur: number;
  optIdx: number;
  view: 'tile' | 'present' | 'frame' | 'draw';
  sheet: 'a1' | 'a2';
  presIn: 'hide' | 'show';
  /** The look last applied ('' for none), and a fingerprint of the layout it gave, to tell when it's been modified. */
  look: string;
  lookKey: string;
  /** Niche shape the looks use ('' = from the answers), and the one the applied look used. */
  shape: string;
  lookShape: string;
  /** What the style's layout was worked out from, to know when to put it on the wall again. */
  lookBase: string;
}
export const UI0: TileUI = { cur: 0, optIdx: 0, ...NO_ADJ, view: 'tile', sheet: 'a1', presIn: 'hide', look: '', lookKey: '', shape: '', lookShape: '', lookBase: '' };

/** Where the wall's shared numbers came from, for the screen to explain. */
export interface TileSource {
  /** Floor plan length (finished). */
  length: number;
  /** Framing at the left corner, measured from the finished corner (1/2″ at a square inside corner). */
  offL: number;
  /** The tub this wall's tile sits on: on this wall, or the end of one on the wall to the left or right. */
  tub: { item: Item; on: 'this' | 'left' | 'right' } | null;
}

/** Values that come from elsewhere on the record and aren't kept in the settings. */
const DERIVED = ['wallW', 'ceilL', 'base', 'tubPos', 'tubL', 'tubH', 'studD', 'widthRef', 'stud1', 'tileW', 'tileH', 'grout'];
const UI_KEYS = Object.keys(UI0) as (keyof TileUI)[];

const live = (i: Item) => i.status !== 'remove';
const pick = (items: Item[]) => items.find((i) => i.status === 'new') ?? items[0] ?? null;

function context(doc: JobDoc, wallId: Id) {
  const wall = doc.walls.find((w) => w.id === wallId);
  if (!wall) throw new Error('Wall not found.');
  const room = doc.rooms.find((r) => r.id === wall.roomId);
  const walls = room ? roomWalls(doc, room.id) : [wall];
  const k = walls.findIndex((w) => w.id === wallId);
  let offL = 0.5;
  let offR = 0.5;
  let leftWall: Wall | null = null;
  let rightWall: Wall | null = null;
  if (room && walls.length >= 3) {
    try {
      const g = geometry(doc, room.id);
      const f = frameWalls(g, walls, doc.items)[k];
      const wg = g.walls[k];
      if (f && wg) {
        offL = -f.leftFraming;
        offR = f.rightFraming - wall.length;
        if (wg.leftCorner === 'inside') leftWall = walls[wg.leftNeighbor] ?? null;
        if (wg.rightCorner === 'inside') rightWall = walls[wg.rightNeighbor] ?? null;
      }
    } catch {
      /* room not drawable yet: square corners assumed */
    }
  }
  // A tub on this wall, or one on the next wall with an end in this corner.
  const tubsOn = (w: Wall) => doc.items.filter((i) => i.wallId === w.id && i.type === 'tub' && live(i));
  let tub: TileSource['tub'] = null;
  const own = pick(tubsOn(wall));
  if (own) tub = { item: own, on: 'this' };
  else {
    const atRightEnd = leftWall ? pick(tubsOn(leftWall).filter((t) => t.position + t.width >= leftWall!.length - 1)) : null;
    const atLeftEnd = rightWall ? pick(tubsOn(rightWall).filter((t) => t.position <= 1)) : null;
    if (atRightEnd) tub = { item: atRightEnd, on: 'left' };
    else if (atLeftEnd) tub = { item: atLeftEnd, on: 'right' };
  }
  return { wall, ceiling: room?.ceilingHeight ?? 96, src: { length: wall.length, offL, tub } as TileSource, studToStud: wall.length + offL + offR };
}

/** The tile settings and screen choices for a wall, with shared values filled in from the record. */
export function readTile(doc: JobDoc, wallId: Id): { S: TileS; ui: TileUI; src: TileSource } {
  const { wall, ceiling, src, studToStud } = context(doc, wallId);
  const tl = wall.tileLayout;
  const saved = (tl?.settings ?? {}) as Record<string, unknown>;
  const S = fromSaved(saved);
  // Walls laid out before the style question: no style until it's picked (their layout stays as it was).
  if (tl && saved.style === undefined) S.style = '';
  // Walls saved before "How is the niche built?": an already-framed niche means between existing studs (owner, Nov 28).
  if (saved.build === undefined && S.framed) {
    if (S.framed === 'yes') {
      S.framed = 'no';
      S.studs = 'bay';
      if (typeof saved.bayL !== 'number') S.bayL = S.rLeft;
    }
    S.build = S.studs === 'bay' ? 'bay' : 'new';
  }
  if (tl) {
    S.tileW = tl.tileWidth;
    S.tileH = tl.tileHeight;
    S.grout = tl.grout;
  }
  S.widthRef = 'framing';
  S.wallW = Math.round(studToStud * 16) / 16;
  S.ceilL = ceiling;
  if (S.ceilLevel) S.ceilR = ceiling;
  S.studD = STUD_DEPTH[wall.studSize];
  if (wall.firstStud !== null) S.stud1 = Math.round((wall.firstStud + src.offL) * 16) / 16;

  const t = src.tub;
  if (t) {
    S.base = 'tub';
    S.tubH = typeof t.item.height === 'number' ? t.item.height : DEF.tubH;
    if (t.on === 'this') {
      const touchL = t.item.position <= 1;
      const touchR = t.item.position + t.item.width >= wall.length - 1;
      S.tubPos = touchL && touchR ? 'full' : touchL ? 'left' : touchR ? 'right' : 'center';
      S.tubL = t.item.width;
    } else {
      // An end wall: the tub's depth, from the corner.
      S.tubPos = t.on === 'left' ? 'left' : 'right';
      S.tubL = t.item.depth;
    }
  } else S.base = 'floor';
  normalize(S);

  const ui: TileUI = { ...UI0 };
  const u = ui as unknown as Record<string, unknown>;
  for (const k of UI_KEYS) if (typeof saved[k] === typeof UI0[k]) u[k] = saved[k];
  return { S, ui, src };
}

/** Save tile settings, writing shared values back where they live. */
export function writeTile(doc: JobDoc, wallId: Id, S: TileS, ui: TileUI): void {
  const { wall, src } = context(doc, wallId);
  const settings: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(S)) if (!DERIVED.includes(k) && !k.startsWith('_')) settings[k] = v;
  for (const k of UI_KEYS) settings[k] = ui[k];

  // The solved niche, kept for takeoffs and other screens (recomputed on every save).
  let niche: TileLayout['niche'] = null;
  if (!isPlain(S) && S.framed) {
    const L = layout(S, ui.optIdx, ui);
    if (L && !L.r.plain) niche = { width: L.r.h.w, height: L.r.hF, sill: L.r.sF, shelves: L.r.int.shelves.length };
  }
  wall.tileLayout = { tileWidth: S.tileW, tileHeight: S.tileH, grout: S.grout, niche, settings };

  const size = (Object.keys(STUD_DEPTH) as StudSize[]).find((s) => Math.abs(STUD_DEPTH[s] - S.studD) < 0.01);
  if (size && STUD_DEPTH[wall.studSize] !== S.studD) wall.studSize = size;
  wall.finishThickness = bu(S);
  if (S.framing === 'existing' && S.studMode === 'oc') wall.firstStud = Math.round((S.stud1 - src.offL) * 16) / 16;
  if (src.tub && S.base === 'tub') src.tub.item.height = S.tubH;
}

/** IN keys that only change how the result is drawn, not the options (changing them keeps the option and course moves). */
export const DRAW_ONLY = IN_KEYS.filter((k) => k !== 'shelfPos') as string[];
