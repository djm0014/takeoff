import { describe, expect, it } from 'vitest';
import { fromSaved } from '../src/tile/settings';
import { solveLook } from '../src/tile/looks';
import { keepSpot, layout, lineMoves, solve, spotOf } from '../src/tile/solve';

const adj = { adjH: 1, adjS: -1, adjHin: 0, adjSin: 0 };

describe('course moves survive other changes', () => {
  it('keeps the niche where it was moved when the centering changes', () => {
    const S = fromSaved({ framed: 'no', widthRef: 'framing' });
    const before = layout(S, 1, adj)!;
    expect(before.adjusted).toBe(true);
    for (const center of ['wall', 'left', 'right'] as const) {
      const S2 = { ...S, center };
      const res = solve(S2);
      const back = keepSpot(S2, res, spotOf(before.r))!;
      expect(back).not.toBeNull();
      const after = layout(S2, back.optIdx, back.adj, res)!;
      expect([after.r.sF, after.r.hF, after.r.p]).toEqual([before.r.sF, before.r.hF, before.r.p]);
    }
  });

  it('keeps a snap to a grout line too', () => {
    const S = fromSaved({ framed: 'yes', widthRef: 'framing', rW: 15, rH: 27, rSill: 45, rLeft: 22 });
    const before = layout(S, 0, { adjH: 0, adjS: 0, adjHin: 0.5, adjSin: 0 })!;
    const S2 = { ...S, pattern: 'stack' as const };
    const res = solve(S2);
    const back = keepSpot(S2, res, spotOf(before.r))!;
    const after = layout(S2, back.optIdx, back.adj, res)!;
    expect([after.r.sF, after.r.hF]).toEqual([before.r.sF, before.r.hF]);
  });

  it('lets go when the courses themselves move', () => {
    const S = fromSaved({ framed: 'no', widthRef: 'framing' });
    const before = layout(S, 0, adj)!;
    const S2 = { ...S, tileH: 4, tilePreset: '4x12' };
    expect(keepSpot(S2, solve(S2), spotOf(before.r))).toBeNull();
  });
});

describe('moving the layout line off center fixes corner slivers', () => {
  // Half bond, 12″ tile, 1/8″ joint: centered on this wall the corners end in 3/16″ slivers.
  const S = fromSaved({ wallType: 'plain', base: 'floor', widthRef: 'finished', wallW: 49.1875, center: 'wall' });

  it('finds a quarter-tile move each way', () => {
    const L = layout(S, 0, { adjH: 0, adjS: 0, adjHin: 0, adjSin: 0 })!;
    const mv = lineMoves(S, L)!;
    expect(mv.now).toBeLessThan(1 / 4);
    expect(Math.abs(mv.left!.shift + 3)).toBeLessThanOrEqual(1 / 4);
    expect(Math.abs(mv.right!.shift - 3)).toBeLessThanOrEqual(1 / 4);
    expect(Math.min(mv.left!.min, mv.right!.min)).toBeGreaterThanOrEqual(2.875);
  });

  it('moves the field and says so on the layout sheet', () => {
    const S2 = { ...S, shift: 3 };
    const L = layout(S2, 0, { adjH: 0, adjS: 0, adjHin: 0, adjSin: 0 })!;
    const corners = L.items.filter((i) => /corner/.test(i[0])).map((i) => i[1]);
    expect(corners.every((v) => v === '' || parseFloat(v) >= 3)).toBe(true);
    const line = L.sheet.find((r) => r[0] === 'Vertical line')![1];
    expect(line).toContain('moved 3″ right of the wall’s center'.replace('’', "'"));
  });

  it('leaves a clean wall alone', () => {
    const clean = fromSaved({ wallType: 'plain', base: 'floor', widthRef: 'finished', wallW: 60.25, center: 'wall', pattern: 'stack', minFrac: 0.25 });
    const L = layout(clean, 0, { adjH: 0, adjS: 0, adjHin: 0, adjSin: 0 })!;
    expect(lineMoves(clean, L)).toBeNull();
  });
});

describe('the line-move quick fix tells the truth', () => {
  const A = { adjH: 0, adjS: 0, adjHin: 0, adjSin: 0 };
  const cornerMin = (L: NonNullable<ReturnType<typeof layout>>) => Math.min(L.r.h.cL, L.r.h.cR, L.S.tileW);
  it('what it shows is what the Cuts list gets, on many walls', () => {
    let checked = 0;
    for (const pattern of ['half', 'third'] as const)
      for (const center of ['wall', 'niche'] as const)
        for (let W = 44; W <= 72; W += 1.4375) {
          const S = fromSaved({ framed: 'no', widthRef: 'framing', wallW: W, base: 'floor', pattern, minFrac: 0.3333, center });
          const L = layout(S, 0, A)!;
          const mv = lineMoves(S, L);
          if (!mv) continue;
          expect(mv.now).toBeCloseTo(cornerMin(L), 6);
          for (const m of [mv.left, mv.right]) {
            if (!m) continue;
            const S1 = { ...S, shift: m.shift };
            const res = solve(S1);
            const back = keepSpot(S1, res, spotOf(L.r));
            const L1 = layout(S1, back ? back.optIdx : 0, back ? back.adj : A, res)!;
            expect(cornerMin(L1)).toBeCloseTo(m.min, 6);
            expect(m.min).toBeGreaterThan(mv.now);
            checked++;
          }
        }
    expect(checked).toBeGreaterThan(20);
  });
});

describe('quick width changes', () => {
  it('a width set by hand stays within 1/2″ of what was asked for; a rough target may move 2″', () => {
    const S = fromSaved({ framed: 'no', widthRef: 'framing', wallW: 61, nPreset: 'custom', nH: 28 });
    for (const nW of [10.75, 15.375, 20, 24.625]) {
      const tight = layout({ ...S, nW, nWTol: 0.5 }, 0, { adjH: 0, adjS: 0, adjHin: 0, adjSin: 0 })!;
      expect(Math.abs(tight.r.h.w - nW)).toBeLessThanOrEqual(0.5 + 1e-9);
      const loose = layout({ ...S, nW }, 0, { adjH: 0, adjS: 0, adjHin: 0, adjSin: 0 })!;
      expect(Math.abs(loose.r.h.w - nW)).toBeLessThanOrEqual(2 + 1e-9);
    }
  });
});

describe('locks (owner, Nov 28: "once I have selected an option... that should be locked in unless I revert")', () => {
  const S = fromSaved({ framed: 'no', widthRef: 'framing', wallW: 61 });
  const p0 = solve(S).map((o) => o.p);

  it('a locked first course keeps every option on it, through a pattern change', () => {
    const lockP = p0[1]!;
    for (const pattern of ['half', 'stack', 'third', 'random'] as const) {
      const res = solve({ ...S, lockP, pattern });
      expect(res.length).toBeGreaterThan(0);
      expect(res.every((o) => o.p === lockP)).toBe(true);
    }
  });

  it('a locked niche size stays through a pattern or centering change', () => {
    const L0 = layout(S, 0, { adjH: 0, adjS: 0, adjHin: 0, adjSin: 0 })!;
    const locked = { ...S, lockW: L0.r.h.w, lockH: L0.r.hF };
    for (const change of [{ pattern: 'stack' as const }, { center: 'wall' as const }, { pattern: 'third' as const, shift: 2 }]) {
      const L = layout({ ...locked, ...change }, 0, { adjH: 0, adjS: 0, adjHin: 0, adjSin: 0 })!;
      expect([L.r.h.w, L.r.hF]).toEqual([L0.r.h.w, L0.r.hF]);
    }
  });

  it('a style keeps a locked first course', () => {
    const lockP = p0[1]!;
    for (const look of ['classic', 'balanced', 'organic'] as const) expect(solveLook(look, { ...S, lockP }, 'tall').L!.r.p).toBe(lockP);
  });
});
