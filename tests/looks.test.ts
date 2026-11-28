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
    let tries = 0;
    let slowest = 0;
    for (const tile of TILES)
      for (let W = 44; W <= 72; W += 3.3125)
        for (const base of ['tub', 'floor'] as const) {
          const S = fromSaved({ framed: 'no', widthRef: 'framing', wallW: W, base, ...tile });
          for (const look of LOOKS)
            for (const shape of SHAPES) {
              tries++;
              const t = performance.now();
              const R = solveLook(look, S, shape);
              slowest = Math.max(slowest, performance.now() - t);
              if (!R.L) {
                expect(R.reason).not.toBe('');
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
    expect(fits).toBeGreaterThan(tries / 2);
    expect(slowest).toBeLessThan(3000);
    console.log(`looks: ${fits} of ${tries} fit; slowest ${Math.round(slowest)} ms`);
  }, 120000);

  it('keeps a fixed grout joint', () => {
    const S = fromSaved({ framed: 'no', widthRef: 'framing', wallW: 51.5, tilePreset: '3x12', grout: 0.03125, groutFixed: true });
    for (const look of LOOKS) {
      const R = solveLook(look, S, 'tall');
      if (R.L) expect(R.L.S.grout).toBe(0.03125);
    }
  });

  it('Classic in half bond fits only some widths; stacked fills in', () => {
    const pats = new Set<string>();
    for (let W = 48; W <= 72; W += 0.5) {
      const R = solveLook('classic', fromSaved({ framed: 'no', widthRef: 'framing', wallW: W }), 'tall');
      if (R.L) pats.add(R.L.S.pattern);
    }
    expect([...pats].sort()).toEqual(['half', 'stack']);
  });
});
