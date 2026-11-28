import { describe, expect, it } from 'vitest';
import { solveLook, type LookKey, type Shape } from '../src/tile/looks';
import { fromSaved, type TileS } from '../src/tile/settings';
import { rowShift, solve } from '../src/tile/solve';

const TILES: Partial<TileS>[] = [
  { tilePreset: '3x12', tileH: 3, tileW: 12 },
  { tilePreset: '4x12', tileH: 4, tileW: 12, pattern: 'third' },
  { tilePreset: '6x24', tileH: 6, tileW: 24, grout: 0.0625 },
];
const LOOKS: LookKey[] = ['classic', 'balanced', 'organic', 'simple'];
const SHAPES: Shape[] = ['square', 'tall', 'linear'];
const ALLOWED: Record<LookKey, string[]> = { classic: ['half'], balanced: ['stack', 'third', 'quarter'], organic: ['random', 'quarter'], simple: ['half', 'third', 'quarter', 'stack'] };

describe('looks keep their rules', () => {
  it('every layout a look gives passes every rule, checked on its own', () => {
    let fits = 0;
    let closest = 0;
    let tries = 0;
    let slowest = 0;
    for (const tile of TILES)
      for (let W = 44; W <= 72; W += 6.6875)
        for (const base of ['tub'] as const) // floors are covered by the random walls below
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
              // A linear niche can't go in a stud bay (the screen doesn't offer it there).
              if (studs === 'bay' && shape === 'linear') continue;
              // Every style gives a layout.
              expect(R.L).not.toBeNull();
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
              if (look === 'classic' || look === 'balanced') expect(Math.abs(V.shift)).toBeLessThanOrEqual(tw / 4 + 1e-6);
              if (studs === 'free' && (look === 'classic' || look === 'balanced')) {
                const mid = V.wallW / 2; // tiled wall: finished width, centered
                expect(Math.abs(r.h.L + r.h.w / 2 - mid)).toBeLessThanOrEqual(0.25 + 1e-6);
              }
              // A niche bound by studs stays in its bay whatever the style.
              if (studs === 'bay') expect([V.studs, V.bayL]).toEqual(['bay', S.bayL]);
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

  it('every wall gets every style in its own pattern, keeping the rules (Nov 28)', () => {
    for (const tile of TILES)
      for (let W = 44; W <= 72; W += 1.5625) {
        const S = fromSaved({ framed: 'no', widthRef: 'framing', wallW: W, ...tile, pattern: 'half' });
        const want: Record<string, string> = { classic: 'half', balanced: 'stack', organic: 'random' };
        for (const look of ['classic', 'balanced', 'organic'] as const) {
          const R = solveLook(look, S, 'tall');
          expect(R.L!.S.pattern, `${look} on ${W}`).toBe(want[look]);
          expect(R.broken, `${look} on ${W}″ with ${tile.tilePreset}`).toEqual([]);
        }
      }
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

describe('Organic: random-looking offsets keep the rules', () => {
  it('each course steps 2″ (a third of very small tile) to a third of long tile from the one below; corners a quarter tile or more', () => {
    for (const [tileW, tileH] of [[12, 3], [16, 4], [24, 6], [24, 12], [6, 3]] as [number, number][])
      for (let W = 44; W <= 72; W += 6.8125)
        for (const seed of [1, 2]) {
          const R = solveLook('organic', fromSaved({ framed: 'no', widthRef: 'framing', wallW: W, tilePreset: 'custom', tileW, tileH, seed }), 'tall');
          expect(R.L).not.toBeNull();
          const T = R.L!.S;
          const mw = tileW + T.grout;
          const lo = Math.min(2, tileW / 3);
          const hi = tileW > 18 ? tileW / 3 : mw / 2;
          for (let i = 0; i < 20; i++) {
            const d = (((rowShift(T, i) - rowShift(T, i - 1)) % mw) + mw) % mw;
            const step = Math.min(d, mw - d);
            expect(step).toBeGreaterThanOrEqual(lo - 1e-9);
            expect(step).toBeLessThanOrEqual(hi + 1e-9);
          }
          expect(Math.min(R.L!.r.h.cL, R.L!.r.h.cR)).toBeGreaterThanOrEqual(tileW / 4 - 1e-6);
          expect(R.L!.sheet.find((r) => r[0] === 'Course starts')?.[1]).toMatch(/^Left piece, from the first course up: 1: /);
        }
  });

  it('uses a 1/4 offset when that is the pattern picked and it keeps the rules', () => {
    const R = solveLook('organic', fromSaved({ framed: 'no', widthRef: 'framing', wallW: 44.5, pattern: 'quarter' }), 'tall');
    expect(R.L!.S.pattern).toBe('quarter');
    expect(R.note).toBeUndefined();
    expect(Math.min(R.L!.r.h.cL, R.L!.r.h.cR)).toBeGreaterThanOrEqual(3 - 1e-6);
  });

  it('says so when the 1/4 offset picked can’t keep the rules and random steps are used', () => {
    const R = solveLook('organic', fromSaved({ framed: 'no', widthRef: 'framing', wallW: 61, pattern: 'quarter' }), 'tall');
    expect(R.L!.S.pattern).toBe('random');
    expect(R.note).toBe('1/4 offset can’t keep every rule on this wall, so this uses random offsets.');
  });

  it('the same seed gives the same wall; Shuffle (a new seed) gives another', () => {
    const S = fromSaved({ framed: 'no', widthRef: 'framing', wallW: 61, pattern: 'random', seed: 5 });
    const a = solveLook('organic', S, 'tall').L!.sheet.find((r) => r[0] === 'Course starts')![1];
    expect(solveLook('organic', { ...S }, 'tall').L!.sheet.find((r) => r[0] === 'Course starts')![1]).toBe(a);
    expect(solveLook('organic', { ...S, seed: 6 }, 'tall').L!.sheet.find((r) => r[0] === 'Course starts')![1]).not.toBe(a);
  });
});
