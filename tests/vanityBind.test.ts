import { describe, expect, it } from 'vitest';
import { createJob, type JobDoc } from '../src/data/model';
import { newPlanItem, toiletCenter } from '../src/plan/items';
import { ensureRoom, makeRectangle, roomWalls } from '../src/plan/room';
import { addVanity, readVanity, toiletItemOf, vanityItemOf, writeVanity } from '../src/vanity/bind';
import { checks, solve } from '../src/vanity/solve';

/** 8′ × 5′ room; wall 2 is the 96″ top wall. */
function job(): { doc: JobDoc; wallId: string } {
  const doc = createJob({ preset: 'comfort' });
  const room = ensureRoom(doc);
  room.ceilingHeight = 96;
  makeRectangle(doc, room.id, 60, 96);
  const w2 = roomWalls(doc, room.id)[1]!;
  return { doc, wallId: w2.id };
}

describe('vanity settings on the shared record', () => {
  it('reads wall, ceiling, studs and preset from the record', () => {
    const { doc, wallId } = job();
    const wall = doc.walls.find((w) => w.id === wallId)!;
    wall.studSize = '2x6';
    wall.open = true;
    wall.firstStud = 8;
    const D = readVanity(doc, wallId);
    expect([D.wall, D.ceil, D.studd, D.wfin, D.wallc, D.stud, D.preset, D.ctr]).toEqual(['96', '96', '5.5', '1/2', 'open', '8', 'comfort', '36']);
    expect(D.wc).toBe('none');
  });

  it('adds a centered vanity that the floor plan sees', () => {
    const { doc, wallId } = job();
    const wall = doc.walls.find((w) => w.id === wallId)!;
    const v = addVanity(doc, wall);
    expect([v.position, v.width, v.depth]).toEqual([30, 36, 21]);
    expect(readVanity(doc, wallId).vpos).toBe('center');
  });

  it('uses the toilet from the floor plan, and a quick fix moves it there', () => {
    const { doc, wallId } = job();
    const t = newPlanItem('toilet', wallId, 'existing');
    t.position = 12 - t.width / 2; // centerline 12″ from the left corner: too close
    doc.items.push(t);
    addVanity(doc, doc.walls.find((w) => w.id === wallId)!);
    const D = readVanity(doc, wallId);
    expect([D.wc, D.wcx, D.wcri, D.wcmove]).toEqual(['left', '12', '12', 'keep']);
    const ck = checks(D, solve(D));
    const fix = ck.flatMap(([, , f]) => f ?? []).find(([label]) => label.startsWith('Move the toilet to 18'))!;
    fix[1](D);
    writeVanity(doc, wallId, D);
    const toilet = toiletItemOf(doc, wallId)!;
    expect(toiletCenter(toilet)).toBe(18);
    expect(toilet.props.flange).toBe('move');
  });

  it('follows the vanity when it is dragged in the floor plan', () => {
    const { doc, wallId } = job();
    const v = addVanity(doc, doc.walls.find((w) => w.id === wallId)!);
    v.position = 50; // dragged in the floor plan
    const D = readVanity(doc, wallId);
    expect([D.vpos, D.voff]).toEqual(['left', '50']);
    expect(solve(D).x0).toBe(50);
  });

  it('moves the vanity in the plan when it is centered on the vanity screen', () => {
    const { doc, wallId } = job();
    const v = addVanity(doc, doc.walls.find((w) => w.id === wallId)!);
    v.position = 10;
    const D = readVanity(doc, wallId);
    D.vpos = 'center';
    writeVanity(doc, wallId, D);
    expect(vanityItemOf(doc, wallId)!.position).toBe(30);
  });

  it('writes studs, finish and the preset back to where they live', () => {
    const { doc, wallId } = job();
    const D = readVanity(doc, wallId);
    D.studd = '5.5';
    D.wfin = '1';
    D.wallc = 'closed';
    D.stud = '16';
    D.preset = 'aip';
    writeVanity(doc, wallId, D);
    const wall = doc.walls.find((w) => w.id === wallId)!;
    expect([wall.studSize, wall.finishThickness, wall.open, wall.firstStud, doc.job.preset]).toEqual(['2x6', 1, false, 16, 'aging']);
    // Shared values aren't kept in the wall's vanity settings.
    expect(Object.keys(wall.vanity!)).not.toContain('studd');
    expect(Object.keys(wall.vanity!)).not.toContain('wall');
  });

  it('applies a preset changed on the job', () => {
    const { doc, wallId } = job();
    writeVanity(doc, wallId, readVanity(doc, wallId));
    doc.job.preset = 'aging';
    const D = readVanity(doc, wallId);
    expect([D.preset, D.ctr, D.place, D.mb]).toEqual(['aip', '34', 'bot', '40']);
  });
});
