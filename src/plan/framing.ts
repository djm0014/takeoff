/**
 * Framing for the design: stud layout, rough-in locations, blocking and a
 * framing takeoff. Same rules as the old Bathroom Floor Plan tool:
 *
 * - framing sits 1/2″ behind the finished face
 * - studs 16″ on center from the left end of each wall's plate
 * - single top plate; king and jack studs each side of a door or window
 * - door rough openings 1/2″ wider than the door's opening
 *
 * At each corner one wall's plate runs through and the other butts into it.
 * Even-numbered walls run through (on a rectangle that matches the old tool).
 * Angled corners are laid out at the framing faces and flagged to check by hand.
 */
import type { Item, Wall } from '../data/model';
import { formatInches } from '../lib/inches';
import { toLocal, type Pt, type RoomGeom, type WallGeom } from './geometry';
import { isOpening, roughIn, span, toiletCenter } from './items';
import { STUD_DEPTH } from './room';

export const DRYWALL = 0.5;
export const STUD = 1.5;
export const OC = 16;

const fmt = (v: number) => formatInches(v);

export interface RoughOpening {
  a: number;
  b: number;
  item: Item;
}

export interface WallFraming {
  wall: number;
  /** Stud depth. */
  depth: number;
  /** Plate from u0 to u1, in the wall's local frame. */
  u0: number;
  u1: number;
  /** Stud spans [a, b] along the wall. */
  studs: [number, number][];
  openings: RoughOpening[];
  /** Distance along the wall from the finished left corner to the framing at that corner. */
  leftFraming: number;
  /** The same at the right corner. */
  rightFraming: number;
  /** True when one of the wall's corners isn't square. */
  angled: boolean;
}

export interface RoughIn {
  item: string;
  wall: string;
  location: string;
}

export interface Blocking {
  /** Wall index, or -1 when described in words. */
  wall: number;
  a: number;
  b: number;
  label: string;
  /** Location as text, when not a span on one wall. */
  where?: string;
}

export interface Mark {
  wall: number;
  u: number;
  v: number;
  kind: 'x' | 'valve' | 'drain';
}

export interface Framing {
  walls: WallFraming[];
  rough: RoughIn[];
  blocking: Blocking[];
  marks: Mark[];
  studs: number;
  /** Plate length in inches, bottom plus single top. */
  plate: number;
  headers: { wall: number; type: string; width: number }[];
  angledCorners: boolean;
}

const isSquare = (w: WallGeom, n: WallGeom) => Math.abs(w.dirU.x * n.dirU.x + w.dirU.y * n.dirU.y) < 1e-6;

/** Does wall i's plate run through the corner it shares with wall j? */
function runsThrough(i: number, j: number, n: number): boolean {
  const evenI = (i + 1) % 2 === 0;
  const evenJ = (j + 1) % 2 === 0;
  if (evenI !== evenJ) return evenI;
  // Both odd: only at the corner between the last wall and wall 1 of an odd walk.
  return i === n - 1;
}

/**
 * Where this wall's framing face meets its neighbour's at one end, measured
 * along this wall. For a square inside corner that's -1/2″ (left end) or
 * length + 1/2″ (right end).
 */
function framingCorner(w: WallGeom, nb: WallGeom, end: 'left' | 'right'): number {
  // Our framing face: v = -DRYWALL. Neighbour's framing face is its inside face moved 1/2″ out.
  const off = (g: WallGeom): [Pt, Pt] => {
    const p = { x: g.left.x - g.dirV.x * DRYWALL, y: g.left.y - g.dirV.y * DRYWALL };
    return [p, g.dirU];
  };
  const [p, d] = off(w);
  const [q, e] = off(nb);
  const den = d.x * e.y - d.y * e.x;
  if (Math.abs(den) < 1e-9) return end === 'left' ? -DRYWALL : w.length + DRYWALL;
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / den;
  const hit = { x: p.x + d.x * t, y: p.y + d.y * t };
  return toLocal(w, hit).x;
}

export function frameWalls(room: RoomGeom, walls: Wall[], items: Item[]): WallFraming[] {
  const n = room.walls.length;
  return room.walls.map((w, k) => {
    const depth = STUD_DEPTH[walls[k]!.studSize];
    const L = room.walls[w.leftNeighbor]!;
    const Rn = room.walls[w.rightNeighbor]!;
    const dL = STUD_DEPTH[walls[w.leftNeighbor]!.studSize];
    const dR = STUD_DEPTH[walls[w.rightNeighbor]!.studSize];
    const cL = framingCorner(w, L, 'left');
    const cR = framingCorner(w, Rn, 'right');
    const thruL = runsThrough(k, w.leftNeighbor, n);
    const thruR = runsThrough(k, w.rightNeighbor, n);
    const sqL = isSquare(w, L);
    const sqR = isSquare(w, Rn);

    // Plate ends: an inside corner's through-wall reaches past the neighbour's framing;
    // an outside corner's butting wall stops at the neighbour's framing.
    let u0 = cL;
    let u1 = cR;
    if (sqL) {
      if (w.leftCorner === 'inside' && thruL) u0 = cL - dL;
      if (w.leftCorner === 'outside' && !thruL) u0 = cL + dL;
    }
    if (sqR) {
      if (w.rightCorner === 'inside' && thruR) u1 = cR + dR;
      if (w.rightCorner === 'outside' && !thruR) u1 = cR - dR;
    }

    const openings: RoughOpening[] = items
      .filter((it) => it.wallId === walls[k]!.id && isOpening(it) && it.status !== 'remove')
      .map((it) => {
        const [a, b] = span(it);
        return it.type === 'door' ? { a: a - 0.25, b: b + 0.25, item: it } : { a, b, item: it };
      })
      .sort((p, q) => p.a - q.a);

    const sp: [number, number][] = [
      [u0, u0 + STUD],
      [u1 - STUD, u1],
    ];
    // Backing stud where a butting wall lands on this one at an inside corner.
    if (thruL && sqL && w.leftCorner === 'inside') sp.push([cL, cL + STUD]);
    if (thruR && sqR && w.rightCorner === 'inside') sp.push([cR - STUD, cR]);
    for (const r of openings) sp.push([r.a - 3, r.a - 1.5], [r.a - 1.5, r.a], [r.b, r.b + 1.5], [r.b + 1.5, r.b + 3]);
    const over = (x: [number, number]) => sp.some((s) => x[0] < s[1] - 0.01 && x[1] > s[0] + 0.01);
    const inRO = (x: [number, number]) => openings.some((r) => x[0] < r.b + 3 && x[1] > r.a - 3);
    const studs = [...sp];
    for (let i = 1; i < 400; i++) {
      const c = u0 + OC * i;
      if (c + 0.75 > u1 - STUD) break;
      const st: [number, number] = [c - 0.75, c + 0.75];
      if (!over(st) && !inRO(st)) studs.push(st);
    }
    studs.sort((p, q) => p[0] - q[0]);
    return { wall: k, depth, u0, u1, studs, openings, leftFraming: cL, rightFraming: cR, angled: !sqL || !sqR };
  });
}

export function framing(room: RoomGeom, walls: Wall[], items: Item[]): Framing {
  const fw = frameWalls(room, walls, items);
  const idx = new Map(walls.map((w, i) => [w.id, i]));
  const active = items.filter((it) => it.status !== 'remove' && idx.has(it.wallId));
  const rough: RoughIn[] = [];
  const blocking: Blocking[] = [];
  const marks: Mark[] = [];
  const num = (k: number) => String(k + 1);

  for (const it of active) {
    const k = idx.get(it.wallId)!;
    const w = room.walls[k]!;
    const f = fw[k]!;
    const s = span(it);
    const fromLeft = (u: number) => fmt(u - f.leftFraming);
    if (it.type === 'toilet') {
      const c = toiletCenter(it);
      const ri = roughIn(it);
      rough.push({ item: 'Toilet flange', wall: num(k), location: `${fmt(ri + DRYWALL)} off back framing · ${fromLeft(c)} from left corner framing` });
      marks.push({ wall: k, u: c, v: ri, kind: 'x' });
    }
    if (it.type === 'vanity') {
      const c = (s[0] + s[1]) / 2;
      rough.push({ item: 'Vanity drain & supplies', wall: num(k), location: `centered ${fromLeft(c)} from left corner framing` });
      marks.push({ wall: k, u: c, v: 2, kind: 'x' });
      blocking.push({ wall: k, a: s[0], b: s[1], label: 'Vanity and mirror backing' });
    }
    if (it.type === 'tub' || it.type === 'shower') {
      const dep = s[3];
      blocking.push({ wall: k, a: s[0], b: s[1], label: 'Grab bar blocking, 33–36″ AFF' });
      // An end against a wall: the fixture reaches the corner, and that corner is a square inside corner.
      const endWall = (side: 'left' | 'right') => {
        const touches = side === 'left' ? s[0] < 0.5 : s[1] > w.length - 0.5;
        const corner = side === 'left' ? w.leftCorner : w.rightCorner;
        const nb = room.walls[side === 'left' ? w.leftNeighbor : w.rightNeighbor]!;
        return touches && corner === 'inside' && isSquare(w, nb) ? nb : null;
      };
      const L = endWall('left');
      const Rr = endWall('right');
      const drainRight = it.props.drain === 'right';
      if (L) blocking.push({ wall: L.index, a: L.length - dep, b: L.length, label: 'Grab bar blocking' + (it.type === 'tub' && !drainRight ? ' + valve' : '') });
      if (Rr) blocking.push({ wall: Rr.index, a: 0, b: dep, label: 'Grab bar blocking' + (it.type === 'tub' && drainRight ? ' + valve' : '') });
      if (it.type === 'tub') {
        const end = drainRight ? 'right' : 'left';
        const du = drainRight ? s[1] : s[0];
        const valveWall = drainRight ? Rr : L;
        rough.push({ item: 'Tub drain', wall: num(k), location: `${end} end · ${fmt(dep / 2 + DRYWALL)} off back framing (check tub spec)` });
        if (valveWall) {
          rough.push({ item: 'Tub/shower valve', wall: num(valveWall.index), location: `${fmt(dep / 2 + DRYWALL)} from the tub wall framing, on the drain centerline` });
          marks.push({ wall: k, u: du, v: dep / 2, kind: 'valve' });
        } else {
          rough.push({ item: 'Tub/shower valve', wall: num(k), location: 'tub end is not against a wall: set the valve location by hand' });
        }
        marks.push({ wall: k, u: drainRight ? du - 7 : du + 7, v: dep / 2, kind: 'drain' });
      } else {
        const c = (s[0] + s[1]) / 2;
        rough.push({ item: 'Shower drain', wall: num(k), location: `${fmt(dep / 2 + DRYWALL)} off back framing · ${fromLeft(c)} from left corner framing` });
        marks.push({ wall: k, u: c, v: dep / 2, kind: 'drain' });
      }
    }
  }

  let studs = 0;
  let plate = 0;
  const headers: Framing['headers'] = [];
  for (const f of fw) {
    studs += f.studs.length;
    plate += 2 * (f.u1 - f.u0);
    for (const r of f.openings) {
      if (r.item.type === 'door') plate -= r.b - r.a;
      headers.push({ wall: f.wall, type: r.item.type, width: r.b - r.a });
    }
  }
  return { walls: fw, rough, blocking, marks, studs, plate, headers, angledCorners: fw.some((f) => f.angled) };
}

/** Blocking location as the schedule shows it: from the left corner framing. */
export function blockingText(f: Framing, b: Blocking, room: RoomGeom): string {
  if (b.where) return b.where;
  const w = room.walls[b.wall]!;
  const left = f.walls[b.wall]!.leftFraming;
  return `${fmt(Math.max(0, b.a) - left)} to ${fmt(Math.min(w.length, b.b) - left)}`;
}
