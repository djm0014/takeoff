/**
 * Tile layout and niche solver, ported from the old Niche Rough-In Planner
 * (public/legacy/niche-planner, the part between LOGIC and END). The math is
 * kept as it was, with the same names, so the same answers give the same
 * layout, cuts and rough-in numbers; tests compare against the old tool's
 * recorded output.
 *
 * Positions are from the left inside corner of the wall as you face it;
 * heights are above the finished floor. All lengths are inches.
 */
import type { TileS } from './settings';

export const EPS = 1 / 64;
export const TOL = 0.04;

export type St = 'full' | 'border' | 'ok' | 'notch' | 'warn' | 'bad';
export const RANK: Record<St, number> = { full: 0, border: 0, ok: 1, notch: 1, warn: 2, bad: 3 };
export const worse = (a: St, b: St): St => (RANK[a] >= RANK[b] ? a : b);

/* ---------- the old tool's inch helpers (kept for identical text) ---------- */

export function parseIn(s0: string | number): number {
  const s = String(s0).trim().replace(/["″”]/g, '').replace(/\s*in\.?$/i, '').trim();
  if (!s) return NaN;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)$/)) && +m[3]!) return +m[1]! + +m[2]! / +m[3]!;
  if ((m = s.match(/^(\d+)\s*\/\s*(\d+)$/)) && +m[2]!) return +m[1]! / +m[2]!;
  if (/^(\d+\.?\d*|\.\d+)$/.test(s)) return parseFloat(s);
  return NaN;
}

/** Nearest 1/16″, like the old tool: `59 1/2″`, `−1/8″`. */
export function fmt(v: number, mark?: boolean): string {
  const neg = v < 0;
  const s = Math.round(Math.abs(v) * 16);
  const w = Math.floor(s / 16);
  let n = s % 16;
  let d = 16;
  while (n && n % 2 === 0) {
    n /= 2;
    d /= 2;
  }
  return (neg && s ? '−' : '') + (n ? (w ? w + ' ' : '') + n + '/' + d : String(w)) + (mark === false ? '' : '″');
}

export function mod(a: number, m: number): number {
  let r = ((a % m) + m) % m;
  if (m - r < 1e-6) r = 0;
  return r;
}

export const PATN: Record<TileS['pattern'], string> = { half: 'running bond 1/2', third: '1/3 offset', stack: 'stacked' };

/* ---------- build-up, tub fit, finished width ---------- */

export const bu = (S: TileS) => S.board + S.thinset + S.tileT;
export const ext = (S: TileS) => (S.frameOn === 'yes' ? S.frameW + S.grout : 0);
export const marble = (S: TileS) => S.sillType === 'marble';
const furTot = (_S: TileS) => 0;

export interface FitEnd {
  side: 'left' | 'right';
  gap: number;
  reach: number;
  low: boolean;
  high: boolean;
  furMin: number;
  furMax: number;
}
export interface TubFit {
  narrow: boolean;
  ends: FitEnd[];
  ok: boolean;
  low: boolean;
}

export function tubFit(S: TileS): TubFit | null {
  if (!(S.base === 'tub' && S.tubPos === 'full' && S.edge === 'none')) return null;
  const B = bu(S);
  const base = S._tile ? S._frW! : S.wallW;
  const FW = S.widthRef === 'framing' ? base : base + 2 * B;
  const room = FW - S.tubL;
  const narrow = room < -1e-6;
  const gL = S.tubSlide === 'left' ? 0 : S.tubSlide === 'right' ? room : room / 2;
  const gR = room - gL;
  const end = (side: 'left' | 'right', gap: number): FitEnd => {
    const reach = B - gap;
    return {
      side,
      gap,
      reach,
      low: reach < S.minReach - 1e-6,
      high: reach > S.maxReach + 1e-6,
      furMin: Math.max(0, gap - (B - S.minReach)),
      furMax: Math.max(0, gap - (B - S.maxReach)),
    };
  };
  const ends = [end('left', gL), end('right', gR)];
  return { narrow, ends, ok: !narrow && ends.every((e) => !e.low && !e.high), low: ends.some((e) => e.low) };
}

function endText(S: TileS, e: FitEnd): string {
  const r = `${e.side === 'left' ? 'Left' : 'Right'} end: tile laps ${e.reach > 0 ? fmt(e.reach) : '0″'} onto the lip (${fmt(e.gap)} tub to stud)`;
  if (e.low) return `${r}. Furring required: fur ${fmt(e.furMin)} to ${fmt(e.furMax)}.`;
  if (e.high) return `${r}, more than ${fmt(S.maxReach)}.`;
  return r + '.';
}
export function fitText(S: TileS, f: TubFit): string {
  if (f.narrow) return 'The tub won’t fit: the studs are closer together than the tub is long.';
  return f.ends.map((e) => endText(S, e)).join(' ');
}

/** One line of the cuts list: label, value, status, pill text (null = the status's pill). */
export type CutItem = [string, string, St, (string | null)?];
/** One line of a sheet: label, value (may hold <br>), highlighted. */
export type SheetRow = [string, string, boolean?];

function fitItems(S: TileS): CutItem[] {
  const f = tubFit(S);
  if (!f) return [];
  if (f.narrow) return [['Tub fit', 'tub won’t fit', 'bad', 'Too narrow']];
  return f.ends.map((e): CutItem => [
    `Tile onto tub lip, ${e.side} end`,
    e.reach > 0 ? fmt(e.reach) : 'none',
    e.low ? 'bad' : e.high ? 'warn' : 'full',
    e.low ? 'Furring req.' : e.high ? 'Over ' + fmt(S.maxReach) : 'OK',
  ]);
}

const furL = (S: TileS) => (S.furSplit === 'right' ? 0 : S.furSplit === 'left' ? furTot(S) : furTot(S) / 2);
const furR = (S: TileS) => furTot(S) - furL(S);
const endAdj = (S: TileS, side: 'left' | 'right') =>
  S.widthRef !== 'framing' ? 0 : S.edge === side ? 0 : bu(S) + (side === 'left' ? furL(S) : furR(S));
export const finW = (S: TileS) => S.wallW - endAdj(S, 'left') - endAdj(S, 'right');

/** The wall as tiled: wallW becomes the finished tile width; the framing width is kept as _frW. */
export function tileS(S: TileS): TileS {
  if (S._tile) return S;
  return { ...S, wallW: finW(S), _tile: true, _frW: S.wallW, _offL: endAdj(S, 'left'), _furL: furL(S), _furR: furR(S) };
}

export const isPlain = (S: TileS) => S.wallType === 'plain';

/** Left edges of the studs along a wall W wide (framing), corner studs included. */
export function studCenters(S: TileS, W: number): number[] {
  const SW = 1.5;
  const cs: number[] = [];
  if (S.framing === 'existing') {
    if (S.studMode === 'list') {
      for (const t of String(S.studList).split(/[,;]+/)) {
        const v = parseIn(t);
        if (!isNaN(v)) cs.push(v);
      }
    } else if (S.exOC > 0) {
      for (let c = S.stud1; c < W && cs.length < 200; c += S.exOC) cs.push(c);
    }
  } else {
    const bayMode = S.framed !== 'yes' && S.studs === 'bay' && !isPlain(S);
    const OC = bayMode ? S.studOC : 16;
    const c0 = bayMode ? S.bayL - SW / 2 : S.studStart === 'right' ? W - OC : OC;
    for (let k = -60; k <= 60; k++) cs.push(c0 + k * OC);
  }
  const ok = cs.filter((c) => c - SW / 2 >= SW - 0.01 && c + SW / 2 <= W - SW + 0.01);
  return [0]
    .concat(ok.map((c) => c - SW / 2))
    .concat([W - SW])
    .sort((a, b) => a - b)
    .filter((x, i, a) => i === 0 || x - a[i - 1]! >= SW - 0.01);
}

export const sillGap = (S: TileS) => (marble(S) ? S.sillT + S.grout : ext(S));
export const sillDrop = (S: TileS) => (marble(S) ? S.sillT + S.thinset + S.board : bu(S));
export const cRv = (S: TileS) => (S.ceilLevel ? S.ceilL : S.ceilR);
export const slopeRun = (S: TileS) =>
  !S.ceilLevel && S.slopeMode === 'part' && S.ceilL !== S.ceilR ? Math.min(Math.max(S.slopeRun, 0.5), S.wallW) : S.wallW;
export const ceilAt = (S: TileS, x: number) => {
  const L = S.ceilL;
  const R = cRv(S);
  const W = S.wallW;
  const run = slopeRun(S);
  if (run >= W - 1e-9) return L + ((R - L) * x) / W;
  if (L < R) return x < run ? L + ((R - L) * x) / run : R;
  return x > W - run ? L + ((R - L) * (x - (W - run))) / run : L;
};
export function ceilPts(S: TileS): [number, number][] {
  const L = S.ceilL;
  const R = cRv(S);
  const W = S.wallW;
  const run = slopeRun(S);
  const pts: [number, number][] = [[W, R]];
  if (run < W - 0.05) pts.push(L < R ? [run, R] : [W - run, L]);
  pts.push([0, L]);
  return pts;
}
export function tubX(S: TileS): { a: number; b: number } | null {
  if (S.base !== 'tub') return null;
  const W = S.wallW;
  const L = Math.min(S.tubL, W);
  if (S.tubPos === 'full') return { a: 0, b: W };
  if (S.tubPos === 'left') return { a: 0, b: L };
  if (S.tubPos === 'right') return { a: W - L, b: W };
  const a = (W - L) / 2;
  return { a, b: a + L };
}
export const baseY = (S: TileS) => (S.base === 'tub' ? S.tubH : 0) + S.gap;
export const fieldL = (S: TileS) => (S.edge === 'left' ? S.frameW + S.grout : S.gap);
export const fieldR = (S: TileS) => (S.edge === 'right' ? S.wallW - S.frameW - S.grout : S.wallW - S.gap);

export interface EdgeParts {
  x0: number;
  bw: number;
  y0: number;
  ps: { y: number; h: number }[];
  top: number;
  st: St;
}
export function edgeParts(S: TileS): EdgeParts | null {
  if (S.edge !== 'left' && S.edge !== 'right') return null;
  const W = S.wallW;
  const bw = S.frameW;
  const x0 = S.edge === 'left' ? 0 : W - bw;
  const x1 = x0 + bw;
  const tb = tubX(S);
  const t = S.tileW;
  const g = S.grout;
  const y0 = tb && tb.a <= x0 + 0.05 && tb.b >= x1 - 0.05 ? baseY(S) : S.gap;
  const y1 = Math.min(ceilAt(S, x0), ceilAt(S, x1)) - S.gap;
  const ps: { y: number; h: number }[] = [];
  let y = y0;
  for (let i = 0; y < y1 - 0.05 && i < 200; i++) {
    const h = Math.min(t, y1 - y);
    ps.push({ y, h });
    y += h + g;
  }
  const top = ps.length ? ps[ps.length - 1]!.h : 0;
  return { x0, bw, y0, ps, top, st: top < t - EPS ? stat(S, top, t) : 'full' };
}
export function floorZone(S: TileS): boolean {
  const x = tubX(S);
  return !!x && (x.a > 0.05 || x.b < S.wallW - 0.05);
}
export const tubCenter = (S: TileS) => {
  const x = tubX(S);
  return x ? (x.a + x.b) / 2 : S.wallW / 2;
};

export interface Grid {
  t: number;
  g: number;
  m: number;
  b: number;
  T0: number;
  p: number;
}
export function grid(S: TileS, p: number): Grid {
  const t = S.tileH;
  const g = S.grout;
  const b = baseY(S);
  return { t, g, m: t + g, b, T0: b + p, p };
}
export function shiftCount(S: TileS): number {
  return S.pattern === 'stack' ? 1 : S.pattern === 'half' ? 2 : 3;
}
export function rowShift(S: TileS, i: number): number {
  const c = shiftCount(S);
  return (mod(i, c) * (S.tileW + S.grout)) / c;
}
export interface Piece {
  x: number;
  w: number;
}
export function rowPieces(S: TileS, x0: number, shift: number, L0?: number | null, R0?: number | null): Piece[] {
  const w = S.tileW;
  const mw = w + S.grout;
  const L = L0 == null ? fieldL(S) : L0;
  const R = R0 == null ? fieldR(S) : R0;
  const out: Piece[] = [];
  let x = L + mod(x0 + shift - L, mw) - mw;
  for (let i = 0; x < R - 0.05 && i < 600; x += mw, i++) {
    const a = Math.max(x, L);
    const b = Math.min(x + w, R);
    if (b - a > 0.05) out.push({ x: a, w: b - a });
  }
  return out;
}
export function splitLen(a: number, b: number, L: number, g: number): { s: number; l: number }[] {
  const tot = b - a;
  if (tot <= L + 1e-6) return [{ s: a, l: tot }];
  const m = L + g;
  const opt = (x0: number) => {
    const r: { s: number; l: number }[] = [];
    let x = a + mod(x0 - a, m) - m;
    for (let i = 0; x < b - 0.05 && i < 200; x += m, i++) {
      const s = Math.max(x, a);
      const e = Math.min(x + L, b);
      if (e - s > 0.05) r.push({ s, l: e - s });
    }
    return r;
  };
  const c = (a + b) / 2;
  const A = opt(c - L / 2);
  const B = opt(c + g / 2);
  const mn = (r: { l: number }[]) => Math.min(r[0]!.l, r[r.length - 1]!.l);
  return mn(A) >= mn(B) - 1e-6 ? A : B;
}
export function stat(S: TileS, h: number, dim: number): St {
  if (h >= dim - EPS) return 'full';
  const r = h / dim;
  return r >= S.minFrac - 1e-6 ? 'ok' : r >= S.minFrac / 2 ? 'warn' : 'bad';
}
function cutPen(S: TileS, h: number, dim: number): number {
  if (h >= dim - EPS) return 0;
  const r = Math.max(h, 0) / dim;
  return r >= S.minFrac - 1e-6 ? (1 - r) * 1.5 : 30 + (S.minFrac - r) * 80;
}
const nMin = (S: TileS, dim: number) => Math.min(2, S.minFrac * dim);

export interface Leg {
  aligned: boolean;
  leg: number;
}
export function legStat(S: TileS, l: Leg, dim: number): St {
  return l.aligned ? 'full' : l.leg >= nMin(S, dim) - 1e-6 ? 'notch' : 'bad';
}
function legPen(S: TileS, l: Leg, dim: number): number {
  return l.aligned ? 0 : l.leg >= nMin(S, dim) - 1e-6 ? 6 : 40 + (nMin(S, dim) - l.leg) * 10;
}
export function edgeLeg(G: Grid, y: number, side: 'below' | 'above'): Leg {
  const u = mod(y - G.T0, G.m);
  if (u <= G.g + TOL || u >= G.m - TOL) return { aligned: true, leg: 0 };
  return { aligned: false, leg: side === 'below' ? u - G.g : G.m - u };
}
function topCut(S: TileS, G: Grid, x: number): number {
  const c = ceilAt(S, x) - S.gap;
  const d = c - (G.T0 + G.g);
  if (d <= 0.05) return Math.min(G.t, c - G.b);
  const j = Math.floor((d - 0.05) / G.m);
  return Math.min(G.t, c - (G.T0 + G.g + j * G.m));
}
function floorCut(S: TileS, G: Grid): number {
  const f = S.gap;
  const i = Math.floor((f + 0.05 - G.T0) / G.m) + 1;
  return Math.min(G.t, G.T0 + i * G.m - f);
}

/* ---------- inside the niche ---------- */

function bayRun(S: TileS, hb: number): number[] {
  const t = S.tileH;
  const g = S.grout;
  const slack = Math.max(0.3, 2 * g + 0.05);
  const out: number[] = [];
  if (hb < 0.3) return out;
  out.push(Math.min(t, hb));
  let y = out[0]! + g;
  while (hb - y > slack && out.length < 200) {
    const h = Math.min(t, hb - y);
    out.push(h);
    y += h + g;
  }
  return out;
}
function shelfPlan(S: TileS, hF: number): { bays: number[]; shelves: number[] } {
  const n = S.shelves;
  const s = S.shelfT;
  const m = S.tileH + S.grout;
  if (!n || n * s > hF - 2) return { bays: [hF], shelves: [] };
  const U = hF - n * s;
  const J = Math.max(1, Math.floor(U / m));
  let best: { sp: number; bays: number[]; shelves: number[] } | null = null;
  if (n === 1) {
    for (let j = 1; j <= J; j++) {
      const a = j * m;
      const b = U - a;
      if (b < 1) continue;
      const sp = Math.abs(a - b);
      if (!best || sp < best.sp - 1e-9) best = { sp, bays: [a, b], shelves: [a] };
    }
  } else {
    for (let j = 1; j <= J; j++)
      for (let k = 1; k <= J; k++) {
        const a = j * m;
        const b = k * m;
        const c = U - a - b;
        if (c < 1) continue;
        const sp = Math.max(a, b, c) - Math.min(a, b, c);
        if (!best || sp < best.sp - 1e-9) best = { sp, bays: [a, b, c], shelves: [a, a + s + b] };
      }
  }
  return best || { bays: [hF], shelves: [] };
}
const bayPen = (st: St) => (st === 'full' ? 0 : st === 'ok' ? 5 : st === 'warn' ? 20 : 35);
export function centeredShelves(S: TileS, hF: number): number[] {
  const n = S.shelves && S.shelves * S.shelfT < hF - 2 ? S.shelves : 0;
  const s = S.shelfT;
  const c = (hF - n * s) / (n + 1);
  const out: number[] = [];
  for (let i = 1; i <= n; i++) out.push(i * c + (i - 1) * s);
  return out;
}

export interface Bay {
  hb: number;
  rows: number[];
  top: number;
  st: St;
  desc?: string;
}
export interface Interior {
  pen?: number;
  bays: Bay[];
  shelves: number[];
  over?: boolean;
}
function interiorV(S: TileS, hF: number): Interior {
  const pl = S.shelfPos === 'center' ? { bays: [hF], shelves: centeredShelves(S, hF) } : shelfPlan(S, hF);
  let pen = 0;
  const bays = pl.bays.map((hb): Bay => {
    const rows = bayRun(S, hb);
    const top = rows.length ? rows[rows.length - 1]! : 0;
    const st = rows.length ? stat(S, top, S.tileH) : 'bad';
    pen += bayPen(st);
    return { hb, rows, top, st };
  });
  return { pen, bays, shelves: pl.shelves };
}

/* ---------- options ---------- */

export interface HFit {
  sc: number;
  w: number;
  L: number;
  x0: number;
  xc: number | null;
  cL: number;
  cR: number;
  lL: Leg;
  lR: Leg;
  ix: number;
  inMin: number;
  frMin: number;
}
export interface Opt {
  sc: number;
  p: number;
  sF: number;
  hF: number;
  j: number;
  sill: Leg;
  head: Leg;
  cl: number;
  cr: number;
  fc: number;
  fz: boolean;
  G: Grid;
  int: Interior;
  h: HFit;
  tot: number;
  pinned?: boolean;
  plain?: boolean;
}
type VOpt = Omit<Opt, 'h' | 'tot'> & { h?: HFit; tot?: number };

function solveV(S: TileS): VOpt[] {
  const t = S.tileH;
  const g = S.grout;
  const m = t + g;
  const e = ext(S);
  const B = bu(S);
  const fz = floorZone(S);
  const cMin = Math.min(S.ceilL, cRv(S)) - S.gap;
  const out: VOpt[] = [];
  const framed = S.framed === 'yes';
  let hs: number[] = [];
  if (framed) hs = [S.rH - B - sillDrop(S)];
  else {
    const R = Math.max(m, 3);
    for (let h = Math.max(4, Math.round((S.nH - R) * 16) / 16); h <= S.nH + R + 1e-9; h += 1 / 16) hs.push(Math.round(h * 16) / 16);
  }
  if (!hs.length || hs[0]! < 1) return out;
  const ints = hs.map((h) => interiorV(S, h));
  for (let i = Math.round(t * 16); i >= 1; i--) {
    const p = i / 16;
    const G = grid(S, p);
    const cl = topCut(S, G, 0);
    const cr = topCut(S, G, S.wallW);
    const fc = fz ? floorCut(S, G) : t;
    const bp = cutPen(S, p, t) + cutPen(S, cl, t) + (S.ceilLevel ? 0 : cutPen(S, cr, t)) + (fz ? cutPen(S, fc, t) : 0);
    let best: { sc: number; p: number; sF: number; hF: number; j: number; sill: Leg; head: Leg } | null = null;
    if (framed) {
      const sF = S.rSill + sillDrop(S);
      const hF = hs[0]!;
      if (sF + hF + e > cMin) break;
      const sl = edgeLeg(G, sF - sillGap(S), 'below');
      const hl = edgeLeg(G, sF + hF + e, 'above');
      best = { sc: bp + legPen(S, sl, t) + legPen(S, hl, t) + ints[0]!.pen!, p, sF, hF, j: 0, sill: sl, head: hl };
    } else {
      const i0 = Math.round((S.nSill - sillGap(S) - G.T0) / m);
      for (let k = Math.max(0, i0 - 1); k <= Math.max(0, i0 + 1); k++) {
        const sF = G.T0 + k * m + sillGap(S);
        for (let j = 0; j < hs.length; j++) {
          const hF = hs[j]!;
          const e2 = sF + hF + e;
          if (e2 > cMin - 1) break;
          const hl = edgeLeg(G, e2, 'above');
          const sc = bp + legPen(S, hl, t) + ints[j]!.pen! + 1.5 * Math.abs(hF - S.nH) + 0.8 * Math.abs(sF - S.nSill);
          if (!best || sc < best.sc - 1e-9) best = { sc, p, sF, hF, j, sill: { aligned: true, leg: 0 }, head: hl };
        }
      }
    }
    if (best) out.push({ ...best, cl, cr, fc, fz, G, int: ints[best.j]! });
  }
  return out;
}

function pickOptions<T extends { sc: number; p: number; sF: number; hF: number; pinned?: boolean }>(S: TileS, list: T[]): T[] {
  const s = list.slice().sort((a, b) => a.sc - b.sc);
  const out: T[] = [];
  const dp = Math.max(0.5, S.tileH / 4);
  for (const c of s) {
    if (out.length >= 3) break;
    if (out.every((o) => Math.abs(o.p - c.p) >= dp || Math.abs(o.sF - c.sF) >= 0.5 || Math.abs(o.hF - c.hF) >= 0.5)) out.push(c);
  }
  if (!out.some((o) => o.p >= S.tileH - EPS)) {
    const full = s.find((c) => c.p >= S.tileH - EPS);
    if (full) out.push({ ...full, pinned: true });
  }
  return out;
}

function solveH(S: TileS, o: VOpt): HFit | null {
  const tw = S.tileW;
  const g = S.grout;
  const mw = tw + g;
  const e = ext(S);
  const B = bu(S);
  const c = shiftCount(S);
  const G = o.G;
  let widths: number[];
  let leftOf: (w: number) => number;
  if (S.framed === 'yes') {
    widths = [S.rW - 2 * B];
    leftOf = () => S.rLeft + B - (S._offL || 0);
  } else if (S.studs === 'bay') {
    widths = [S.studOC - 1.5 - 2 * B];
    leftOf = () => S.bayL + B - (S._offL || 0);
  } else {
    widths = [];
    for (let w = Math.max(3, S.nW - 2); w <= S.nW + 2 + 1e-9; w += 1 / 16) widths.push(Math.round(w * 16) / 16);
    const ref = S.nPos === 'tub' ? tubCenter(S) : (fieldL(S) + fieldR(S)) / 2;
    leftOf = (w) => (S.nPos === 'custom' ? S.nLeft + B - (S._offL || 0) : ref - w / 2);
  }
  const y1 = o.sF - sillGap(S);
  const y2 = o.sF + o.hF + e;
  const ks: number[] = [];
  for (let i = Math.floor((y1 - G.T0) / G.m) - 1; i <= Math.ceil((y2 - G.T0) / G.m) + 1; i++) {
    const Ti = G.T0 + i * G.m;
    if (Ti > y1 + TOL && Ti - G.t < y2 - TOL) ks.push(i);
  }
  let best: HFit | null = null;
  for (const w of widths) {
    if (w < 1) continue;
    const L = leftOf(w);
    if (L - e < fieldL(S) + 0.25 || L + w + e > fieldR(S) - 0.25) continue;
    const xc = S.center === 'niche' ? L + w / 2 : S.center === 'wall' ? (fieldL(S) + fieldR(S)) / 2 : S.center === 'tub' ? tubCenter(S) : null;
    const x0s = xc == null ? [S.center === 'right' ? fieldR(S) - tw : fieldL(S)] : [xc - tw / 2, xc + g / 2];
    let inB: { ix: number; mn: number } | null = null;
    const ixs = [L + w / 2 - tw / 2, L + w / 2 + g / 2];
    for (let s = 0; s < mw; s += 1 / 16) ixs.push(L + s);
    for (const ix of ixs) {
      let mn = Infinity;
      for (let k = 0; k < c; k++) {
        const ps = rowPieces(S, ix, (k * mw) / c, L, L + w);
        if (ps.length > 1) for (const q of [ps[0]!, ps[ps.length - 1]!]) if (q.w < tw - EPS) mn = Math.min(mn, q.w);
      }
      if (!inB || mn > inB.mn + 0.25) inB = { ix, mn };
    }
    const inPen = inB!.mn === Infinity ? 0 : cutPen(S, inB!.mn, tw);
    let frMin = Infinity;
    if (e) {
      for (const s of splitLen(L - S.frameW, L + w + S.frameW, tw, g)) if (s.l < tw - EPS) frMin = Math.min(frMin, s.l);
      if (o.hF > 2 * g + 0.1) for (const s of splitLen(o.sF + g, o.sF + o.hF - g, tw, g)) if (s.l < tw - EPS) frMin = Math.min(frMin, s.l);
    }
    const frPen = frMin === Infinity ? 0 : cutPen(S, frMin, tw);
    for (const x0 of x0s) {
      let cL = Infinity;
      let cR = Infinity;
      for (let k = 0; k < c; k++) {
        const ps = rowPieces(S, x0, (k * mw) / c);
        if (!ps.length) continue;
        if (ps[0]!.w < tw - EPS) cL = Math.min(cL, ps[0]!.w);
        const l = ps[ps.length - 1]!;
        if (l.w < tw - EPS) cR = Math.min(cR, l.w);
      }
      let mL = Infinity;
      let mR = Infinity;
      const q1 = L - e;
      const q2 = L + w + e;
      for (const i of ks)
        for (const pc of rowPieces(S, x0, rowShift(S, i))) {
          const a = pc.x;
          const b = pc.x + pc.w;
          if (q1 > a + TOL && q1 < b - TOL) mL = Math.min(mL, q1 - a);
          if (q2 > a + TOL && q2 < b - TOL) mR = Math.min(mR, b - q2);
        }
      const lL: Leg = mL < Infinity ? { aligned: false, leg: mL } : { aligned: true, leg: 0 };
      const lR: Leg = mR < Infinity ? { aligned: false, leg: mR } : { aligned: true, leg: 0 };
      const sc =
        (cL < Infinity ? cutPen(S, cL, tw) : 0) +
        (cR < Infinity ? cutPen(S, cR, tw) : 0) +
        legPen(S, lL, tw) +
        legPen(S, lR, tw) +
        inPen +
        frPen +
        (widths.length > 1 ? 1.5 * Math.abs(w - S.nW) : 0);
      if (!best || sc < best.sc - 1e-9) best = { sc, w, L, x0, xc, cL, cR, lL, lR, ix: inB!.ix, inMin: inB!.mn, frMin };
    }
  }
  return best;
}

/* ---------- plain tile wall ---------- */

function solveHPlain(S: TileS): HFit {
  const tw = S.tileW;
  const g = S.grout;
  const mw = tw + g;
  const c = shiftCount(S);
  const mid = (fieldL(S) + fieldR(S)) / 2;
  const xc = S.center === 'tub' ? tubCenter(S) : S.center === 'left' || S.center === 'right' ? null : mid;
  const x0s = xc == null ? [S.center === 'right' ? fieldR(S) - tw : fieldL(S)] : [xc - tw / 2, xc + g / 2];
  let best: HFit | null = null;
  const none: Leg = { aligned: true, leg: 0 };
  for (const x0 of x0s) {
    let cL = Infinity;
    let cR = Infinity;
    for (let k = 0; k < c; k++) {
      const ps = rowPieces(S, x0, (k * mw) / c);
      if (!ps.length) continue;
      if (ps[0]!.w < tw - EPS) cL = Math.min(cL, ps[0]!.w);
      const l = ps[ps.length - 1]!;
      if (l.w < tw - EPS) cR = Math.min(cR, l.w);
    }
    const sc = (cL < Infinity ? cutPen(S, cL, tw) : 0) + (cR < Infinity ? cutPen(S, cR, tw) : 0);
    if (!best || sc < best.sc - 1e-9) best = { sc, x0, xc, cL, cR, w: 0, L: 0, lL: none, lR: none, ix: 0, inMin: Infinity, frMin: Infinity };
  }
  return best!;
}

const sortOpts = (a: Opt, b: Opt) => (a.pinned ? 1 : 0) - (b.pinned ? 1 : 0) || a.tot - b.tot;

function solvePlain(S: TileS): Opt[] {
  const t = S.tileH;
  const fz = floorZone(S);
  const list: VOpt[] = [];
  const none: Leg = { aligned: true, leg: 0 };
  for (let i = Math.round(t * 16); i >= 1; i--) {
    const p = i / 16;
    const G = grid(S, p);
    const cl = topCut(S, G, 0);
    const cr = topCut(S, G, S.wallW);
    const fc = fz ? floorCut(S, G) : t;
    list.push({
      sc: cutPen(S, p, t) + cutPen(S, cl, t) + (S.ceilLevel ? 0 : cutPen(S, cr, t)) + (fz ? cutPen(S, fc, t) : 0),
      p,
      G,
      cl,
      cr,
      fc,
      fz,
      plain: true,
      // A plain wall has no niche; these keep the option's shape (the old tool left them undefined).
      sF: 0,
      hF: 0,
      j: 0,
      sill: none,
      head: none,
      int: { bays: [], shelves: [] },
    });
  }
  const h = solveHPlain(S);
  return pickOptions(S, list)
    .map((o): Opt => ({ ...o, h, tot: o.sc + h.sc }))
    .sort(sortOpts);
}

export function cutsPlain(S: TileS, r: Opt): CutItem[] {
  const t = S.tileH;
  const tw = S.tileW;
  const h = r.h;
  const items: CutItem[] = [];
  const c = (v: number, dim: number, unit: string) => (v < dim - EPS ? fmt(v) + ' ' + unit : '');
  items.push([S.base === 'tub' ? 'Bottom course on tub' : 'Bottom course', c(r.p, t, 'tall'), stat(S, r.p, t)]);
  if (S.ceilLevel) items.push(['Top course at ceiling', c(r.cl, t, 'tall'), stat(S, r.cl, t)]);
  else {
    items.push(['Top course, left end', c(r.cl, t, 'tall'), stat(S, r.cl, t)]);
    items.push(['Top course, right end', c(r.cr, t, 'tall'), stat(S, r.cr, t)]);
  }
  if (r.fz) items.push(['Bottom course beside tub', c(r.fc, t, 'tall'), stat(S, r.fc, t)]);
  const ep = edgeParts(S);
  if (ep) items.push(['Bullnose edge', ep.top < tw - EPS ? 'top piece ' + fmt(ep.top) : '', ep.st, ep.st === 'full' ? 'Full pieces' : null]);
  items.push(...fitItems(S));
  items.push([S.edge === 'left' ? 'Beside bullnose' : 'Left corner', h.cL < Infinity ? fmt(h.cL) + ' wide' : '', h.cL < Infinity ? stat(S, h.cL, tw) : 'full']);
  items.push([S.edge === 'right' ? 'Beside bullnose' : 'Right corner', h.cR < Infinity ? fmt(h.cR) + ' wide' : '', h.cR < Infinity ? stat(S, h.cR, tw) : 'full']);
  return items;
}

function verticalLine(S: TileS, h: HFit): string {
  return h.xc == null
    ? `Full tile at the ${S.center === 'right' ? 'right' : 'left'} corner`
    : (Math.abs(h.x0 - (h.xc - S.tileW / 2)) < 1e-6 ? 'Center of a tile' : 'Grout joint') +
        ' at ' +
        fmt(h.xc) +
        ' from left corner' +
        (S.widthRef === 'framing' ? ` (${fmt(h.xc + (S._offL || 0))} from the left stud)` : '');
}

export function sheetPlainRows(S: TileS, r: Opt): SheetRow[] {
  const h = r.h;
  const tub = S.base === 'tub';
  const rows: SheetRow[] = [];
  const G = r.G;
  rows.push(...furRows(S));
  rows.push(['First course', (r.p < S.tileH - EPS ? 'Cut to ' + fmt(r.p) : 'Full tile') + (tub ? ', on the tub' : ', on the floor'), true]);
  rows.push([
    'Ledger line',
    (tub ? `${fmt(G.T0 + G.g - S.tubH)} above tub (${fmt(G.T0 + G.g)} above floor)` : fmt(G.T0 + G.g) + ' above floor') + ', bottom of 2nd course',
    true,
  ]);
  rows.push([
    'Top course',
    S.ceilLevel
      ? r.cl < S.tileH - EPS
        ? 'Cut to ' + fmt(r.cl)
        : 'Full tile'
      : `${r.cl < S.tileH - EPS ? fmt(r.cl) : 'Full'} at left, ${r.cr < S.tileH - EPS ? fmt(r.cr) : 'full'} at right`,
  ]);
  rows.push(['Vertical line', verticalLine(S, h)]);
  const ep = edgeParts(S);
  if (ep) rows.push(['Bullnose edge', `${fmt(S.frameW)} bullnose up the ${S.edge} corner` + (ep.top < S.tileW - EPS ? `, top piece ${fmt(ep.top)}` : '')]);
  return rows;
}

/* ---------- framing ---------- */

export interface Framing {
  plain?: boolean;
  W: number;
  SW: number;
  OC: number;
  bt: number;
  bayMode?: boolean;
  full?: boolean;
  xL: number;
  xR: number;
  ys: number;
  yh: number;
  studs: number[];
  cripples: number[];
  replaced: number[];
  sides: { x: number; full: boolean }[];
  fillers: { x: number; w: number }[];
  bx1: number;
  bx2: number;
}

export function framingPlain(S: TileS): Framing {
  const W = S._frW || S.wallW;
  const studs = studCenters(S, W);
  return { plain: true, W, SW: 1.5, OC: 16, bt: 1.5, studs, cripples: [], sides: [], fillers: [], replaced: [], xL: 0, xR: 0, ys: 0, yh: 0, bx1: 0, bx2: 0 };
}

export function furRows(S: TileS): SheetRow[] {
  const f = tubFit(S);
  if (f) return [['Tub fit', fitText(S, f), !f.ok]];
  return [];
}

export function framingRowsPlain(S: TileS, fr: Framing): SheetRow[] {
  const cMin = Math.min(S.ceilL, cRv(S));
  const cMax = Math.max(S.ceilL, cRv(S));
  const sl = cMax - cMin < 1 / 16 ? fmt(cMin - 3) : fmt(cMin - 3) + ' to ' + fmt(cMax - 3);
  return [
    [
      'Stud layout',
      S.framing === 'existing'
        ? S.studMode === 'list'
          ? 'Existing studs, as entered'
          : `Existing studs, ${fmt(S.exOC)} on center from the first at ${fmt(S.stud1)}`
        : `${fmt(fr.OC)} on center from the ${S.studStart === 'right' ? 'right' : 'left'} corner`,
    ],
    ...furRows(S),
    ['Cut list', `${fr.studs.length} studs at ${sl}<br>Bottom plate and top plate at ${fmt(S._frW || S.wallW)}`],
  ];
}

export function solve(S0: TileS): Opt[] {
  const S = tileS(S0);
  if (isPlain(S)) return solvePlain(S);
  return pickOptions(S, solveV(S))
    .map((o): Opt | null => {
      const h = solveH(S, o);
      return h ? { ...o, h, tot: o.sc + h.sc } : null;
    })
    .filter((o): o is Opt => !!o)
    .sort(sortOpts);
}

/** An option moved by whole courses (dh, ds) and by fine snaps (hi, si) to land on grout lines. */
export function adjustOpt(S: TileS, r: Opt, dh: number, ds: number, hi: number, si: number): Opt | null {
  if (!dh && !ds && !hi && !si) return r;
  const m = r.G.m;
  const e = ext(S);
  const sF = r.sF + ds * m + si;
  const hF = r.hF + dh * m + hi - si;
  if (hF < 3) return null;
  const o: Opt = { ...r, sF, hF, int: interiorV(S, hF), sill: edgeLeg(r.G, sF - sillGap(S), 'below'), head: edgeLeg(r.G, sF + hF + e, 'above') };
  const h = solveH(S, o);
  if (!h) return null;
  o.h = h;
  return o;
}

export function framingFor(S: TileS, r: Opt): Framing {
  const B = bu(S);
  const W = S._frW || S.wallW;
  const off = S._offL || 0;
  const SW = 1.5;
  const bayMode = S.framed !== 'yes' && S.studs === 'bay';
  const OC = bayMode ? S.studOC : 16;
  const bt = S.block === 'edge' ? 3.5 : 1.5;
  const full = S.sides !== 'block';
  const xL = r.h.L - B + off;
  const xR = r.h.L + r.h.w + B + off;
  const ys = r.sF - sillDrop(S);
  const yh = r.sF + r.hF + B;
  const reg = studCenters(S, W);
  const near = (a: number, b: number) => Math.abs(a - b) < TOL;
  const over = (x: number, s: number) => x < s + SW - TOL && x + SW > s + TOL;
  const studs: number[] = [];
  const cripples: number[] = [];
  const replaced: number[] = [];
  const sides: { x: number; full: boolean }[] = [];
  const fillers: { x: number; w: number }[] = [];
  let bx1: number;
  let bx2: number;
  if (full) {
    const sl = xL - SW;
    const sr = xR;
    bx1 = xL;
    bx2 = xR;
    for (const x of reg) {
      if (near(x, sl) || near(x, sr)) continue;
      if (over(x, sl) || over(x, sr)) {
        replaced.push(x);
        continue;
      }
      if (x >= xL - TOL && x + SW <= xR + TOL) {
        cripples.push(x);
        continue;
      }
      studs.push(x);
    }
    sides.push({ x: sl, full: true }, { x: sr, full: true });
  } else {
    const ls = reg.filter((x) => x + SW <= xL + TOL);
    const rs = reg.filter((x) => x >= xR - TOL);
    bx1 = ls.length ? Math.max(...ls) + SW : 0;
    bx2 = rs.length ? Math.min(...rs) : W;
    for (const x of reg) {
      if (x >= bx1 - TOL && x + SW <= bx2 + TOL) cripples.push(x);
      else studs.push(x);
    }
    const gl = xL - bx1;
    const gr = bx2 - xR;
    if (gl >= SW - TOL) sides.push({ x: xL - SW, full: false });
    else if (gl > 1 / 16) fillers.push({ x: bx1, w: gl });
    if (gr >= SW - TOL) sides.push({ x: xR, full: false });
    else if (gr > 1 / 16) fillers.push({ x: xR, w: gr });
  }
  return { W, SW, OC, bt, bayMode, full, xL, xR, ys, yh, studs, cripples, replaced, sides, fillers, bx1, bx2 };
}

export function framingRows(S: TileS, fr: Framing): SheetRow[] {
  const rows: SheetRow[] = [];
  const tub = S.base === 'tub';
  const SW = fr.SW;
  const cMin = Math.min(S.ceilL, cRv(S));
  const cMax = Math.max(S.ceilL, cRv(S));
  const sl = cMax - cMin < 1 / 16 ? fmt(cMin - 2 * SW) : fmt(cMin - 2 * SW) + ' to ' + fmt(cMax - 2 * SW);
  const cb = fr.ys - fr.bt - SW;
  const ca = cMin - SW - (fr.yh + fr.bt);
  rows.push([
    'Stud layout',
    S.framing === 'existing'
      ? S.studMode === 'list'
        ? 'Existing studs, as entered'
        : `Existing studs, ${fmt(S.exOC)} on center from the first at ${fmt(S.stud1)}`
      : `${fmt(fr.OC)} on center from ${fr.bayMode ? 'your stud bay' : S.studStart === 'right' ? 'the right corner' : 'the left corner'}`,
  ]);
  rows.push(...furRows(S));
  rows.push(['Niche sides', `Inside faces at ${fmt(fr.xL)} and ${fmt(fr.xR)} from left corner`, true]);
  rows.push(['Sill block', `Top at ${fmt(fr.ys)} above floor` + (tub ? ` · ${fmt(fr.ys - S.tubH)} above tub` : ''), true]);
  rows.push(['Head block', `Bottom at ${fmt(fr.yh)}, top at ${fmt(fr.yh + fr.bt)} above floor`, true]);
  rows.push(['Framed opening', `${fmt(fr.xR - fr.xL)} wide × ${fmt(fr.yh - fr.ys)} tall`]);
  const cut = [`2 blocks at ${fmt(fr.bx2 - fr.bx1)}, laid ${S.block === 'edge' ? 'on edge' : 'flat'}`];
  if (fr.full) cut.push(`2 full-height side studs at ${sl}`);
  else if (fr.sides.length) cut.push(`${fr.sides.length} side block${fr.sides.length > 1 ? 's' : ''} at ${fmt(fr.yh - fr.ys)}`);
  if (fr.fillers.length) cut.push(`${fr.fillers.map((x) => fmt(x.w)).join(' and ')} rip${fr.fillers.length > 1 ? 's' : ''} beside the opening`);
  if (fr.cripples.length) cut.push(`${fr.cripples.length} cripple${fr.cripples.length > 1 ? 's' : ''} at ${fmt(cb)} below` + (ca > 0.25 ? ` and ${fmt(ca)} above` : ''));
  cut.push(`${fr.studs.length} studs at ${sl}`);
  cut.push(`Bottom plate and top plate at ${fmt(S._frW || S.wallW)}`);
  rows.push(['Cut list', cut.join('<br>')]);
  if (fr.replaced.length)
    rows.push([
      'Layout note',
      `The side stud${fr.replaced.length > 1 ? 's replace' : ' replaces'} the layout stud at ${fr.replaced.map((x) => fmt(x + SW / 2)).join(', ')} on center. Check that drywall seams still land on framing.`,
    ]);
  return rows;
}

export const shiftIn = (S: TileS, k: number) => (S.pat === 'stack' ? 0 : rowShift(S, k));

function bayD(S: TileS, hb: number, y0: number | null, G: Grid | null): Bay {
  const t = S.tileH;
  const g = S.grout;
  const m = t + g;
  const slack = Math.max(0.3, 2 * g + 0.05);
  const rows: number[] = [];
  if (hb < 0.3) return { hb, rows, st: 'bad', top: 0, desc: 'too short' };
  let p = t;
  if (S.start === 'match' && G && y0 != null) {
    p = G.T0 + Math.ceil((y0 + 0.05 - G.T0) / G.m) * G.m - y0;
    if (p > t) p = t;
    p = Math.min(p, hb);
  } else if (hb > t + slack) {
    if (S.start === 'top') {
      p = mod(hb, m);
      if (p < slack || p > t) p = t;
    } else if (S.start === 'balance') {
      const k = Math.max(0, Math.ceil((hb - g - 2 * t) / m - 1e-9));
      p = (hb - g - k * m) / 2;
      if (p <= 0.05) p = t;
      p = Math.min(p, t);
    }
  }
  const h = Math.min(p, hb);
  rows.push(h);
  let y = h + g;
  while (hb - y > slack && rows.length < 200) {
    const hh = Math.min(t, hb - y);
    rows.push(hh);
    y += hh + g;
  }
  const f = rows[0]!;
  const l = rows[rows.length - 1]!;
  const parts: string[] = [];
  let st: St = 'full';
  if (f < t - EPS) {
    st = worse(st, stat(S, f, t));
    parts.push(fmt(f) + (rows.length > 1 ? ' bottom' : ''));
  }
  if (rows.length > 1 && l < t - EPS) {
    st = worse(st, stat(S, l, t));
    parts.push(fmt(l) + ' top');
  }
  return { hb, rows, st, top: l, desc: parts.join(', ') };
}

/** The inside of the niche as drawn: shelf positions and the tile in each bay. */
export function interiorD(S: TileS, hF: number, sF: number | null, G: Grid | null): Interior {
  const n = S.shelves && S.shelves * S.shelfT < hF - 2 ? S.shelves : 0;
  const s = S.shelfT;
  let sh: number[] = [];
  if (n && S.shelfPos === 'center') {
    const cs = centeredShelves(S, hF);
    return { shelves: cs, bays: [bayD(S, hF, sF, G)], over: true };
  }
  if (n) {
    if (S.shelfPos === 'even') {
      const c = (hF - n * s) / (n + 1);
      for (let i = 1; i <= n; i++) sh.push(i * c + (i - 1) * s);
    } else if (S.shelfPos === 'custom') {
      const a = Math.min(Math.max(S.shelf1, 0.5), hF - s - 0.5);
      sh.push(a);
      if (n > 1) {
        const b = Math.min(Math.max(S.shelf2, a + s + 0.5), hF - s - 0.5);
        if (b >= a + s + 0.5) sh.push(b);
      }
    } else sh = shelfPlan(S, hF).shelves;
  }
  const hbs: number[] = [];
  let b0 = 0;
  for (const y of sh) {
    hbs.push(y - b0);
    b0 = y + s;
  }
  hbs.push(hF - b0);
  const starts: number[] = [sF ?? 0];
  for (const y of sh) starts.push((sF ?? 0) + y + s);
  return { shelves: sh, bays: hbs.map((hb, i) => bayD(S, hb, sF == null ? null : starts[i]!, G)) };
}

export function interiorX(S: TileS, L: number, w: number): { ix: number; mn: number } {
  const tw = S.tileW;
  const g = S.grout;
  const mw = tw + g;
  const c = S.pat === 'stack' ? 1 : shiftCount(S);
  const cands = S.side === 'tile' ? [L + w / 2 - tw / 2] : S.side === 'joint' ? [L + w / 2 + g / 2] : [L + w / 2 - tw / 2, L + w / 2 + g / 2];
  if (S.side === 'auto') for (let s = 0; s < mw; s += 1 / 16) cands.push(L + s);
  let best: { ix: number; mn: number } | null = null;
  for (const ix of cands) {
    let mn = Infinity;
    for (let k = 0; k < c; k++) {
      const ps = rowPieces(S, ix, (k * mw) / c, L, L + w);
      if (ps.length > 1) for (const q of [ps[0]!, ps[ps.length - 1]!]) if (q.w < tw - EPS) mn = Math.min(mn, q.w);
    }
    if (!best || mn > best.mn + 0.25) best = { ix, mn };
  }
  return best!;
}

/** Full courses below and above the niche. */
export function courseRoom(S: TileS, r: Opt): { below: number; above: number } {
  const G = r.G;
  const e = ext(S);
  const e1 = r.sF - sillGap(S);
  const e2 = r.sF + r.hF + e;
  const top = Math.min(S.ceilL, cRv(S)) - S.gap;
  let below = 0;
  let above = 0;
  for (let i = 0; i < 600; i++) {
    const Ti = G.T0 + i * G.m;
    if (Ti - G.t > top) break;
    if (Ti <= e1 + TOL && Ti - G.t >= G.b - TOL) below++;
    if (Ti - G.t >= e2 - TOL && Ti <= top + TOL) above++;
  }
  return { below, above };
}

export function cutsFor(S: TileS, r: Opt): CutItem[] {
  const t = S.tileH;
  const tw = S.tileW;
  const h = r.h;
  const items = cutsPlain(S, r);
  const nm = ext(S) ? 'border' : 'niche';
  const lg = (lab: string, l: Leg, dim: number, word: string): CutItem => [lab, l.aligned ? '' : fmt(l.leg) + ' ' + word, legStat(S, l, dim), l.aligned ? 'On joint' : null];
  items.push(lg('Below ' + nm, r.sill, t, 'strip'), lg('Above ' + nm, r.head, t, 'strip'), lg('Left of ' + nm, h.lL, tw, 'leg'), lg('Right of ' + nm, h.lR, tw, 'leg'));
  const B = r.int.bays;
  const names = B.length === 1 ? ['Inside niche'] : B.length === 2 ? ['Inside, lower bay', 'Inside, upper bay'] : ['Inside, lower bay', 'Inside, middle bay', 'Inside, upper bay'];
  B.forEach((b, i) => items.push([names[i]!, b.desc != null ? b.desc : b.top < t - EPS ? 'top piece ' + fmt(b.top) : '', b.st, b.st === 'full' ? 'Full tiles' : null]));
  if (r.int.over && r.int.shelves.length) items.push([r.int.shelves.length > 1 ? 'Tile behind shelves' : 'Tile behind shelf', 'trim in field', 'ok', 'Field cut']);
  if (h.inMin < Infinity) items.push(['Inside, side pieces', fmt(h.inMin) + ' wide', stat(S, h.inMin, tw)]);
  if (ext(S)) items.push(['Border pieces', h.frMin < Infinity ? 'shortest ' + fmt(h.frMin) : '', h.frMin < Infinity ? stat(S, h.frMin, tw) : 'full', h.frMin < Infinity ? null : 'Full pieces']);
  return items;
}

export function sheetFor(S: TileS, r: Opt): SheetRow[] {
  const B = bu(S);
  const h = r.h;
  const W = S.wallW;
  const tub = S.base === 'tub';
  const rows: SheetRow[] = [];
  const rs = r.sF - sillDrop(S);
  const rh = r.hF + B + sillDrop(S);
  const rw = h.w + 2 * B;
  const rl = h.L - B + (S._offL || 0);
  const FW = S._frW || W;
  rows.push([S.framed === 'yes' ? 'Your rough opening' : 'Frame the rough opening', fmt(rw) + ' wide × ' + fmt(rh) + ' tall', true]);
  rows.push(['Rough sill', fmt(rs) + ' above floor' + (tub ? ' · ' + fmt(rs - S.tubH) + ' above tub' : ''), true]);
  rows.push(['Rough head', fmt(rs + rh) + ' above floor']);
  rows.push(...furRows(S));
  rows.push(['Left side', fmt(rl) + ' from left corner' + (S.widthRef === 'framing' ? ' (stud)' : '')]);
  rows.push(['Right side', fmt(FW - rl - rw) + ' from right corner']);
  rows.push(['Finished opening', fmt(h.w) + ' wide × ' + fmt(r.hF) + ' tall']);
  if (r.int.shelves.length) rows.push([r.int.shelves.length > 1 ? 'Shelves' : 'Shelf', r.int.shelves.map((s) => fmt(s)).join(' and ') + ' above finished sill, to underside']);
  const ep = edgeParts(S);
  if (ep)
    rows.push([
      'Bullnose edge',
      `${fmt(S.frameW)} bullnose up the ${S.edge} corner, ${S.tileW}″ pieces from the ${ep.y0 > S.gap + 0.01 ? 'tub' : 'floor'} up` + (ep.top < S.tileW - EPS ? `, top piece ${fmt(ep.top)}` : ''),
    ]);
  if (marble(S)) rows.push(['Marble sill', `${fmt(S.sillT)} thick, projects ${fmt(S.sillProj)}; underside at ${fmt(r.sF - S.sillT)} above floor`]);
  if (ext(S)) rows.push(['Border', fmt(S.frameW) + ' bullnose frame, outside ' + fmt(h.w + 2 * S.frameW) + ' × ' + fmt(r.hF + 2 * S.frameW)]);
  rows.push(['First course', (r.p < S.tileH - EPS ? 'Cut to ' + fmt(r.p) : 'Full tile') + ', top at ' + fmt(r.G.T0) + ' above floor']);
  rows.push(['Ledger line', (tub ? `${fmt(r.G.T0 + r.G.g - S.tubH)} above tub (${fmt(r.G.T0 + r.G.g)} above floor)` : fmt(r.G.T0 + r.G.g) + ' above floor') + ', bottom of 2nd course']);
  rows.push(['Vertical line', verticalLine(S, h)]);
  return rows;
}

export function optTitle(S: TileS, r: Opt): string {
  const t = S.tileH;
  const top = Math.min(r.cl, r.cr);
  if (r.p >= t - EPS) return 'Full tile on the ' + (S.base === 'tub' ? 'tub' : 'floor');
  if (top >= t - EPS) return 'Full tile at the ceiling';
  if (Math.abs(r.p - top) <= 0.25) return 'Even cuts top and bottom';
  return 'Start with a ' + fmt(r.p) + ' course';
}

/** The second line of an option card. */
export function optionLine(S: TileS, o: Opt): string {
  return o.plain
    ? `First course ${o.p < S.tileH - EPS ? fmt(o.p) : 'full'} · top ${Math.min(o.cl, o.cr) < S.tileH - EPS ? fmt(Math.min(o.cl, o.cr)) : 'full'}`
    : `Finished ${fmt(o.h.w)} × ${fmt(o.hF)} · rough sill ${fmt(o.sF - bu(S))}`;
}

export const PILL: Record<St, string> = { full: 'Full tile', border: 'Full tile', ok: 'OK', warn: 'Small', notch: 'Notched', bad: 'Sliver' };
export function worstOf(items: CutItem[]): St {
  let w: St = 'full';
  for (const i of items) w = worse(w, i[2] === 'notch' ? 'ok' : i[2]);
  return w;
}

/**
 * Everything the results screen shows for one chosen option, as the old
 * tool's renderResults worked it out: the option with its course adjustments,
 * the inside of the niche, cuts, the rough-in (or layout) sheet and framing.
 */
export interface Layout {
  /** The finished tile wall (wallW is the finished width). */
  S: TileS;
  options: Opt[];
  /** Index actually used (falls back to 0). */
  optIdx: number;
  /** The option before course adjustments. */
  r0: Opt;
  r: Opt;
  /** False when the adjustments asked for didn't fit, so they were dropped. */
  adjusted: boolean;
  items: CutItem[];
  sheet: SheetRow[];
  fr: Framing;
  frRows: SheetRow[];
}

export interface Adjust {
  adjH: number;
  adjS: number;
  adjHin: number;
  adjSin: number;
}
export const NO_ADJ: Adjust = { adjH: 0, adjS: 0, adjHin: 0, adjSin: 0 };

export function layout(S0: TileS, optIdx: number, adj: Adjust, options?: Opt[]): Layout | null {
  const S = tileS(S0);
  const res = options ?? solve(S);
  if (!res.length) return null;
  const idx = optIdx >= 0 && optIdx < res.length ? optIdx : 0;
  const r0 = res[idx]!;
  let r = r0;
  let adjusted = true;
  if (!r0.plain) {
    const a = adjustOpt(S, r0, adj.adjH, adj.adjS, adj.adjHin, adj.adjSin);
    if (a) r = a;
    else adjusted = false;
    const ixb = interiorX(S, r.h.L, r.h.w);
    r = { ...r, int: interiorD(S, r.hF, r.sF, r.G), h: { ...r.h, ix: ixb.ix, inMin: ixb.mn } };
  }
  const PL = !!r.plain;
  const items = PL ? cutsPlain(S, r) : cutsFor(S, r);
  const sheet = PL ? sheetPlainRows(S, r) : sheetFor(S, r);
  const fr = PL ? framingPlain(S) : framingFor(S, r);
  const frRows = PL ? framingRowsPlain(S, fr) : framingRows(S, fr);
  return { S, options: res, optIdx: idx, r0, r, adjusted, items, sheet, fr, frRows };
}

/** Can the option move by these whole courses and snaps and still keep a full course above and below? */
export function canAdjust(S: TileS, r0: Opt, a: Adjust): boolean {
  const o = adjustOpt(S, r0, a.adjH, a.adjS, a.adjHin, a.adjSin);
  if (!o) return false;
  const q = courseRoom(S, o);
  return q.below >= 1 && q.above >= 1;
}

/** How far the head and sill sit off a grout line (the old tool's "Fine-tune the niche"). */
export function snapInfo(S: TileS, r: Opt) {
  const G = r.G;
  const eE = ext(S);
  const uh = mod(r.sF + r.hF + eE - G.T0, G.m);
  const us = mod(r.sF - sillGap(S) - G.T0, G.m);
  const hOn = uh <= G.g + TOL || uh >= G.m - TOL;
  const sOn = us <= G.g + TOL || us >= G.m - TOL;
  return { hOn, sOn, hd: uh - G.g, hu: G.m - uh + G.g, sd: us, su: G.m - us };
}
