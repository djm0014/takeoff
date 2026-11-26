/**
 * The shared job record. One document per job, holding flat tables that link
 * by id (like linked tables in Airtable, and like the Supabase tables planned
 * for Stage 2). A measurement lives in exactly one place.
 *
 * All lengths are inches (numbers). Positions along a wall are measured from
 * the wall's left corner, looking at the wall from inside the room.
 *
 * A room's shape is its walls, in the order you walk them from a starting
 * corner: each wall has a length and a turn to the next one. Bump-ins, chases
 * and alcoves are just more walls. See src/plan/geometry.ts.
 */

export const SCHEMA_VERSION = 1;

export type Id = string;

export type Preset = 'tight' | 'standard' | 'comfort' | 'aging';

export const PRESET_LABELS: Record<Preset, string> = {
  tight: 'Tight',
  standard: 'Standard',
  comfort: 'Comfort',
  aging: 'Aging in place',
};

export interface Job {
  id: Id;
  name: string;
  client: string;
  address: string;
  contractor: string;
  /** ISO date, yyyy-mm-dd */
  date: string;
  preset: Preset;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Survey {
  id: Id;
  jobId: Id;
  yearBuilt: number | null;
  plumbing: string;
  electrical: string;
  /** Moisture readings by location, e.g. { "subfloor at toilet": 14 } */
  moisture: Record<string, number>;
  hazards: string[];
  access: string;
  /** Photo checklist: label → taken */
  photos: Record<string, boolean>;
  /** Room for the full field checklist until the survey screen is rebuilt. */
  answers: Record<string, unknown>;
}

export interface Room {
  id: Id;
  jobId: Id;
  name: string;
  ceilingHeight: number;
}

export type StudSize = '2x4' | '2x6' | '2x3' | 'steel' | 'other';

/** Tile and niche settings for one wall. A wall has at most one. */
export interface TileLayout {
  tileWidth: number;
  tileHeight: number;
  grout: number;
  niche: {
    width: number;
    height: number;
    sill: number;
    shelves: number;
  } | null;
  /** Everything else the tile screen needs, filled in at Milestone 4. */
  settings: Record<string, unknown>;
}

export interface Wall {
  id: Id;
  roomId: Id;
  /** Order you walk the room in, starting at 1 from the starting corner. */
  number: number;
  /** Finished face length. 0 until it's entered. */
  length: number;
  /** Turn to the next wall, degrees: 90 right, -90 left. Ignored on the last wall. */
  turn: number;
  studSize: StudSize;
  finishThickness: number;
  open: boolean;
  /** Distance from the wall's left end to the first stud center, if known. */
  firstStud: number | null;
  tileHeight: number | null;
  tileLayout: TileLayout | null;
  /**
   * Vanity wall answers (the old Vanity Wall Solver's settings), when this wall
   * has a vanity. Values that live elsewhere on the record (wall width, studs,
   * the toilet, the vanity's place) aren't kept here. See src/vanity/bind.ts.
   */
  vanity?: Record<string, string> | null;
}

export type ItemType =
  | 'toilet'
  | 'vanity'
  | 'sink'
  | 'tub'
  | 'shower'
  | 'door'
  | 'window'
  | 'mirror'
  | 'medicine-cabinet'
  | 'light'
  | 'outlet'
  | 'switch'
  | 'cabinet'
  | 'fan'
  | 'grab-bar'
  | 'other';

export type ItemStatus = 'existing' | 'new' | 'remove';

export interface Item {
  id: Id;
  wallId: Id;
  type: ItemType;
  status: ItemStatus;
  /** Distance from the wall's left corner to the left edge of the item's footprint. */
  position: number;
  /** Footprint along the wall. For a door, the opening including jambs. */
  width: number;
  /** Footprint into the room. 0 for doors and windows. */
  depth: number;
  /** Height of the item itself. */
  height: number | null;
  /** Height of the item's bottom above finished floor. */
  elevation: number | null;
  label: string;
  /** Type-specific fields: toilet rough-in, drain side, drawer direction, faucet reach… */
  props: Record<string, unknown>;
}

export interface JobDoc {
  schemaVersion: number;
  job: Job;
  survey: Survey | null;
  rooms: Room[];
  walls: Wall[];
  items: Item[];
}

/** Short random id; unique enough for one contractor's jobs and safe to sync later. */
export function newId(): Id {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function createJob(fields: Partial<Omit<Job, 'id' | 'createdAt' | 'updatedAt'>> = {}): JobDoc {
  const now = new Date().toISOString();
  const job: Job = {
    id: newId(),
    name: 'New job',
    client: '',
    address: '',
    contractor: '',
    date: today(),
    preset: 'standard',
    notes: '',
    ...fields,
    createdAt: now,
    updatedAt: now,
  };
  return {
    schemaVersion: SCHEMA_VERSION,
    job,
    survey: null,
    rooms: [],
    walls: [],
    items: [],
  };
}

/**
 * Copy a job with fresh ids everywhere, keeping every link intact.
 */
export function duplicateJobDoc(doc: JobDoc, name?: string): JobDoc {
  const map = new Map<Id, Id>();
  const remap = (id: Id): Id => {
    let next = map.get(id);
    if (!next) {
      next = newId();
      map.set(id, next);
    }
    return next;
  };
  const now = new Date().toISOString();
  const copy: JobDoc = structuredClone(doc);
  copy.job.id = remap(doc.job.id);
  copy.job.name = name ?? `${doc.job.name} (copy)`;
  copy.job.createdAt = now;
  copy.job.updatedAt = now;
  if (copy.survey) {
    copy.survey.id = remap(copy.survey.id);
    copy.survey.jobId = remap(copy.survey.jobId);
  }
  for (const r of copy.rooms) {
    r.id = remap(r.id);
    r.jobId = remap(r.jobId);
  }
  for (const w of copy.walls) {
    w.id = remap(w.id);
    w.roomId = remap(w.roomId);
  }
  for (const i of copy.items) {
    i.id = remap(i.id);
    i.wallId = remap(i.wallId);
  }
  return copy;
}

/**
 * Upgrade a saved job from any earlier schema version to the current one.
 * Each step takes version N to N+1. Add a step here whenever the shape of
 * JobDoc changes, and bump SCHEMA_VERSION.
 */
const MIGRATIONS: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {
  // 1: (doc) => ({ ...doc, schemaVersion: 2, ... }),
};

export class JobFormatError extends Error {}

export function migrate(raw: unknown): JobDoc {
  if (!raw || typeof raw !== 'object') throw new JobFormatError('Not a job record.');
  let doc = raw as Record<string, unknown>;
  const rawVersion = doc.schemaVersion;
  if (typeof rawVersion !== 'number' || !Number.isInteger(rawVersion) || rawVersion < 1) {
    throw new JobFormatError('Job record has no version number.');
  }
  let version: number = rawVersion;
  if (version > SCHEMA_VERSION) {
    throw new JobFormatError(
      `This job was saved by a newer version of the app (format ${version}). Update the app to open it.`,
    );
  }
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new JobFormatError(`No upgrade from format ${version}.`);
    doc = step(doc);
    version = doc.schemaVersion as number;
  }
  validate(doc);
  return doc as unknown as JobDoc;
}

function validate(doc: Record<string, unknown>): void {
  const job = doc.job as Record<string, unknown> | undefined;
  if (!job || typeof job.id !== 'string' || typeof job.name !== 'string') {
    throw new JobFormatError('Job record is missing its job details.');
  }
  for (const table of ['rooms', 'walls', 'items'] as const) {
    if (!Array.isArray(doc[table])) throw new JobFormatError(`Job record is missing its ${table}.`);
  }
}
