/**
 * Storage module. Every read and write of saved jobs goes through here, so
 * Stage 2 (sync with a hosted database) can swap what is behind it without
 * touching the screens.
 *
 * Stage 1: one record per job in the browser's IndexedDB.
 */
import { duplicateJobDoc, migrate, type Id, type JobDoc } from './model';

export interface JobSummary {
  id: Id;
  name: string;
  client: string;
  address: string;
  updatedAt: string;
}

export interface JobStore {
  list(): Promise<JobSummary[]>;
  get(id: Id): Promise<JobDoc | null>;
  save(doc: JobDoc): Promise<JobDoc>;
  remove(id: Id): Promise<void>;
  duplicate(id: Id): Promise<JobDoc>;
}

const DB_NAME = 'bathroom-tools';
const DB_VERSION = 1;
const JOBS = 'jobs';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(JOBS)) {
        db.createObjectStore(JOBS, { keyPath: 'job.id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Close other tabs of this app and try again.'));
  });
}

function summarize(doc: JobDoc): JobSummary {
  const { id, name, client, address, updatedAt } = doc.job;
  return { id, name, client, address, updatedAt };
}

export function createIdbStore(factory: IDBFactory = indexedDB): JobStore {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => (dbPromise ??= openDb(factory));

  async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await db()).transaction(JOBS, mode).objectStore(JOBS);
  }

  const api: JobStore = {
    async list() {
      const all = (await request((await store('readonly')).getAll())) as unknown[];
      const summaries: JobSummary[] = [];
      for (const raw of all) {
        try {
          summaries.push(summarize(migrate(raw)));
        } catch {
          // A record this version can't read is skipped, never deleted.
        }
      }
      return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async get(id) {
      const raw = await request((await store('readonly')).get(id));
      return raw ? migrate(raw) : null;
    },

    async save(doc) {
      const toSave: JobDoc = structuredClone(doc);
      toSave.job.updatedAt = new Date().toISOString();
      await request((await store('readwrite')).put(toSave));
      return toSave;
    },

    async remove(id) {
      await request((await store('readwrite')).delete(id));
    },

    async duplicate(id) {
      const doc = await api.get(id);
      if (!doc) throw new Error('Job not found.');
      return api.save(duplicateJobDoc(doc));
    },
  };
  return api;
}

let current: JobStore | null = null;

/** The app's job store. Screens call this, never IndexedDB directly. */
export function jobs(): JobStore {
  return (current ??= createIdbStore());
}

/** For tests, or for Stage 2 to swap in a syncing store. */
export function setJobStore(store: JobStore): void {
  current = store;
}
