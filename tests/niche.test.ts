import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { drawFraming, drawTile, sheetA1, sheetA2 } from '../src/tile/draw';
import { fromSaved, normalize, type TileS } from '../src/tile/settings';
import { courseRoom, cutsFor, cutsPlain, layout, optionLine, optTitle, worstOf } from '../src/tile/solve';

interface Expected {
  options: { title: string; line: string; worst: string; pinned: boolean }[];
  optIdx?: number;
  adjusted?: { adjH: number; adjS: number; adjHin: number; adjSin: number };
  items?: unknown[];
  sheet?: unknown[];
  frRows?: unknown[];
  room?: { below: number; above: number } | null;
  drawings: Record<string, string>;
}
const fixtures = JSON.parse(readFileSync('tests/fixtures/niche-scenarios.json', 'utf8')) as {
  scenarios: { name: string; S: Partial<TileS>; IN?: Partial<TileS>; optIdx?: number; adj?: Partial<Expected['adjusted']>; expected: Expected }[];
};

const sha = (s: string) => createHash('sha1').update(s).digest('hex');
const svgText = (d: { vb: string; h: string }) => d.vb + '\n' + d.h;
// The sheets print the date; the recorder fixed it to this day.
const DATE = 'Jan 15, 2026';

describe('tile and niche match the old Niche Rough-In Planner', () => {
  for (const sc of fixtures.scenarios) {
    describe(sc.name, () => {
      const S = fromSaved({ ...sc.S, ...(sc.IN ?? {}) } as Record<string, unknown>);
      normalize(S);
      const adj = { adjH: 0, adjS: 0, adjHin: 0, adjSin: 0, ...(sc.adj ?? {}) };
      const L = layout(S, sc.optIdx ?? 0, adj)!;
      const E = sc.expected;

      it('options', () => {
        expect(
          L.options.map((o) => ({
            title: optTitle(L.S, o),
            line: optionLine(L.S, o),
            worst: worstOf(o.plain ? cutsPlain(L.S, o) : cutsFor(L.S, o)),
            pinned: !!o.pinned,
          })),
        ).toEqual(E.options);
      });

      it('cuts, sheet and framing', () => {
        expect(L.adjusted ? adj : { adjH: 0, adjS: 0, adjHin: 0, adjSin: 0 }).toEqual(E.adjusted);
        // JSON turns undefined pill text into null, as the recorder saw it.
        expect(JSON.parse(JSON.stringify(L.items))).toEqual(E.items);
        expect(JSON.parse(JSON.stringify(L.sheet))).toEqual(E.sheet);
        expect(JSON.parse(JSON.stringify(L.frRows))).toEqual(E.frRows);
        expect(L.r.plain ? null : courseRoom(L.S, L.r)).toEqual(E.room);
      });

      it('drawings', () => {
        const got: Record<string, string> = {
          preview: sha(svgText(drawTile(S, null))),
          tile: sha(svgText(drawTile(L.S, L.r))),
          framing: sha(svgText(drawFraming(L.S, L.r, L.fr))),
          a1: sha(sheetA1(L.S, L.r, L.fr, { date: DATE })),
        };
        if (!L.r.plain) got.a2 = sha(sheetA2(L.S, L.r, L.fr, { date: DATE }));
        expect(got).toEqual(E.drawings);
      });
    });
  }
});
