import { describe, expect, it } from 'vitest';
import { fromSaved } from '../src/tile/settings';
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
    const mv = lineMoves(L)!;
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
    expect(lineMoves(L)).toBeNull();
  });
});
