import { describe, expect, it } from 'vitest';
import { drawTile, sheetA1 } from '../src/tile/draw';
import { solveLook } from '../src/tile/looks';
import { fromSaved, type TileS } from '../src/tile/settings';
import { layout, NO_ADJ } from '../src/tile/solve';

// A 61″ stud-to-stud tub alcove, studs 16″ on center from the left corner: the bay from 16 3/4″ to 31 1/4″.
const base = (extra: Partial<TileS> = {}) =>
  fromSaved({ framed: 'no', build: 'prefab', studs: 'bay', studOC: 16, bayL: 16.75, widthRef: 'framing', wallW: 61, pfModel: 'kb12x28', pfW: 12, pfH: 28, pfLip: 0, pfRW: 14.375, pfRH: 30.375, ...extra } as Record<string, unknown>);
const row = (rows: [string, string, boolean?][], k: string) => rows.find((r) => r[0] === k)?.[1];

describe('prefabricated niche', () => {
  it('keeps its size, puts its bottom on a grout line, and has no tile inside', () => {
    const L = layout(base(), 0, NO_ADJ)!;
    expect([L.r.h.w, L.r.hF]).toEqual([12, 28]);
    expect(L.r.sill.aligned).toBe(true);
    expect(L.r.int.bays).toEqual([]);
    expect(L.items.some((i) => /^Inside/.test(i[0]))).toBe(false);
  });

  it('frames the rough opening 1/16″ larger on every side, centered in the bay', () => {
    const L = layout(base(), 0, NO_ADJ)!;
    expect(L.fr.xR - L.fr.xL).toBeCloseTo(14.5, 6);
    expect(L.fr.yh - L.fr.ys).toBeCloseTo(30.5, 6);
    expect(L.fr.xL).toBeCloseTo(16.75, 6); // fills the 14 1/2″ bay exactly
    expect(row(L.sheet, 'Frame the rough opening')).toMatch(/^14 1\/2″ wide × 30 1\/2″ tall/);
    expect(row(L.sheet, 'Stud bay')).toBeUndefined();
    expect(row(L.sheet, 'Prefab niche')).toBe('12″ × 28″ inside, not tiled, flush with the board');
  });

  it('says when the opening is wider than the bay', () => {
    const L = layout(base({ pfRW: 15 }), 0, NO_ADJ)!;
    expect(row(L.sheet, 'Stud bay')).toBe('The opening is 5/8″ wider than the 14 1/2″ bay: trim or move a stud.');
  });

  it('with a lip, the tile stops at the outside of the lip', () => {
    const L = layout(base({ pfModel: 'custom', pfLip: 1 }), 0, NO_ADJ)!;
    expect([L.r.h.w, L.r.hF]).toEqual([14, 30]);
    expect(row(L.sheet, 'Tile stops at')).toMatch(/^14″ × 30″, bottom at .* \(outside of the lip\)$/);
    expect(drawTile(L.S, L.r).h).toContain('class="marble"');
  });

  it('draws and makes sheet A-1', () => {
    const L = layout(base(), 0, NO_ADJ)!;
    expect(sheetA1(L.S, L.r, L.fr, { date: 'Jan 15, 2026' })).toContain('Prefabricated niche 12″ × 28″ inside, not tiled.');
  });

  it('every style keeps the prefab’s size with its bottom on a grout line, in its bay', () => {
    for (const look of ['classic', 'balanced', 'organic', 'simple'] as const) {
      const R = solveLook(look, base(), null);
      expect(R.L, look).not.toBeNull();
      expect([R.L!.r.h.w, R.L!.r.hF]).toEqual([12, 28]);
      expect(R.L!.r.sill.aligned).toBe(true);
      expect(R.broken.filter((b) => /grout line/.test(b))).toEqual([]);
    }
    for (const look of ['classic', 'simple'] as const) expect(solveLook(look, base(), null).S!.studs).toBe('bay');
  });
});
