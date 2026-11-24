/**
 * Floor plan checks: clearances, overlaps and door swings, for a room of any
 * shape. Same checks and wording as the old Bathroom Floor Plan tool, which
 * only handled rectangles.
 *
 * Everything is worked out in one wall's local frame (u along the wall from its
 * left corner, v into the room). Other fixtures and the room's own walls block
 * parts of a clear-floor zone; the zone passes if a wide enough stretch is clear.
 */
import type { Id, Item, Wall } from '../data/model';
import { formatInches } from '../lib/inches';
import { toLocal, toPlan, type Pt, type RoomGeom, type WallGeom } from './geometry';
import { doorSize, isFixture, itemName, span, toiletCenter } from './items';
import { PLAN_RULES as R } from './rules';

export type Level = 'ok' | 'warn' | 'bad';

export interface Check {
  level: Level;
  text: string;
  itemIds: Id[];
}

/** A clear-floor zone to shade on the drawing, in the wall's local frame. */
export interface Zone {
  wall: number;
  a: number;
  b: number;
  v0: number;
  v1: number;
  ok: boolean;
}

export interface PlanContext {
  room: RoomGeom;
  /** Walls in walk order, matching room.walls. */
  walls: Wall[];
  items: Item[];
}

const fmt = (v: number) => formatInches(v);
const TOL = 0.01;

interface Obstacle {
  item: Item;
  wall: number;
  name: string;
  full: string;
  poly: Pt[];
}

/** Keep the part of a polygon where f(p) >= 0 (f linear). */
function clip(poly: Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) out.push(a);
    if (fa >= 0 !== fb >= 0) {
      const t = fa / (fa - fb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** u-extent of a local polygon within the band v0 < v < v1, or null. */
function bandU(local: Pt[], v0: number, v1: number): [number, number] | null {
  let p = clip(local, (q) => q.y - v0);
  p = clip(p, (q) => v1 - q.y);
  if (p.length < 3) return null;
  const vs = p.map((q) => q.y);
  if (Math.max(...vs) - Math.min(...vs) < 1e-6) return null;
  const us = p.map((q) => q.x);
  return [Math.min(...us), Math.max(...us)];
}

/** u-extent of a local segment within the band v0 < v < v1, or null. */
function segBandU(a: Pt, b: Pt, v0: number, v1: number): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dv = b.y - a.y;
  for (const [lim, sign] of [
    [v0, 1],
    [v1, -1],
  ] as const) {
    // keep sign*(v - lim) > 0
    const f0 = sign * (a.y - lim);
    const df = sign * dv;
    if (Math.abs(df) < 1e-12) {
      if (f0 <= 0) return null;
      continue;
    }
    const t = -f0 / df;
    if (df > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
  }
  if (t1 - t0 < 1e-9) return null;
  const u0 = a.x + (b.x - a.x) * t0;
  const u1 = a.x + (b.x - a.x) * t1;
  return [Math.min(u0, u1), Math.max(u0, u1)];
}

/** Widest clear stretch of [a, b] after removing the blocked intervals. */
function widestGap(a: number, b: number, blocked: [number, number][]): number {
  const bl = blocked
    .map(([x0, x1]) => [Math.max(a, x0), Math.min(b, x1)] as [number, number])
    .filter(([x0, x1]) => x1 > x0)
    .sort((p, q) => p[0] - q[0]);
  let cur = a;
  let best = 0;
  for (const [x0, x1] of bl) {
    best = Math.max(best, x0 - cur);
    cur = Math.max(cur, x1);
  }
  return Math.max(best, b - cur);
}

function distPointSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function insideConvex(p: Pt, poly: Pt[]): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const c = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (Math.abs(c) < 1e-12) continue;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

function distPointPoly(p: Pt, poly: Pt[]): number {
  if (poly.length >= 3 && insideConvex(p, poly)) return 0;
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distPointSeg(p, poly[i]!, poly[(i + 1) % poly.length]!));
  return d;
}

/** Do two convex polygons overlap by more than `tol` in every direction? */
function overlaps(p: Pt[], q: Pt[], tol: number): boolean {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1e-9) continue;
      const ax = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
      const proj = (s: Pt[]) => s.map((v) => v.x * ax.x + v.y * ax.y);
      const pp = proj(p);
      const qq = proj(q);
      const o = Math.min(Math.max(...pp), Math.max(...qq)) - Math.max(Math.min(...pp), Math.min(...qq));
      if (o <= tol) return false;
    }
  }
  return true;
}

export function footprint(w: WallGeom, it: Item): Pt[] {
  const [u0, u1, v0, v1] = span(it);
  return [toPlan(w, u0, v0), toPlan(w, u1, v0), toPlan(w, u1, v1), toPlan(w, u0, v1)];
}

export interface CheckResult {
  checks: Check[];
  zones: Zone[];
}

/** Run the checks on the design: everything except items marked for removal. */
export function runChecks(ctx: PlanContext): CheckResult {
  const { room, walls } = ctx;
  const out: Check[] = [];
  const zones: Zone[] = [];
  if (room.problems.length) {
    return { checks: room.problems.map((text) => ({ level: 'bad', text, itemIds: [] })), zones };
  }

  const wallIndex = new Map(walls.map((w, i) => [w.id, i]));
  const active = ctx.items.filter((it) => it.status !== 'remove' && wallIndex.has(it.wallId));
  const wallOf = (it: Item) => wallIndex.get(it.wallId)!;
  const geomOf = (it: Item) => room.walls[wallOf(it)]!;
  const nm = (it: Item) => `${itemName(it)} (wall ${wallOf(it) + 1})`;
  const push = (level: Level, text: string, ...items: Item[]) => out.push({ level, text, itemIds: items.map((i) => i.id) });

  const fixtures = active.filter(isFixture);
  const obstacles: Obstacle[] = fixtures.map((it) => ({
    item: it,
    wall: wallOf(it),
    name: itemName(it).toLowerCase(),
    full: nm(it),
    poly: footprint(geomOf(it), it),
  }));

  /** Room walls (inside faces) other than wall k, in wall k's frame. */
  const roomEdges = (k: number) =>
    room.walls
      .filter((_, i) => i !== k)
      .map((w) => ({ index: w.index, a: toLocal(room.walls[k]!, w.start), b: toLocal(room.walls[k]!, w.end) }));

  // Items must sit on their wall and inside the room.
  for (const it of active) {
    const k = wallOf(it);
    const w = room.walls[k]!;
    const [u0, u1, , d] = span(it);
    if (u0 < -TOL || u1 > w.length + TOL) {
      push('bad', `${nm(it)} runs past the end of the wall.`, it);
      continue;
    }
    if (isFixture(it) && d > TOL) {
      const hit = roomEdges(k).find((e) => {
        const r = segBandU(e.a, e.b, TOL, d - TOL);
        return r && r[1] > u0 + TOL && r[0] < u1 - TOL;
      });
      if (hit) push('bad', `${nm(it)} runs into wall ${hit.index + 1}.`, it);
    }
  }

  // Fixtures overlapping each other.
  for (let a = 0; a < obstacles.length; a++) {
    for (let b = a + 1; b < obstacles.length; b++) {
      const A = obstacles[a]!;
      const B = obstacles[b]!;
      if (overlaps(A.poly, B.poly, 0.25)) push('bad', `${A.full} and ${B.full} overlap.`, A.item, B.item);
    }
  }

  function zone(it: Item, a: number, b: number, depth: number, need: number | null, label: string, rule: string) {
    const k = wallOf(it);
    const w = room.walls[k]!;
    const d = span(it)[3];
    a = Math.max(a, 0);
    b = Math.min(b, w.length);
    const width = need ?? b - a;

    // The room's own walls first: is there even room in front?
    const edges = roomEdges(k);
    const wallBlocks = edges
      .map((e) => segBandU(e.a, e.b, d + TOL, d + depth - TOL))
      .filter((r): r is [number, number] => !!r);
    if (widestGap(a, b, wallBlocks) < width - TOL) {
      let clear = Infinity;
      for (const e of edges) {
        const r = segBandU(e.a, e.b, d + TOL, d + depth + 1000);
        if (!r || r[1] <= a + TOL || r[0] >= b - TOL) continue;
        // nearest point of this wall in front of the fixture, within the zone's width
        const pts = [e.a, e.b].filter((p) => p.x >= a && p.x <= b && p.y > d);
        const ys = pts.map((p) => p.y);
        const dv = e.b.y - e.a.y;
        const du = e.b.x - e.a.x;
        for (const u of [a, b]) {
          if (Math.abs(du) > 1e-9) {
            const t = (u - e.a.x) / du;
            if (t >= 0 && t <= 1) ys.push(e.a.y + dv * t);
          }
        }
        for (const y of ys) if (y > d) clear = Math.min(clear, y - d);
      }
      if (!Number.isFinite(clear)) clear = 0;
      zones.push({ wall: k, a, b, v0: d, v1: d + Math.min(clear, depth), ok: false });
      push('bad', `${label}: only ${fmt(clear)} in front, ${fmt(depth)} needed.`, it);
      return;
    }

    const blocked: [number, number][] = [...wallBlocks];
    for (const o of obstacles) {
      if (o.item === it) continue;
      const r = bandU(
        o.poly.map((p) => toLocal(w, p)),
        d + TOL,
        d + depth - TOL,
      );
      if (r) blocked.push(r);
    }
    const best = widestGap(a, b, blocked);
    const pass = best >= width - TOL;
    zones.push({ wall: k, a, b, v0: d, v1: d + depth, ok: pass });
    push(
      pass ? 'ok' : 'bad',
      `${label}: ${rule}${pass ? '' : ` — something sits in that space (${fmt(best)} of ${fmt(width)} width clear)`}.`,
      it,
    );
  }

  for (const it of fixtures) {
    const k = wallOf(it);
    const w = room.walls[k]!;
    const s = span(it);
    if (it.type === 'toilet') {
      const c = toiletCenter(it);
      const dep = s[3];
      let lo = -Infinity;
      let hi = Infinity;
      const consider = (r: [number, number] | null) => {
        if (!r) return;
        if (r[1] <= c + TOL) lo = Math.max(lo, r[1]);
        else if (r[0] >= c - TOL) hi = Math.min(hi, r[0]);
      };
      for (const o of obstacles) {
        if (o.item === it) continue;
        consider(bandU(o.poly.map((p) => toLocal(w, p)), s[2] + TOL, dep - TOL));
      }
      for (const e of roomEdges(k)) consider(segBandU(e.a, e.b, s[2] + TOL, dep - TOL));
      const left = c - lo;
      const right = hi - c;
      const side = R.toiletSide.value;
      push(
        Math.min(left, right) < side - 1e-6 ? 'bad' : 'ok',
        `Toilet side room: ${fmt(left)} left and ${fmt(right)} right of center (${fmt(side)} minimum each side).`,
        it,
      );
      const half = R.fixtureClearWidth.value / 2;
      zone(it, c - half, c + half, R.toiletFront.value, null, 'Toilet', `${fmt(R.toiletFront.value)} clear in front`);
    }
    if (it.type === 'vanity') {
      const c = (s[0] + s[1]) / 2;
      const half = R.fixtureClearWidth.value / 2;
      zone(it, c - half, c + half, R.sinkFront.value, null, 'Vanity', `${fmt(R.sinkFront.value)} clear in front of the sink`);
    }
    if (it.type === 'tub') {
      zone(
        it,
        s[0],
        s[1],
        R.tubFront.value,
        R.tubFrontWidth.value,
        'Tub',
        `${fmt(R.tubFront.value)} clear in front, at least ${fmt(R.tubFrontWidth.value)} wide`,
      );
    }
    if (it.type === 'shower') {
      const wd = s[1] - s[0];
      const dp = s[3] - s[2];
      zone(it, s[0], s[1], R.showerFront.value, Math.min(wd, R.showerFront.value), 'Shower', `${fmt(R.showerFront.value)} clear in front of the opening`);
      if (Math.min(wd, dp) < R.showerMinSide.value || wd * dp < R.showerMinArea.value) {
        push(
          'bad',
          `Shower is ${fmt(wd)} × ${fmt(dp)}: code minimum is ${fmt(R.showerMinSide.value)} × ${fmt(R.showerMinSide.value)} and ${R.showerMinArea.value} sq in.`,
          it,
        );
      }
    }
  }

  // Doors: blocked openings and swings into fixtures or walls.
  for (const it of active.filter((i) => i.type === 'door')) {
    const k = wallOf(it);
    const w = room.walls[k]!;
    const size = doorSize(it);
    const [u0, u1] = span(it);
    const leftHinge = it.props.hinge !== 'right';
    const swingIn = it.props.swing !== 'out';
    const hu = leftHinge ? u0 + 0.75 : u1 - 0.75;
    const hinge = { x: hu, y: 0 };
    const region = (p: Pt[]) => clip(clip(p, (q) => q.y), (q) => (leftHinge ? q.x - hu : hu - q.x));
    let hit = false;
    for (const o of obstacles) {
      const local = o.poly.map((p) => toLocal(w, p));
      const us = local.map((p) => p.x);
      const vs = local.map((p) => p.y);
      if (Math.min(...vs) < 1 && Math.max(...vs) > -TOL && Math.min(...us) < u1 - TOL && Math.max(...us) > u0 + TOL) {
        push('bad', `The ${o.name} blocks the door on wall ${k + 1}.`, it, o.item);
        hit = true;
        continue;
      }
      if (!swingIn) continue;
      const part = region(local);
      if (part.length >= 3 && distPointPoly(hinge, part) < size - TOL) {
        push('bad', `Door on wall ${k + 1} swings into the ${o.name}.`, it, o.item);
        hit = true;
      }
    }
    if (swingIn) {
      for (const e of roomEdges(k)) {
        const seg = region([e.a, e.b]);
        if (seg.length < 2) continue;
        let dmin = Infinity;
        for (let i = 0; i < seg.length; i++) dmin = Math.min(dmin, distPointSeg(hinge, seg[i]!, seg[(i + 1) % seg.length]!));
        if (dmin < size - TOL) {
          push('bad', `Door on wall ${k + 1} swings into wall ${e.index + 1}.`, it);
          hit = true;
        }
      }
    }
    if (!hit) push('ok', `Door on wall ${k + 1} ${swingIn ? 'swings clear' : 'swings out'}.`, it);
  }

  out.sort((a, b) => (a.level === 'bad' ? 0 : 1) - (b.level === 'bad' ? 0 : 1));
  return { checks: out, zones };
}
