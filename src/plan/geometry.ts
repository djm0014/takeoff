/**
 * Room geometry from a walk around the room.
 *
 * The room is entered as walls in the order you walk them, starting in a
 * corner: a length, then a turn (+90 right, -90 left, or another angle) to the
 * next wall. Wall 1 is drawn going up from the starting corner.
 *
 * Coordinates are plan inches with x to the right and y down (SVG). Each wall
 * also gets a local frame, the one every other screen uses:
 *   u  along the wall, from its LEFT corner as you face it from inside the room
 *   v  into the room, from the finished face
 */

export interface Pt {
  x: number;
  y: number;
}

export interface WallInput {
  /** Finished face length, inches. 0 means not entered yet. */
  length: number;
  /** Turn after this wall, degrees: positive right, negative left. Ignored on the last wall. */
  turn: number;
  /** Overall wall thickness, finish to finish (drawn outside the room). */
  thickness: number;
}

export type CornerKind = 'inside' | 'outside';

export interface WallGeom {
  index: number;
  /** Inside face, in walk order. */
  start: Pt;
  end: Pt;
  length: number;
  thickness: number;
  /** Left corner as you face the wall from inside, and unit vectors of the local frame. */
  left: Pt;
  dirU: Pt;
  dirV: Pt;
  /** Wall body: inside face then outside face, mitered at the corners. */
  body: Pt[];
  /** Corner at the wall's left and right ends (as faced from inside). */
  leftCorner: CornerKind;
  rightCorner: CornerKind;
  /** Index of the wall meeting this one at its left and right ends. */
  leftNeighbor: number;
  rightNeighbor: number;
}

export interface RoomGeom {
  walls: WallGeom[];
  /** Inside faces, one point per corner, in walk order. */
  inner: Pt[];
  /** True when the walk ends back at the start (within 1/16″). */
  closed: boolean;
  /** From where the walk ended to where it started. */
  gap: Pt;
  /** Floor area in square inches (0 if not closed). */
  area: number;
  /** True when walking with the room on your right (turning right at inside corners). */
  clockwise: boolean;
  /** Things wrong with the shape, in plain words. Empty when the room is usable. */
  problems: string[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export const CLOSE_TOLERANCE = 1 / 16;
const EPS = 1e-9;

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y;
export const cross = (a: Pt, b: Pt): number => a.x * b.y - a.y * b.x;

/** Unit vector for a heading in degrees: 0 = up, 90 = right. */
export function headingVector(deg: number): Pt {
  const r = (deg * Math.PI) / 180;
  const x = Math.sin(r);
  const y = -Math.cos(r);
  // Clean up float noise so right angles stay exact.
  return { x: Math.abs(x) < 1e-12 ? 0 : x, y: Math.abs(y) < 1e-12 ? 0 : y };
}

/** Heading of each wall in walk order. */
export function headings(walls: Pick<WallInput, 'turn'>[]): number[] {
  const out: number[] = [];
  let h = 0;
  for (let i = 0; i < walls.length; i++) {
    out.push(h);
    h += walls[i]!.turn;
  }
  return out;
}

function lineIntersect(p: Pt, d: Pt, q: Pt, e: Pt): Pt | null {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(sub(q, p), e) / den;
  return add(p, mul(d, t));
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(sub(b, a), sub(c, a));
  const d2 = cross(sub(b, a), sub(d, a));
  const d3 = cross(sub(d, c), sub(a, c));
  const d4 = cross(sub(d, c), sub(b, c));
  return d1 * d2 < -EPS && d3 * d4 < -EPS;
}

export function signedArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function buildRoom(input: WallInput[]): RoomGeom {
  const n = input.length;
  const problems: string[] = [];
  const hs = headings(input);
  const dirs = hs.map(headingVector);

  // Walk the room.
  const pts: Pt[] = [{ x: 0, y: 0 }];
  for (let i = 0; i < n; i++) pts.push(add(pts[i]!, mul(dirs[i]!, Math.max(0, input[i]!.length))));
  const inner = pts.slice(0, n);
  const gap = n ? sub(pts[0]!, pts[n]!) : { x: 0, y: 0 };
  const closed = n >= 3 && Math.hypot(gap.x, gap.y) <= CLOSE_TOLERANCE && input.every((w) => w.length > 0);

  const sa = signedArea(inner);
  // In screen coordinates a positive area means the walk goes clockwise on screen,
  // with the room on the walker's right.
  const clockwise = sa >= 0;
  const side = clockwise ? 1 : -1;

  if (n < 3) problems.push('A room needs at least 3 walls.');
  input.forEach((w, i) => {
    if (!(w.length > 0)) problems.push(`Wall ${i + 1} needs a length.`);
  });
  input.slice(0, n - 1).forEach((w, i) => {
    if (!(Math.abs(w.turn) >= 1 && Math.abs(w.turn) <= 135)) {
      problems.push(`The turn after wall ${i + 1} must be between 1° and 135°.`);
    }
  });
  if (n >= 3 && !closed && input.every((w) => w.length > 0)) {
    problems.push('The walls do not meet back at the starting corner.');
  }
  if (closed) {
    const total = hs[n - 1]! + closingTurn(input);
    if (Math.abs(Math.abs(total) - 360) > 0.5) problems.push('The turns do not add up to one trip around the room.');
    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        if (segmentsCross(pts[i]!, pts[i + 1]!, pts[j]!, pts[j + 1]!)) {
          problems.push(`Walls ${i + 1} and ${j + 1} cross each other.`);
        }
      }
    }
  }

  // Outward offset lines and mitered outside corners.
  const outward = (i: number): Pt => {
    const d = dirs[i]!;
    // Room is to the right of the walk when clockwise: right of d is (-d.y, d.x).
    const inward = side > 0 ? { x: -d.y, y: d.x } : { x: d.y, y: -d.x };
    return mul(inward, -1);
  };
  const outerCorner = (i: number): Pt => {
    // Corner at pts[i], between wall i-1 and wall i.
    const prev = (i - 1 + n) % n;
    const p = pts[i]!;
    const a = add(p, mul(outward(prev), input[prev]!.thickness));
    const b = add(p, mul(outward(i), input[i]!.thickness));
    if (!closed && (i === 0)) return b;
    const hit = lineIntersect(a, dirs[prev]!, b, dirs[i]!);
    if (!hit) return b;
    // Keep very sharp miters from spiking.
    const maxReach = 4 * Math.max(input[prev]!.thickness, input[i]!.thickness);
    return Math.hypot(hit.x - p.x, hit.y - p.y) > maxReach ? b : hit;
  };
  const outerEnd = (i: number): Pt => {
    if (!closed && i === n - 1) return add(pts[n]!, mul(outward(i), input[i]!.thickness));
    return outerCorner((i + 1) % n);
  };

  const cornerKind = (i: number): CornerKind => {
    // Corner at pts[i] between wall i-1 and wall i.
    const prev = (i - 1 + n) % n;
    const c = cross(dirs[prev]!, dirs[i]!);
    return c * side > 0 ? 'inside' : 'outside';
  };

  const walls: WallGeom[] = input.map((w, i) => {
    const start = pts[i]!;
    const end = pts[i + 1]!;
    const d = dirs[i]!;
    const dirU = side > 0 ? d : mul(d, -1);
    const dirV = { x: -dirU.y, y: dirU.x };
    const startCorner = cornerKind(i);
    const endCorner = cornerKind((i + 1) % n);
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;
    return {
      index: i,
      start,
      end,
      length: Math.max(0, w.length),
      thickness: w.thickness,
      left: side > 0 ? start : end,
      dirU,
      dirV,
      body: [start, end, outerEnd(i), outerCorner(i)],
      leftCorner: side > 0 ? startCorner : endCorner,
      rightCorner: side > 0 ? endCorner : startCorner,
      leftNeighbor: side > 0 ? prev : next,
      rightNeighbor: side > 0 ? next : prev,
    };
  });

  const all = walls.flatMap((w) => w.body);
  const bounds = all.length
    ? {
        minX: Math.min(...all.map((p) => p.x)),
        minY: Math.min(...all.map((p) => p.y)),
        maxX: Math.max(...all.map((p) => p.x)),
        maxY: Math.max(...all.map((p) => p.y)),
      }
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  return {
    walls,
    inner,
    closed,
    gap,
    area: closed ? Math.abs(sa) : 0,
    clockwise,
    problems,
    bounds,
  };
}

/** The turn at the starting corner that the walk implies, degrees. */
export function closingTurn(input: Pick<WallInput, 'turn'>[]): number {
  const n = input.length;
  if (n < 2) return 0;
  const hs = headings(input);
  const last = hs[n - 1]!;
  // Turn from the last wall's heading back to heading 0, into (-180, 180].
  let t = -last % 360;
  if (t <= -180) t += 360;
  if (t > 180) t -= 360;
  return t;
}

/** Wall-local (u along, v into the room) to plan coordinates. */
export function toPlan(w: WallGeom, u: number, v: number): Pt {
  return { x: w.left.x + w.dirU.x * u + w.dirV.x * v, y: w.left.y + w.dirU.y * u + w.dirV.y * v };
}

/** Plan coordinates to wall-local (u, v). */
export function toLocal(w: WallGeom, p: Pt): Pt {
  const d = sub(p, w.left);
  return { x: dot(d, w.dirU), y: dot(d, w.dirV) };
}

/** SVG matrix() arguments mapping wall-local (u, v) to plan coordinates. */
export function wallMatrix(w: WallGeom): string {
  const r = (k: number) => Math.round(k * 1e6) / 1e6;
  return [w.dirU.x, w.dirU.y, w.dirV.x, w.dirV.y, w.left.x, w.left.y].map(r).join(' ');
}

/**
 * Lengths for the last two walls that bring the walk back to the start,
 * from every other length and every turn. Null when it can't be done
 * (the last two walls are parallel, or a length comes out negative).
 */
export function solveLastTwo(input: Pick<WallInput, 'length' | 'turn'>[]): [number, number] | null {
  const n = input.length;
  if (n < 3) return null;
  const dirs = headings(input).map(headingVector);
  let p: Pt = { x: 0, y: 0 };
  for (let i = 0; i < n - 2; i++) p = add(p, mul(dirs[i]!, input[i]!.length));
  // p + a*d1 + b*d2 = 0
  const d1 = dirs[n - 2]!;
  const d2 = dirs[n - 1]!;
  const den = cross(d1, d2);
  if (Math.abs(den) < 1e-9) return null;
  const target = mul(p, -1);
  const a = cross(target, d2) / den;
  const b = cross(d1, target) / den;
  if (a <= CLOSE_TOLERANCE || b <= CLOSE_TOLERANCE) return null;
  return [a, b];
}

/** Rectangle: wall 1 up, then right turns. */
export function rectangle(len1: number, len2: number): Pick<WallInput, 'length' | 'turn'>[] {
  return [
    { length: len1, turn: 90 },
    { length: len2, turn: 90 },
    { length: len1, turn: 90 },
    { length: len2, turn: 90 },
  ];
}

/** Is the point inside the polygon (even-odd rule)? */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
