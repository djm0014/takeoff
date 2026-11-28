import { describe, expect, it } from 'vitest';
import { solveLook, type LookKey, type Shape } from '../src/tile/looks';
import { fromSaved, type TileS } from '../src/tile/settings';
import { solve } from '../src/tile/solve';

const TILES: Partial<TileS>[] = [
  { tilePreset: '3x12', tileH: 3, tileW: 12 },
  { tilePreset: '4x12', tileH: 4, tileW: 12, pattern: 'third' },
  { tilePreset: '6x24', tileH: 6, tileW: 24, grout: 0.0625 },
];
const LOOKS: LookKey[] = ['classic', 'balanced', 'simple'];
const SHAPES: Shape[] = ['square', 'tall', 'linear'];
const ALLOWED: Record<LookKey, string[]> = { classic: ['half', 'stack'], balanced: ['half', 'stack', 'quarter'], simple: ['half', 'third', 'quarter', 'stack'] };

describe('looks keep their rules', () => {
  it('every layout a look gives passes every rule, checked on its own', () => {
    let fits = 0;
    let closest = 0;
    let tries = 0;
    let slowest = 0;
    for (const tile of TILES)
      for (let W = 44; W <= 72; W += 3.3125)
        for (const base of ['tub', 'floor'] as const)
        for (const studs of ['free', 'bay'] as const) {
          const S = fromSaved({ framed: 'no', widthRef: 'framing', wallW: W, base, studs, bayL: Math.round((W / 2 - 7.25) * 16) / 16, ...tile });
          for (const look of LOOKS)
            for (const shape of SHAPES) {
              tries++;
              const t = performance.now();
              const R = solveLook(look, S, shape);
              slowest = Math.max(slowest, performance.now() - t);
              if (look === 'simple' && studs === 'free') {
                expect(R.hidden).toBe(true);
                continue;
              }
              // Classic and Balanced always give a layout; Simple too, except a linear niche (wider than a bay).
              if (look !== 'simple' || shape !== 'linear') expect(R.L).not.toBeNull();
              if (!R.L) {
                expect(R.reason).not.toBe('');
                continue;
              }
              // A closest fit says which rules it breaks; only a full fit is checked rule by rule.
              expect(R.broken).toEqual(R.check!.fails);
              // A niche not framed yet always lands its sill and head on grout lines (owner, Nov 28).
              expect(R.L.r.sill.aligned && R.L.r.head.aligned).toBe(true);
              if (R.broken.length) {
                closest++;
                continue;
              }
              fits++;
              const L = R.L;
              const V = L.S;
              const r = L.r;
              const tw = V.tileW;
              const th = V.tileH;
              expect(ALLOWED[look]).toContain(V.pattern);
              expect(V.grout).toBeGreaterThanOrEqual(1 / 16 - 1e-9);
              expect(V.grout).toBeLessThanOrEqual(3 / 16 + 1e-9);
              expect(Math.min(r.h.cL, r.h.cR)).toBeGreaterThanOrEqual(tw / 4 - 1e-6);
              expect(Math.min(r.cl, r.cr)).toBeGreaterThanOrEqual(th / 2 - 1e-6);
              expect(r.p).toBeGreaterThanOrEqual(th * 0.75 - 1e-6);
              expect(r.sill.aligned && r.head.aligned).toBe(true);
              expect(r.sF).toBeGreaterThanOrEqual(40 - 1e-6);
              expect(r.sF).toBeLessThanOrEqual(52 + 1e-6);
              expect(r.hF).toBeGreaterThanOrEqual(10 - 1e-6);
              if (shape === 'linear') expect(r.h.w).toBeGreaterThan(r.hF);
              if (look === 'classic') {
                expect(V.shift).toBe(0);
                expect(Math.abs(Math.min(r.h.cL, tw) - Math.min(r.h.cR, tw))).toBeLessThanOrEqual(1 / 32);
              }
              if (look === 'balanced') expect(Math.abs(V.shift)).toBeLessThanOrEqual(tw / 4 + 1e-6);
              if (look !== 'simple') {
                const mid = V.wallW / 2; // tiled wall: finished width, centered
                expect(Math.abs(r.h.L + r.h.w / 2 - mid)).toBeLessThanOrEqual(0.25 + 1e-6);
              }
              if (look === 'simple') expect(V.studs).toBe('bay');
              // The look's settings give the same layout when solved fresh (what the screen does on opening).
              expect(solve(R.S!)[R.optIdx]!.p).toBe(R.options[R.optIdx]!.p);
            }
        }
    expect(fits).toBeGreaterThan(tries / 3);
    expect(slowest).toBeLessThan(3000);
    console.log(`looks: ${fits} keep every rule, ${closest} closest fits, of ${tries}; slowest ${Math.round(slowest)} ms`);
  }, 120000);

  it('keeps a fixed grout joint', () => {
    const S = fromSaved({ framed: 'no', widthRef: 'framing', wallW: 51.5, tilePreset: '3x12', grout: 0.03125, groutFixed: true });
    for (const look of LOOKS) {
      const R = solveLook(look, { ...S, studs: 'bay', bayL: 17.5 }, 'tall');
      if (R.L) expect(R.L.S.grout).toBe(0.03125);
    }
  });

  it('Classic in half bond fits only some widths; stacked fills in', () => {
    const pats = new Set<string>();
    for (let W = 48; W <= 72; W += 0.5) {
      const R = solveLook('classic', fromSaved({ framed: 'no', widthRef: 'framing', wallW: W }), 'tall');
      if (R.L && !R.broken.length) pats.add(R.L.S.pattern);
    }
    expect([...pats].sort()).toEqual(['half', 'stack']);
  });
});

describe('every wall gets Classic and Balanced', () => {
  const hard: [string, Partial<TileS>][] = [
    ['already-framed niche off center', { framed: 'yes', rW: 16, rH: 30, rSill: 44, rLeft: 8 }],
    ['short wall, long tile', { framed: 'no', wallW: 30, tilePreset: '6x24', tileH: 6, tileW: 24 }],
    ['low sloped ceiling', { framed: 'no', ceilLevel: false, ceilL: 70, ceilR: 84 }],
    ['plain wall', { wallType: 'plain', framed: '' }],
  ];
  for (const [name, extra] of hard)
    it(name, () => {
      const S = fromSaved({ widthRef: 'framing', wallW: 61, ...extra });
      for (const look of ['classic', 'balanced'] as const) {
        const R = solveLook(look, S, S.framed === 'no' ? 'tall' : null);
        expect(R.L, `${look}: ${R.reason}`).not.toBeNull();
        expect(R.broken).toEqual(R.check!.fails);
      }
      expect(solveLook('simple', S, 'tall').hidden).toBe(true);
    });
});

describe('the niche lands on grout lines in every look', () => {
  // Setup sizes aren't limits (owner, Nov 28): framed or not, the sill and head move to grout lines.
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
  it('on 50 random walls, framed and not', () => {
    for (let k = 0; k < 50; k++) {
      const [tileH, tileW] = pick([[3, 6], [3, 12], [4, 12], [4, 16], [6, 24], [12, 24]]);
      const S = fromSaved({
        framed: pick(['no', 'yes']), rW: pick([14, 16, 26]), rH: pick([16, 26, 30]), rSill: pick([40, 44, 47]), rLeft: 18,
        widthRef: 'framing', wallW: 44 + Math.round(rnd() * 28 * 16) / 16, tilePreset: 'custom', tileH, tileW,
        grout: pick([1 / 32, 1 / 16, 1 / 8, 3 / 16]), shelves: pick([0, 1, 2]), sillType: pick(['tile', 'tile', 'marble']),
        frameOn: pick(['no', 'no', 'yes']), tubH: pick([14, 15, 16.5]), base: pick(['tub', 'floor']), ceilL: pick([84, 90, 96, 108]),
        nPreset: 'custom', nW: pick([12, 14, 24]), nH: pick([12, 18, 24, 30]),
      } as Record<string, unknown>);
      for (const look of ['classic', 'balanced'] as const) {
        const R = solveLook(look, S, S.framed === 'no' ? pick(['square', 'tall', 'linear'] as Shape[]) : null);
        expect(R.L).not.toBeNull();
        expect(R.broken.filter((b) => /grout line/.test(b))).toEqual([]);
      }
    }
  });
});
