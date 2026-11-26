import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromJobFile, jobFileName, toJobFile, withFreshJobId } from '../src/data/jobfile';
import {
  createJob,
  duplicateJobDoc,
  JobFormatError,
  migrate,
  newId,
  SCHEMA_VERSION,
  type JobDoc,
} from '../src/data/model';
import { createIdbStore, type JobStore } from '../src/data/storage';

/** A small job with a room, a wall and an item, all linked. */
function sampleJob(): JobDoc {
  const doc = createJob({ name: 'Smith hall bath', client: 'Smith' });
  const roomId = newId();
  const wallId = newId();
  doc.rooms.push({ id: roomId, jobId: doc.job.id, name: 'Hall bath', ceilingHeight: 96 });
  doc.walls.push({
    id: wallId,
    roomId,
    number: 1,
    length: 60,
    turn: 90,
    studSize: '2x4',
    finishThickness: 0.5,
    open: false,
    firstStud: 16,
    tileHeight: null,
    tileLayout: null,
  });
  doc.items.push({
    id: newId(),
    wallId,
    type: 'toilet',
    status: 'new',
    position: 30,
    width: 20,
    depth: 28,
    height: null,
    elevation: null,
    label: '',
    props: { roughIn: 12 },
  });
  return doc;
}

describe('job record', () => {
  it('creates a job at the current version', () => {
    const doc = createJob();
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.job.preset).toBe('standard');
    expect(doc.job.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('duplicates with new ids and intact links', () => {
    const doc = sampleJob();
    const copy = duplicateJobDoc(doc);
    expect(copy.job.id).not.toBe(doc.job.id);
    expect(copy.job.name).toBe('Smith hall bath (copy)');
    expect(copy.rooms[0]!.jobId).toBe(copy.job.id);
    expect(copy.walls[0]!.roomId).toBe(copy.rooms[0]!.id);
    expect(copy.items[0]!.wallId).toBe(copy.walls[0]!.id);
    expect(copy.walls[0]!.id).not.toBe(doc.walls[0]!.id);
    // the original is untouched
    expect(doc.rooms[0]!.jobId).toBe(doc.job.id);
  });

  it('rejects records it cannot read', () => {
    expect(() => migrate(null)).toThrow(JobFormatError);
    expect(() => migrate({})).toThrow(/version/);
    expect(() => migrate({ ...sampleJob(), schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/newer version/);
    expect(() => migrate({ ...sampleJob(), walls: undefined })).toThrow(/walls/);
  });
});

describe('job file', () => {
  it('round-trips a job', () => {
    const doc = sampleJob();
    expect(fromJobFile(toJobFile(doc))).toEqual(doc);
  });

  it('names the file after the job', () => {
    expect(jobFileName(sampleJob())).toMatch(/^smith-hall-bath-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('rejects other files with a plain message', () => {
    expect(() => fromJobFile('not json')).toThrow(/not valid JSON/);
    expect(() => fromJobFile('{"hello":1}')).toThrow(/not a Bathroom Tools job file/);
  });

  it('can give an imported job a fresh id', () => {
    const doc = sampleJob();
    const fresh = withFreshJobId(doc);
    expect(fresh.job.id).not.toBe(doc.job.id);
    expect(fresh.rooms[0]!.jobId).toBe(fresh.job.id);
  });
});

describe('storage', () => {
  let store: JobStore;
  beforeEach(() => {
    store = createIdbStore(new IDBFactory());
  });

  it('saves, lists, reads and deletes', async () => {
    const a = await store.save(sampleJob());
    await new Promise((r) => setTimeout(r, 5));
    const b = await store.save(createJob({ name: 'Second' }));
    const list = await store.list();
    expect(list.map((j) => j.name)).toEqual(['Second', 'Smith hall bath']);
    expect(await store.get(a.job.id)).toEqual(a);
    await store.remove(b.job.id);
    expect((await store.list()).length).toBe(1);
    expect(await store.get(b.job.id)).toBeNull();
  });

  it('updates the saved time on every save', async () => {
    const doc = sampleJob();
    doc.job.updatedAt = '2000-01-01T00:00:00.000Z';
    const saved = await store.save(doc);
    expect(saved.job.updatedAt > '2000').toBe(true);
    expect(doc.job.updatedAt).toBe('2000-01-01T00:00:00.000Z');
  });

  it('duplicates a saved job', async () => {
    const a = await store.save(sampleJob());
    const copy = await store.duplicate(a.job.id);
    expect(copy.job.id).not.toBe(a.job.id);
    expect((await store.list()).length).toBe(2);
  });
});

describe('storage ordering', () => {
  it('a read started right after a save sees the saved job', async () => {
    const store = createIdbStore(new IDBFactory());
    const doc = await store.save(createJob({ name: 'Before' }));
    doc.job.name = 'After';
    // Same order as leaving a screen: the next screen's read starts, then the old screen's save.
    const read = store.get(doc.job.id);
    void store.save(doc);
    expect((await read)!.job.name).toBe('After');
  });
});
