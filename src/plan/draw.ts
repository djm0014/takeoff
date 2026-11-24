/**
 * Floor plan drawing (SVG markup). Fixture and opening symbols are drawn in
 * each wall's local frame, as in the old tool, so they work on walls at any
 * angle.
 */
import type { Item, Wall } from '../data/model';
import { formatInches } from '../lib/inches';
import { toPlan, wallMatrix, type Pt, type RoomGeom, type WallGeom } from './geometry';
import type { Zone } from './checks';
import { doorSize, isFixture, isOpening, itemName, span, toiletCenter } from './items';

export type PlanView = 'existing' | 'design';

export interface DrawInput {
  room: RoomGeom;
  walls: Wall[];
  items: Item[];
  view: PlanView;
  zones: Zone[];
  /** Item being dragged, drawn heavier. */
  activeId?: string | null;
}

const r2 = (v: number) => Math.round(v * 1000) / 1000;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pts = (list: Pt[]) => list.map((p) => `${r2(p.x)},${r2(p.y)}`).join(' ');
const dimText = (v: number) => formatInches(v, { mark: false, feet: v >= 24 }).replace('′-', "'-");

export function visibleIn(view: PlanView, it: Item): boolean {
  return view === 'existing' ? it.status !== 'new' : true;
}

function fixtureSymbol(it: Item): string {
  const [u0, u1, , d] = span(it);
  const w = u1 - u0;
  let s = `<rect class="hit" x="${u0}" y="0" width="${w}" height="${d}"/>`;
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

function openingSymbol(it: Item, t: number, removed: boolean): string {
  const [u0, u1] = span(it);
  if (removed) return `<rect class="infill" x="${u0}" y="${-t}" width="${u1 - u0}" height="${t}"/>`;
  let s =
    `<rect class="cut" x="${u0}" y="${-t - 0.05}" width="${u1 - u0}" height="${t + 0.1}"/>` +
    `<rect class="hit" x="${u0}" y="${-t}" width="${u1 - u0}" height="${t}"/>` +
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

/** Text rotated to run along a wall, kept upright. */
function alongText(w: WallGeom, u: number, v: number, text: string, size: number, cls = 'dt'): string {
  const p = toPlan(w, u, v);
  let ang = (Math.atan2(w.dirU.y, w.dirU.x) * 180) / Math.PI;
  if (ang > 90.01) ang -= 180;
  if (ang <= -90.01) ang += 180;
  const rot = Math.abs(ang) > 0.01 ? ` transform="rotate(${r2(ang)} ${r2(p.x)} ${r2(p.y)})"` : '';
  return `<text class="${cls}" font-size="${r2(size)}" text-anchor="middle" dominant-baseline="central" x="${r2(p.x)}" y="${r2(p.y)}"${rot}>${esc(text)}</text>`;
}

/** A dimension string along a wall, outside it at distance `d` from the finished face. */
function chain(w: WallGeom, us: number[], d: number, fs: number, ext: number): string {
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
    s += alongText(w, (a + b) / 2, -d - fs * 0.55 - (small && alt ? fs * 1.15 : 0), dimText(b - a), fs * 0.82);
  }
  return s;
}

export function drawPlan(input: DrawInput): string {
  const { room, walls, items, view, zones } = input;
  const b = room.bounds;
  const span0 = Math.max(b.maxX - b.minX, b.maxY - b.minY, 48);
  const fs = span0 / 24;
  const maxT = Math.max(0, ...room.walls.map((w) => w.thickness));
  const M = maxT + fs * 8.4;
  const wallIdx = new Map(walls.map((w, i) => [w.id, i]));
  const vis = items.filter((it) => wallIdx.has(it.wallId) && visibleIn(view, it));
  const geomOf = (it: Item) => room.walls[wallIdx.get(it.wallId)!]!;
  const grp = (w: WallGeom, inner: string, cls = '', id?: string) =>
    `<g${cls ? ` class="${cls}"` : ''}${id ? ` data-id="${esc(id)}"` : ''} transform="matrix(${wallMatrix(w)})">${inner}</g>`;

  let s = '';
  if (room.closed) s += `<polygon class="floor" points="${pts(room.inner)}"/>`;
  for (const w of room.walls) if (w.length > 0) s += `<polygon class="wall" points="${pts(w.body)}"/>`;
  if (!room.closed && room.walls.length) {
    const last = room.walls[room.walls.length - 1]!;
    s += `<path class="gapline" d="M${r2(last.end.x)} ${r2(last.end.y)}L0 0"/><circle class="startpt" cx="0" cy="0" r="${r2(fs * 0.3)}"/>`;
  }

  if (view === 'design') {
    for (const z of zones) {
      const w = room.walls[z.wall];
      if (w) s += grp(w, `<rect class="zone${z.ok ? '' : ' bad'}" x="${z.a}" y="${z.v0}" width="${z.b - z.a}" height="${z.v1 - z.v0}"/>`);
    }
  }

  const stateCls = (it: Item) => (view === 'design' ? (it.status === 'new' ? 'new' : it.status === 'remove' ? 'rem' : '') : '');
  for (const it of vis.filter(isFixture)) {
    const cls = ['drag', stateCls(it), input.activeId === it.id ? 'on' : ''].filter(Boolean).join(' ');
    s += grp(geomOf(it), fixtureSymbol(it), cls, it.id);
  }
  for (const it of vis.filter(isOpening)) {
    const w = geomOf(it);
    const removed = view === 'design' && it.status === 'remove';
    const cls = ['drag', removed ? 'rem' : stateCls(it), input.activeId === it.id ? 'on' : ''].filter(Boolean).join(' ');
    s += grp(w, openingSymbol(it, w.thickness, removed), cls, it.id);
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

  // Dimensions and wall numbers.
  for (const w of room.walls) {
    if (w.length <= 0) continue;
    const t = w.thickness;
    const ext = t + fs * 0.4;
    const us = [0, w.length];
    for (const it of vis) {
      if (geomOf(it) !== w || (view === 'design' && it.status === 'remove')) continue;
      const [u0, u1] = span(it);
      if (it.type === 'toilet') us.push(toiletCenter(it));
      else us.push(u0, u1);
    }
    const inside = us.filter((u) => u >= -0.01 && u <= w.length + 0.01);
    if (new Set(inside.map(r2)).size > 2) s += chain(w, inside, t + fs * 2.2, fs, ext);
    s += chain(w, [0, w.length], t + fs * 4.4, fs, ext);
    const tag = toPlan(w, w.length / 2, -(t + fs * 6.9));
    s +=
      `<circle class="tagc" cx="${r2(tag.x)}" cy="${r2(tag.y)}" r="${r2(fs * 0.85)}"/>` +
      `<text class="dt" font-size="${r2(fs * 0.95)}" text-anchor="middle" dominant-baseline="central" x="${r2(tag.x)}" y="${r2(tag.y)}">${w.index + 1}</text>`;
  }

  const vb = [b.minX - M, b.minY - M, b.maxX - b.minX + 2 * M, b.maxY - b.minY + 2 * M].map(r2).join(' ');
  const label = view === 'existing' ? 'Existing conditions plan' : 'Design plan';
  return `<svg id="plan" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${s}</svg>`;
}
