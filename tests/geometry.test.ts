import { describe, expect, it } from 'vitest';
import {
  buildRoom,
  closingTurn,
  pointInPolygon,
  rectangle,
  solveLastTwo,
  toLocal,
  toPlan,
  type WallInput,
} from '../src/plan/geometry';

const T = 4.5; // 2x4 with 1/2″ finish each side
const walls = (list: [number, number][]): WallInput[] => list.map(([length, turn]) => ({ length, turn, thickness: T }));
const rect = (a: number, b: number) => rectangle(a, b).map((w) => ({ ...w, thickness: T }));

describe('rectangle', () => {
  const room = buildRoom(rect(60, 96));

  it('closes and has the right area', () => {
    expect(room.closed).toBe(true);
    expect(room.problems).toEqual([]);
    expect(room.area).toBeCloseTo(60 * 96, 9);
    expect(room.clockwise).toBe(true);
  });

  it('draws wall 1 going up from the start', () => {
    expect(room.walls[0]!.start).toEqual({ x: 0, y: 0 });
    expect(room.walls[0]!.end.x).toBeCloseTo(0, 9);
    expect(room.walls[0]!.end.y).toBeCloseTo(-60, 9);
  });

  it('has every corner as an inside corner', () => {
    for (const w of room.walls) {
      expect(w.leftCorner).toBe('inside');
      expect(w.rightCorner).toBe('inside');
    }
  });

  it('measures u from the left corner as you face the wall, v into the room', () => {
    // Wall 2 is the top wall (walk goes up, then right). Facing it from inside you look up,
    // so its left corner is the top-left of the room.
    const w2 = room.walls[1]!;
    expect(w2.left.x).toBeCloseTo(0, 9);
    expect(w2.left.y).toBeCloseTo(-60, 9);
    const p = toPlan(w2, 10, 5);
    expect(p.x).toBeCloseTo(10, 9);
    expect(p.y).toBeCloseTo(-55, 9);
    const back = toLocal(w2, p);
    expect(back.x).toBeCloseTo(10, 9);
    expect(back.y).toBeCloseTo(5, 9);
  });

  it('puts the wall body outside the room', () => {
    const w1 = room.walls[0]!;
    // Wall 1 is the left wall; its outside face is at x = -4.5.
    expect(Math.min(...w1.body.map((p) => p.x))).toBeCloseTo(-T, 9);
    // Mitered corner reaches the outside corner of the frame.
    expect(w1.body.some((p) => Math.abs(p.x + T) < 1e-9 && Math.abs(p.y - T) < 1e-9)).toBe(true);
  });
});

describe('walking the other way', () => {
  // Same rectangle, walked with left turns (room on the walker's left).
  const room = buildRoom(walls([[60, -90], [96, -90], [60, -90], [96, -90]]));

  it('still closes, with inside corners and the room on the inside', () => {
    expect(room.closed).toBe(true);
    expect(room.clockwise).toBe(false);
    expect(room.area).toBeCloseTo(5760, 9);
    for (const w of room.walls) {
      expect(w.leftCorner).toBe('inside');
      const mid = toPlan(w, w.length / 2, 1);
      expect(pointInPolygon(mid, room.inner)).toBe(true);
    }
  });
});

describe('L-shaped room', () => {
  // Up 72, right 48, down 36 (turn right), then a jog: left turn, right 36, then right turn down 36, then back.
  const L = buildRoom(
    walls([
      [72, 90],
      [48, 90],
      [36, -90],
      [36, 90],
      [36, 90],
      [84, 90],
    ]),
  );

  it('closes with one outside corner', () => {
    expect(L.problems).toEqual([]);
    expect(L.closed).toBe(true);
    expect(L.area).toBeCloseTo(72 * 48 + 36 * 36, 9);
    const outside = L.walls.flatMap((w) => [w.leftCorner, w.rightCorner]).filter((c) => c === 'outside');
    expect(outside.length).toBe(2); // the one corner, seen from both of its walls
  });

  it('keeps v pointing into the room on every wall', () => {
    for (const w of L.walls) expect(pointInPolygon(toPlan(w, w.length / 2, 1), L.inner)).toBe(true);
  });
});

describe('closure', () => {
  it('reports the gap when the walk does not close', () => {
    const r = buildRoom(walls([[60, 90], [96, 90], [60.375, 90], [96, 90]]));
    expect(r.closed).toBe(false);
    expect(Math.hypot(r.gap.x, r.gap.y)).toBeCloseTo(0.375, 9);
    expect(r.problems).toContain('The walls do not meet back at the starting corner.');
  });

  it('accepts a gap under 1/16″', () => {
    expect(buildRoom(walls([[60, 90], [96, 90], [60.03, 90], [96, 90]])).closed).toBe(true);
  });

  it('solves the last two walls of an L-shape', () => {
    const solved = solveLastTwo([
      { length: 72, turn: 90 },
      { length: 48, turn: 90 },
      { length: 36, turn: -90 },
      { length: 36, turn: 90 },
      { length: 0, turn: 90 },
      { length: 0, turn: 90 },
    ]);
    expect(solved![0]).toBeCloseTo(36, 9);
    expect(solved![1]).toBeCloseTo(84, 9);
  });

  it('cannot solve parallel last walls', () => {
    expect(solveLastTwo([{ length: 60, turn: 90 }, { length: 96, turn: 0 }, { length: 0, turn: 90 }])).toBeNull();
  });

  it('works out the turn back at the start', () => {
    expect(closingTurn(rectangle(60, 96))).toBe(90);
    expect(closingTurn([{ turn: -90 }, { turn: -90 }, { turn: -90 }, { turn: -90 }])).toBe(-90);
  });
});

describe('angled walls', () => {
  it('closes a room with two 45° corners cut off', () => {
    const s = Math.SQRT2 * 12;
    const solved = solveLastTwo([
      { length: 60, turn: 90 },
      { length: 48, turn: 45 },
      { length: s, turn: 45 },
      { length: 0, turn: 90 },
      { length: 0, turn: 90 },
    ]);
    expect(solved).not.toBeNull();
    const room = buildRoom(
      walls([
        [60, 90],
        [48, 45],
        [s, 45],
        [solved![0], 90],
        [solved![1], 90],
      ]),
    );
    expect(room.closed).toBe(true);
    expect(room.problems).toEqual([]);
    expect(room.area).toBeCloseTo(60 * 60 - 72, 6); // 60 × 60 less one 12″ corner triangle
    expect(solved![0]).toBeCloseTo(48, 9);
    expect(solved![1]).toBeCloseTo(60, 9);
  });

  it('rejects a turn too sharp to build', () => {
    const r = buildRoom(walls([[60, 170], [60, 170], [60, 20]]));
    expect(r.problems.some((p) => p.includes('between 1° and 135°'))).toBe(true);
  });

  it('flags walls that cross', () => {
    const d = Math.SQRT2 * 60;
    const r = buildRoom(
      walls([
        [60, 135],
        [d, -135],
        [60, -135],
        [d, 0],
      ]),
    );
    expect(r.closed).toBe(true);
    expect(r.problems).toEqual(['The turns do not add up to one trip around the room.', 'Walls 2 and 4 cross each other.']);
  });
});
