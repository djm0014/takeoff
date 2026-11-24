/**
 * Export a job as a JSON file and import it again, for backup or moving a job
 * to another device.
 */
import { JobFormatError, migrate, newId, type JobDoc } from './model';

export const FILE_KIND = 'bathroom-tools/job';

export interface JobFile {
  kind: typeof FILE_KIND;
  exportedAt: string;
  doc: JobDoc;
}

export function toJobFile(doc: JobDoc): string {
  const file: JobFile = { kind: FILE_KIND, exportedAt: new Date().toISOString(), doc };
  return JSON.stringify(file, null, 2);
}

/** File name like `smith-hall-bath-2026-11-23.json`. */
export function jobFileName(doc: JobDoc): string {
  const slug =
    doc.job.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'job';
  return `${slug}-${new Date().toISOString().slice(0, 10)}.json`;
}

/**
 * Read a job file. Throws JobFormatError with a plain message when the file
 * isn't one of ours or can't be upgraded.
 */
export function fromJobFile(text: string): JobDoc {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new JobFormatError('That file is not a job file (it is not valid JSON).');
  }
  const file = parsed as Partial<JobFile> | null;
  if (!file || file.kind !== FILE_KIND || !file.doc) {
    throw new JobFormatError('That file is not a Bathroom Tools job file.');
  }
  return migrate(file.doc);
}

/**
 * Give an imported job a new id when one with the same id is already saved,
 * so importing never overwrites a job without asking.
 */
export function withFreshJobId(doc: JobDoc): JobDoc {
  const copy = structuredClone(doc);
  const oldId = copy.job.id;
  copy.job.id = newId();
  if (copy.survey && copy.survey.jobId === oldId) copy.survey.jobId = copy.job.id;
  for (const r of copy.rooms) if (r.jobId === oldId) r.jobId = copy.job.id;
  return copy;
}
