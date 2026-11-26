/**
 * Vanity wall solver, checks and rough-in schedule, ported from the old
 * Vanity Wall Solver (public/legacy/vanity-wall). The math is kept as it was
 * so the same answers give the same numbers; tests compare against the old
 * tool's recorded output.
 *
 * Horizontal positions are from the left end of the wall (as you face it);
 * heights are above the finished floor (AFF).
 */
import { formatInches, parseInches } from '../lib/inches';
import { DEF, type VanityD } from './settings';

const fmtN = (v: number) => formatInches(v, { mark: false });
const fmt = (v: number) => formatInches(v);
const r16 = (x: number) => Math.round(x * 16) / 16;

const parse = (s: string | undefined) => {
  const x = parseInches(String(s ?? ''));
  return x === null ? NaN : x;
};

/** A setting as a number, falling back to the default. */
export function vOf(D: VanityD, k: string): number {
  const x = parse(D[k]);
  return Number.isNaN(x) ? parse(DEF[k]) || 0 : x;
}
/** An optional setting: null when blank. */
export function optOf(D: VanityD, k: string): number | null {
  const x = parse(D[k]);
  return Number.isNaN(x) ? null : x;
}

export interface Mirror {
  c: number;
  x: number;
  w: number;
  b: number;
  t: number;
  ro?: { x: number; w: number; b: number; h: number };
}
export interface Light {
  c: number;
  x: number;
  w: number;
  b: number;
  h: number;
  box: number;
}
export interface Drawer {
  y0: number;
  y1: number;
  room?: number;
  by?: string;
  need?: number;
}
export interface StorageCab {
  x: number;
  w: number;
  b: number;
  t: number;
  n: number;
  face: string;
  carc: number;
  slide: number;
  drawers: Drawer[];
}
export interface Outlet {
  key: 'bid' | 'wo';
  name: string;
  x: number;
  aff: number;
}

export interface VanityResult {
  ped: boolean;
  vs: 'L' | 'R';
  centered?: { gap: number; ref: string; side: 'L' | 'R' };
  drainX: number | null;
  sec: { dep: number; bx: number; fx: number; outX: number };
  bs: number;
  Wd: number;
  H: number;
  vw: number;
  n: number;
  x0: number;
  x1: number;
  vc: number;
  cls: number[];
  counter: number;
  bsTop: number;
  rim: number;
  spoutAFF: number;
  fTop: number;
  wc: 'left' | 'right' | null;
  tc: number | null;
  mirs: Mirror[];
  forced?: boolean;
  mLow?: number;
  lights: Light[];
  sconces: Light[];
  rec?: { x: number; aff: number };
  outs: Outlet[];
  studs: number[];
  cab?: StorageCab;
}

export function solve(D: VanityD): VanityResult {
  const v = (k: string) => vOf(D, k);
  const opt = (k: string) => optOf(D, k);
  const ped = D.sink === 'ped';
  const Wd = v('wall');
  const H = v('ceil');
  const vw = ped ? v('pw') : v('vw');
  const n = !ped && D.sinks === '2' ? 2 : 1;
  const bs = ped ? 0 : v('bs');
  const wc = D.wc === 'left' || D.wc === 'right' ? D.wc : null;
  const tc = wc === 'left' ? v('wcx') : wc === 'right' ? Wd - v('wcx') : null;
  let x0 = (Wd - vw) / 2;
  if (D.vpos === 'left') x0 = v('voff');
  const vs: 'L' | 'R' = D.vside === 'L' ? 'L' : 'R';
  let centered: VanityResult['centered'];
  if (wc && tc !== null && D.vpos === 'beside') {
    const off = ({ cl: 0, edge: 10, clear: 15 } as Record<string, number>)[D.vref ?? ''] ?? 15;
    const a = vs === 'R' ? tc + off : 0;
    const b = vs === 'R' ? Wd : tc - off;
    x0 = (a + b - vw) / 2;
    centered = {
      gap: (b - a - vw) / 2,
      ref: ({ cl: 'toilet centerline', edge: 'tank edge', clear: '15″ clearance line' } as Record<string, string>)[D.vref ?? ''] || '15″ clearance line',
      side: vs,
    };
  } else if (wc && D.vpos === 'far') x0 = vs === 'R' ? Wd - vw : 0;
  const exd = D.plumb === 'keep' ? opt('exdx') : null;
  if (D.vpos === 'drain' && exd !== null) x0 = exd - vw / 2;
  x0 = Math.round(x0 * 16) / 16;
  const x1 = x0 + vw;
  const vc = (x0 + x1) / 2;
  const sp = opt('space');
  const cls = n === 1 ? [vc] : sp ? [vc - sp / 2, vc + sp / 2] : [x0 + vw / 4, x0 + (3 * vw) / 4];
  const counter = ped ? v('prim') : v('ctr');
  const bsTop = counter + bs;
  const rim = D.sink === 'vessel' ? counter + v('vh') : counter;
  const spoutAFF = rim + v('spout');
  const fTop = D.fau === 'deck' ? rim + v('fh') : spoutAFF + 3;
  const dep = ped ? v('pd') : v('vd');
  const bx = ped || D.sink === 'vessel' ? dep / 2 + 1 : (dep + 1) / 2 + 0.5;
  const fx = D.fau === 'deck' ? Math.max(1.5, bx - 9.5) : 0;
  const R: VanityResult = {
    ped,
    vs,
    centered,
    drainX: exd,
    sec: { dep, bx, fx, outX: fx + v('freach') },
    bs,
    Wd,
    H,
    vw,
    n,
    x0,
    x1,
    vc,
    cls,
    counter,
    bsTop,
    rim,
    spoutAFF,
    fTop,
    wc,
    tc,
    mirs: [],
    lights: [],
    sconces: [],
    outs: [],
    studs: [],
  };

  const mirs: Mirror[] = [];
  if (D.mir !== 'none') {
    const mw = v('mw');
    const mh = v('mh');
    const cs = n === 2 && D.mm === 'each' ? cls : [vc];
    const low = Math.max(bs > 0 ? bsTop + 1 : counter + 1, fTop + v('fgap'));
    let b = low;
    let want: number | null = null;
    if (D.place === 'eye') want = v('mc') - mh / 2;
    if (D.place === 'top') want = v('mt') - mh;
    if (D.place === 'bot') want = v('mb');
    if (want !== null) {
      b = Math.max(low, want);
      R.forced = want < low - 0.01;
    }
    b = Math.round(b * 16) / 16;
    R.mLow = low;
    for (const c of cs) {
      const m: Mirror = { c, x: c - mw / 2, w: mw, b, t: b + mh };
      if (D.mir === 'rec') {
        const rw = opt('mro') || mw - 1.75;
        const rh = opt('mroh') || mh - 1.75;
        m.ro = { x: c - rw / 2, w: rw, b: b + (mh - rh) / 2, h: rh };
      }
      mirs.push(m);
    }
  }
  R.mirs = mirs;
  const refs = mirs.length ? mirs : cls.map((c) => ({ c, x: c - 8, w: 16, b: fTop, t: fTop + 24 }));
  if (D.lt === 'bar') {
    const lw = v('lw');
    const lh = v('lh');
    for (const m of refs) {
      const b = m.t + v('lgap');
      R.lights.push({ c: m.c, x: m.c - lw / 2, w: lw, b, h: lh, box: b + lh / 2 });
    }
  }
  if (D.lt === 'sconce') {
    const sw = v('sw');
    const sh = v('sh');
    for (const m of refs) {
      const box = opt('saff') || Math.min(68, Math.max(60, Math.round(((m.b + m.t) / 2 + 2) * 2) / 2));
      for (const s of [-1, 1]) {
        const c = m.c + s * (m.w / 2 + v('sgap') + sw / 2);
        R.sconces.push({ c, x: c - sw / 2, w: sw, b: box - sh / 2, h: sh, box });
      }
    }
  }
  if (D.rec !== 'none') {
    const objs = [...mirs.map((m) => [m.x, m.x + m.w]), ...R.sconces.map((s) => [s.x, s.x + s.w]), ...R.lights.map((l) => [l.x, l.x + l.w])] as [number, number][];
    const aff = Math.max(v('rech'), bsTop + 2);
    const x = D.rec === 'R' ? Math.max(x1 - 4, ...objs.map((o) => o[1] + 4)) : Math.min(x0 + 4, ...objs.map((o) => o[0] - 4));
    R.rec = { x, aff };
  }
  if (D.bid === 'yes') {
    let x = opt('bidx');
    if (x === null) x = R.tc !== null ? R.tc + 12 : 12;
    R.outs.push({ key: 'bid', name: 'Bidet outlet', x, aff: v('bidh') });
  }
  if (D.wo === 'yes') R.outs.push({ key: 'wo', name: 'Wall outlet', x: v('wox'), aff: v('woh') });
  const f = opt('stud');
  if (f !== null) {
    let c = f;
    while (c - 16 > -1) c -= 16;
    for (; c < Wd + 1; c += 16) if (c > 0.75 && c < Wd - 0.75) R.studs.push(c);
  }
  if (D.cab === 'yes') {
    const w = v('cabw');
    let x = opt('cabx');
    if (x === null) {
      if (R.wc && R.tc !== null) {
        const left = R.tc - 15 - w;
        const right = R.tc + 15;
        const fitL = left >= 0;
        const fitR = right + w <= Wd;
        const vanR = R.vc > R.tc;
        x = vanR ? (fitL ? left : right) : fitR ? right : left;
      } else x = 0;
    }
    const c: StorageCab = {
      x,
      w,
      b: Math.max(0, opt('cabb') || 0),
      t: v('cabh'),
      n: Math.max(0, Math.min(8, Math.round(opt('cabn') ?? 4))),
      face: D.cabface || 'front',
      carc: 0,
      slide: 0,
      drawers: [],
    };
    R.cab = c;
    c.carc = c.face === 'front' ? v('cabd') : w;
    c.slide = [24, 22, 20, 18, 16, 14, 12, 10].find((z) => z <= c.carc - 1.5) || 0;
    const kick = c.b < 0.01 ? 4 : 0;
    const bb = c.b + kick;
    const ih = c.t - bb - 1.5;
    if (c.n > 0)
      for (let i = 0; i < c.n; i++) {
        const h = ih / c.n;
        const y0 = bb + 0.75 + i * h;
        c.drawers.push({ y0, y1: y0 + h });
      }
    if (c.face !== 'front' && c.drawers.length) {
      const L = c.face === 'left';
      const front = L ? c.x : c.x + c.w;
      const obs: { x0: number; x1: number; y0: number; y1: number; name: string }[] = [];
      if (R.wc && R.tc !== null) {
        const st = v('wcseat');
        const tt = v('wct');
        obs.push({ x0: R.tc - 8, x1: R.tc + 8, y0: 0, y1: st, name: 'toilet' }, { x0: R.tc - 10, x1: R.tc + 10, y0: st, y1: tt, name: 'toilet tank' });
      }
      obs.push({ x0: R.x0, x1: R.x1, y0: 0, y1: R.counter, name: R.ped ? 'sink' : 'vanity' });
      c.drawers.forEach((d) => {
        let lim = L ? 0 : Wd;
        let by = 'wall';
        for (const o of obs) {
          if (o.y1 <= d.y0 + 0.01 || o.y0 >= d.y1 - 0.01) continue;
          if (L && o.x1 <= front + 0.01 && o.x1 > lim) {
            lim = o.x1;
            by = o.name;
          }
          if (!L && o.x0 >= front - 0.01 && o.x0 < lim) {
            lim = o.x0;
            by = o.name;
          }
        }
        d.room = Math.abs(front - lim);
        d.by = by;
        d.need = c.slide + 1.25;
      });
    }
  }
  return R;
}

/* ---------- checks ---------- */

export type CheckLevel = 'ans' | 'bad' | 'warn' | 'good';
export type Fix = [label: string, apply: (D: VanityD) => void];
export type VanityCheck = [level: CheckLevel, text: string, fixes?: Fix[]];

const STD = [18, 24, 30, 36, 42, 48, 60, 72];
const fitStd = (m: number) => STD.filter((w) => w <= m + 1e-6).pop();
const setX = (x: number) => (D: VanityD) => {
  D.vpos = 'left';
  D.voff = fmtN(r16(x));
};
const setW = (w: number) => (D: VanityD) => {
  if (D.sink === 'ped') D.pw = fmtN(w);
  else D.vw = fmtN(w);
};

export function checks(D: VanityD, R: VanityResult): VanityCheck[] {
  const v = (k: string) => vOf(D, k);
  const opt = (k: string) => optOf(D, k);
  const out: VanityCheck[] = [];
  const ok = (t: string, f?: Fix[]) => out.push(['good', t, f]);
  const warn = (t: string, f?: Fix[]) => out.push(['warn', t, f]);
  const bad = (t: string, f?: Fix[]) => out.push(['bad', t, f]);
  const vn = R.ped ? 'sink' : 'vanity';
  const lowMir: Fix[] =
    D.place !== 'low'
      ? [
          [
            'Set the mirror just above the faucet',
            (D) => {
              D.place = 'low';
            },
          ],
        ]
      : [];
  const flipRec: Fix[] = [
    [
      'Move the outlet to the other side',
      (D) => {
        D.rec = D.rec === 'L' ? 'R' : 'L';
      },
    ],
  ];
  const oneMir: Fix[] =
    R.n === 2 && D.mm === 'each'
      ? [
          [
            'Use one centered mirror',
            (D) => {
              D.mm = 'one';
            },
          ],
        ]
      : [];

  if (R.x0 < -0.01 || R.x1 > R.Wd + 0.01) {
    const f: Fix[] = [];
    if (R.vw > R.Wd) {
      const s = fitStd(R.Wd);
      if (s) f.push([`Use a ${s}″ ${vn}`, setW(s)]);
    } else f.push(['Pull it back onto the wall', setX(Math.min(Math.max(R.x0, 0), R.Wd - R.vw))]);
    bad(`Vanity doesn’t fit: ${fmt(R.vw)} vanity on a ${fmt(R.Wd)} wall at that position.`, f);
  }
  const side = Math.min(R.cls[0]!, R.Wd - R.cls[R.cls.length - 1]!);
  {
    const f: Fix[] = [];
    if (side < 15 - 1e-6) {
      const need = 15 - side;
      const nearL = R.cls[0]! < R.Wd - R.cls[R.cls.length - 1]!;
      const nx = nearL ? R.x0 + need : R.x0 - need;
      if (nx >= -0.01 && nx + R.vw <= R.Wd + 0.01) f.push([`Shift the ${vn} ${fmt(need)} away from the wall`, setX(nx)]);
      if (R.n === 1 && !R.ped && R.vw < 30 && (R.x0 < 0.5 || R.x1 > R.Wd - 0.5)) f.push(['Use a 30″ vanity', setW(30)]);
      if (R.n === 2 && !opt('space'))
        f.push([
          'Pull the sinks closer to center',
          (D) => {
            D.space = fmtN(Math.max(30, Math.min(36, R.vw - 30)));
          },
        ]);
    }
    if (side >= 15 - 1e-6 && side < 20 - 1e-6 && D.preset !== 'tight' && R.n === 1) {
      const need = 20 - side;
      const nearL = R.cls[0]! < R.Wd - R.cls[0]!;
      const nx = nearL ? R.x0 + need : R.x0 - need;
      warn(
        `Sink centerline is ${fmt(side)} from the side wall: meets code; 20″ is more comfortable.`,
        nx >= -0.01 && nx + R.vw <= R.Wd + 0.01 ? [[`Shift the ${vn} ${fmt(need)} away from the wall`, setX(nx)]] : [],
      );
    } else (side < 15 - 1e-6 ? bad : ok)(`Sink centerline is ${fmt(side)} from the nearest side wall (15″ minimum).`, f);
  }
  if (R.n === 2) {
    const cc = R.cls[1]! - R.cls[0]!;
    (cc < 30 - 1e-6 ? bad : ok)(`Sinks are ${fmt(cc)} center to center (30″ minimum).`);
    if (R.cls[0]! - R.x0 < 8 || R.x1 - R.cls[1]! < 8) warn('A sink is within 8″ of the vanity end: check the bowl fits the cabinet.');
  }
  if (R.centered) {
    const c = R.centered;
    if (c.gap < 0) {
      const s = fitStd(R.vw + 2 * c.gap);
      bad(`Vanity is too wide to fit between the ${c.ref} and the wall.`, s ? [[`Use a ${s}″ ${vn}`, setW(s)]] : []);
    } else
      out.push([
        'ans',
        `Vanity centered between the ${c.ref} and the ${c.side === 'R' ? 'right' : 'left'} wall: ${fmt(c.gap)} each side, left edge at ${fmt(R.x0)} from the left wall, sink centerline at ${fmt(R.cls[0]!)}${R.n > 1 ? ` and ${fmt(R.cls[1]!)}` : ''}.`,
      ]);
  }
  if (R.drainX !== null) {
    const dx = R.drainX;
    const c = R.cls.reduce((a, b) => (Math.abs(b - dx) < Math.abs(a - dx) ? b : a));
    const d = dx - c;
    if (Math.abs(d) <= 0.25) ok('Existing drain lines up with the sink centerline.');
    else
      (R.ped && Math.abs(d) > 1 ? bad : warn)(
        `Existing drain is ${fmt(Math.abs(d))} ${d < 0 ? 'left' : 'right'} of the sink centerline. ${R.ped ? 'A pedestal hides very little offset: center on the drain or move it.' : 'Center the vanity on the drain, offset the trap in the cabinet, or move the drain.'}`,
        R.n === 1
          ? [
              [
                `Center the ${vn} on the drain`,
                (D) => {
                  D.vpos = 'drain';
                },
              ],
            ]
          : [],
      );
  }
  if (R.wc && D.wcmove === 'move') warn('Toilet flange is moving: check joist direction and the drain path under the floor before locking in this spot.');
  if (D.wallc === 'closed' && D.mir === 'rec') warn('Wall is still finished: find the studs before committing to the recessed cabinet location.');
  if (R.wc && R.tc !== null) {
    const tc = R.tc;
    const sw = Math.min(tc, R.Wd - tc);
    const moveWc = (nt: number) => (D: VanityD) => {
      D.wcmove = 'move';
      D.wcx = fmtN(r16(D.wc === 'left' ? nt : R.Wd - nt));
    };
    if (tc < 10 || tc > R.Wd - 10) bad('Toilet runs past the wall.');
    (sw < 15 - 1e-6 ? bad : ok)(
      `Toilet centerline is ${fmt(sw)} from the side wall (15″ minimum).`,
      sw < 15 - 1e-6 ? [['Move the toilet to 18″ off the wall (moves the flange)', moveWc(tc < R.Wd / 2 ? 18 : R.Wd - 18)]] : [],
    );
    const ve = tc < R.x0 ? R.x0 - tc : tc > R.x1 ? tc - R.x1 : 0;
    if (R.cab) {
      const c = R.cab;
      const ce = tc < c.x ? c.x - tc : tc > c.x + c.w ? tc - c.x - c.w : 0;
      const cf: Fix[] = [
        [
          'Place the cabinet 15″ past the toilet',
          (D) => {
            D.cabx = '';
          },
        ],
      ];
      if (ce === 0) bad('Toilet and storage cabinet overlap.', cf);
      else (ce < 15 - 1e-6 ? bad : ok)(`Toilet centerline is ${fmt(ce)} from the storage cabinet (15″ minimum).`, ce < 15 - 1e-6 ? cf : []);
    }
    const right = R.vc > tc;
    const away = (need: number) => {
      const f: Fix[] = [];
      const nx = right ? R.x0 + need : R.x0 - need;
      if (nx >= -0.01 && nx + R.vw <= R.Wd + 0.01) f.push([`Shift the ${vn} ${fmt(need)} away from the toilet`, setX(nx)]);
      const nt = right ? tc - need : tc + need;
      if (nt >= 15 && nt <= R.Wd - 15) f.push([`Move the toilet ${fmt(need)} (moves the flange)`, moveWc(nt)]);
      if (D.vpos === 'far' || D.vpos === 'beside') {
        const s = fitStd(R.vw - (D.vpos === 'far' ? need : 2 * need));
        if (s && s >= 18 && !R.ped) f.push([`Use a ${s}″ vanity`, setW(s)]);
      }
      return f;
    };
    if (tc >= R.x0 && tc <= R.x1)
      bad(`Toilet and ${vn} overlap.`, [
        [
          `Center the ${vn} between the toilet and the wall`,
          (D) => {
            D.vpos = 'beside';
            D.vref = 'clear';
            D.vside = right ? 'R' : 'L';
          },
        ],
      ]);
    else (ve < 15 - 1e-6 ? bad : ok)(`Toilet centerline is ${fmt(ve)} from the ${vn} (15″ minimum).`, ve < 15 - 1e-6 ? away(15 - ve) : []);
    const cc = Math.min(...R.cls.map((c) => Math.abs(c - tc)));
    (cc < 30 - 1e-6 ? bad : ok)(`Toilet to sink centerline: ${fmt(cc)} (30″ minimum).`, cc < 30 - 1e-6 && ve >= 15 - 1e-6 ? away(30 - cc) : []);
    if (ve >= 15 && ve < 18 && D.preset !== 'tight') warn(`${fmt(ve)} from toilet center to ${vn} meets code but feels tight; 18″ or more is more comfortable.`, away(18 - ve));
    if (R.rec && Math.abs(R.rec.x - tc) < 11 && R.rec.aff < v('wct') + 4) warn('Outlet lands behind the toilet tank: move it to the other side.', flipRec);
  }
  if (R.cab) {
    const c = R.cab;
    const gl = c.x;
    const gr = R.Wd - c.x - c.w;
    const gw = Math.min(gl, gr);
    if (gw > 0.01 && gw < 4)
      warn(`Storage cabinet is ${fmt(gw)} off the ${gl < gr ? 'left' : 'right'} wall: a hard-to-clean gap.`, [
        [
          'Push it tight to the wall',
          (D) => {
            D.cabx = gl < gr ? '0' : fmtN(R.Wd - c.w);
          },
        ],
      ]);
    if (c.n > 0 && c.slide < 10) warn(`Storage cabinet is only ${fmt(c.carc)} deep for its drawers: too shallow for standard slides.`);
    if (c.face !== 'front' && c.drawers.length) {
      const short = c.drawers.map((d, i) => ({ d, i })).filter((o) => o.d.room! < o.d.need! - 0.01);
      if (short.length)
        warn(
          `Sideways drawers need about ${fmt(c.drawers[0]!.need!)} to open fully (${c.slide}″ slides). ${short.map((o) => `Drawer ${o.i + 1} from the bottom opens ${fmt(Math.min(o.d.room!, c.slide))} before the ${o.d.by}`).join('; ')}.`,
          [
            [
              'Turn the drawers to face the room',
              (D) => {
                D.cabface = 'front';
              },
            ],
          ],
        );
      else ok(`Sideways drawers open fully: ${c.slide}″ slides with ${fmt(Math.min(...c.drawers.map((d) => d.room!)))} or more of room.`);
    }
  }
  if (R.cab) {
    const c = R.cab;
    const ov = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - 0.01 && a1 > b0 + 0.01;
    if (c.x < -0.01 || c.x + c.w > R.Wd + 0.01) bad('Storage cabinet runs past the wall.');
    if (c.t <= c.b) bad('Storage cabinet top is below its bottom.');
    if (ov(c.x, c.x + c.w, R.x0, R.x1) && ov(c.b, c.t, 0, R.counter))
      bad(
        `Storage cabinet overlaps the ${vn}.`,
        R.wc && opt('cabx') !== null
          ? [
              [
                'Place the cabinet 15″ past the toilet',
                (D) => {
                  D.cabx = '';
                },
              ],
            ]
          : [],
      );
    if (R.mirs.some((m) => ov(c.x, c.x + c.w, m.x, m.x + m.w) && ov(c.b, c.t, m.b, m.t))) bad('Storage cabinet overlaps the mirror.');
    if (R.rec && R.rec.x > c.x && R.rec.x < c.x + c.w && R.rec.aff < c.t + 2) warn('Outlet lands behind the storage cabinet: move it.', flipRec);
  }
  {
    const { bx, fx, outX } = R.sec;
    const off = outX - bx;
    const need = r16(bx - fx);
    if (D.fau === 'wall' ? Math.abs(off) > 3 : off < -5 || off > 4)
      warn(`Spout outlet lands ${fmt(Math.abs(off))} ${off < 0 ? 'behind' : 'in front of'} the drain${off < 0 ? ', close to the back of the bowl' : ', close to the front edge'}.`, [
        [
          `Use a ${fmt(need)} spout reach`,
          (D) => {
            D.freach = fmtN(need);
          },
        ],
      ]);
  }
  const studd = parse(D.studd) || 3.5;
  if (D.mir === 'rec' && v('mrd') > studd + 0.01)
    bad(`Recessed cabinet body is ${fmt(v('mrd'))} deep; a ${studd > 4 ? '2×6' : '2×4'} cavity is ${fmt(studd)}.`, [
      [
        'Use a surface-mount cabinet',
        (D) => {
          D.mir = 'surf';
        },
      ],
      ...(studd < 5
        ? ([
            [
              'Frame this wall with 2×6',
              (D) => {
                D.studd = '5.5';
              },
            ],
          ] as Fix[])
        : []),
    ]);
  if (R.rim > 38)
    warn(
      `Sink rim at ${fmt(R.rim)}: high for most people. Lower the vanity for a vessel sink.`,
      D.sink === 'vessel'
        ? [
            [
              `Lower the vanity to ${fmt(36 - v('vh'))} (rim at 36″)`,
              (D) => {
                D.ctr = fmtN(36 - vOf(D, 'vh'));
              },
            ],
          ]
        : [],
    );
  else if (R.rim < 30) warn(`Sink rim at ${fmt(R.rim)} is low.`);
  if (v('drain') > R.counter - 12 && D.sink !== 'vessel') warn(`Drain stub at ${fmt(v('drain'))} may be too high for the sink tailpiece and trap.`);
  if (v('sup') < v('drain')) warn('Supplies are below the drain stub.');
  if (R.ped) {
    if (v('spread') / 2 > 3.5)
      warn(`Pedestal: supplies ${fmt(v('spread'))} apart will likely show beside the column. Most pedestals want them about 4–6″ apart (check the spec).`, [
        [
          'Set supplies 4″ apart',
          (D) => {
            D.spread = '4';
          },
        ],
      ]);
    if (v('drain') > R.rim - 10) warn('Pedestal: drain stub is high for the trap to hide behind the column.');
    ok('Pedestal: block the wall for the sink hanger bracket before drywall.');
  }
  let vent = false;
  let first = true;
  for (const m of R.mirs) {
    if (R.forced && first) warn(`Mirror was raised to clear the faucet and backsplash: bottom at ${fmt(m.b)}.`);
    const ctr = (m.b + m.t) / 2;
    if (first && D.preset !== 'aip' && (ctr < 58 || ctr > 70))
      warn(`Mirror center at ${fmt(ctr)} AFF: most people look for about 60–66″.`, [
        [
          'Center the mirror at 64″',
          (D) => {
            D.place = 'eye';
            D.mc = '64';
          },
        ],
      ]);
    if (m.t > R.H - 2) {
      const nh = r16(m.t - m.b - (m.t - (R.H - 2)));
      bad(`Mirror top at ${fmt(m.t)} runs into the ceiling.`, [
        ...lowMir,
        ...(nh >= 12
          ? ([
              [
                `Use a ${fmt(nh)} tall mirror`,
                (D) => {
                  D.mh = fmtN(nh);
                },
              ],
            ] as Fix[])
          : []),
      ]);
    }
    if (m.x < -0.01 || m.x + m.w > R.Wd + 0.01) bad('Mirror runs past the wall.');
    if (m.ro) {
      const ro = m.ro;
      const lab = R.mirs.length > 1 ? (m.c < R.vc ? 'Left cabinet' : 'Right cabinet') : 'Recessed cabinet';
      const hits = R.studs.filter((c) => c + 0.75 > ro.x && c - 0.75 < ro.x + ro.w);
      if (!R.studs.length) {
        if (first) warn(`Recessed cabinet needs a ${fmt(ro.w)} × ${fmt(ro.h)} rough opening; enter the stud layout to check it against the studs.`);
      } else if (hits.length)
        warn(`${lab} cuts ${hits.length} stud${hits.length > 1 ? 's' : ''}: frame a header and sill for the ${fmt(ro.w)} × ${fmt(ro.h)} rough opening.`, [
          [
            'Use a surface-mount cabinet',
            (D) => {
              D.mir = 'surf';
            },
          ],
        ]);
      else ok(`${lab} fits between studs (${fmt(ro.w)} wide rough opening).`);
      if (!vent) {
        vent = true;
        warn('The sink vent usually runs up the sink centerline: confirm the cabinet bay is clear.');
      }
    }
    first = false;
  }
  if (R.mirs.length > 1 && R.mirs[0]!.x + R.mirs[0]!.w > R.mirs[1]!.x - 0.01) bad('The two mirrors overlap: narrow them or widen the sink spacing.', oneMir);
  if (R.mirs.length && R.fTop + 0.5 > R.mirs[0]!.b) bad('Faucet hits the mirror.', lowMir);
  let lightTold = false;
  for (const l of R.lights) {
    if (l.b + l.h > R.H - 1 && !lightTold) {
      lightTold = true;
      const over = l.b + l.h - (R.H - 1);
      const m = R.mirs[0];
      const nh = m ? r16(m.t - m.b - over) : 0;
      bad(`Light bar top at ${fmt(l.b + l.h)} is too close to the ceiling: lower the mirror or use sconces.`, [
        [
          'Use sconces instead',
          (D) => {
            D.lt = 'sconce';
          },
        ],
        ...lowMir,
        ...(m && nh >= 12
          ? ([
              [
                `Use a ${fmt(nh)} tall mirror`,
                (D) => {
                  D.mh = fmtN(nh);
                },
              ],
            ] as Fix[])
          : []),
      ]);
    }
    const m = R.mirs.find((mm) => mm.c === l.c);
    if (m && l.w > m.w + 0.01)
      warn(`Light bar (${fmt(l.w)}) is wider than the mirror (${fmt(m.w)}).`, [
        [
          `Use a ${fmt(m.w)} bar`,
          (D) => {
            D.lw = fmtN(m.w);
          },
        ],
      ]);
  }
  if (R.lights.length > 1 && R.lights[0]!.x + R.lights[0]!.w > R.lights[1]!.x) bad('The two light bars overlap.', oneMir);
  if (R.sconces.length) {
    const pr: number[] = [];
    for (let i = 0; i < R.sconces.length; i += 2) pr.push(R.sconces[i + 1]!.c - R.sconces[i]!.c);
    const barFix: Fix[] = [
      [
        'Use a light bar above instead',
        (D) => {
          D.lt = 'bar';
        },
      ],
    ];
    pr.slice(0, 1).forEach((d) => {
      if (d < 28 || d > 40) {
        const mw = R.mirs.length ? R.mirs[0]!.w : 16;
        const tg = d < 28 ? 30 : 36;
        const g = r16((tg - mw - v('sw')) / 2);
        warn(`Sconces are ${fmt(d)} apart: about 28–40″ apart lights a face evenly.`, [
          ...(g >= 1
            ? ([
                [
                  `Space the sconces ${tg}″ apart`,
                  (D) => {
                    D.sgap = fmtN(g);
                  },
                ],
              ] as Fix[])
            : []),
          ...(d > 40 ? barFix : []),
        ]);
      }
    });
    if (R.sconces.some((s) => s.x < 0 || s.x + s.w > R.Wd)) bad('A sconce runs past the wall.', barFix);
    let told = false;
    for (let i = 1; i + 1 < R.sconces.length; i += 2)
      if (!told && R.sconces[i]!.x + R.sconces[i]!.w > R.sconces[i + 1]!.x) {
        told = true;
        bad('Sconces between the two mirrors collide: use one centered mirror or narrower mirrors.', [...oneMir, ...barFix]);
      }
  }
  if (R.rec) {
    const rec = R.rec;
    const e = Math.min(...R.cls.map((c) => Math.max(0, Math.abs(rec.x - c) - 8)));
    if (rec.x < 2 || rec.x > R.Wd - 2) warn('No room for the outlet beside the mirror: put it on the side wall, within 36″ of the basin.', flipRec);
    else (e > 36 ? bad : ok)(`Outlet is ${fmt(e)} from the basin edge (36″ maximum).`, e > 36 ? flipRec : []);
  }
  for (const o of R.outs) {
    const target = o.key === 'bid' && R.tc !== null ? R.tc + 14 : 6;
    const mv: Fix[] = [
      [
        `Move the ${o.name.toLowerCase()} to ${fmt(target)}`,
        (D) => {
          D[o.key === 'bid' ? 'bidx' : 'wox'] = fmtN(target);
        },
      ],
    ];
    if (o.x < 1.5 || o.x > R.Wd - 1.5) {
      bad(`${o.name} is off the wall.`, mv);
      continue;
    }
    if (o.x > R.x0 - 1.4 && o.x < R.x1 + 1.4 && o.aff < R.counter + 1) warn(`${o.name} lands behind the ${R.ped ? 'sink' : 'vanity'}.`);
    if (R.cab && o.x > R.cab.x - 1.4 && o.x < R.cab.x + R.cab.w + 1.4 && o.aff > R.cab.b - 2 && o.aff < R.cab.t + 2) warn(`${o.name} lands behind the storage cabinet.`);
    if (R.wc && R.tc !== null && Math.abs(o.x - R.tc) < 11.5 && o.aff > v('wcseat') - 2 && o.aff < v('wct') + 2)
      warn(`${o.name} lands behind the toilet tank: it needs to sit beside the tank to reach the plug.`, o.key === 'bid' ? mv : []);
    if (o.key === 'bid' && !R.wc) warn('Bidet outlet is on, but there is no toilet on this wall.');
    if (o.key === 'bid' && R.wc && R.tc !== null && Math.abs(o.x - R.tc) > 30)
      warn(`Bidet outlet is ${fmt(Math.abs(o.x - R.tc))} from the toilet centerline: check the bidet seat's cord length.`, mv);
  }
  if (D.preset === 'aip') {
    if (!R.ped && R.counter > 34.01)
      warn(`Counter at ${fmt(R.counter)}: 34″ max for seated use.`, [
        [
          'Set the counter to 34″',
          (D) => {
            D.ctr = '34';
          },
        ],
      ]);
    if (R.wc) {
      const st = v('wcseat');
      if (st < 17 || st > 19)
        warn(`Toilet seat at ${fmt(st)}: 17–19″ for aging in place.`, [
          [
            'Use an 18″ seat height',
            (D) => {
              D.wcseat = '18';
            },
          ],
        ]);
    }
    if (R.mirs.length && R.mirs[0]!.b > 40.01) {
      const fh = r16(40 - v('fgap') - R.rim);
      const f: Fix[] = [];
      if (D.fau === 'deck' && fh >= 3)
        f.push([
          `Use a ${fmt(fh)}-tall faucet`,
          (D) => {
            D.fh = fmtN(fh);
            D.place = 'bot';
            D.mb = '40';
          },
        ]);
      if (D.place !== 'bot')
        f.push([
          'Set the mirror bottom to 40″',
          (D) => {
            D.place = 'bot';
            D.mb = '40';
          },
        ]);
      warn(`Mirror bottom at ${fmt(R.mirs[0]!.b)}: 40″ max over the sink for seated use.`, f);
    }
    const outs: { name?: string; aff: number }[] = [...(R.rec ? [R.rec] : []), ...R.outs];
    outs.forEach((o) => {
      if (o.aff > 48 || o.aff < 15)
        warn(
          `${o.name || 'Vanity outlet'} at ${fmt(o.aff)}: keep outlets within 15–48″ for reach.`,
          !o.name
            ? [
                [
                  'Set it to 44″',
                  (D) => {
                    D.rech = '44';
                  },
                ],
              ]
            : [],
        );
    });
    ok('Aging in place: plan lever handles and a 30″ × 48″ clear space in front of the sink.');
  }
  if (D.preset === 'tight' && !R.ped && R.vw > 24) ok('Tight space: a pedestal sink or an 18–24″ vanity frees up floor.');
  if (D.lt !== 'none' && D.lbkeep === 'keep') {
    const bx = opt('lbx');
    const bh = opt('lbh');
    if (D.lt === 'sconce')
      warn('The existing single box won’t serve sconces: they need a box on each side. Plan new boxes or switch to a light bar.', [
        [
          'Use a light bar above instead',
          (D) => {
            D.lt = 'bar';
          },
        ],
      ]);
    else if (R.lights.length) {
      const l = R.lights.reduce((a, b) => (bx !== null && Math.abs(b.c - bx) < Math.abs(a.c - bx) ? b : a));
      if (bx !== null) {
        const d = bx - l.c;
        if (Math.abs(d) <= 0.5) ok('Existing light box lines up with the light centerline.');
        else
          warn(
            `Existing light box is ${fmt(Math.abs(d))} ${d < 0 ? 'left' : 'right'} of the light centerline. Center the vanity on it, or move the box.`,
            R.n === 1 || D.mm === 'one' ? [[`Center the ${vn} on the light box`, setX(bx - R.vw / 2)]] : [],
          );
      }
      if (bh !== null) {
        const d = bh - l.box;
        if (Math.abs(d) <= 0.5) ok('Existing light box height works with the mirror and bar.');
        else {
          const mt = r16(bh - v('lgap') - v('lh') / 2);
          warn(
            `Existing light box is at ${fmt(bh)}; the bar's box lands at ${fmt(l.box)}.`,
            R.mirs.length
              ? [
                  [
                    `Set the mirror top to ${fmt(mt)} to meet the box`,
                    (D) => {
                      D.place = 'top';
                      D.mt = fmtN(mt);
                    },
                  ],
                ]
              : [],
          );
        }
      }
    }
  }
  const rank: Record<CheckLevel, number> = { ans: -1, bad: 0, warn: 1, good: 2 };
  out.sort((a, b) => rank[a[0]] - rank[b[0]]);
  return out;
}

/* ---------- rough-in schedule ---------- */

export type ScheduleRow = [item: string, fromLeft: string, aff: string];

export function schedule(D: VanityD, R: VanityResult): ScheduleRow[] {
  const v = (k: string) => vOf(D, k);
  const opt = (k: string) => optOf(D, k);
  const rows: ScheduleRow[] = [];
  const rng = (a: number, b: number) => `${fmtN(a)}–${fmt(b)}`;
  R.cls.forEach((c, i) => {
    const s = R.n > 1 ? ` (${i ? 'right' : 'left'} sink)` : '';
    rows.push([`Sink centerline${s}`, fmt(c), '']);
    rows.push([`Drain stub${s}${D.plumb === 'keep' ? ' (existing)' : ''}`, R.drainX !== null && R.n === 1 ? fmt(R.drainX) : fmt(c), fmt(v('drain'))]);
    rows.push([`Supplies${s}${D.plumb === 'keep' ? ' (existing)' : ''}`, `${fmtN(c - v('spread') / 2)} & ${fmt(c + v('spread') / 2)}`, fmt(v('sup'))]);
    if (D.fau === 'wall') rows.push([`Wall faucet spout${s}`, fmt(c), fmt(R.spoutAFF) + ' (set valve per spec)']);
  });
  if (R.cab) {
    const c = R.cab;
    rows.push(['Storage cabinet', rng(c.x, c.x + c.w), rng(c.b, c.t)]);
    if (c.n > 0 && c.slide) rows.push([`Drawers (${c.n}, ${c.face === 'front' ? 'facing the room' : 'opening ' + c.face})`, `${c.slide}″ full-extension slides`, `${fmt(c.carc)} box space`]);
    if (c.b > 0) rows.push(['Cabinet blocking (wall-hung)', rng(c.x, c.x + c.w), `at ${fmtN(c.b + 2)} & ${fmt(c.t - 2)}`]);
  }
  if (R.wc && R.tc !== null) {
    rows.push(['Toilet centerline', fmt(R.tc), '']);
    rows.push([D.wcmove === 'move' ? 'Toilet flange (new)' : 'Toilet flange (existing)', `on centerline, ${fmt(v('wcri'))} off finished wall`, 'floor']);
    rows.push(['Toilet supply stop', fmt(R.tc - v('wcs')), fmt(v('wch'))]);
  }
  if (R.ped) {
    rows.push(['Pedestal sink', rng(R.x0, R.x1), `${fmt(R.rim)} rim`]);
    rows.push(['Sink hanger blocking', rng(R.x0 - 2, R.x1 + 2), rng(R.rim - 9, R.rim - 1.5) + ' (check bracket height in spec)']);
  } else {
    rows.push(['Vanity', rng(R.x0, R.x1), `${fmt(R.counter)} top`]);
    rows.push(['Vanity backing (blocking)', rng(R.x0, R.x1), rng(R.counter - 6, R.counter - 1.5)]);
  }
  R.mirs.forEach((m) => {
    rows.push([D.mir === 'mirror' ? 'Mirror' : 'Medicine cabinet', rng(m.x, m.x + m.w), rng(m.b, m.t)]);
    if (m.ro) rows.push(['Cabinet rough opening', rng(m.ro.x, m.ro.x + m.ro.w), rng(m.ro.b, m.ro.b + m.ro.h)]);
    else rows.push([D.mir === 'mirror' ? 'Mirror blocking' : 'Cabinet blocking', rng(m.x, m.x + m.w), `at ${fmtN(m.b)} & ${fmt(m.t)}`]);
  });
  R.lights.forEach((l) => rows.push([D.lbkeep === 'keep' ? 'Light box (bar), per layout' : 'Light box (bar)', fmt(l.c), fmt(l.box)]));
  if (D.lt !== 'none' && D.lbkeep === 'keep' && (opt('lbx') !== null || opt('lbh') !== null))
    rows.push(['Light box (existing)', opt('lbx') !== null ? fmt(opt('lbx')!) : '—', opt('lbh') !== null ? fmt(opt('lbh')!) : '—']);
  if (D.preset === 'aip' && R.wc && R.tc !== null) {
    rows.push(['Grab bar blocking behind toilet', rng(Math.max(0, R.tc - 24), Math.min(R.Wd, R.tc + 24)), rng(32, 38)]);
    rows.push(['Grab bar blocking, side wall', 'adjacent wall, 12–54″ from this wall', rng(32, 38)]);
  }
  R.sconces.forEach((s) => rows.push(['Sconce box', fmt(s.c), fmt(s.box)]));
  if (R.rec) rows.push(['Vanity outlet (GFCI)', fmt(R.rec.x), fmt(R.rec.aff) + ' center']);
  R.outs.forEach((o) => rows.push([o.name + ' (GFCI)', fmt(o.x), fmt(o.aff) + ' center']));
  return rows;
}
