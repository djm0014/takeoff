/**
 * Floor plan drawing (SVG markup). Fixture and opening symbols are drawn in
 * each wall's local frame, as in the old tool, so they work on walls at any
 * angle.
 */
import type { Item, Wall } from '../data/model';
import { formatInches } from '../lib/inches';
import { headingVector, headings, toPlan, wallMatrix, type Pt, type RoomGeom, type WallGeom } from './geometry';
import type { Zone } from './checks';
import { DRYWALL, type Framing } from './framing';
import { doorSize, isFixture, isOpening, itemName, span, toiletCenter } from './items';

export type PlanView = 'existing' | 'design' | 'framing';

export interface DrawInput {
  room: RoomGeom;
  walls: Wall[];
  items: Item[];
  view: PlanView;
  zones: Zone[];
  /** Item being dragged, drawn heavier. */
  activeId?: string | null;
  /** Needed for the framing view. */
  framing?: Framing;
  /** Wall being edited, drawn in the accent color. */
  highlightWall?: number | null;
  /** Draw dimension strings (default true). Off, the room fills the window. */
  showDims?: boolean;
  /** Extra touch area around each item, in plan inches (so small items are easy to tap). */
  hitPad?: number;
}

const r2 = (v: number) => Math.round(v * 1000) / 1000;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pts = (list: Pt[]) => list.map((p) => `${r2(p.x)},${r2(p.y)}`).join(' ');
const dimText = (v: number) => formatInches(v, { mark: false, feet: v >= 24 }).replace('′-', "'-");

export function visibleIn(view: PlanView, it: Item): boolean {
  return view === 'existing' ? it.status !== 'new' : view === 'framing' ? it.status !== 'remove' : true;
}

function fixtureSymbol(it: Item, pad: number): string {
  const [u0, u1, , d] = span(it);
  const w = u1 - u0;
  let s = `<rect class="hit" x="${r2(u0 - pad)}" y="${r2(-pad)}" width="${r2(w + 2 * pad)}" height="${r2(d + 2 * pad)}"/>`;
  if (it.type === 'tub') {
    const dx = it.props.drain === 'right' ? u1 - 7 : u0 + 7;
    s += `<rect class="fx" x="${u0}" y="0" width="${w}" height="${d}"/><rect class="fx2" x="${u0 + 2.5}" y="2.5" width="${Math.max(0, w - 5)}" height="${Math.max(0, d - 5)}" rx="7"/><circle class="fx2" cx="${dx}" cy="${d / 2}" r="1.3"/>`;
  } else if (it.type === 'shower') {
    s += `<rect class="fx" x="${u0}" y="0" width="${w}" height="${d}"/><path class="fx2" d="M${u0} 0L${u1} ${d}M${u1} 0L${u0} ${d}"/><circle class="fx2" cx="${(u0 + u1) / 2}" cy="${d / 2}" r="1.6"/>`;
  } else if (it.type === 'toilet') {
    const c = toiletCenter(it);
    const top = 9.75;
    const bot = d;
    s += `<rect class="fx" x="${c - 10}" y="0.75" width="20" height="8.5" rx="1.2"/><ellipse class="fx" cx="${c}" cy="${(top + bot) / 2}" rx="7.5" ry="${Math.max(1, (bot - top) / 2)}"/><ellipse class="fx2" cx="${c}" cy="${(top + bot) / 2 + 1}" rx="5" ry="${Math.max(1, (bot - top) / 2 - 3)}"/>`;
  } else {
    s += `<rect class="fx" x="${u0}" y="0" width="${w}" height="${d}"/><ellipse class="fx2" cx="${(u0 + u1) / 2}" cy="${d / 2 + 1}" rx="${Math.max(2, Math.min(w / 2 - 3, 9))}" ry="${Math.max(2, Math.min(d / 2 - 3, 7))}"/>`;
  }
  return s;
}

function openingSymbol(it: Item, t: number, removed: boolean, pad: number): string {
  const [u0, u1] = span(it);
  if (removed) return `<rect class="infill" x="${u0}" y="${-t}" width="${u1 - u0}" height="${t}"/>`;
  let s =
    `<rect class="cut" x="${u0}" y="${-t - 0.05}" width="${u1 - u0}" height="${t + 0.1}"/>` +
    `<rect class="hit" x="${r2(u0 - pad)}" y="${r2(-t - pad)}" width="${r2(u1 - u0 + 2 * pad)}" height="${r2(t + 2 * pad)}"/>` +
    `<path class="ln" d="M${u0} ${-t}V0M${u1} ${-t}V0"/>`;
  if (it.type === 'window') return s + `<path class="ln" d="M${u0} ${-t}H${u1}M${u0} ${-t / 2}H${u1}M${u0} 0H${u1}"/>`;
  const sz = doorSize(it);
  const left = it.props.hinge !== 'right';
  const hu = left ? u0 + 0.75 : u1 - 0.75;
  const tip = left ? hu + sz : hu - sz;
  if (it.props.swing === 'out') {
    const b = -t;
    return s + `<path class="leaf" d="M${hu} ${b}V${b - sz}"/><path class="arc" d="M${tip} ${b}A${sz} ${sz} 0 0 ${left ? 0 : 1} ${hu} ${b - sz}"/>`;
  }
  return s + `<path class="leaf" d="M${hu} 0V${sz}"/><path class="arc" d="M${tip} 0A${sz} ${sz} 0 0 ${left ? 1 : 0} ${hu} ${sz}"/>`;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** Label boxes drawn so far, so dimension strings can keep clear of each other. */
let boxes: Box[] = [];
const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function textAngle(w: WallGeom): number {
  let ang = (Math.atan2(w.dirU.y, w.dirU.x) * 180) / Math.PI;
  if (ang > 90.01) ang -= 180;
  if (ang <= -90.01) ang += 180;
  return ang;
}

/** Rough on-plan box of a label, for overlap tests. */
function textBox(w: WallGeom, u: number, v: number, text: string, size: number): Box {
  const p = toPlan(w, u, v);
  const a = (textAngle(w) * Math.PI) / 180;
  const L = text.length * size * 0.55;
  const H = size;
  const bw = Math.abs(L * Math.cos(a)) + Math.abs(H * Math.sin(a));
  const bh = Math.abs(L * Math.sin(a)) + Math.abs(H * Math.cos(a));
  return { x0: p.x - bw / 2, y0: p.y - bh / 2, x1: p.x + bw / 2, y1: p.y + bh / 2 };
}

/** Text rotated to run along a wall, kept upright. */
function alongText(w: WallGeom, u: number, v: number, text: string, size: number, cls = 'dt'): string {
  const p = toPlan(w, u, v);
  const ang = textAngle(w);
  const rot = Math.abs(ang) > 0.01 ? ` transform="rotate(${r2(ang)} ${r2(p.x)} ${r2(p.y)})"` : '';
  return `<text class="${cls}" font-size="${r2(size)}" text-anchor="middle" dominant-baseline="central" x="${r2(p.x)}" y="${r2(p.y)}"${rot}>${esc(text)}</text>`;
}

/** A dimension string along a wall, outside it at distance `d` from the finished face. */
function chain(w: WallGeom, us: number[], d: number, fs: number, ext: number, out?: Box[]): string {
  const list = [...new Set(us.map(r2))].sort((a, b) => a - b);
  if (list.length < 2) return '';
  const P = (u: number, v: number) => {
    const p = toPlan(w, u, v);
    return `${r2(p.x)} ${r2(p.y)}`;
  };
  const tk = fs * 0.32;
  let s = `<path class="dim" d="M${P(list[0]!, -d)}L${P(list[list.length - 1]!, -d)}`;
  for (const u of list) s += `M${P(u, -ext)}L${P(u, -d - tk)}M${P(u - tk, -d + tk)}L${P(u + tk, -d - tk)}`;
  s += '"/>';
  let alt = false;
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i]!;
    const b = list[i + 1]!;
    if (b - a < 0.05) continue;
    const small = b - a < fs * 2.6;
    alt = small ? !alt : false;
    const tv = -d - fs * 0.55 - (small && alt ? fs * 1.15 : 0);
    out?.push(textBox(w, (a + b) / 2, tv, dimText(b - a), fs * 0.82));
    s += alongText(w, (a + b) / 2, tv, dimText(b - a), fs * 0.82);
  }
  return s;
}

export function drawPlan(input: DrawInput): string {
  const { room, walls, items, view, zones } = input;
  const b = room.bounds;
  const span0 = Math.max(b.maxX - b.minX, b.maxY - b.minY, 48);
  const fs = span0 / 24;
  const hitPad = input.hitPad ?? fs * 0.6;
  const dims = input.showDims !== false;
  const maxT = Math.max(0, ...room.walls.map((w) => w.thickness));
  const M = maxT + fs * 8.4;
  const wallIdx = new Map(walls.map((w, i) => [w.id, i]));
  const vis = items.filter((it) => wallIdx.has(it.wallId) && visibleIn(view, it));
  const geomOf = (it: Item) => room.walls[wallIdx.get(it.wallId)!]!;
  const grp = (w: WallGeom, inner: string, cls = '', id?: string) =>
    `<g${cls ? ` class="${cls}"` : ''}${id ? ` data-id="${esc(id)}"` : ''} transform="matrix(${wallMatrix(w)})">${inner}</g>`;

  const F = view === 'framing' ? input.framing : undefined;
  let s = '';
  if (room.closed) s += `<polygon class="floor" points="${pts(room.inner)}"/>`;
  for (const w of room.walls) {
    if (w.length > 0) {
      s += `<polygon class="${F ? 'face' : 'wall'}${input.highlightWall === w.index ? ' hl' : ''}" data-wall-index="${w.index}" points="${pts(w.body)}"/>`;
    }
  }
  if (F) {
    for (const f of F.walls) {
      const w = room.walls[f.wall]!;
      const D = f.depth;
      const y = -DRYWALL - D;
      let g = `<rect class="plate" x="${f.u0}" y="${y}" width="${f.u1 - f.u0}" height="${D}"/>`;
      for (const r of f.openings) {
        if (r.item.type === 'door') g += `<rect class="cut" x="${r.a}" y="${y - 0.1}" width="${r.b - r.a}" height="${D + 0.2}"/>`;
        g += `<rect class="hdr" x="${r.a - 1.5}" y="${y}" width="${r.b - r.a + 3}" height="${D}"/>`;
      }
      for (const [a, b2] of f.studs) g += `<rect class="stud" x="${a}" y="${y}" width="${b2 - a}" height="${D}"/>`;
      for (const bk of F.blocking) if (bk.wall === f.wall) g += `<path class="blk" d="M${bk.a} ${y + D / 2}H${bk.b}"/>`;
      s += grp(w, g);
    }
  }
  const extra: Box[] = [];
  if (!room.closed && room.walls.length) {
    const last = room.walls[room.walls.length - 1]!;
    s += `<path class="gapline" d="M${r2(last.end.x)} ${r2(last.end.y)}L0 0"/><circle class="startpt" cx="0" cy="0" r="${r2(fs * 0.3)}"/>`;
    // Arrow showing which way the next wall goes: from the first wall without a length,
    // or from the end of the last wall, in the direction of the turn after it.
    const hs = headings(walls);
    const blank = walls.findIndex((w) => !(w.length > 0));
    const n = walls.length;
    const at = blank >= 0 ? room.walls[blank]!.start : last.end;
    const heading = blank >= 0 ? hs[blank]! : hs[n - 1]! + walls[n - 1]!.turn;
    const label = `Wall ${blank >= 0 ? blank + 1 : n + 1}`;
    const d = headingVector(heading);
    const len = fs * 3;
    const tip = { x: at.x + d.x * len, y: at.y + d.y * len };
    const hw = fs * 0.55;
    const back = { x: tip.x - d.x * hw * 1.6, y: tip.y - d.y * hw * 1.6 };
    const side = { x: -d.y * hw, y: d.x * hw };
    s +=
      `<path class="nextarrow" d="M${r2(at.x)} ${r2(at.y)}L${r2(back.x)} ${r2(back.y)}"/>` +
      `<polygon class="nexthead" points="${pts([tip, { x: back.x + side.x, y: back.y + side.y }, { x: back.x - side.x, y: back.y - side.y }])}"/>`;
    const lp = { x: tip.x + d.x * fs * 1.6, y: tip.y + d.y * fs * 1.6 };
    s += `<text class="nextlbl" font-size="${r2(fs * 0.8)}" text-anchor="middle" dominant-baseline="central" x="${r2(lp.x)}" y="${r2(lp.y)}">${label}</text>`;
    const half = fs * 2.2;
    extra.push({ x0: lp.x - half, y0: lp.y - fs, x1: lp.x + half, y1: lp.y + fs }, { x0: at.x, y0: at.y, x1: at.x, y1: at.y });
  }

  if (view === 'design') {
    for (const z of zones) {
      const w = room.walls[z.wall];
      if (w) s += grp(w, `<rect class="zone${z.ok ? '' : ' bad'}" x="${z.a}" y="${z.v0}" width="${z.b - z.a}" height="${z.v1 - z.v0}"/>`);
    }
  }

  const stateCls = (it: Item) =>
    view === 'framing' ? 'ghost' : view === 'design' ? (it.status === 'new' ? 'new' : it.status === 'remove' ? 'rem' : '') : '';
  for (const it of vis.filter(isFixture)) {
    const cls = ['drag', stateCls(it), input.activeId === it.id ? 'on' : ''].filter(Boolean).join(' ');
    s += grp(geomOf(it), fixtureSymbol(it, hitPad), cls, it.id);
  }
  for (const it of vis.filter(isOpening)) {
    const w = geomOf(it);
    if (F) {
      const [u0, u1] = span(it);
      s += grp(
        w,
        `<rect class="hit" x="${r2(u0 - hitPad)}" y="${r2(-w.thickness - hitPad)}" width="${r2(u1 - u0 + 2 * hitPad)}" height="${r2(w.thickness + 2 * hitPad)}"/>`,
        'drag',
        it.id,
      );
      continue;
    }
    const removed = view === 'design' && it.status === 'remove';
    const cls = ['drag', removed ? 'rem' : stateCls(it), input.activeId === it.id ? 'on' : ''].filter(Boolean).join(' ');
    s += grp(w, openingSymbol(it, w.thickness, removed, hitPad), cls, it.id);
  }

  if (F) {
    for (const m of F.marks) {
      const w = room.walls[m.wall];
      if (!w) continue;
      const p = toPlan(w, m.u, m.v);
      const r = fs * 0.45;
      s +=
        m.kind === 'x'
          ? `<path class="mk" d="M${r2(p.x - r * 1.6)} ${r2(p.y)}H${r2(p.x + r * 1.6)}M${r2(p.x)} ${r2(p.y - r * 1.6)}V${r2(p.y + r * 1.6)}"/><circle class="mk" cx="${r2(p.x)}" cy="${r2(p.y)}" r="${r2(r)}"/>`
          : m.kind === 'valve'
            ? `<rect class="mk" x="${r2(p.x - r)}" y="${r2(p.y - r)}" width="${r2(2 * r)}" height="${r2(2 * r)}"/><text class="lbl" font-size="${r2(fs * 0.7)}" x="${r2(p.x + r * 1.6)}" y="${r2(p.y + fs * 0.25)}">V</text>`
            : `<circle class="mk" cx="${r2(p.x)}" cy="${r2(p.y)}" r="${r2(r)}"/>`;
    }
  }

  // Fixture labels, upright.
  for (const it of vis.filter(isFixture)) {
    const w = geomOf(it);
    const [u0, u1, , d] = span(it);
    let label = itemName(it);
    if (view === 'design' && it.status === 'new') label += ' (new)';
    if (view === 'design' && it.status === 'remove') label += ' (remove)';
    const c = it.type === 'toilet' ? toPlan(w, toiletCenter(it), 5) : toPlan(w, (u0 + u1) / 2, d / 2);
    s += `<text class="lbl" font-size="${r2(fs * 0.72)}" text-anchor="middle" dominant-baseline="central" x="${r2(c.x)}" y="${r2(c.y)}">${esc(label)}</text>`;
  }

  // Dimensions and wall numbers. A wall whose labels would land on labels
  // already drawn (short walls at a jog) gets its strings moved farther out.
  boxes = [];
  for (const w of room.walls) {
    if (w.length <= 0) continue;
    const t = w.thickness;
    const ext = t + fs * 0.4;
    let us: number[];
    let overall: [number, number];
    if (F) {
      const f = F.walls[w.index]!;
      us = [f.u0, f.u1, ...f.openings.flatMap((r) => [r.a, r.b])];
      overall = [f.u0, f.u1];
    } else {
      us = [0, w.length];
      for (const it of vis) {
        if (geomOf(it) !== w || (view === 'design' && it.status === 'remove')) continue;
        const [u0, u1] = span(it);
        if (it.type === 'toilet') us.push(toiletCenter(it));
        else us.push(u0, u1);
      }
      us = us.filter((u) => u >= -0.01 && u <= w.length + 0.01);
      overall = [0, w.length];
    }
    // Item string nearest the wall, the overall length outside it (or nearest, when the wall is
    // bare), then the wall number. With dimensions off, just the number, on the wall.
    const showItems = dims && new Set(us.map(r2)).size > 2;
    const row = fs * 1.75;
    let best = '';
    for (let step = 0; step < 4; step++) {
      const off = step * row;
      const mine: Box[] = [];
      let g = '';
      let tagV: number;
      if (dims) {
        if (showItems) g += chain(w, us, t + row + off, fs, ext, mine);
        const overallD = t + (showItems ? 2 : 1) * row + off;
        g += chain(w, overall, overallD, fs, ext, mine);
        tagV = overallD + fs * 2;
      } else {
        // On the wall itself, so the room can fill the window.
        tagV = t / 2 + off;
      }
      const tr = fs * 0.75;
      const tag = toPlan(w, w.length / 2, -tagV);
      mine.push({ x0: tag.x - tr, y0: tag.y - tr, x1: tag.x + tr, y1: tag.y + tr });
      g +=
        `<circle class="tagc${input.highlightWall === w.index ? ' hl' : ''}" data-wall-index="${w.index}" cx="${r2(tag.x)}" cy="${r2(tag.y)}" r="${r2(tr)}"/>` +
        `<text class="dt" font-size="${r2(fs * 0.85)}" text-anchor="middle" dominant-baseline="central" x="${r2(tag.x)}" y="${r2(tag.y)}">${w.index + 1}</text>`;
      best = g;
      if (!mine.some((m) => boxes.some((b2) => hits(m, b2))) || step === 3) {
        boxes.push(...mine);
        break;
      }
    }
    s += best;
  }

  // Fit the view to the walls and every label actually drawn.
  const pad = fs * 0.4;
  boxes.push(...extra);
  const fit = boxes.length
    ? {
        x0: Math.min(b.minX, ...boxes.map((q) => q.x0)) - pad,
        y0: Math.min(b.minY, ...boxes.map((q) => q.y0)) - pad,
        x1: Math.max(b.maxX, ...boxes.map((q) => q.x1)) + pad,
        y1: Math.max(b.maxY, ...boxes.map((q) => q.y1)) + pad,
      }
    : { x0: b.minX - M, y0: b.minY - M, x1: b.maxX + M, y1: b.maxY + M };
  const vb = [fit.x0, fit.y0, fit.x1 - fit.x0, fit.y1 - fit.y0].map(r2).join(' ');
  const label = view === 'existing' ? 'Existing conditions plan' : view === 'framing' ? 'Framing plan' : 'Design plan';
  return `<svg id="plan" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${s}</svg>`;
}
