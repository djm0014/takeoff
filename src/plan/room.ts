/**
 * Reading and editing a room's walls on the shared job record.
 * Screens call these instead of editing the tables directly, so wall numbers
 * and links stay right.
 */
import { newId, type Id, type JobDoc, type Room, type StudSize, type Wall } from '../data/model';
import { buildRoom, rectangle, solveLastTwo, type RoomGeom } from './geometry';

export const STUD_DEPTH: Record<StudSize, number> = {
  '2x3': 2.5,
  '2x4': 3.5,
  '2x6': 5.5,
  steel: 3.625,
  other: 3.5,
};

/** Finish face to finish face. */
export function wallThickness(w: Wall): number {
  return STUD_DEPTH[w.studSize] + 2 * w.finishThickness;
}

/** The job's first room, created if it doesn't exist yet. */
export function ensureRoom(doc: JobDoc): Room {
  let room = doc.rooms[0];
  if (!room) {
    room = { id: newId(), jobId: doc.job.id, name: 'Bathroom', ceilingHeight: 96 };
    doc.rooms.push(room);
  }
  return room;
}

/** A room's walls in walk order. */
export function roomWalls(doc: JobDoc, roomId: Id): Wall[] {
  return doc.walls.filter((w) => w.roomId === roomId).sort((a, b) => a.number - b.number);
}

export function geometry(doc: JobDoc, roomId: Id): RoomGeom {
  return buildRoom(roomWalls(doc, roomId).map((w) => ({ length: w.length, turn: w.turn, thickness: wallThickness(w) })));
}

export function newWall(roomId: Id, number: number, length = 0, turn = 90): Wall {
  return {
    id: newId(),
    roomId,
    number,
    length,
    turn,
    studSize: '2x4',
    finishThickness: 0.5,
    open: false,
    firstStud: null,
    tileHeight: null,
    tileLayout: null,
  };
}

function renumber(doc: JobDoc, roomId: Id, ordered: Wall[]): void {
  ordered.forEach((w, i) => (w.number = i + 1));
  doc.walls = [...doc.walls.filter((w) => w.roomId !== roomId), ...ordered];
}

/** Add a wall at the end of the walk (or after `afterId`). */
export function insertWall(doc: JobDoc, roomId: Id, afterId?: Id): Wall {
  const walls = roomWalls(doc, roomId);
  const at = afterId ? walls.findIndex((w) => w.id === afterId) + 1 : walls.length;
  const prev = walls[at - 1];
  const wall = newWall(roomId, 0, 0, 90);
  if (prev) wall.studSize = prev.studSize;
  walls.splice(at, 0, wall);
  renumber(doc, roomId, walls);
  return wall;
}

/** Delete a wall and everything on it. */
export function deleteWall(doc: JobDoc, wallId: Id): void {
  const wall = doc.walls.find((w) => w.id === wallId);
  if (!wall) return;
  doc.items = doc.items.filter((it) => it.wallId !== wallId);
  renumber(
    doc,
    wall.roomId,
    roomWalls(doc, wall.roomId).filter((w) => w.id !== wallId),
  );
}

/**
 * Replace the room's walls with a rectangle. Walls that already exist keep
 * their ids (and the items on them); extra walls are deleted.
 */
export function makeRectangle(doc: JobDoc, roomId: Id, len1: number, len2: number): void {
  const walls = roomWalls(doc, roomId);
  const shape = rectangle(len1, len2);
  for (const extra of walls.slice(4)) deleteWall(doc, extra.id);
  const keep = roomWalls(doc, roomId);
  const out = shape.map((s, i) => {
    const w = keep[i] ?? newWall(roomId, i + 1);
    w.length = s.length;
    w.turn = s.turn;
    return w;
  });
  renumber(doc, roomId, out);
}

/** Fill in the last two walls so the room closes. Returns false if it can't. */
export function closeRoom(doc: JobDoc, roomId: Id): boolean {
  const walls = roomWalls(doc, roomId);
  const solved = solveLastTwo(walls);
  if (!solved) return false;
  walls[walls.length - 2]!.length = Math.round(solved[0] * 16) / 16;
  walls[walls.length - 1]!.length = Math.round(solved[1] * 16) / 16;
  return true;
}

/**
 * For rooms with only square corners: how far the walls running across and the
 * walls running up and down are from adding up. Null if any wall is angled.
 */
export function squareGap(room: RoomGeom): { across: number; upDown: number } | null {
  for (const w of room.walls) {
    const d = { x: w.end.x - w.start.x, y: w.end.y - w.start.y };
    if (w.length > 0 && Math.abs(d.x) > 1e-6 && Math.abs(d.y) > 1e-6) return null;
  }
  return { across: Math.abs(room.gap.x), upDown: Math.abs(room.gap.y) };
}
