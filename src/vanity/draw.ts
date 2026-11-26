/**
 * Vanity wall elevation and presentation drawings, ported from the old
 * Vanity Wall Solver. (The section view is left out for now.)
 */
import { formatInches } from '../lib/inches';
import type { VanityD } from './settings';
import { optOf, vOf, type VanityResult } from './solve';

export type ElevationView = 'elev' | 'pres';

const r2 = (v: number) => Math.round(v * 1000) / 1000;
const fmtN = (v: number) => formatInches(v, { mark: false });

function heights(D: VanityD, R: VanityResult): [string, number][] {
  const v = (k: string) => vOf(D, k);
  const pts: [string, number][] = [
    ['Ceiling', R.H],
    ['Drain', v('drain')],
    ['Supply', v('sup')],
    [R.ped ? 'Rim' : 'Counter', R.counter],
  ];
  if (R.bs > 0) pts.push(['Splash', R.bsTop]);
  if (D.sink === 'vessel') pts.push(['Rim', R.rim]);
  pts.push([D.fau === 'deck' ? 'Faucet' : 'Spout', D.fau === 'deck' ? R.fTop : R.spoutAFF]);
  if (R.mirs.length) pts.push([D.mir === 'mirror' ? 'Mirror' : 'Cab', R.mirs[0]!.b], [D.mir === 'mirror' ? 'Mirror top' : 'Cab top', R.mirs[0]!.t]);
  if (R.lights.length) pts.push(['Light box', R.lights[0]!.box]);
  if (R.sconces.length) pts.push(['Sconce box', R.sconces[0]!.box]);
  if (R.rec) pts.push(['Vanity outlet', R.rec.aff]);
  R.outs.forEach((o) => pts.push([o.key === 'bid' ? 'Bidet outlet' : 'Wall outlet', o.aff]));
  if (R.wc) pts.push(['WC supply', v('wch')], ['Tank top', v('wct')]);
  if (R.cab) {
    pts.push(['Cabinet top', R.cab.t]);
    if (R.cab.b > 0) pts.push(['Cabinet bottom', R.cab.b]);
  }
  return pts;
}

function presHeights(D: VanityD, R: VanityResult): [string, number][] {
  const pts: [string, number][] = [
    ['Ceiling', R.H],
    [R.ped ? 'Sink rim' : 'Counter', R.counter],
  ];
  if (R.mirs.length) {
    const cab = D.mir !== 'mirror';
    pts.push([cab ? 'Cabinet bottom' : 'Mirror bottom', R.mirs[0]!.b], [cab ? 'Cabinet top' : 'Mirror top', R.mirs[0]!.t]);
  }
  if (R.lights.length) pts.push(['Light', R.lights[0]!.box]);
  if (R.sconces.length) pts.push(['Sconces', R.sconces[0]!.box]);
  if (D.fig !== 'none') {
    const fh = Math.max(36, Math.min(84, vOf(D, 'figh')));
    pts.push([`Eye (${fmtN(Math.floor(fh / 12))}′ ${fmtN(fh % 12)}″ person)`, fh * 0.93]);
  }
  return pts;
}

/** Height labels down the right side, spread apart where they'd collide. */
function ordSVG(pts: [string, number][], hx: number, H: number, fs: number, Y: (a: number) => number): string {
  let s = '';
  pts.sort((a, b) => a[1] - b[1]);
  const gap = fs * 1.05;
  let last = -1e9;
  const ly = pts.map((p) => {
    const y = Math.max(p[1], last + gap);
    last = y;
    return y;
  });
  const over = last - H;
  if (over > 0) for (let i = ly.length - 1, top = H + Math.max(0, fs * 0.3); i >= 0; i--) ly[i] = Math.min(ly[i]!, top - (ly.length - 1 - i) * gap);
  s += `<path class="dim" d="M${hx} ${Y(0)}V${Y(H)}${pts.map((p) => `M${hx - fs * 0.4} ${Y(p[1])}H${hx + fs * 0.4}`).join('')}"/>`;
  pts.forEach((p, i) => {
    const ty = ly[i]!;
    if (Math.abs(ty - p[1]) > 0.01) s += `<path class="dim" d="M${hx + fs * 0.4} ${Y(p[1])}L${hx + fs * 0.9} ${Y(ty)}"/>`;
    s += `<text class="dt" font-size="${fs * 0.78}" x="${hx + fs * 1.05}" y="${Y(ty) + fs * 0.27}"><tspan class="dl">${p[0]}</tspan> ${fmtN(p[1])}</text>`;
  });
  return s;
}

export function drawElevation(D: VanityD, R: VanityResult, view: ElevationView): string {
  const v = (k: string) => vOf(D, k);
  const opt = (k: string) => optOf(D, k);
  const P = view === 'pres';
  const { Wd, H } = R;
  const fs = Math.max(Wd, H) / 26;
  const Y = (a: number) => r2(H - a);
  const M = fs * 2.5;
  const MR = fs * 10;
  const MB = fs * 6.5;
  const vb = { x: -M, y: -fs * 2.4, w: Wd + M + MR, h: H + fs * 2.4 + MB };
  let s = '';
  // Presentation reads like paper in either theme.
  if (P) s += `<rect class="sheet" x="${r2(vb.x)}" y="${r2(vb.y)}" width="${r2(vb.w)}" height="${r2(vb.h)}"/>`;
  s += `<rect class="face" x="0" y="0" width="${Wd}" height="${H}"/><rect class="side" x="${-fs * 0.8}" y="0" width="${fs * 0.8}" height="${H}"/><rect class="side" x="${Wd}" y="0" width="${fs * 0.8}" height="${H}"/>`;
  s += `<path class="dim" d="M${-fs * 0.8} ${H}H${Wd + fs * 0.8}M${-fs * 0.8} 0H${Wd + fs * 0.8}"/>`;
  R.studs.forEach((c) => (s += `<rect class="stud" x="${c - 0.75}" y="0" width="1.5" height="${H}"/>`));
  const { x0, x1, counter } = R;
  const tk = 4;
  if (R.ped) {
    const c = R.cls[0]!;
    const hw = (x1 - x0) / 2;
    const bt = counter - 7.5;
    s += `<path class="ob" d="M${c - 4} ${Y(0)}L${c - 3} ${Y(bt - 0.5)}H${c + 3}L${c + 4} ${Y(0)}Z"/><path class="ob" d="M${c - 5} ${Y(0)}H${c + 5}V${Y(1)}H${c - 5}Z"/>`;
    s += `<path class="ob" d="M${x0} ${Y(counter)}H${x1}V${Y(counter - 2)}Q${x1 - 1} ${Y(bt)} ${c + hw * 0.5} ${Y(bt)}H${c - hw * 0.5}Q${x0 + 1} ${Y(bt)} ${x0} ${Y(counter - 2)}Z"/><path class="hid" d="M${c - hw + 3} ${Y(counter - 1)}Q${c} ${Y(bt + 2)} ${c + hw - 3} ${Y(counter - 1)}"/>`;
  } else {
    s += `<rect class="ob" x="${x0}" y="${Y(counter - 1.5)}" width="${x1 - x0}" height="${counter - 1.5 - tk}"/><rect class="ob" x="${x0 + 3}" y="${Y(tk)}" width="${x1 - x0 - 6}" height="${tk}"/>`;
    const dt = counter - 1.5 - 6;
    if (R.vw >= 24) {
      const n = R.vw >= 48 ? 4 : 2;
      const w = (x1 - x0 - 2) / n;
      for (let i = 0; i < n; i++) s += `<rect class="ob2" x="${x0 + 1 + i * w + 0.5}" y="${Y(dt)}" width="${w - 1}" height="${dt - tk - 1}"/>`;
      s += `<rect class="ob2" x="${x0 + 1.5}" y="${Y(counter - 2.5)}" width="${x1 - x0 - 3}" height="${counter - 2.5 - dt - 0.5}"/>`;
    }
    s += `<rect class="ob" x="${x0 - 0.5}" y="${Y(counter)}" width="${x1 - x0 + 1}" height="1.5"/>`;
    if (R.bs > 0) s += `<rect class="ob" x="${x0}" y="${Y(R.bsTop)}" width="${x1 - x0}" height="${R.bs}"/>`;
  }
  for (const c of R.cls) {
    if (R.ped) {
      /* the pedestal outline already shows the basin */
    } else if (D.sink === 'vessel') s += `<path class="ob" d="M${c - 8} ${Y(R.rim)}H${c + 8}Q${c + 7} ${Y(counter)} ${c} ${Y(counter)}Q${c - 7} ${Y(counter)} ${c - 8} ${Y(R.rim)}Z"/>`;
    else s += `<path class="hid" d="M${c - 8} ${Y(counter - 1.5)}V${Y(counter - 7)}H${c + 8}V${Y(counter - 1.5)}"/>`;
    if (D.fau === 'deck')
      s += `<path class="ob" d="M${c - 1} ${Y(R.rim)}V${Y(R.fTop - 1)}Q${c - 1} ${Y(R.fTop)} ${c} ${Y(R.fTop)}H${c + 4}V${Y(R.fTop - 2)}H${c + 1}V${Y(R.rim)}Z"/>`;
    else
      s += `<rect class="ob" x="${c - 1.5}" y="${Y(R.spoutAFF + 3)}" width="3" height="3"/><circle class="ob" cx="${c - 5}" cy="${Y(R.spoutAFF + 2)}" r="1.4"/><circle class="ob" cx="${c + 5}" cy="${Y(R.spoutAFF + 2)}" r="1.4"/>`;
    const dx = R.drainX !== null && R.n === 1 ? R.drainX : c;
    s += `<circle class="mk" cx="${dx}" cy="${Y(v('drain'))}" r="1"/><circle class="mk" cx="${c - v('spread') / 2}" cy="${Y(v('sup'))}" r="0.7"/><circle class="mk" cx="${c + v('spread') / 2}" cy="${Y(v('sup'))}" r="0.7"/>`;
  }
  for (const m of R.mirs) {
    s += `<rect class="glass" x="${m.x}" y="${Y(m.t)}" width="${m.w}" height="${m.t - m.b}"/>`;
    const g = Math.min(m.w, m.t - m.b) * 0.18;
    s += `<path class="ob2" d="M${m.x + m.w * 0.62} ${Y(m.t - 2)}l${-g} ${g}M${m.x + m.w * 0.72} ${Y(m.t - 2)}l${-g * 1.5} ${g * 1.5}"/>`;
    if (D.mir === 'surf' || D.mir === 'rec') s += `<path class="ob2" d="M${m.c} ${Y(m.t)}V${Y(m.b)}"/>`;
    if (m.ro) s += `<rect class="ro" x="${m.ro.x}" y="${Y(m.ro.b + m.ro.h)}" width="${m.ro.w}" height="${m.ro.h}"/>`;
  }
  for (const l of R.lights) {
    s += `<rect class="ob" x="${l.x}" y="${Y(l.b + l.h)}" width="${l.w}" height="${l.h}" rx="1"/>`;
    const n = Math.max(2, Math.round(l.w / 8));
    for (let i = 0; i < n; i++) {
      const cx = l.x + (l.w * (i + 0.5)) / n;
      s += `<circle class="ob2" cx="${cx}" cy="${Y(l.b + l.h / 2)}" r="${Math.min(2, l.h / 3)}"/>`;
    }
    s += `<rect class="mk" x="${l.c - 2}" y="${Y(l.box + 2)}" width="4" height="4"/>`;
  }
  for (const c of R.sconces)
    s += `<rect class="ob" x="${c.x}" y="${Y(c.b + c.h)}" width="${c.w}" height="${c.h}" rx="${c.w / 2}"/><rect class="mk" x="${c.c - 2}" y="${Y(c.box + 2)}" width="4" height="4"/>`;
  if (R.rec && R.rec.x >= 2 && R.rec.x <= Wd - 2) s += `<rect class="ob" x="${R.rec.x - 1.4}" y="${Y(R.rec.aff + 2.25)}" width="2.8" height="4.5" rx=".4"/>`;
  if (R.wc && R.tc !== null) {
    const c = R.tc;
    const st = v('wcseat');
    const tt = v('wct');
    const tb = st + 1.5;
    s += `<path class="ob" d="M${c - 4.5} ${Y(0)}Q${c - 8.5} ${Y(st - 7)} ${c - 7.5} ${Y(st - 1.5)}H${c + 7.5}Q${c + 8.5} ${Y(st - 7)} ${c + 4.5} ${Y(0)}Z"/>`;
    s += `<rect class="ob" x="${c - 8}" y="${Y(st)}" width="16" height="1.5" rx=".6"/>`;
    if (tt > tb + 2)
      s += `<rect class="ob" x="${c - 9.5}" y="${Y(tt - 1)}" width="19" height="${tt - 1 - tb}" rx="1"/><rect class="ob" x="${c - 10}" y="${Y(tt)}" width="20" height="1.2" rx=".5"/><path class="ob2" d="M${c - 8} ${Y(tt - 3)}h3"/>`;
    s += `<path class="hid" d="M${c - v('wcs')} ${Y(v('wch'))}V${Y(tb + 1)}"/><circle class="mk" cx="${c - v('wcs')}" cy="${Y(v('wch'))}" r="0.9"/>`;
    s += `<path class="cl" d="M${c} ${-fs * 0.6}V${H + fs * 0.6}"/><text class="ct" font-size="${fs * 0.8}" text-anchor="middle" x="${c}" y="${-fs * 0.9}">WC</text>`;
  }
  if (R.cab) {
    const c = R.cab;
    const kick = c.b < 0.01 ? 4 : 0;
    const bb = c.b + kick;
    if (kick) s += `<rect class="ob" x="${c.x + 3}" y="${Y(kick)}" width="${Math.max(0, c.w - 3)}" height="${kick}"/>`;
    s += `<rect class="ob" x="${c.x}" y="${Y(c.t)}" width="${c.w}" height="${Math.max(0, c.t - bb)}"/>`;
    const n = c.n;
    const ih = c.t - bb - 1.5;
    if (c.face !== 'front') {
      const L = c.face === 'left';
      const front = L ? c.x : c.x + c.w;
      c.drawers.forEach((d) => {
        s += `<path class="hid" d="M${c.x + 0.75} ${Y(d.y0)}H${c.x + c.w - 0.75}"/>`;
        const ext = c.slide;
        const dx0 = L ? front - ext : front;
        const blocked = (d.room ?? 0) < (d.need ?? 0) - 0.01;
        s += `<rect class="${blocked ? 'gbad' : 'gok'}" x="${dx0}" y="${Y(d.y1 - 0.4)}" width="${ext}" height="${d.y1 - d.y0 - 0.8}"/>`;
      });
      s += `<text class="dl tech" font-size="${fs * 0.55}" text-anchor="middle" x="${c.x + c.w / 2}" y="${Y(c.t) + fs * 0.9}">side view</text><path class="mk" d="M${c.x + c.w / 2} ${Y(c.t - 5)}h${L ? -4 : 4}m${L ? 2 : -2} -1.5l${L ? -2 : 2} 1.5l${L ? 2 : -2} 1.5"/>`;
    } else if (n > 0)
      for (let i = 0; i < n; i++) {
        const h = ih / n;
        const y0 = bb + 0.75 + i * h;
        s += `<rect class="ob2" x="${c.x + 0.75}" y="${Y(y0 + h - 0.2)}" width="${c.w - 1.5}" height="${h - 0.4}"/><path class="ob2" d="M${c.x + c.w / 2 - 2} ${Y(y0 + h / 2)}h4"/>`;
      }
    else s += `<rect class="ob2" x="${c.x + 0.75}" y="${Y(c.t - 0.75)}" width="${c.w - 1.5}" height="${ih}"/><path class="ob2" d="M${c.x + c.w - 3} ${Y(bb + ih / 2 + 2)}v4"/>`;
  }
  R.outs.forEach((o) => {
    if (o.x < 1.5 || o.x > Wd - 1.5) return;
    s += `<rect class="ob" x="${o.x - 1.4}" y="${Y(o.aff + 2.25)}" width="2.8" height="4.5" rx=".4"/><text font-size="${fs * 0.6}" text-anchor="middle" x="${o.x}" y="${Y(o.aff + 2.25) - fs * 0.25}" class="dl tech">${o.key === 'bid' ? 'Bidet' : 'Outlet'}</text>`;
  });
  const lbx = opt('lbx');
  const lbh = opt('lbh');
  if (D.lt !== 'none' && D.lbkeep === 'keep' && lbx !== null && lbh !== null)
    s += `<rect class="ro" x="${lbx - 2}" y="${Y(lbh + 2)}" width="4" height="4"/><text class="dl tech" font-size="${fs * 0.55}" text-anchor="middle" x="${lbx}" y="${Y(lbh + 2) - fs * 0.2}">existing</text>`;
  if (P && D.fig !== 'none') {
    const fh = Math.max(36, Math.min(84, v('figh')));
    const u = fh / 69;
    let c = R.cls[0]!;
    if (D.fig === 'side') {
      const right = R.Wd - R.x1;
      const left = R.x0;
      c = right >= left ? R.x1 + Math.min(14, right / 2) : R.x0 - Math.min(14, left / 2);
    }
    const e = fh * 0.93;
    const sh = fh * 0.82;
    const hip = fh * 0.52;
    const hr = fh * 0.062;
    s +=
      `<g class="figg"><circle class="fig" cx="${c}" cy="${Y(fh - hr)}" r="${hr}"/><path class="fig" d="M${c - 7.6 * u} ${Y(sh)}Q${c} ${Y(sh + 1.6 * u)} ${c + 7.6 * u} ${Y(sh)}L${c + 6.2 * u} ${Y(hip)}H${c - 6.2 * u}Z"/>` +
      `<path class="figl" stroke-width="${2.6 * u}" d="M${c - 7.4 * u} ${Y(sh - 1.2 * u)}L${c - 9.6 * u} ${Y(hip - 1)}M${c + 7.4 * u} ${Y(sh - 1.2 * u)}L${c + 9.6 * u} ${Y(hip - 1)}"/>` +
      `<path class="figl" stroke-width="${4 * u}" d="M${c - 3 * u} ${Y(hip)}L${c - 3.8 * u} ${Y(1.5)}M${c + 3 * u} ${Y(hip)}L${c + 3.8 * u} ${Y(1.5)}"/>` +
      `<path class="eye" d="M${c + hr + 0.5} ${Y(e)}H${Wd}"/></g>`;
  }
  // centerlines
  for (const c of R.cls)
    s += `<path class="cl" d="M${c} ${-fs * 0.6}V${H + fs * 0.6}"/><text class="ct" font-size="${fs * 0.8}" text-anchor="middle" x="${c}" y="${-fs * 0.9}">CL</text>`;
  if (R.n === 2 && R.mirs.length === 1) s += `<path class="cl" d="M${R.vc} ${-fs * 0.6}V${H}"/>`;
  // horizontal dimension string
  const hs = [
    ...new Set(
      (P
        ? [0, R.x0, R.x1, Wd, ...(R.cab ? [R.cab.x, R.cab.x + R.cab.w] : [])]
        : [0, R.x0, ...R.cls, R.x1, Wd, ...(R.tc !== null ? [R.tc] : []), ...(R.cab ? [R.cab.x, R.cab.x + R.cab.w] : []), ...R.outs.map((o) => o.x)]
      )
        .filter((x) => x >= -0.01 && x <= Wd + 0.01)
        .map(r2),
    ),
  ].sort((a, b) => a - b);
  const yd = H + fs * 2.2;
  s += `<path class="dim" d="M${hs[0]} ${yd}H${hs[hs.length - 1]}${hs.map((x) => `M${x} ${H + fs * 0.4}V${yd + fs * 0.4}M${x - fs * 0.3} ${yd + fs * 0.3}l${fs * 0.6} ${-fs * 0.6}`).join('')}"/>`;
  let alt = false;
  for (let i = 0; i < hs.length - 1; i++) {
    const a = hs[i]!;
    const b = hs[i + 1]!;
    if (b - a < 0.05) continue;
    const small = b - a < fs * 2.4;
    alt = small ? !alt : false;
    s += `<text class="dt" font-size="${fs * 0.8}" text-anchor="middle" x="${(a + b) / 2}" y="${yd - fs * 0.35 - (small && alt ? fs * 1.05 : 0)}">${fmtN(b - a)}</text>`;
  }
  const yd2 = H + fs * 4.6;
  s += `<path class="dim" d="M0 ${yd2}H${Wd}M0 ${yd + fs * 0.6}V${yd2 + fs * 0.4}M${Wd} ${yd + fs * 0.6}V${yd2 + fs * 0.4}M${-fs * 0.3} ${yd2 + fs * 0.3}l${fs * 0.6} ${-fs * 0.6}M${Wd - fs * 0.3} ${yd2 + fs * 0.3}l${fs * 0.6} ${-fs * 0.6}"/><text class="dt" font-size="${fs * 0.8}" text-anchor="middle" x="${Wd / 2}" y="${yd2 - fs * 0.35}">${fmtN(Wd)}</text>`;
  s += ordSVG(P ? presHeights(D, R) : heights(D, R), Wd + fs * 2, H, fs, Y);
  return `<svg class="elev-svg${P ? ' pres' : ''}" viewBox="${r2(vb.x)} ${r2(vb.y)} ${r2(vb.w)} ${r2(vb.h)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vanity wall ${P ? 'presentation' : 'elevation'}">${s}</svg>`;
}
