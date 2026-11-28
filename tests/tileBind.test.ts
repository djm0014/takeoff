import { describe, expect, it } from 'vitest';
import { createJob, type JobDoc } from '../src/data/model';
import { newPlanItem } from '../src/plan/items';
import { ensureRoom, makeRectangle, roomWalls } from '../src/plan/room';
import { readTile, writeTile } from '../src/tile/bind';
import { layout } from '../src/tile/solve';
import { STEPS, type ChoiceF } from '../src/tile/fields';
import { fromSaved } from '../src/tile/settings';

/** 5′ × 8′ room with a 60″ tub along wall 1 (a tub alcove). */
function job(): { doc: JobDoc; ids: string[] } {
  const doc = createJob();
  const room = ensureRoom(doc);
  room.ceilingHeight = 96;
  makeRectangle(doc, room.id, 60, 96);
  const ids = roomWalls(doc, room.id).map((w) => w.id);
  const tub = newPlanItem('tub', ids[0]!, 'new');
  doc.items.push(tub);
  return { doc, ids };
}

describe('tile settings on the shared record', () => {
  it('reads the wall stud to stud, the ceiling and the tub from the floor plan', () => {
    const { doc, ids } = job();
    const { S } = readTile(doc, ids[0]!);
    // 60″ finished plus 1/2″ of drywall at each corner.
    expect([S.wallW, S.ceilL, S.widthRef, S.base, S.tubPos, S.tubL, S.tubH, S.studD]).toEqual([61, 96, 'framing', 'tub', 'full', 60, 15, 3.5]);
  });

  it('sees the tub end in the corner of each end wall', () => {
    const { doc, ids } = job();
    const ends = [ids[1]!, ids[3]!].map((id) => readTile(doc, id).S);
    expect(ends.map((S) => [S.base, S.tubL]).sort()).toEqual([
      ['tub', 30],
      ['tub', 30],
    ]);
    expect(ends.map((S) => S.tubPos).sort()).toEqual(['left', 'right']);
    // The wall across from the tub has none.
    expect(readTile(doc, ids[2]!).S.base).toBe('floor');
  });

  it('keeps its settings on the wall and writes shared values back where they live', () => {
    const { doc, ids } = job();
    const wallId = ids[0]!;
    const { S, ui } = readTile(doc, wallId);
    Object.assign(S, { framed: 'no', tileH: 4, tileW: 12, tilePreset: '4x12', tubH: 14.5, studD: 5.5, framing: 'existing', studMode: 'oc', stud1: 16.5, start: 'top' });
    ui.cur = 6;
    writeTile(doc, wallId, S, ui);
    const wall = doc.walls.find((w) => w.id === wallId)!;
    const tub = doc.items.find((i) => i.type === 'tub')!;
    expect(wall.tileLayout).toMatchObject({ tileWidth: 12, tileHeight: 4, grout: 0.125 });
    expect(wall.tileLayout!.settings).not.toHaveProperty('wallW');
    expect(wall.tileLayout!.niche).toEqual(expect.objectContaining({ shelves: 1 }));
    expect([tub.height, wall.studSize, wall.finishThickness, wall.firstStud]).toEqual([14.5, '2x6', 1, 16]);

    const back = readTile(doc, wallId);
    expect([back.S.tileH, back.S.tubH, back.S.studD, back.S.stud1, back.S.start, back.ui.cur]).toEqual([4, 14.5, 5.5, 16.5, 'top', 6]);
    // The layout the screen shows matches the saved niche.
    const L = layout(back.S, back.ui.optIdx, back.ui)!;
    expect(wall.tileLayout!.niche).toEqual({ width: L.r.h.w, height: L.r.hF, sill: L.r.sF, shelves: L.r.int.shelves.length });
  });

  it('follows the floor plan when the tub moves', () => {
    const { doc, ids } = job();
    const tub = doc.items.find((i) => i.type === 'tub')!;
    tub.width = 40;
    expect(readTile(doc, ids[0]!).S.tubPos).toBe('left');
    tub.position = 20;
    expect(readTile(doc, ids[0]!).S.tubPos).toBe('right');
    tub.position = 10;
    expect(readTile(doc, ids[0]!).S.tubPos).toBe('center');
  });
});

describe('how the niche is built (replaces "Is the niche framed yet?")', () => {
  it('opens a wall saved as "Already framed" as between existing studs', () => {
    const { doc, ids } = job();
    const wall = doc.walls.find((w) => w.id === ids[0])!;
    wall.tileLayout = { tileWidth: 12, tileHeight: 3, grout: 0.125, niche: null, settings: { framed: 'yes', rLeft: 22, cur: 6 } };
    const { S } = readTile(doc, ids[0]!);
    expect([S.build, S.framed, S.studs, S.bayL]).toEqual(['bay', 'no', 'bay', 22]);
  });

  it('keeps older "not framed yet" walls as they were', () => {
    const { doc, ids } = job();
    const wall = doc.walls.find((w) => w.id === ids[0])!;
    wall.tileLayout = { tileWidth: 12, tileHeight: 3, grout: 0.125, niche: null, settings: { framed: 'no', studs: 'free', cur: 6 } };
    expect(readTile(doc, ids[0]!).S.build).toBe('new');
  });

  it('the answer sets the stud-bay setup', () => {
    const f = STEPS[0]!.fields.find((x) => 'id' in x && x.id === 'build') as ChoiceF;
    const S = fromSaved({});
    f.on!(S, 'bay');
    expect([S.framed, S.studs]).toEqual(['no', 'bay']);
    f.on!(S, 'new');
    expect([S.framed, S.studs]).toEqual(['no', 'free']);
  });
});

describe('style', () => {
  it('a wall laid out before the style question has no style until one is picked', () => {
    const { doc, ids } = job();
    const wall = doc.walls.find((w) => w.id === ids[0])!;
    wall.tileLayout = { tileWidth: 12, tileHeight: 3, grout: 0.125, niche: null, settings: { framed: 'no', studs: 'free', cur: 6 } };
    expect(readTile(doc, ids[0]!).S.style).toBe('');
  });
  it('a new wall starts on Classic, and the style is saved', () => {
    const { doc, ids } = job();
    const { S, ui } = readTile(doc, ids[0]!);
    expect(S.style).toBe('classic');
    S.style = 'organic';
    writeTile(doc, ids[0]!, S, ui);
    expect(readTile(doc, ids[0]!).S.style).toBe('organic');
  });
  it('picking a style keeps the pattern to one it allows', () => {
    const f = STEPS.find((s) => s.id === 'tile')!.fields.find((x) => 'id' in x && x.id === 'style') as ChoiceF;
    const S = fromSaved({ pattern: 'third' });
    f.on!(S, 'classic');
    expect(S.pattern).toBe('half');
    f.on!(S, 'organic');
    expect(S.pattern).toBe('random');
  });
});
