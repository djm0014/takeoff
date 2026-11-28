/**
 * Tile wall drawings, ported from the old Niche Rough-In Planner: the tile
 * elevation (and the setup sketch, when there's no layout yet), the framing
 * elevation, and the printable sheets A-1 (elevations, niche detail, notes)
 * and A-2 (niche section). Each returns SVG text exactly as the old tool
 * built it; tests compare fingerprints of the two.
 *
 * Drawings use the old tool's CSS variables and classes (see the tile part of
 * src/styles/app.css); the sheets carry their own black-on-white style.
 */
import type { TileS } from './settings';
import {
  EPS,
  PATN,
  RANK,
  bu,
  cRv,
  ceilAt,
  ceilPts,
  edgeParts,
  ext,
  fieldL,
  fieldR,
  fmt,
  marble,
  rowPieces,
  rowShift,
  shiftIn,
  sillGap,
  slopeRun,
  splitLen,
  stat,
  tubX,
  worse,
  type Framing,
  type Opt,
  type St,
} from './solve';

export interface Svg {
  /** viewBox */
  vb: string;
  /** inner SVG text */
  h: string;
}

export interface SheetInfo {
  /** Printed on the title block, e.g. "Jan 15, 2026". */
  date: string;
  /** Job name for the title block; the old tool's defaults when blank. */
  job?: string;
  /** The look's name, e.g. "Classic" or "Modified Classic", added to the sheet name. */
  look?: string;
}

export const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f3 = (n: number) => Math.round(n * 1000) / 1000;

/** The tile elevation with the layout r, or the setup sketch when r is null. */
export function drawTile(S: TileS, r: Opt | null): Svg {
  const W = S.wallW;
  const cL = S.ceilL;
  const cR = cRv(S);
  const H = Math.max(cL, cR);
  const fs = Math.max(W, H) * 0.034;
  const tb = tubX(S);
  const ml = fs * (r ? 6.4 : 4.4);
  const mr = fs * (r ? 5 : 4.4);
  const mt = fs * 2.7;
  const mb = fs * 3.4;
  const Y = (y: number) => H - y;
  const f = f3;
  const poly = `0,${f(Y(0))} ${f(W)},${f(Y(0))} ` + ceilPts(S).map(([x, y]) => f(x) + ',' + f(Y(y))).join(' ');
  const R = (x: number, y: number, w: number, h: number, cls: string | null, extra?: string) =>
    `<rect${cls ? ` class="${cls}"` : ''} x="${f(x)}" y="${f(Y(y + h))}" width="${f(Math.max(w, 0))}" height="${f(Math.max(h, 0))}"${extra ? ' ' + extra : ''}/>`;
  const T = (x: number, y: number, s: string, a: string, size: number, cls?: string) =>
    `<text class="${cls || 't-halo'}" x="${f(x)}" y="${f(Y(y))}" font-size="${f(size)}" text-anchor="${a}" stroke-width="${f(size * 0.3)}">${s}</text>`;
  const Ln = (x1: number, y1: number, x2: number, y2: number, extra: string) => `<line x1="${f(x1)}" y1="${f(Y(y1))}" x2="${f(x2)}" y2="${f(Y(y2))}" ${extra}/>`;
  const dimA = `class="dim" stroke-width="${f(fs * 0.08)}"`;
  const tk = fs * 0.35;
  let o = `<defs><clipPath id="wc"><polygon points="${poly}"/></clipPath></defs><polygon points="${poly}" fill="${r ? 'var(--grout)' : 'var(--wall)'}"/>`;
  if (r) {
    const G = r.G;
    const h = r.h;
    const t = S.tileH;
    const tw = S.tileW;
    let g2 = '';
    const iLo = Math.floor((S.gap - G.T0) / G.m) + 1;
    const iHi = Math.ceil((H + t - G.T0) / G.m);
    for (let i = iLo; i <= iHi; i++) {
      const Ti = G.T0 + i * G.m;
      for (const pc of rowPieces(S, h.x0, rowShift(S, i))) {
        const ov = !!tb && pc.x < tb.b - 0.05 && pc.x + pc.w > tb.a + 0.05;
        const inside = ov && pc.x >= tb!.a - 0.01 && pc.x + pc.w <= tb!.b + 0.01;
        if (inside && Ti <= G.b + 0.05) continue;
        const cMax = Math.max(ceilAt(S, pc.x), ceilAt(S, pc.x + pc.w));
        if (Ti - t >= cMax - S.gap) continue;
        const vb = Math.max(Ti - t, ov && Ti > G.b + 0.05 ? G.b : S.gap);
        const ct = Math.min(ceilAt(S, pc.x), ceilAt(S, pc.x + pc.w)) - S.gap;
        const vh = Math.min(Ti, ct) - vb;
        let st: St = vh >= t - EPS ? 'full' : stat(S, vh, t);
        if (pc.w < tw - EPS) {
          const edge = pc.x <= fieldL(S) + 0.01 || pc.x + pc.w >= fieldR(S) - 0.01;
          st = worse(st, edge ? stat(S, pc.w, tw) : 'ok');
        }
        const yb = Math.max(Ti - t, 0);
        g2 += R(pc.x, yb, pc.w, Ti - yb, 'p-' + st);
      }
    }
    const ep = edgeParts(S);
    if (ep)
      for (const q of ep.ps) {
        const st = q.h < tw - EPS ? stat(S, q.h, tw) : 'full';
        g2 += R(ep.x0, q.y, ep.bw, q.h, 'p-' + (RANK[st] >= 2 ? st : 'border'));
      }
    o += `<g clip-path="url(#wc)">${g2}</g>`;
    o += Ln(0, G.T0 + G.g, W, G.T0 + G.g, `class="constr" stroke="var(--accent)" stroke-width="${f(fs * 0.09)}" stroke-dasharray="${f(fs * 0.4)} ${f(fs * 0.25)}"`);
  }
  if (tb) {
    o += R(tb.a, 0, tb.b - tb.a, S.tubH, 'tub');
    o += T((tb.a + tb.b) / 2, S.tubH / 2 - fs * 0.35, r ? 'TUB' : `${fmt(tb.b - tb.a)} tub`, 'middle', fs * 0.9, 't-muted');
  }
  if (r && !r.plain) {
    const h = r.h;
    const t = S.tileH;
    const tw = S.tileW;
    const g = S.grout;
    const e = ext(S);
    const x1 = h.L;
    const x2 = h.L + h.w;
    const y1 = r.sF;
    const y2 = r.sF + r.hF;
    if (marble(S) && !e) o += R(x1, y1 - sillGap(S), h.w, sillGap(S), null, 'fill="var(--grout)"');
    if (e) {
      o += R(x1 - e, y1 - sillGap(S), h.w + 2 * e, r.hF + e + sillGap(S), null, 'fill="var(--grout)"');
      const fw = S.frameW;
      const ps: [number, number, number, number, number][] = [];
      for (const s of splitLen(x1 - fw, x2 + fw, tw, g)) {
        if (!marble(S)) ps.push([s.s, y1 - fw, s.l, fw, s.l]);
        ps.push([s.s, y2, s.l, fw, s.l]);
      }
      if (r.hF > 2 * g + 0.1)
        for (const s of splitLen(y1 + g, y2 - g, tw, g)) {
          ps.push([x1 - fw, s.s, fw, s.l, s.l]);
          ps.push([x2, s.s, fw, s.l, s.l]);
        }
      for (const [x, y, w, hh, len] of ps) {
        const s = len < tw - EPS ? stat(S, len, tw) : 'full';
        o += R(x, y, w, hh, 'p-' + (RANK[s] >= 2 ? s : 'border'));
      }
    }
    o += R(x1, y1, h.w, r.hF, null, 'fill="var(--recess)"');
    let yb = y1;
    r.int.bays.forEach((b) => {
      let y = yb;
      b.rows.forEach((rh, k) => {
        const ps = rowPieces(S, h.ix, shiftIn(S, k), x1, x2);
        const edge = k === 0 || k === b.rows.length - 1;
        for (const pc of ps) {
          let st: St = rh < t - EPS ? (edge ? stat(S, rh, t) : 'ok') : 'full';
          if (pc.w < tw - EPS) st = worse(st, ps.length > 1 ? stat(S, pc.w, tw) : 'ok');
          o += R(pc.x, y, pc.w, rh, 'p-' + st + ' inn');
        }
        y += rh + g;
      });
      yb += b.hb + S.shelfT;
    });
    for (const s of r.int.shelves) o += marble(S) ? R(x1, y1 + s, h.w, S.shelfT, 'marble') : R(x1, y1 + s, h.w, S.shelfT, null, 'fill="var(--accent)"');
    if (marble(S)) o += R(x1, y1 - S.sillT, h.w, S.sillT, 'marble');
    o += R(x1, y1, h.w, r.hF, null, `fill="none" stroke="var(--recess)" stroke-width="${f(fs * 0.16)}"`);
    // niche dimensions
    o += '<g class="constr">';
    const cx = (x1 + x2) / 2;
    const useTub = S.framed !== 'yes' && S.studs !== 'bay' && S.nPos === 'tub' && tb;
    const x0 = useTub ? tb!.a : 0;
    o += Ln(cx, 0, cx, Math.min(ceilAt(S, cx), H), `stroke="var(--accent)" stroke-width="${f(fs * 0.06)}" stroke-dasharray="${f(fs * 0.9)} ${f(fs * 0.25)} ${f(fs * 0.15)} ${f(fs * 0.25)}"`);
    o += T(cx, H + fs * 0.6, '℄ niche', 'middle', fs * 0.8, 't-out');
    const dy = Math.max(fs * 2.2, y1 - sillGap(S) - fs * 1.6);
    if (cx - x0 > fs * 2) {
      o += Ln(x0, dy, cx, dy, dimA) + Ln(x0, dy - tk, x0, dy + tk, dimA) + Ln(cx, dy - tk, cx, dy + tk, dimA);
      o += T((x0 + cx) / 2, dy + fs * 0.3, fmt(cx - x0) + (useTub && x0 > 0.01 ? ' from tub' : ''), 'middle', fs * 0.9);
    }
    const a = fmt(h.w) + ' × ' + fmt(r.hF);
    const ns = Math.min(fs * 0.85, h.w / (a.length * 0.5));
    o += T(cx, y2 - ns * 1.4, a, 'middle', ns) + T(cx, y2 - ns * 2.5, 'finished', 'middle', ns * 0.8);
    o += '</g>';
    {
      const fa = fmt(h.w) + ' × ' + fmt(r.hF);
      const fsz = Math.min(fs * 0.85, h.w / (fa.length * 0.5));
      o += '<g class="pres">' + T(cx, y2 - fsz * 1.4, fa, 'middle', fsz) + '</g>';
    }
  }
  if (r) {
    const G = r.G;
    const t = S.tileH;
    // edge labels
    const cls = (s: St) => (s === 'bad' ? 't-bad' : s === 'warn' ? 't-warn' : 't-out');
    o += '<g class="constr">';
    o += T(W + fs * 0.5, G.b + r.p / 2 - fs * 0.35, r.p < t - EPS ? fmt(r.p) : 'full', 'start', fs * 0.95, cls(stat(S, r.p, t)));
    o += T(W + fs * 0.5, cR - S.gap - r.cr / 2 - fs * 0.35, r.cr < t - EPS ? fmt(r.cr) : 'full', 'start', fs * 0.95, cls(stat(S, r.cr, t)));
    if (!S.ceilLevel) o += T(-fs * 0.5, cL - S.gap - r.cl / 2 - fs * 0.35, r.cl < t - EPS ? fmt(r.cl) : 'full', 'end', fs * 0.95, cls(stat(S, r.cl, t)));
    o += '</g>';
    o +=
      T(-fs * 0.5, G.T0 + G.g + fs * 0.15, S.base === 'tub' ? 'ledger, above tub' : 'ledger', 'end', fs * 0.7, 'constr t-muted') +
      T(-fs * 0.5, G.T0 + G.g - fs * 0.9, fmt(G.T0 + G.g - (S.base === 'tub' ? S.tubH : 0)), 'end', fs * 0.85, 'constr t-out');
  }
  o += `<polygon points="${poly}" fill="none" stroke="var(--ink)" stroke-width="${f(fs * 0.1)}"/>`;
  // overall dimensions
  o += Ln(0, -fs * 1.2, W, -fs * 1.2, dimA) + Ln(0, -fs * 1.2 - tk, 0, -fs * 1.2 + tk, dimA) + Ln(W, -fs * 1.2 - tk, W, -fs * 1.2 + tk, dimA);
  o += T(W / 2, -fs * 2.6, fmt(W) + (r && S.widthRef === 'framing' ? ' finished' : ' wide'), 'middle', fs * 0.95, 't-out');
  if (r) {
    const vch = (pts: number[], x: number, side: number) => {
      let q = Ln(x, pts[0]!, x, pts[pts.length - 1]!, dimA);
      for (const p of pts) q += Ln(x - tk, p, x + tk, p, dimA);
      for (let i = 0; i < pts.length - 1; i++) {
        const tx = x + (side < 0 ? -fs * 0.3 : fs * 0.95);
        const ty = Y((pts[i]! + pts[i + 1]!) / 2);
        q += `<text class="t-out" x="${f(tx)}" y="${f(ty)}" font-size="${f(fs * 0.85)}" text-anchor="middle" transform="rotate(-90 ${f(tx)} ${f(ty)})">${fmt(pts[i + 1]! - pts[i]!)}</text>`;
      }
      return q;
    };
    o += '<g class="constr">' + (tb && tb.a < 0.05 ? vch([0, S.tubH, cL], -fs * 3.5, -1) + vch([0, cL], -fs * 4.9, -1) : vch([0, cL], -fs * 3.5, -1)) + (S.ceilLevel ? '' : vch([0, cR], W + fs * 3.7, 1)) + '</g>';
  } else {
    if (S.ceilLevel) o += T(W / 2, H + fs * 0.7, fmt(cL) + ' floor to ceiling', 'middle', fs * 0.85, 't-muted');
    else {
      o += T(0, H + fs * 0.7, fmt(cL), 'start', fs * 0.85, 't-muted');
      o += T(W, H + fs * 0.7, fmt(cR), 'end', fs * 0.85, 't-muted');
    }
  }
  if (tb && r && tb.a >= 0.05) {
    o +=
      '<g class="constr">' +
      Ln(tb.a - fs * 1.2, 0, tb.a - fs * 1.2, S.tubH, dimA) +
      Ln(tb.a - fs * 1.2 - tk, S.tubH, tb.a - fs * 1.2 + tk, S.tubH, dimA) +
      T(tb.a - fs * 1.6, S.tubH / 2 - fs * 0.35, fmt(S.tubH), 'end', fs * 0.9) +
      '</g>';
  }
  if (tb && !r) {
    o += Ln(-fs * 0.9, 0, -fs * 0.9, S.tubH, dimA) + Ln(-fs * 0.9 - tk, S.tubH, -fs * 0.9 + tk, S.tubH, dimA);
    o += T(-fs * 1.3, S.tubH / 2 - fs * 0.35, fmt(S.tubH), 'end', fs * 0.95, 't-out');
  }
  return { vb: `${f(-ml)} ${f(-mt)} ${f(W + ml + mr)} ${f(H + mt + mb)}`, h: o };
}

/** The framing elevation: studs, plates, niche blocking, rough opening. */
export function drawFraming(S0: TileS, r: Opt, fr: Framing): Svg {
  const S: TileS = { ...S0, wallW: S0._frW || S0.wallW };
  const W = S.wallW;
  const cL = S.ceilL;
  const cR = cRv(S);
  const H = Math.max(cL, cR);
  const fs = Math.max(W, H) * 0.034;
  const SW = fr.SW;
  const bt = fr.bt;
  const tb = (() => {
    const t0 = tubX(S0);
    if (!t0) return null;
    const off = S0._offL || 0;
    return S0.tubPos === 'full' ? { a: S0._furL || 0, b: W - (S0._furR || 0) } : { a: t0.a + off, b: t0.b + off };
  })();
  const ml = fs * 4.4;
  const mr = fs * 5.4;
  const mt = fs * 3.6;
  const mb = fs * 4.4;
  const Y = (y: number) => H - y;
  const f = f3;
  const R = (x: number, y: number, w: number, h: number, cls: string | null, extra?: string) =>
    `<rect${cls ? ` class="${cls}"` : ''} x="${f(x)}" y="${f(Y(y + h))}" width="${f(Math.max(w, 0))}" height="${f(Math.max(h, 0))}"${extra ? ' ' + extra : ''}/>`;
  const T = (x: number, y: number, s: string, a: string, size: number, cls?: string) =>
    `<text class="${cls || 't-halo'}" x="${f(x)}" y="${f(Y(y))}" font-size="${f(size)}" text-anchor="${a}" stroke-width="${f(size * 0.3)}">${s}</text>`;
  const Ln = (x1: number, y1: number, x2: number, y2: number, extra: string) => `<line x1="${f(x1)}" y1="${f(Y(y1))}" x2="${f(x2)}" y2="${f(Y(y2))}" ${extra}/>`;
  const P = (pts: [number, number][]) => `<polygon points="${pts.map(([x, y]) => f(x) + ',' + f(Y(y))).join(' ')}" class="wood"/>`;
  const dimA = `class="dim" stroke-width="${f(fs * 0.08)}"`;
  const tk = fs * 0.35;
  const dash = `fill="none" stroke="var(--ink)" stroke-width="${f(fs * 0.08)}" stroke-dasharray="${f(fs * 0.3)} ${f(fs * 0.2)}"`;
  const cp = ceilPts(S);
  let o = `<polygon points="0,${f(Y(0))} ${f(W)},${f(Y(0))} ${cp.map(([x, y]) => f(x) + ',' + f(Y(y))).join(' ')}" fill="var(--bg)"/>`;
  if (tb) {
    o += R(tb.a, 0, tb.b - tb.a, S.tubH, null, `fill="none" stroke="var(--muted)" stroke-width="${f(fs * 0.08)}" stroke-dasharray="${f(fs * 0.5)} ${f(fs * 0.3)}"`);
  }
  // plates and end-wall furring
  o += R(0, 0, W, SW, 'wood');
  if (S0._furL! > 0.01) o += R(0, 0, S0._furL!, cL, 'filler');
  if (S0._furR! > 0.01) o += R(W - S0._furR!, 0, S0._furR!, cR, 'filler');
  o += P(
    cp
      .slice()
      .reverse()
      .map(([x, y]): [number, number] => [x, y - SW])
      .concat(cp),
  );
  // studs, cripples, niche framing
  const ct = (x: number) => Math.min(ceilAt(S, x), ceilAt(S, x + SW)) - SW;
  for (const x of fr.studs) o += R(x, SW, SW, ct(x) - SW, 'wood');
  if (!fr.plain) {
    for (const x of fr.cripples) {
      o += R(x, SW, SW, fr.ys - bt - SW, 'wood');
      const t2 = ct(x);
      if (t2 - (fr.yh + bt) > 0.05) o += R(x, fr.yh + bt, SW, t2 - fr.yh - bt, 'wood');
    }
    for (const sd of fr.sides) o += sd.full ? R(sd.x, SW, SW, ct(sd.x) - SW, 'block') : R(sd.x, fr.ys, SW, fr.yh - fr.ys, 'block');
    for (const fl of fr.fillers) o += R(fl.x, fr.ys, fl.w, fr.yh - fr.ys, 'filler');
    o += R(fr.bx1, fr.ys - bt, fr.bx2 - fr.bx1, bt, 'block') + R(fr.bx1, fr.yh, fr.bx2 - fr.bx1, bt, 'block');
    o += R(fr.xL, fr.ys, fr.xR - fr.xL, fr.yh - fr.ys, null, dash);
  }
  if (tb) {
    const tx2 = (tb.a + tb.b) / 2 + (fr.studs.some((x) => Math.abs(x + SW / 2 - (tb.a + tb.b) / 2) < fs * 2) ? 8 : 0);
    o += T(tx2, S.tubH / 2 - fs * 0.35, 'TUB ' + fmt(S.tubH), 'middle', fs * 0.85);
  }
  if (!fr.plain) {
    // heights, outside the wall on the right, with dashed extension lines
    const ext2 = `class="dimx" stroke="var(--muted)" stroke-width="${f(fs * 0.05)}" stroke-dasharray="${f(fs * 0.3)} ${f(fs * 0.2)}"`;
    const TK = fs * 0.45;
    const px = W + fs * 1.6;
    const slash = (x: number, y: number) => Ln(x - TK * 0.7, y - TK * 0.7, x + TK * 0.7, y + TK * 0.7, `class="dim" stroke-width="${f(fs * 0.12)}"`);
    const xe = Math.max(fr.xR + (fr.full ? SW : 0), fr.bx2);
    o += Ln(px, 0, px, fr.yh, dimA) + slash(px, 0) + slash(px, fr.ys) + slash(px, fr.yh);
    o += Ln(xe, fr.ys, px + TK, fr.ys, ext2) + Ln(xe, fr.yh, px + TK, fr.yh, ext2);
    o += T(px + fs * 0.55, fr.ys - fs * 0.35, fmt(fr.ys), 'start', fs * 0.9, 't-out') + T(px + fs * 0.55, fr.yh - fs * 0.35, fmt(fr.yh), 'start', fs * 0.9, 't-out');
    o += T(px + fs * 0.55, fr.ys - fs * 1.35, 'sill', 'start', fs * 0.65, 't-muted') + T(px + fs * 0.55, fr.yh + fs * 0.75, 'head', 'start', fs * 0.65, 't-muted');
    // corner to RO and RO width, above the wall with dashed extension lines
    const cTop = Math.max(cL, cR);
    const dyT = cTop + fs * 1.7;
    o += Ln(0, dyT, W, dyT, dimA);
    for (const x of [0, fr.xL, fr.xR, W]) o += slash(x, dyT);
    o += Ln(fr.xL, fr.yh + bt, fr.xL, dyT + TK, ext2) + Ln(fr.xR, fr.yh + bt, fr.xR, dyT + TK, ext2);
    (
      [
        [0, fr.xL],
        [fr.xL, fr.xR],
        [fr.xR, W],
      ] as [number, number][]
    ).forEach(([x0, x1]) => {
      if (x1 - x0 > 0.05) o += T((x0 + x1) / 2, dyT + fs * 0.35, fmt(x1 - x0), 'middle', fs * 0.85, 't-out');
    });
    // inside framing size
    const fw = fr.xR - fr.xL;
    const fh = fr.yh - fr.ys;
    const a = fmt(fw) + ' × ' + fmt(fh);
    const ns = Math.min(fs * 0.85, fw / (a.length * 0.5));
    const cx = (fr.xL + fr.xR) / 2;
    const my = (fr.ys + fr.yh) / 2;
    o += T(cx, my + ns * 0.3, a, 'middle', ns) + T(cx, my - ns * 0.9, 'RO', 'middle', ns * 0.8);
  }
  // stud centers along the floor
  for (const x of fr.studs.concat(fr.cripples)) if (x > 0.01 && x < W - SW - 0.01) o += T(x + SW / 2, -fs * 1.1, fmt(x + SW / 2, false), 'middle', fs * 0.62, 't-muted');
  o += Ln(0, -fs * 2.1, W, -fs * 2.1, dimA) + Ln(0, -fs * 2.1 - tk, 0, -fs * 2.1 + tk, dimA) + Ln(W, -fs * 2.1 - tk, W, -fs * 2.1 + tk, dimA);
  o += T(W / 2, -fs * 3.4, fmt(W) + ' wide · stud centers from left', 'middle', fs * 0.85, 't-out');
  if (S.ceilLevel) o += T(W / 2, H + fs * 0.7, fmt(cL) + ' floor to ceiling', 'middle', fs * 0.85, 't-muted');
  else {
    o += T(0, H + fs * 0.7, fmt(cL), 'start', fs * 0.85, 't-muted');
    o += T(W, H + fs * 0.7, fmt(cR), 'end', fs * 0.85, 't-muted');
  }
  void r;
  return { vb: `${f(-ml)} ${f(-mt)} ${f(W + ml + mr)} ${f(H + mt + mb)}`, h: o };
}

/* ---------- construction sheets ---------- */

interface DimCtx {
  H: number;
  fs: number;
}
function dimsH(c: DimCtx, xs: number[], y: number): string {
  const Y = (v: number) => c.H - v;
  const fs = c.fs;
  const tk = fs * 0.3;
  const sz = fs * 0.8;
  const sw = f3(fs * 0.05);
  let o = `<line class="dl" x1="${f3(xs[0]!)}" y1="${f3(Y(y))}" x2="${f3(xs[xs.length - 1]!)}" y2="${f3(Y(y))}" stroke-width="${sw}"/>`;
  for (const x of xs)
    o += `<line class="dl" x1="${f3(x)}" y1="${f3(Y(y) - tk * 1.6)}" x2="${f3(x)}" y2="${f3(Y(y) + tk * 0.8)}" stroke-width="${sw}"/><line class="dl" x1="${f3(x - tk)}" y1="${f3(Y(y) + tk)}" x2="${f3(x + tk)}" y2="${f3(Y(y) - tk)}" stroke-width="${f3(fs * 0.09)}"/>`;
  let flip = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const s = xs[i + 1]! - xs[i]!;
    if (s < 0.05) continue;
    const lab = fmt(s);
    const fits = s > lab.length * sz * 0.5 + fs * 0.3;
    const ty = fits ? y + fs * 0.25 : y + fs * 0.25 + (flip++ % 2 ? 0 : sz * 1.1);
    o += `<text class="dt" x="${f3((xs[i]! + xs[i + 1]!) / 2)}" y="${f3(Y(ty))}" font-size="${f3(sz)}" text-anchor="middle">${lab}</text>`;
  }
  return o;
}
function dimsV(c: DimCtx, ys: number[], x: number): string {
  const Y = (v: number) => c.H - v;
  const fs = c.fs;
  const tk = fs * 0.3;
  const sz = fs * 0.8;
  const sw = f3(fs * 0.05);
  let o = `<line class="dl" x1="${f3(x)}" y1="${f3(Y(ys[0]!))}" x2="${f3(x)}" y2="${f3(Y(ys[ys.length - 1]!))}" stroke-width="${sw}"/>`;
  for (const y of ys)
    o += `<line class="dl" x1="${f3(x - tk * 0.8)}" y1="${f3(Y(y))}" x2="${f3(x + tk * 1.6)}" y2="${f3(Y(y))}" stroke-width="${sw}"/><line class="dl" x1="${f3(x - tk)}" y1="${f3(Y(y) + tk)}" x2="${f3(x + tk)}" y2="${f3(Y(y) - tk)}" stroke-width="${f3(fs * 0.09)}"/>`;
  let flip = 0;
  for (let i = 0; i < ys.length - 1; i++) {
    const s = ys[i + 1]! - ys[i]!;
    if (s < 0.05) continue;
    const lab = fmt(s);
    const fits = s > lab.length * sz * 0.5 + fs * 0.3;
    const tx = fits ? x - fs * 0.3 : x - fs * 0.3 - (flip++ % 2 ? 0 : sz * 1.1);
    const ty = Y((ys[i]! + ys[i + 1]!) / 2);
    o += `<text class="dt" x="${f3(tx)}" y="${f3(ty)}" font-size="${f3(sz)}" text-anchor="middle" transform="rotate(-90 ${f3(tx)} ${f3(ty)})">${lab}</text>`;
  }
  return o;
}
function wrapLines(t: string, n: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of t.split(' ')) {
    if ((line + ' ' + w).trim().length > n) {
      out.push(line.trim());
      line = w;
    } else line += ' ' + w;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}
const SHEET_CSS = `.sheet{font-family:"Barlow Semi Condensed","Arial Narrow",Arial,sans-serif;background:#fff}
.sheet text{fill:#000;stroke:none;font-weight:600}
.sheet .el text:not(.dt){display:none}
.sheet .el .dim,.sheet .el .dimx,.sheet .tileel rect.constr{display:none}
.sheet [fill^="var("]{fill:#fff}
.sheet [stroke^="var("]{stroke:#000}
.sheet [fill="var(--accent)"]{fill:#333}
.sheet [fill="var(--bad-fill)"]{fill:#fff}
.sheet rect[class^="p-"]{fill:#fff;stroke:#000;stroke-width:.6px;vector-effect:non-scaling-stroke}
.sheet .wood,.sheet .filler{fill:#fff;stroke:#000;stroke-width:.8px;vector-effect:non-scaling-stroke}
.sheet .block{fill:#c8c8c8;stroke:#000;stroke-width:.8px;vector-effect:non-scaling-stroke}
.sheet .marble{fill:#f3f3f3;stroke:#000;stroke-width:.8px;vector-effect:non-scaling-stroke}
.sheet .tub{fill:#fff;stroke:#000;stroke-width:1.2px;vector-effect:non-scaling-stroke}
.sheet line.constr{stroke:#000}
.sheet .dl{stroke:#000}
.sheet .hair{stroke:#000;stroke-width:1px;fill:none}
.sheet .heavy{stroke:#000;stroke-width:2.5px;fill:none}`;

const nest = (cap: Svg, x: number, y: number, w: number, hh: number, cls: string) =>
  `<svg class="el ${cls}" x="${x}" y="${y}" width="${w}" height="${hh}" viewBox="${cap.vb}" preserveAspectRatio="xMidYMid meet">${cap.h}</svg>`;
const T = (x: number, y: number, s: string | number, sz: number, ex?: string) => `<text x="${x}" y="${y}" font-size="${sz}"${ex ? ' ' + ex : ''}>${s}</text>`;
const title = (n: string, x: number, y: number, t: string, sub: string, len = 400) =>
  `<circle cx="${x + 16}" cy="${y - 6}" r="16" class="hair" fill="none"/>` +
  T(x + 16, y, n, 17, 'text-anchor="middle"') +
  `<line x1="${x + 40}" y1="${y + 6}" x2="${x + len}" y2="${y + 6}" class="hair"/>` +
  T(x + 42, y, t, 19) +
  T(x + 42, y + 26, sub, 13, 'style="font-weight:500"');
function titleBlock(rows: [string, string][], sheet: string): string {
  let tbs = `<rect x="1200" y="880" width="460" height="180" class="heavy" fill="none"/><line x1="1580" y1="880" x2="1580" y2="1060" class="hair"/>`;
  rows.forEach(([k, v], i) => {
    const y = 880 + i * 36;
    if (i) tbs += `<line x1="1200" y1="${y}" x2="1580" y2="${y}" class="hair"/>`;
    tbs += T(1210, y + 14, k, 10, 'style="font-weight:500"') + T(1210, y + 31, v, 15);
  });
  tbs += `<line x1="1200" y1="1024" x2="1580" y2="1024" class="hair"/>` + T(1210, 1046, 'Dimensions govern. Do not scale.', 12, 'style="font-weight:500"');
  tbs += T(1620, 940, 'SHEET', 10, 'text-anchor="middle" style="font-weight:500"') + T(1620, 990, sheet, 34, 'text-anchor="middle"');
  return tbs;
}
const frame = `<rect x="0" y="0" width="1700" height="1100" fill="#fff"/><rect x="20" y="20" width="1660" height="1060" class="heavy" fill="none"/>`;
function notesText(notes: string[], y0: number): string {
  let ny = y0;
  let nt = '';
  notes.forEach((n, i) => {
    wrapLines(n, 58).forEach((l, j) => {
      nt += T(1218, ny, (j ? '    ' : i + 1 + '. ') + esc(l), 13, 'style="font-weight:500"');
      ny += 17;
    });
    ny += 4;
  });
  return nt;
}

/** Sheet A-1 for a plain tile wall: framing and tile elevations, notes. */
function sheetPlain(S: TileS, r: Opt, fr: Framing, info: SheetInfo): string {
  const W = S.wallW;
  const FW = S._frW || W;
  const cR = cRv(S);
  const H = Math.max(S.ceilL, cR);
  const tub = S.base === 'tub';
  const G = r.G;
  const ffs = Math.max(W, H) * 0.034;
  const c = { H, fs: ffs };
  const sr = slopeRun(S);
  const xb = S.ceilL < cR ? sr : W - sr;
  const fc = drawFraming(S, r, fr);
  fc.h += dimsH(c, [0, FW], -ffs * 2.9) + dimsV(c, [0, cR], FW + ffs * 1.5) + (S.ceilLevel ? '' : dimsV(c, [0, S.ceilL], -ffs * 1.5)) + (sr < W - 0.05 ? dimsH(c, [0, xb, W], H + ffs * 1.2) : '');
  const tc = drawTile(S, r);
  const hs = [0];
  if (tub) hs.push(S.tubH);
  hs.push(G.T0 + G.g, cR);
  tc.h += dimsH(c, [0, W], -ffs * 2.9) + dimsV(c, hs, W + ffs * 1.5) + (S.ceilLevel ? '' : dimsV(c, [0, S.ceilL], -ffs * 1.5)) + (sr < W - 0.05 ? dimsH(c, [0, xb, W], H + ffs * 1.2) : '');
  const notes = [
    'Dimensions are from the finished floor and the left inside corner unless noted. Verify in field before cutting.',
    tub
      ? `Set a ledger with its top ${fmt(G.T0 + G.g - S.tubH)} above the tub (bottom of 2nd course). First course ${r.p < S.tileH - EPS ? 'cut to ' + fmt(r.p) : 'full tile'}.`
      : `Set a ledger with its top at ${fmt(G.T0 + G.g)} above floor. First course ${r.p < S.tileH - EPS ? 'cut to ' + fmt(r.p) : 'full tile'}.`,
    `Field tile ${fmt(S.tileH)} × ${fmt(S.tileW)}, ${S.grout < 0.05 ? 'butted joint' : fmt(S.grout) + ' joint'}, ${PATN[S.pattern]}.`,
    `Build-up ${fmt(bu(S))}: ${fmt(S.board)} board, ${fmt(S.thinset)} thinset, ${fmt(S.tileT)} tile.`,
  ];
  if (S.edge !== 'none') notes.push(`${fmt(S.frameW)} bullnose on the ${S.edge} outside corner.`);
  notes.push('Check tub for level and walls for plumb before layout.');
  const nt = notesText(notes, 78);
  const tbs = titleBlock(
    [
      ['PROJECT', esc(info.job || 'Tile wall')],
      ['SHEET', 'Tile wall: framing and tile' + (info.look ? ' · ' + esc(info.look) : '')],
      ['DATE', info.date],
      ['DRAWN', 'Niche Rough-In Planner'],
    ],
    'A-1',
  );
  return (
    `<style>${SHEET_CSS}</style>` +
    frame +
    nest(fc, 40, 40, 560, 800, 'frameel') +
    title('1', 60, 880, 'FRAMING ELEVATION', `${fmt(fr.OC)} o.c. studs · single top plate`) +
    nest(tc, 620, 40, 560, 800, 'tileel') +
    title('2', 640, 880, 'TILE ELEVATION', 'Layout line dimensions') +
    T(1210, 56, 'NOTES', 15) +
    nt +
    tbs
  );
}

/** Sheet A-1 for a niche wall: framing and tile elevations, niche detail, notes. */
function sheetNiche(S: TileS, r: Opt, fr: Framing, info: SheetInfo): string {
  const B = bu(S);
  const h = r.h;
  const W = S.wallW;
  const FW = S._frW || W;
  const cL = S.ceilL;
  const cR = cRv(S);
  const H = Math.max(cL, cR);
  const SW = fr.SW;
  const bt = fr.bt;
  const tub = S.base === 'tub';
  // 1 framing
  const fc = drawFraming(S, r, fr);
  const ffs = Math.max(W, H) * 0.034;
  const cF = { H, fs: ffs };
  let fx = dimsH(cF, [0, fr.xL, fr.xR, FW], -ffs * 1.4) + dimsH(cF, [0, FW], -ffs * 2.9);
  fx += dimsV(cF, [0, fr.ys, fr.yh, cR], FW + ffs * 1.5) + dimsV(cF, [0, cR], FW + ffs * 3.1);
  if (!S.ceilLevel) fx += dimsV(cF, [0, cL], -ffs * 1.5);
  const sr = slopeRun(S);
  if (sr < W - 0.05) {
    const xb = S.ceilL < cR ? sr : FW - sr;
    const top = H + ffs * 1.2;
    fx += dimsH(cF, [0, xb, FW], top);
  }
  fc.h += fx;
  // 2 tile
  const tc = drawTile(S, r);
  const cT = { H, fs: ffs };
  const G = r.G;
  const hs = [0];
  if (tub) hs.push(S.tubH);
  hs.push(G.T0 + G.g, r.sF, r.sF + r.hF, cR);
  let tx = dimsH(cT, [0, h.L, h.L + h.w, W], -ffs * 1.4) + dimsH(cT, [0, W], -ffs * 2.9) + dimsV(cT, hs.sort((a, b) => a - b), W + ffs * 1.5) + dimsV(cT, [0, cR], W + ffs * 3.1);
  if (!S.ceilLevel) tx += dimsV(cT, [0, cL], -ffs * 1.5);
  if (sr < W - 0.05) {
    const xb = S.ceilL < cR ? sr : W - sr;
    tx += dimsH(cT, [0, xb, W], H + ffs * 1.2);
  }
  tc.h += tx;
  // 3 niche detail
  const pad = 7;
  const x0 = fr.xL - SW - pad;
  const x1 = fr.xR + SW + pad;
  const y0 = fr.ys - bt - pad;
  const y1 = fr.yh + bt + pad;
  const dw = x1 - x0;
  const dh = y1 - y0;
  const dfs = Math.max(dw, dh) * 0.045;
  const Yd = (v: number) => y1 - v;
  const R = (x: number, y: number, w: number, hh: number, cls: string | null, ex?: string) =>
    `<rect${cls ? ` class="${cls}"` : ''} x="${f3(x)}" y="${f3(Yd(y + hh))}" width="${f3(Math.max(w, 0))}" height="${f3(Math.max(hh, 0))}"${ex ? ' ' + ex : ''}/>`;
  let nd = '';
  for (const sd of fr.sides) nd += sd.full ? R(sd.x, y0, SW, dh, 'wood') : R(sd.x, fr.ys, SW, fr.yh - fr.ys, 'block');
  nd += R(fr.bx1, fr.ys - bt, fr.bx2 - fr.bx1, bt, 'block') + R(fr.bx1, fr.yh, fr.bx2 - fr.bx1, bt, 'block');
  nd += R(fr.xL, fr.ys, fr.xR - fr.xL, fr.yh - fr.ys, null, `fill="none" stroke="#000" stroke-width="${f3(dfs * 0.06)}" stroke-dasharray="${f3(dfs * 0.3)} ${f3(dfs * 0.2)}"`);
  const e = ext(S);
  const L = h.L;
  const fw = h.w;
  const sF = r.sF;
  const hF = r.hF;
  if (e) {
    const bw = S.frameW;
    nd += R(L - bw, sF - bw, fw + 2 * bw, hF + 2 * bw, null, `fill="#fff" stroke="#000" stroke-width="${f3(dfs * 0.05)}"`);
  }
  nd += R(L, sF, fw, hF, null, `fill="#fff" stroke="#000" stroke-width="${f3(dfs * 0.1)}"`);
  for (const s of r.int.shelves) nd += R(L, sF + s, fw, S.shelfT, null, marble(S) ? 'fill="#eee" stroke="#000" stroke-width="' + f3(dfs * 0.04) + '"' : 'fill="#333"');
  if (marble(S)) nd += R(L, sF - S.sillT, fw, S.sillT, null, 'fill="#eee" stroke="#000" stroke-width="' + f3(dfs * 0.05) + '"');
  const cD = { H: y1, fs: dfs };
  nd += dimsH(cD, [fr.xL, fr.xR], fr.ys - bt - dfs * 1.6) + dimsH(cD, [L, L + fw], fr.yh + bt + dfs * 1.2);
  nd += dimsV(cD, [fr.ys, fr.yh], fr.xL - SW - dfs * 1.2);
  const sy = [sF];
  for (const s of r.int.shelves) sy.push(sF + s, sF + s + S.shelfT);
  sy.push(sF + hF);
  nd += dimsV(cD, sy, fr.xR + SW + dfs * 1.6);
  const dvb = `${f3(x0 - dfs * 1.5)} ${f3(-dfs * 1.5)} ${f3(dw + dfs * 4)} ${f3(dh + dfs * 3)}`;
  // sheet frame
  const notes = [
    'Dimensions are from the finished floor and the left inside corner unless noted. Verify in field before cutting.',
    `Rough opening is framing. Finished opening is smaller by ${fmt(B)} per face (board, thinset, tile).`,
    `Set a ledger with its top at ${fmt(G.T0 + G.g)} above floor (bottom of 2nd course). First course ${r.p < S.tileH - EPS ? 'cut to ' + fmt(r.p) : 'full tile'}.`,
    `Field tile ${fmt(S.tileH)} × ${fmt(S.tileW)}, ${S.grout < 0.05 ? 'butted joint' : fmt(S.grout) + ' joint'}, ${PATN[S.pattern]}.`,
    `Niche sides: ${fr.full ? 'full-height studs' : 'blocks between sill and head'}. Blocking 2×4 laid ${S.block === 'edge' ? 'on edge' : 'flat'}.`,
  ];
  if (r.int.over && r.int.shelves.length) notes.push(`Shelf ${r.int.shelves.length > 1 ? 'positions are evenly spaced' : 'is centered'} in the niche. Tile runs behind it; trim in the field.`);
  if (marble(S)) notes.push(`${fmt(S.sillT)} marble sill projecting ${fmt(S.sillProj)} past the field tile; field tile stops one joint below it.${r.int.shelves.length ? ' Shelf is matching marble.' : ''}`);
  if (ext(S)) notes.push(`${fmt(S.frameW)} bullnose border around the niche${marble(S) ? ', sides and head' : ''}.`);
  if (S.edge !== 'none') notes.push(`${fmt(S.frameW)} bullnose on the ${S.edge} outside corner.`);
  notes.push('Check tub for level and walls for plumb before layout.');
  const nt = notesText(notes, 578);
  const tbs = titleBlock(
    [
      ['PROJECT', esc(info.job || 'Tub wall with niche')],
      ['SHEET', 'Tub wall: niche framing and tile' + (info.look ? ' · ' + esc(info.look) : '')],
      ['DATE', info.date],
      ['DRAWN', 'Niche Rough-In Planner'],
    ],
    'A-1',
  );
  return (
    `<style>${SHEET_CSS}</style>` +
    frame +
    nest(fc, 40, 40, 560, 800, 'frameel') +
    title('1', 60, 880, 'FRAMING ELEVATION', `${fmt(fr.OC)} o.c. studs · single top plate · niche blocking`) +
    nest(tc, 620, 40, 560, 800, 'tileel') +
    title('2', 640, 880, 'TILE ELEVATION', 'Finished niche and layout line dimensions') +
    `<svg class="el" x="1200" y="40" width="460" height="420" viewBox="${dvb}" preserveAspectRatio="xMidYMid meet">${nd}</svg>` +
    title('3', 1210, 500, 'NICHE DETAIL', `Rough ${fmt(fr.xR - fr.xL)} × ${fmt(fr.yh - fr.ys)} · finished ${fmt(fw)} × ${fmt(hF)}`) +
    T(1210, 556, 'NOTES', 15) +
    nt +
    tbs
  );
}

/** Sheet A-1, 1700 × 1100 (11×17 at 100 per inch). */
export function sheetA1(S: TileS, r: Opt, fr: Framing, info: SheetInfo): string {
  return r.plain ? sheetPlain(S, r, fr, info) : sheetNiche(S, r, fr, info);
}

/* ---------- niche section (sheet A-2) ---------- */

function sectionSVG(S: TileS, r: Opt, fr: Framing): Svg {
  const D = S.studD || 3.5;
  const b = S.board;
  const t = S.thinset;
  const k = S.tileT;
  const B = b + t + k;
  const bt = fr.bt;
  const tub = S.base === 'tub';
  const g = S.grout;
  const th = S.tileH;
  const ys = fr.ys;
  const yh = fr.yh;
  const sF = r.sF;
  const fh = r.sF + r.hF;
  const e = ext(S);
  const fw = S.frameW;
  const G = r.G;
  const shel = r.int.shelves;
  const sT = S.shelfT;
  const ceil = Math.min(S.ceilL, cRv(S));
  // vertical zones kept at full scale; the rest is broken out
  let segs: [number, number][] = [];
  if (tub) segs.push([S.tubH - 1.3, S.tubH + 2]);
  segs.push([ys - bt - 2.6, sF + 1.8]);
  for (const s of shel) segs.push([sF + s - 1.5, sF + s + sT + 1.5]);
  segs.push([fh - 1.8, Math.min(yh + bt + 1.5, ceil)]);
  segs.sort((a, b2) => a[0] - b2[0]);
  const m: [number, number][] = [];
  for (const sg of segs) {
    const l = m[m.length - 1];
    if (l && sg[0] <= l[1] + 2) l[1] = Math.max(l[1], sg[1]);
    else m.push([sg[0], sg[1]]);
  }
  segs = m;
  const GAP = 1.0;
  const desc = segs.slice().reverse();
  const off: number[] = [];
  let acc = 0;
  desc.forEach((sg) => {
    off.push(acc);
    acc += sg[1] - sg[0] + GAP;
  });
  const Ht = acc - GAP;
  const mapY = (y: number) => {
    for (let i = 0; i < desc.length; i++) {
      const sg = desc[i]!;
      if (y >= sg[0] - 1e-6 && y <= sg[1] + 1e-6) return off[i]! + (sg[1] - y);
    }
    for (let i = 0; i < desc.length - 1; i++) {
      if (y < desc[i]![0] && y > desc[i + 1]![1]) return off[i]! + (desc[i]![1] - desc[i]![0]) + GAP / 2;
    }
    return y > desc[0]![1] ? 0 : Ht;
  };
  const R = (x0: number, x1: number, y0: number, y1: number, ex: string) => {
    let o = '';
    for (const sg of segs) {
      const lo = Math.max(y0, sg[0]);
      const hi = Math.min(y1, sg[1]);
      if (hi - lo > 1e-4 && x1 - x0 > 1e-4) o += `<rect x="${f3(x0)}" y="${f3(mapY(hi))}" width="${f3(x1 - x0)}" height="${f3(hi - lo)}" ${ex}/>`;
    }
    return o;
  };
  const VL = (x: number, y0: number, y1: number, ex: string) => {
    let o = '';
    for (const sg of segs) {
      const lo = Math.max(y0, sg[0]);
      const hi = Math.min(y1, sg[1]);
      if (hi - lo > 1e-4) o += `<line x1="${f3(x)}" y1="${f3(mapY(hi))}" x2="${f3(x)}" y2="${f3(mapY(lo))}" ${ex}/>`;
    }
    return o;
  };
  const HAT = 'fill="url(#secBoard)" stroke="#000" stroke-width="0.02"';
  const THN = 'fill="#8a8a8a" stroke="none"';
  const TIL = 'fill="#e4e4e4" stroke="#000" stroke-width="0.02"';
  const BLK = 'fill="#fff" stroke="#000" stroke-width="0.03"';
  const yLo = segs[0]![0];
  const yTop = segs[segs.length - 1]![1];
  let o = `<defs><pattern id="secBoard" patternUnits="userSpaceOnUse" width="0.22" height="0.22" patternTransform="rotate(45)"><rect width="0.22" height="0.22" fill="#fff"/><line x1="0" y1="0" x2="0" y2="0.22" stroke="#000" stroke-width="0.025"/></pattern></defs>`;
  // studs beyond (outline of the bay)
  o += VL(0, yLo, yTop, 'stroke="#777" stroke-width="0.025"') + VL(D, yLo, ys - bt, 'stroke="#777" stroke-width="0.025"') + VL(D, yh + bt, yTop, 'stroke="#777" stroke-width="0.025"');
  // blocking with an X
  const blk = (y0: number, y1: number) => {
    o += R(0, D, y0, y1, BLK);
    o += `<line x1="0" y1="${f3(mapY(y1))}" x2="${f3(D)}" y2="${f3(mapY(y0))}" stroke="#000" stroke-width="0.02"/><line x1="0" y1="${f3(mapY(y0))}" x2="${f3(D)}" y2="${f3(mapY(y1))}" stroke="#000" stroke-width="0.02"/>`;
  };
  blk(ys - bt, ys);
  if (yh + bt <= yTop + 1e-6) blk(yh, yh + bt);
  const fBot = tub ? S.tubH + 0.25 : yLo;
  // tub
  if (tub) {
    o += R(D, D + B + 5, S.tubH - 1.2, S.tubH, 'fill="#fff" stroke="#000" stroke-width="0.04"') + R(D - 0.12, D, S.tubH - 1.2, S.tubH + 1, 'fill="#fff" stroke="#000" stroke-width="0.03"');
  }
  // face build-up below and above the opening
  o += R(D, D + b, fBot, ys, HAT) + R(D, D + b, yh, yTop, HAT);
  o += R(D + b, D + b + t, tub ? S.tubH + S.gap : yLo, ys + b, THN) + R(D + b, D + b + t, yh - b, yTop, THN);
  // niche lining: sill, head, back
  o += R(0, D + b, ys, ys + b, HAT) + R(0, D + b, yh - b, yh, HAT) + R(0, b, ys + b, yh - b, HAT);
  o += R(b, D + b + t, ys + b, ys + b + t, THN) + R(b, D + b + t, yh - b - t, yh - b, THN) + R(b, b + t, ys + b + t, yh - b - t, THN);
  const MAR = 'fill="#f3f3f3" stroke="#000" stroke-width="0.04"';
  o += (marble(S) ? R(b + t, D + B + S.sillProj, ys + b + t, sF, MAR) : R(b + t, D + b + t, ys + b + t, sF, TIL)) + R(b + t, D + b + t, fh, yh - b - t, TIL);
  // back wall tile inside the niche
  let yb = sF;
  for (const bay of r.int.bays) {
    let y = yb;
    bay.rows.forEach((hh) => {
      o += R(b + t, B, y, y + hh, TIL);
      y += hh + g;
    });
    yb += bay.hb + (r.int.over ? 0 : sT);
  }
  // face tile courses, stopping at the bullnose border if there is one
  const fBelow = sF - sillGap(S);
  const fAbove = e ? fh + fw + g : fh;
  const fStart = tub ? S.tubH + S.gap : yLo;
  const i0 = Math.floor((fStart - G.T0) / G.m);
  const i1 = Math.ceil((yTop + th - G.T0) / G.m);
  for (let i = i0; i <= i1; i++) {
    const Ti = G.T0 + i * G.m;
    const lo = Math.max(Ti - th, fStart);
    const hi = Ti;
    const a = [lo, Math.min(hi, fBelow)] as const;
    const c = [Math.max(lo, fAbove), hi] as const;
    if (a[1] - a[0] > 0.02) o += R(D + b + t, D + B, a[0], a[1], TIL);
    if (c[1] - c[0] > 0.02 && c[0] < yTop) o += R(D + b + t, D + B, c[0], Math.min(c[1], yTop), TIL);
  }
  if (e) {
    o += (marble(S) ? '' : R(D + b + t, D + B, sF - fw, sF, 'fill="#cfcfcf" stroke="#000" stroke-width="0.03"')) + R(D + b + t, D + B, fh, fh + fw, 'fill="#cfcfcf" stroke="#000" stroke-width="0.03"');
  }
  // shelves
  for (const s of shel) o += R(b + t, D + B, sF + s, sF + s + sT, marble(S) ? MAR : 'fill="#bdbdbd" stroke="#000" stroke-width="0.04"');
  // break lines
  for (let i = 0; i < desc.length - 1; i++) {
    const yc = off[i]! + (desc[i]![1] - desc[i]![0]) + GAP / 2;
    const x0 = -0.6;
    const x1 = D + B + 0.6;
    const w = x1 - x0;
    o += `<polyline points="${f3(x0)},${f3(yc)} ${f3(x0 + w * 0.42)},${f3(yc)} ${f3(x0 + w * 0.47)},${f3(yc - 0.45)} ${f3(x0 + w * 0.53)},${f3(yc + 0.45)} ${f3(x0 + w * 0.58)},${f3(yc)} ${f3(x1)},${f3(yc)}" fill="none" stroke="#000" stroke-width="0.03"/>`;
  }
  // dimension chains on the back side
  const fz = 0.36;
  const tk = 0.16;
  const dl = 'stroke="#000" stroke-width="0.025"';
  const chain = (pts0: number[], x: number) => {
    const pts = pts0.filter((v, i, a) => i === 0 || v - a[i - 1]! > 0.01);
    let s = `<line x1="${f3(x)}" y1="${f3(mapY(pts[0]!))}" x2="${f3(x)}" y2="${f3(mapY(pts[pts.length - 1]!))}" ${dl}/>`;
    let flip = 0;
    for (const p of pts) {
      const yy = mapY(p);
      s += `<line x1="${f3(x - tk)}" y1="${f3(yy + tk)}" x2="${f3(x + tk)}" y2="${f3(yy - tk)}" stroke="#000" stroke-width="0.04"/><line x1="${f3(x)}" y1="${f3(yy)}" x2="${f3(x + 0.5)}" y2="${f3(yy)}" stroke="#000" stroke-width="0.015"/>`;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const d = pts[i + 1]! - pts[i]!;
      const y0 = mapY(pts[i + 1]!);
      const y1 = mapY(pts[i]!);
      const lab = fmt(d);
      const room = y1 - y0 > lab.length * fz * 0.5 + 0.2;
      const tx = room ? x - 0.18 : x - 0.18 - (flip++ % 2 ? 0 : fz * 1.15);
      const ty = (y0 + y1) / 2;
      s += `<text x="${f3(tx)}" y="${f3(ty)}" font-size="${fz}" text-anchor="middle" transform="rotate(-90 ${f3(tx)} ${f3(ty)})">${lab}</text>`;
    }
    return s;
  };
  const pts: number[] = [];
  if (tub) pts.push(S.tubH);
  pts.push(ys);
  if (marble(S)) pts.push(sF - S.sillT);
  pts.push(sF);
  for (const s of shel) pts.push(sF + s, sF + s + sT);
  pts.push(fh, yh);
  o += chain(pts, -1.4) + chain([ys, yh], -2.9);
  // depth dims across the top
  const yT = -0.9;
  const hd = (x0: number, x1: number, y: number, lab: string) =>
    `<line x1="${f3(x0)}" y1="${f3(y)}" x2="${f3(x1)}" y2="${f3(y)}" ${dl}/>` +
    [x0, x1]
      .map(
        (x) =>
          `<line x1="${f3(x - tk)}" y1="${f3(y + tk)}" x2="${f3(x + tk)}" y2="${f3(y - tk)}" stroke="#000" stroke-width="0.04"/><line x1="${f3(x)}" y1="${f3(y - 0.15)}" x2="${f3(x)}" y2="${f3(0)}" stroke="#000" stroke-width="0.015"/>`,
      )
      .join('') +
    `<text x="${f3((x0 + x1) / 2)}" y="${f3(y - 0.15)}" font-size="${fz}" text-anchor="middle">${lab}</text>`;
  o += hd(0, D, yT - 0.9, 'stud ' + fmt(D)) + hd(B, D + B, yT, 'finished depth ' + fmt(D));
  // callouts on the face side
  const lx = D + B + 6;
  const callouts: [string, number, number][] = [];
  const lowY = (y: number) => mapY(y);
  callouts.push([`${fmt(b)} tile board`, D + b / 2, ys - 1.2]);
  callouts.push([`${fmt(t)} thinset`, D + b + t / 2, ys - 1.7]);
  callouts.push([`${fmt(k)} tile`, D + b + t + k / 2, ys - 2.2]);
  callouts.push([`2×4 sill block, ${S.block === 'edge' ? 'on edge' : 'flat'}`, D / 2, ys - bt / 2]);
  callouts.push(marble(S) ? [`${fmt(S.sillT)} marble sill, ${fmt(S.sillProj)} past tile`, D + B + S.sillProj * 0.6, sF - S.sillT / 2] : [`Sill: board, thinset, tile`, D * 0.6, ys + b + t / 2]);
  if (marble(S)) callouts.push([`Board and thinset under sill`, D * 0.4, ys + b / 2]);
  if (yh + bt <= yTop + 1e-6) callouts.push([`2×4 head block`, D / 2, yh + bt / 2]);
  callouts.push([`Back: board, thinset, tile`, B / 2, fh - 1]);
  shel.forEach((s, i) => callouts.push([`${fmt(sT)} ${marble(S) ? 'marble ' : ''}shelf` + (shel.length > 1 ? ` ${i + 1}` : ''), D * 0.7, sF + s + sT / 2]));
  if (e) callouts.push([`${fmt(fw)} bullnose`, D + b + t + k / 2, sF - fw / 2]);
  if (tub) callouts.push(['Tub', D + B + 3, S.tubH - 0.6]);
  callouts.sort((a, b2) => lowY(a[2]) - lowY(b2[2]));
  let lastY = -99;
  for (const [lab, px, py] of callouts) {
    const yy = lowY(py);
    const ty = Math.max(yy, lastY + fz * 1.5);
    lastY = ty;
    o += `<polyline points="${f3(px)},${f3(yy)} ${f3(lx - 0.6)},${f3(ty)} ${f3(lx - 0.15)},${f3(ty)}" fill="none" stroke="#000" stroke-width="0.018"/><circle cx="${f3(px)}" cy="${f3(yy)}" r="0.06" fill="#000"/>`;
    o += `<text x="${f3(lx)}" y="${f3(ty + fz * 0.35)}" font-size="${fz}">${esc(lab)}</text>`;
  }
  const vb = `${f3(-4.2)} ${f3(-3)} ${f3(D + B + 6 + 10.5)} ${f3(Ht + 3.5)}`;
  return { vb, h: o };
}

/** Sheet A-2: section through the niche, build-up and key heights. */
export function sheetA2(S: TileS, r: Opt, fr: Framing, info: SheetInfo): string {
  const B = bu(S);
  const D = S.studD || 3.5;
  const h = r.h;
  const tub = S.base === 'tub';
  const sec = sectionSVG(S, r, fr);
  const rows = (y0: number, head: string, list: [string, string][]) => {
    let s = T(1210, y0, head, 15);
    list.forEach(([a, v], i) => {
      const y = y0 + 24 + i * 21;
      s += T(1214, y, esc(a), 13, 'style="font-weight:500"') + T(1650, y, esc(v), 13, 'text-anchor="end"');
    });
    return s;
  };
  const hts: [string, string][] = [];
  if (tub) hts.push(['Top of tub', fmt(S.tubH)]);
  hts.push(['Top of sill block (rough sill)', fmt(fr.ys)]);
  if (marble(S)) hts.push(['Underside of marble sill', fmt(r.sF - S.sillT)]);
  hts.push(['Finished sill', fmt(r.sF)]);
  r.int.shelves.forEach((s, i) => hts.push([`Underside of shelf${r.int.shelves.length > 1 ? ' ' + (i + 1) : ''}`, fmt(r.sF + s)]));
  hts.push(['Finished head', fmt(r.sF + r.hF)], ['Bottom of head block (rough head)', fmt(fr.yh)], ['Top of head block', fmt(fr.yh + fr.bt)]);
  const tbs = titleBlock(
    [
      ['PROJECT', esc(info.job || 'Tub wall with niche')],
      ['SHEET', 'Niche section' + (info.look ? ' · ' + esc(info.look) : '')],
      ['DATE', info.date],
      ['DRAWN', 'Niche Rough-In Planner'],
    ],
    'A-2',
  );
  return (
    `<style>${SHEET_CSS}</style>` +
    frame +
    `<svg class="secel" x="60" y="40" width="1100" height="800" viewBox="${sec.vb}" preserveAspectRatio="xMidYMid meet">${sec.h}</svg>` +
    title('4', 80, 880, 'NICHE SECTION', 'Cut at the center of the niche. Breaks remove plain wall; heights are dimensioned, not to scale.', 460) +
    rows(70, 'BUILD-UP, EACH FACE', [
      ['Tile board', fmt(S.board)],
      ['Thinset', fmt(S.thinset)],
      ['Tile', fmt(S.tileT)],
      ['Total', fmt(B)],
    ]) +
    rows(205, 'NICHE', [
      ['Rough opening', `${fmt(fr.xR - fr.xL)} × ${fmt(fr.yh - fr.ys)}`],
      ['Finished opening', `${fmt(h.w)} × ${fmt(r.hF)}`],
      ['Stud depth', fmt(D)],
      ['Finished depth', fmt(D)],
      ...(marble(S) ? ([['Marble sill', `${fmt(S.sillT)}, projects ${fmt(S.sillProj)}`]] as [string, string][]) : []),
      ...(r.int.shelves.length ? ([['Shelf thickness', fmt(S.shelfT) + (marble(S) ? ' marble' : '')]] as [string, string][]) : []),
    ]) +
    rows(360, 'KEY HEIGHTS ABOVE FLOOR', hts) +
    (marble(S)
      ? T(1210, 350 + hts.length * 21 + 80, 'Field tile stops one grout joint below the marble sill,', 12, 'style="font-weight:500"') +
        T(1210, 350 + hts.length * 21 + 96, 'which caps it. The head tile tucks behind the field tile.', 12, 'style="font-weight:500"')
      : T(1210, 350 + hts.length * 21 + 80, 'Planner assumes field tile ends flush with the finished', 12, 'style="font-weight:500"') +
        T(1210, 350 + hts.length * 21 + 96, 'sill and head, with sill and head tile tucked behind it.', 12, 'style="font-weight:500"')) +
    tbs
  );
}
