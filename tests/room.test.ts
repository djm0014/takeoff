import { describe, expect, it } from 'vitest';
import { createJob } from '../src/data/model';
import { closeRoom, deleteWall, ensureRoom, geometry, insertWall, makeRectangle, roomWalls, squareGap, wallThickness } from '../src/plan/room';
import { newPlanItem } from '../src/plan/items';

describe('room editing', () => {
  it('creates one room per job on first use', () => {
    const doc = createJob();
    const a = ensureRoom(doc);
    expect(ensureRoom(doc)).toBe(a);
    expect(doc.rooms.length).toBe(1);
    expect(a.jobId).toBe(doc.job.id);
  });

  it('makes a rectangle that closes, keeping existing walls and their items', () => {
    const doc = createJob();
    const room = ensureRoom(doc);
    const first = insertWall(doc, room.id);
    doc.items.push(newPlanItem('toilet', first.id, 'existing'));
    makeRectangle(doc, room.id, 60, 96);
    const walls = roomWalls(doc, room.id);
    expect(walls.map((w) => [w.number, w.length, w.turn])).toEqual([
      [1, 60, 90],
      [2, 96, 90],
      [3, 60, 90],
      [4, 96, 90],
    ]);
    expect(walls[0]!.id).toBe(first.id);
    expect(doc.items[0]!.wallId).toBe(first.id);
    expect(geometry(doc, room.id).closed).toBe(true);
  });

  it('inserts a wall after another and renumbers', () => {
    const doc = createJob();
    const room = ensureRoom(doc);
    makeRectangle(doc, room.id, 60, 96);
    const w2 = roomWalls(doc, room.id)[1]!;
    const added = insertWall(doc, room.id, w2.id);
    expect(roomWalls(doc, room.id).map((w) => w.id).indexOf(added.id)).toBe(2);
    expect(roomWalls(doc, room.id).map((w) => w.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('deletes a wall with its items and renumbers', () => {
    const doc = createJob();
    const room = ensureRoom(doc);
    makeRectangle(doc, room.id, 60, 96);
    const w3 = roomWalls(doc, room.id)[2]!;
    doc.items.push(newPlanItem('tub', w3.id, 'existing'), newPlanItem('door', roomWalls(doc, room.id)[0]!.id, 'existing'));
    deleteWall(doc, w3.id);
    expect(roomWalls(doc, room.id).map((w) => w.number)).toEqual([1, 2, 3]);
    expect(doc.items.map((i) => i.type)).toEqual(['door']);
  });

  it('closes an L-shaped walk by filling in the last two walls', () => {
    const doc = createJob();
    const room = ensureRoom(doc);
    for (const [length, turn] of [
      [72, 90],
      [48, 90],
      [36, -90],
      [36, 90],
      [0, 90],
      [0, 90],
    ]) {
      const w = insertWall(doc, room.id);
      w.length = length!;
      w.turn = turn!;
    }
    expect(closeRoom(doc, room.id)).toBe(true);
    expect(roomWalls(doc, room.id).slice(-2).map((w) => w.length)).toEqual([36, 84]);
    expect(geometry(doc, room.id).closed).toBe(true);
  });

  it('says which way a square room is off', () => {
    const doc = createJob();
    const room = ensureRoom(doc);
    makeRectangle(doc, room.id, 60, 96);
    roomWalls(doc, room.id)[3]!.length = 95.5;
    expect(squareGap(geometry(doc, room.id))).toEqual({ across: 0.5, upDown: 0 });
  });

  it('works out wall thickness from studs and finish', () => {
    const doc = createJob();
    const w = insertWall(doc, ensureRoom(doc).id);
    expect(wallThickness(w)).toBe(4.5);
    w.studSize = '2x6';
    expect(wallThickness(w)).toBe(6.5);
  });
});
