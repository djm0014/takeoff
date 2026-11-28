/**
 * Auto mode: named looks. Each look is a set of rules (docs/tile-looks.md);
 * the planner tries the patterns, grout joints, tile-or-joint on center,
 * layout-line moves, niche sizes and course moves the look allows, checks
 * every rule on each layout, and keeps the best one that passes them all.
 * A look that can't keep its rules on this wall gives no layout.
 *
 * Built on the ported solver: a look only changes settings the old tool
 * already had (or the new shift / onCenter / quarter / groutFixed ones), so a
 * look's layout is an ordinary layout you can keep fine-tuning by hand.
 */
import type { TileS } from './settings';
import {
  fieldL,
  fieldR,
  fmt,
  isPlain,
  layout,
  NO_ADJ,
  rowPieces,
  shiftCount,
  solve,
  studCenters,
  tileS,
  type Adjust,
  type Layout,
  type Opt,
} from './solve';

export type LookKey = 'classic' | 'balanced' | 'simple';
export type Shape = 'square' | 'tall' | 'linear';

export const LOOKS: { key: LookKey; name: string; blurb: string }[] = [
  { key: 'classic', name: 'Classic', blurb: 'Symmetrical: niche and tile centered on the wall, the same piece at both corners.' },
  { key: 'balanced', name: 'Balanced', blurb: 'Niche centered; the tile may move up to a quarter tile off center to clear corner slivers.' },
  { key: 'simple', name: 'Simple', blurb: 'The niche goes in the stud bay nearest the center; less planning, the tile lines up as it falls.' },
];
export const lookName = (k: string | null | undefined) => LOOKS.find((l) => l.key === k)?.name ?? '';

/** Finished niche sizes by shape: target, and the range a look may use. Heights also allow one course over. */
export const SHAPES: Record<Shape, { name: string; w: number; h: number; wMin: number; wMax: number; hMin: number; hMax: number; shelves: boolean }> = {
  square: { name: 'Square', w: 14, h: 14, wMin: 12, wMax: 16, hMin: 12, hMax: 16, shelves: false },
  tall: { name: 'Tall', w: 13.5, h: 28, wMin: 12, wMax: 15, hMin: 26, hMax: 30, shelves: true },
  linear: { name: 'Linear', w: 29, h: 11, wMin: 26, wMax: 32, hMin: 10, hMax: 12, shelves: false },
};

/** The shape the answers point to. */
export function shapeOf(S: TileS): Shape {
  const w = S.nPreset === 'custom' ? S.nW : Number(S.nPreset.split('x')[0]);
  const h = S.nPreset === 'custom' ? S.nH : Number(S.nPreset.split('x')[1]);
  if (w > h * 1.5) return 'linear';
  if (h > w * 1.5) return 'tall';
  return 'square';
}

/* ---------- the rules (docs/tile-looks.md) ---------- */

const SILL_MIN = 40;
const SILL_MAX = 52;
const SILL_LO = 42;
const SILL_HI = 48;
/** Clear height in every niche bay: shampoo bottles. */
const BAY_MIN = 10;
const GROUTS = [1 / 16, 3 / 32, 1 / 8, 5 / 32, 3 / 16];

export interface Check {
  ok: boolean;
  /** Rules this layout breaks, in words. */
  fails: string[];
  /** True when only the niche's own rules fail (course moves may fix it). */
  nicheOnly: boolean;
  /** Lower is better, among layouts that pass. */
  score: number;
}

/** Clear heights between the sill, shelves and head. */
function bayHeights(S: TileS, r: Opt): number[] {
  const out: number[] = [];
  let y = 0;
  for (const s of r.int.shelves) {
    out.push(s - y);
    y = s + S.shelfT;
  }
  out.push(r.hF - y);
  return out;
}

const minCorner = (L: Layout) => Math.min(L.r.h.cL, L.r.h.cR, L.S.tileW);

/** Check a layout against the rules every look keeps, plus the look's own. */
export function checkLook(look: LookKey, L: Layout, shape: Shape | null, base: TileS): Check {
  const S = L.S;
  const r = L.r;
  const th = S.tileH;
  const tw = S.tileW;
  const fails: string[] = [];
  let score = 0;
  let other = 0;

  const corner = minCorner(L);
  if (corner < tw / 4 - 1e-6) fails.push(`corner pieces down to ${fmt(corner)} (under a quarter tile)`);
  score += ((tw - corner) / tw) * 5;
  if (look === 'classic') {
    const a = Math.min(r.h.cL, tw);
    const b = Math.min(r.h.cR, tw);
    if (Math.abs(a - b) > 1 / 32) fails.push(`corners not equal (${fmt(a)} and ${fmt(b)})`);
  }
  other = fails.length;

  const top = Math.min(r.cl, r.cr);
  if (top < th / 2 - 1e-6) fails.push(`top course ${fmt(top)} (under half a tile)`);
  score += ((th - Math.min(top, th)) / th) * 3;
  if (r.p < th * 0.75 - 1e-6) fails.push(`bottom course ${fmt(r.p)} (under 3/4 of a tile)`);
  score += ((th - r.p) / th) * 10;
  other = fails.length;

  if (!r.plain) {
    if (!r.sill.aligned || !r.head.aligned) fails.push('niche top or bottom not on a grout line');
    if (r.sF < SILL_MIN - 1e-6 || r.sF > SILL_MAX + 1e-6) fails.push(`niche sill at ${fmt(r.sF)} (outside 40″ to 52″)`);
    score += Math.max(0, SILL_LO - r.sF, r.sF - SILL_HI) * 1;
    const bays = bayHeights(S, r);
    if (bays.some((b) => b < BAY_MIN - 1e-6)) fails.push(`a niche bay under ${BAY_MIN}″ tall`);
    if (shape && S.framed !== 'yes') {
      const sh = SHAPES[shape];
      const m = r.G.m;
      if (r.hF < Math.max(sh.hMin, BAY_MIN) - 1e-6 || r.hF > sh.hMax + m + 1e-6) fails.push(`niche ${fmt(r.hF)} tall (not ${sh.name.toLowerCase()})`);
      if (S.studs !== 'bay' && (r.h.w < sh.wMin - 1e-6 || r.h.w > sh.wMax + 1e-6)) fails.push(`niche ${fmt(r.h.w)} wide (not ${sh.name.toLowerCase()})`);
      if (shape === 'linear' && r.h.w <= r.hF) fails.push('linear niche not wider than tall');
      score += (Math.abs(r.h.w - sh.w) + Math.abs(r.hF - sh.h)) * 0.3;
    }
    if (look === 'classic' || look === 'balanced') {
      const mid = (fieldL(S) + fieldR(S)) / 2;
      const nc = r.h.L + r.h.w / 2;
      if (Math.abs(nc - mid) > 0.25) fails.push('niche not centered on the wall');
    }
  }
  // Prefer the answers' own grout and pattern, and small line moves.
  score += Math.abs(S.grout - base.grout) * 40;
  score += Math.abs(S.shift || 0) * 0.5;
  return { ok: fails.length === 0, fails, nicheOnly: other === 0 && fails.length > 0, score };
}

/* ---------- searching ---------- */

export interface LookResult {
  look: LookKey;
  /** Settings for this look (answers with the look's choices applied). */
  S: TileS | null;
  optIdx: number;
  adj: Adjust;
  L: Layout | null;
  options: Opt[];
  check: Check | null;
  /** Why it didn't fit, when it didn't. */
  reason: string;
}

/** The smallest corner piece with the layout line at xc (a tile centered on it). */
function cornerAt(T: TileS, xc: number): number {
  const tw = T.tileW;
  const mw = tw + T.grout;
  const c = shiftCount(T);
  let mn = tw;
  for (let k = 0; k < c; k++) {
    const ps = rowPieces(T, xc - tw / 2, (k * mw) / c);
    if (ps.length) mn = Math.min(mn, ps[0]!.w, ps[ps.length - 1]!.w);
  }
  return mn;
}

/** Shortest move of the layout line off the wall's center (within max) that gives corners of at least a quarter tile; else the best one. */
function lineShift(V: TileS, max: number): number {
  const T = tileS(V);
  const base = (fieldL(T) + fieldR(T)) / 2;
  const want = T.tileW / 4;
  let best = { d: 0, m: -1 };
  for (let i = 1; i <= Math.round(max * 16); i++) {
    for (const d of [i / 16, -i / 16]) {
      const m = cornerAt(T, base + d);
      if (m >= want - 1e-6) return d;
      if (m > best.m + 1e-6) best = { d, m };
    }
  }
  return best.d;
}

/** Stud bay (left stud face, from the left corner framing) whose middle is nearest the wall's middle. */
function centerBay(V: TileS): number | null {
  const W = V.wallW;
  const OC = V.framing === 'existing' && V.studMode === 'oc' ? V.exOC : 16;
  const T = { ...V, studs: 'free' as const };
  const xs = studCenters(T, W).sort((a, b) => a - b);
  let best: number | null = null;
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i]! + 1.5;
    const b = xs[i + 1]!;
    if (Math.abs(b - a - (OC - 1.5)) > 0.5) continue;
    if (best == null || Math.abs((a + b) / 2 - W / 2) < Math.abs(best + (OC - 1.5) / 2 - W / 2)) best = a;
  }
  return best;
}

/** Course moves to try when an option is close: sill up/down, height up/down. */
const MOVES: Adjust[] = [NO_ADJ];
for (const adjS of [0, -1, 1, -2, 2]) for (const adjH of [0, -1, 1, -2, 2]) if (adjS || adjH) MOVES.push({ adjH, adjS, adjHin: 0, adjSin: 0 });

interface Best {
  S: TileS;
  optIdx: number;
  adj: Adjust;
  L: Layout;
  options: Opt[];
  check: Check;
}

/** Try every option of these settings (and course moves for the niche); the best that passes, or the closest miss. */
function tryVariant(look: LookKey, V: TileS, shape: Shape | null, base: TileS, keep: { best: Best | null; miss: Best | null }): void {
  const options = solve(V);
  options.forEach((o, i) => {
    for (const adj of MOVES) {
      const L = layout(V, i, adj, options);
      if (!L || (adj !== NO_ADJ && !L.adjusted)) continue;
      const check = checkLook(look, L, shape, base);
      const cand = { S: V, optIdx: i, adj, L, options, check };
      if (check.ok) {
        if (!keep.best || check.score < keep.best.check.score - 1e-9) keep.best = cand;
        break; // the first course moves that pass are the least change for this option
      }
      if (!keep.miss || check.fails.length < keep.miss.check.fails.length || (check.fails.length === keep.miss.check.fails.length && check.score < keep.miss.check.score)) keep.miss = cand;
      // Course moves only help the niche's own rules.
      if (o.plain || !check.nicheOnly) break;
    }
  });
}

/** The best layout for a look on this wall, or why there isn't one. */
export function solveLook(look: LookKey, base: TileS, shape: Shape | null): LookResult {
  const niche = !isPlain(base) && base.framed !== '';
  const framed = base.framed === 'yes';
  const none = (reason: string): LookResult => ({ look, S: null, optIdx: 0, adj: NO_ADJ, L: null, options: [], check: null, reason });

  // The answers' own pattern first when the look allows it; the next only if that one can't keep the rules.
  const allowed: TileS['pattern'][] = look === 'classic' ? ['half', 'stack'] : look === 'balanced' ? ['half', 'stack', 'quarter'] : ['half', 'third', 'quarter', 'stack'];
  const uniq = allowed.includes(base.pattern) ? [base.pattern, ...allowed.filter((p) => p !== base.pattern)] : allowed;
  const grouts = base.groutFixed ? [base.grout] : [base.grout, ...GROUTS.filter((g) => Math.abs(g - base.grout) > 1e-9).sort((a, b) => Math.abs(a - base.grout) - Math.abs(b - base.grout))];

  // The niche the look asks for.
  const N: Partial<TileS> = {};
  if (niche && !framed && shape) {
    const sh = SHAPES[shape];
    Object.assign(N, { nPreset: 'custom', nW: sh.w, nH: sh.h, nSill: (SILL_LO + SILL_HI) / 2 });
    if (!sh.shelves) N.shelves = 0;
  }
  if (niche && !framed) {
    if (look === 'simple') {
      if (shape === 'linear') return none('A linear niche is wider than a stud bay, so it needs a header.');
      const bay = centerBay(base);
      if (bay == null) return none('No regular stud bay near the middle of this wall.');
      Object.assign(N, { studs: 'bay', bayL: bay });
    } else Object.assign(N, { studs: 'free', nPos: 'wall' });
  }

  const keep: { best: Best | null; miss: Best | null } = { best: null, miss: null };
  let cornerMiss = '';
  // Corner pieces depend only on the pattern, grout and line (the tile is centered on the wall), so check them before solving.
  const cornersOk = (V: TileS, xcOff: number) => {
    const T = tileS(V);
    const m = cornerAt(T, (fieldL(T) + fieldR(T)) / 2 + xcOff);
    if (m >= T.tileW / 4 - 1e-6) return true;
    if (!cornerMiss) cornerMiss = `corner pieces down to ${fmt(m)} (under a quarter tile)`;
    return false;
  };
  for (const pattern of uniq) {
    for (const grout of grouts) {
      const V0: TileS = { ...base, ...N, pattern, grout, center: 'wall', shift: 0, onCenter: 'auto', sideLegs: false };
      const tw = V0.tileW;
      if (look === 'classic') {
        if (cornersOk(V0, 0)) tryVariant(look, { ...V0, onCenter: 'tile' }, shape, base, keep);
        if (cornersOk(V0, grout / 2 + tw / 2)) tryVariant(look, { ...V0, onCenter: 'joint' }, shape, base, keep);
      } else if (cornersOk(V0, 0)) {
        tryVariant(look, { ...V0, onCenter: 'tile' }, shape, base, keep);
        if (pattern === 'stack') tryVariant(look, { ...V0, onCenter: 'joint' }, shape, base, keep);
      } else {
        const d = lineShift(V0, look === 'balanced' ? tw / 4 : (tw + grout) / 2);
        if (cornersOk(V0, d)) tryVariant(look, { ...V0, shift: d }, shape, base, keep);
      }
      if (keep.best) break; // the least grout change that works
    }
    if (keep.best) break; // the first pattern that works
  }
  const b = keep.best;
  if (b) return { look, S: b.S, optIdx: b.optIdx, adj: b.adj, L: b.L, options: b.options, check: b.check, reason: '' };
  const m = keep.miss;
  return none(m ? m.check.fails[0]! : cornerMiss || 'No layout fits this wall.');
}

/** One line for a look's card. */
export function lookLine(R: LookResult): string {
  if (!R.L || !R.S) return R.reason;
  const L = R.L;
  const S = L.S;
  const parts = [`${({ half: 'Half bond', third: '1/3 offset', quarter: '1/4 offset', stack: 'Stacked' } as const)[S.pattern]}, ${fmt(S.grout)} joint`];
  if (!L.r.plain) parts.push(`niche ${fmt(L.r.h.w)} × ${fmt(L.r.hF)}, sill ${fmt(L.r.sF)} AFF`);
  parts.push(`corners ${fmt(minCorner(L))} and up`);
  if (S.shift) parts.push(`tile moved ${fmt(Math.abs(S.shift))} ${S.shift < 0 ? 'left' : 'right'}`);
  return parts.join(' · ');
}
