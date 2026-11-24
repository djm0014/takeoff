import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newId, type Item, type ItemStatus, type Wall } from '../src/data/model';
import { runChecks } from '../src/plan/checks';
import { buildRoom, rectangle, type WallInput } from '../src/plan/geometry';
import { DOOR_JAMBS, TOILET_REACH, TOILET_WIDTH } from '../src/plan/items';
import { KEY_DIMENSIONS } from '../src/data/keyDimensions';
import { PLAN_RULES } from '../src/plan/rules';

/* ---------- old tool format → shared job record ---------- */

interface OldItem {
  type: string;
  st: 'ex' | 'new' | 'rem';
  w: number;
  [k: string]: string | number;
}
interface OldState {
  L: string;
  W: string;
  D: string[];
  items: OldItem[];
}

const STATUS: Record<string, ItemStatus> = { ex: 'existing', new: 'new', rem: 'remove' };

/**
 * The old tool's wall k (0 = top, clockwise) is wall (k + 1) % 4 here, because
 * a walked rectangle starts with the left wall going up.
 */
const newWall = (k: number) => (k + 1) % 4;

export function fromOld(state: OldState) {
  const L = Number(state.L);
  const W = Number(state.W);
  const shape = rectangle(W, L);
  const thickness = (i: number) => Number(state.D[(i + 3) % 4]) + 1;
  const walls: Wall[] = shape.map((s, i) => ({
    id: newId(),
    roomId: 'r',
    number: i + 1,
    length: s.length,
    turn: s.turn,
    studSize: '2x4',
    finishThickness: 0.5,
    open: false,
    firstStud: null,
    tileHeight: null,
    tileLayout: null,
  }));
  const input: WallInput[] = shape.map((s, i) => ({ ...s, thickness: thickness(i) }));
  const items: Item[] = state.items.map((o) => {
    const n = (k: string) => Number(o[k]);
    const base: Item = {
      id: newId(),
      wallId: walls[newWall(o.w)]!.id,
      type: o.type as Item['type'],
      status: STATUS[o.st]!,
      position: n('off'),
      width: 0,
      depth: 0,
      height: null,
      elevation: null,
      label: '',
      props: {},
    };
    switch (o.type) {
      case 'door':
        return { ...base, width: n('size') + DOOR_JAMBS, props: { size: n('size'), hinge: o.hinge === 'R' ? 'right' : 'left', swing: o.swing } };
      case 'window':
        return { ...base, width: n('wid') };
      case 'tub':
        return { ...base, width: n('len'), depth: n('dep'), props: { drain: o.drain === 'R' ? 'right' : 'left' } };
      case 'toilet':
        return {
          ...base,
          position: n('off') - TOILET_WIDTH / 2,
          width: TOILET_WIDTH,
          depth: n('ri') + TOILET_REACH,
          props: { roughIn: n('ri') },
        };
      default:
        return { ...base, width: n('wid'), depth: n('dep') };
    }
  });
  return { room: buildRoom(input), walls, items };
}

/** Old messages say "wall N" in the old numbering. */
const renumber = (text: string) => text.replace(/wall (\d)/g, (_, n) => `wall ${newWall(Number(n) - 1) + 1}`);

/* ---------- matches the old tool ---------- */

const fixtures = JSON.parse(readFileSync('tests/fixtures/floorplan-scenarios.json', 'utf8')) as {
  scenarios: { name: string; state: OldState; expected: { level: string; text: string }[] }[];
};

describe('floor plan checks match the old tool on rectangles', () => {
  for (const sc of fixtures.scenarios) {
    it(sc.name, () => {
      const { checks } = runChecks(fromOld(sc.state));
      const got = checks.map((c) => `${c.level === 'ok' ? 'good' : c.level} ${c.text}`);
      const want = sc.expected.map((c) => `${c.level} ${renumber(c.text)}`);
      expect(got).toEqual(want);
    });
  }
});

/* ---------- shapes the old tool couldn't do ---------- */

function walked(list: [number, number][], items: (walls: Wall[]) => Item[]) {
  const input: WallInput[] = list.map(([length, turn]) => ({ length, turn, thickness: 4.5 }));
  const walls: Wall[] = input.map((w, i) => ({
    id: newId(),
    roomId: 'r',
    number: i + 1,
    length: w.length,
    turn: w.turn,
    studSize: '2x4',
    finishThickness: 0.5,
    open: false,
    firstStud: null,
    tileHeight: null,
    tileLayout: null,
  }));
  return { room: buildRoom(input), walls, items: items(walls) };
}

const item = (wall: Wall, type: Item['type'], position: number, width: number, depth: number, props = {}): Item => ({
  id: newId(),
  wallId: wall.id,
  type,
  status: 'new',
  position,
  width,
  depth,
  height: null,
  elevation: null,
  label: '',
  props,
});

describe('checks in rooms that are not rectangles', () => {
  // L-shape: up 72, right 48, down 36, right 36, down 36, back 84.
  // The tall part is 48 wide; the short leg sticks out 36 more to the right.
  const L: [number, number][] = [
    [72, 90],
    [48, 90],
    [36, -90],
    [36, 90],
    [36, 90],
    [84, 90],
  ];
  // 96 × 60 room with a 12 × 12 chase on the top wall, 30″ from the left corner.
  const chase: [number, number][] = [
    [60, 90],
    [30, 90],
    [12, -90],
    [12, -90],
    [12, 90],
    [54, 90],
    [60, 90],
    [96, 90],
  ];

  it('counts a chase beside the toilet as its side wall', () => {
    // Toilet on wall 6 (top wall right of the chase), centerline 12″ from the chase.
    const ctx = walked(chase, (w) => [item(w[5]!, 'toilet', 2, 20, 29, { roughIn: 12 })]);
    const side = runChecks(ctx).checks.find((c) => c.text.startsWith('Toilet side room'))!;
    expect(side).toMatchObject({ level: 'bad', text: expect.stringContaining('12″ left and 42″ right') });
  });

  it('sees open floor past an outside corner', () => {
    // Toilet on wall 4 (top of the short leg), 12″ from the outside corner: the floor
    // continues past that corner into the tall part, so the left side is open to wall 1.
    const ctx = walked(L, (w) => [item(w[3]!, 'toilet', 2, 20, 29, { roughIn: 12 })]);
    const side = runChecks(ctx).checks.find((c) => c.text.startsWith('Toilet side room'))!;
    expect(side).toMatchObject({ level: 'ok', text: expect.stringContaining('60″ left and 24″ right') });
  });

  it('catches a fixture running into the far side of the L', () => {
    // A 60″ deep tub on wall 1, 40″ up from the corner, reaches across the 48″ tall part into wall 3.
    const bad = runChecks(walked(L, (w) => [item(w[0]!, 'tub', 40, 30, 60)])).checks.map((c) => c.text);
    expect(bad).toContain('Tub (wall 1) runs into wall 3.');
    // Lower down, the same tub reaches into the short leg's open floor and fits.
    const ok = runChecks(walked(L, (w) => [item(w[0]!, 'tub', 0, 30, 60)])).checks.map((c) => c.text);
    expect(ok.some((t) => t.includes('runs into'))).toBe(false);
  });

  it('finds the wall in front of a fixture', () => {
    // Vanity on wall 5 (end of the short leg) faces wall 1, 84″ away.
    const checks = runChecks(walked(L, (w) => [item(w[4]!, 'vanity', 3, 30, 21)])).checks;
    expect(checks.find((c) => c.text.startsWith('Vanity'))!.level).toBe('ok');
  });

  it('catches a door swinging into the wall across a narrow room', () => {
    const narrow: [number, number][] = [
      [24, 90],
      [96, 90],
      [24, 90],
      [96, 90],
    ];
    const ctx = walked(narrow, (w) => [item(w[3]!, 'door', 30, 31.5, 0, { size: 30, hinge: 'left', swing: 'in' })]);
    expect(runChecks(ctx).checks.map((c) => c.text)).toContain('Door on wall 4 swings into wall 2.');
  });

  it('reports room problems instead of clearances', () => {
    const open = walked(
      [
        [60, 90],
        [96, 90],
        [60.5, 90],
        [96, 90],
      ],
      () => [],
    );
    expect(runChecks(open).checks).toEqual([
      { level: 'bad', text: 'The walls do not meet back at the starting corner.', itemIds: [] },
    ]);
  });
});

describe('rules', () => {
  it('match their rows in the Key Dimensions sheet', () => {
    for (const [name, rule] of Object.entries(PLAN_RULES)) {
      if (!rule.key) continue;
      const row = KEY_DIMENSIONS.find((d) => d.key === rule.key);
      expect(row, name).toBeDefined();
      const value = rule.value >= 100 ? rule.value.toLocaleString('en-US') : `${rule.value}″`;
      expect(row!.value, name).toContain(rule.value >= 100 ? `${rule.value}` : value);
    }
  });
});

/* ---------- framing matches the old tool ---------- */

import { blockingText, framing } from '../src/plan/framing';
import { formatInches } from '../src/lib/inches';

const fixturesFraming = JSON.parse(readFileSync('tests/fixtures/floorplan-scenarios.json', 'utf8')) as {
  scenarios: { name: string; state: OldState; expectedFraming: string[][][] }[];
};
const oldWall = (n: string) => String(newWall(Number(n) - 1) + 1);

describe('framing matches the old tool on rectangles', () => {
  for (const sc of fixturesFraming.scenarios) {
    it(sc.name, () => {
      const ctx = fromOld(sc.state);
      const f = framing(ctx.room, ctx.walls, ctx.items);
      const [rough, blocking, takeoff] = sc.expectedFraming;

      expect(f.rough.map((r) => [r.item, r.wall, r.location])).toEqual(rough!.map(([a, w, c]) => [a, oldWall(w!), c]));

      // The old tool shows "None." instead of a table when there's no blocking.
      const oldBlocking = blocking && blocking[0]?.length === 3 ? blocking : [];
      const oldTakeoff = blocking && blocking[0]?.length === 3 ? takeoff! : blocking!;
      expect(f.blocking.map((b) => [String(b.wall + 1), blockingText(f, b, ctx.room), b.label])).toEqual(
        oldBlocking.map(([w, t, l]) => [oldWall(w!), t, l]),
      );

      expect(`${f.studs}`).toBe(oldTakeoff[0]![1]!.split(' ')[0]);
      expect(`${Math.ceil(f.plate / 12)} ft`).toBe(oldTakeoff[1]![1]!.split(' (')[0]);
      expect(f.headers.map((hd) => [`Header, wall ${hd.wall + 1}`, `${formatInches(hd.width + 3)} long for a ${formatInches(hd.width)} ${hd.type} RO`])).toEqual(
        oldTakeoff.slice(2).map(([k, v]) => [k!.replace(/wall (\d)/, (_, n) => `wall ${oldWall(n)}`), v]),
      );
    });
  }
});

describe('framing at an outside corner', () => {
  it('butts one plate into the other with no gap or overlap', () => {
    const ctx = walked(
      [
        [72, 90],
        [48, 90],
        [36, -90],
        [36, 90],
        [36, 90],
        [84, 90],
      ],
      () => [],
    );
    const f = framing(ctx.room, ctx.walls, []);
    const w3 = f.walls[2]!; // runs down to the outside corner, butts
    const w4 = f.walls[3]!; // runs out from the outside corner, through
    expect(w4.u0).toBeCloseTo(0.5, 9); // starts at the corner's framing face
    expect(w3.u1).toBeCloseTo(36 - 0.5 - 3.5, 9); // stops at wall 4's framing
    expect(w4.leftFraming).toBeCloseTo(0.5, 9);
    expect(f.angledCorners).toBe(false);
  });
});
