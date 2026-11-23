/** Jobs: the job list. New, open, rename, duplicate, export, import, delete. */
import { fromJobFile, jobFileName, toJobFile, withFreshJobId } from '../data/jobfile';
import { createJob, JobFormatError } from '../data/model';
import { jobs, type JobSummary } from '../data/storage';
import { downloadText, h, icon, ICONS, menuButton, pickTextFile, toast } from '../lib/dom';
import { go } from '../router';
import { topbar } from './shell';

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export async function renderJobs(root: HTMLElement): Promise<void> {
  const store = jobs();
  const listEl = h('ul', { class: 'job-list' });
  const main = h('main', {});

  async function newJob() {
    const name = prompt('Job name', 'New job');
    if (name === null) return;
    const saved = await store.save(createJob({ name: name.trim() || 'New job' }));
    go({ name: 'job', jobId: saved.job.id });
  }

  async function importJob() {
    const text = await pickTextFile();
    if (text === null) return;
    try {
      let doc = fromJobFile(text);
      if (await store.get(doc.job.id)) {
        const replace = confirm(
          `"${doc.job.name}" is already saved on this phone.\n\nOK replaces it with the file. Cancel keeps both.`,
        );
        if (!replace) {
          doc = withFreshJobId(doc);
          doc.job.name = `${doc.job.name} (imported)`;
        }
      }
      await store.save(doc);
      toast(`Imported "${doc.job.name}"`);
      await refresh();
    } catch (err) {
      toast(err instanceof JobFormatError ? err.message : 'Could not import that file.', 'error');
    }
  }

  function jobRow(job: JobSummary): HTMLElement {
    const meta = [job.client, job.address, `Saved ${formatUpdated(job.updatedAt)}`].filter(Boolean).join(' · ');
    return h(
      'li',
      { class: 'card job-card' },
      h(
        'button',
        { class: 'open', type: 'button', onclick: () => go({ name: 'job', jobId: job.id }) },
        h('span', { class: 'name' }, job.name),
        h('span', { class: 'meta' }, meta),
      ),
      menuButton(`More for ${job.name}`, [
        {
          label: 'Rename',
          run: async () => {
            const doc = await store.get(job.id);
            if (!doc) return;
            const name = prompt('Job name', doc.job.name);
            if (name === null || !name.trim()) return;
            doc.job.name = name.trim();
            await store.save(doc);
            await refresh();
          },
        },
        {
          label: 'Duplicate',
          run: async () => {
            const copy = await store.duplicate(job.id);
            toast(`Made "${copy.job.name}"`);
            await refresh();
          },
        },
        {
          label: 'Export file',
          run: async () => {
            const doc = await store.get(job.id);
            if (doc) downloadText(jobFileName(doc), toJobFile(doc));
          },
        },
        {
          label: 'Delete',
          danger: true,
          run: async () => {
            if (!confirm(`Delete "${job.name}" from this phone? Export it first if you might need it.`)) return;
            await store.remove(job.id);
            toast(`Deleted "${job.name}"`);
            await refresh();
          },
        },
      ]),
    );
  }

  async function refresh() {
    let list: JobSummary[];
    try {
      list = await store.list();
    } catch {
      listEl.replaceChildren(
        h('li', { class: 'empty' }, 'Saved jobs could not be opened. Private browsing can block saving on this phone.'),
      );
      return;
    }
    if (list.length === 0) {
      listEl.replaceChildren(
        h('li', { class: 'empty' }, h('p', {}, 'No jobs yet.'), h('p', { class: 'small' }, 'Start a new job, or import a job file.')),
      );
      return;
    }
    listEl.replaceChildren(...list.map(jobRow));
  }

  main.append(
    h(
      'div',
      { class: 'row', style: 'margin-bottom:16px' },
      h('button', { class: 'btn primary', type: 'button', onclick: newJob }, icon(ICONS.plus), 'New job'),
      h('button', { class: 'btn', type: 'button', onclick: importJob }, 'Import job file'),
    ),
    listEl,
    h(
      'p',
      { class: 'small muted', style: 'margin-top:32px' },
      'Jobs are saved on this phone and work with no signal. Export a job file to back it up or move it to another device. ',
      h('a', { href: './legacy/takeoff-calculator/' }, 'Old sheet goods calculator'),
    ),
  );

  root.replaceChildren(topbar('Jobs'), main);
  await refresh();
}

