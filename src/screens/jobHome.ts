/**
 * Job home: the job's details and a card for each screen. The screens fill in
 * milestone by milestone; for now the job details save automatically.
 */
import { jobFileName, toJobFile } from '../data/jobfile';
import { PRESET_LABELS, type Job, type JobDoc, type Preset } from '../data/model';
import { geometry, roomWalls } from '../plan/room';
import { jobs } from '../data/storage';
import { downloadText, h, menuButton, toast } from '../lib/dom';
import { go, href } from '../router';
import { topbar } from './shell';

const SCREENS: { title: string; blurb: string; milestone: number }[] = [
  { title: 'Tile and niche', blurb: 'Wall tile layout, niche, sheets A-1 and A-2.', milestone: 4 },
  { title: 'Survey', blurb: 'Field checklist and report.', milestone: 5 },
  { title: 'Sheets', blurb: 'Printable drawings and schedules.', milestone: 5 },
];

function floorPlanCard(doc: JobDoc): HTMLElement {
  const room = doc.rooms[0];
  const walls = room ? roomWalls(doc, room.id) : [];
  let status = 'Not started';
  if (room && walls.length) {
    const g = geometry(doc, room.id);
    const ids = new Set(walls.map((w) => w.id));
    const items = doc.items.filter((it) => ids.has(it.wallId)).length;
    status = g.closed
      ? `${walls.length} walls · ${(g.area / 144).toFixed(1)} sq ft · ${items} item${items === 1 ? '' : 's'}`
      : `${walls.length} walls · room not closed yet`;
  }
  return h(
    'a',
    { class: 'card screen-card link-card', href: href({ name: 'plan', jobId: doc.job.id }) },
    h('h3', {}, 'Floor plan'),
    h('p', { class: 'small muted', style: 'margin:0' }, 'Room, walls, doors, windows and fixtures.'),
    h('span', { class: 'status' }, status),
  );
}

function vanityCard(doc: JobDoc): HTMLElement {
  const room = doc.rooms[0];
  const walls = room ? roomWalls(doc, room.id) : [];
  const withVanity = walls.filter((w) => doc.items.some((i) => i.wallId === w.id && i.type === 'vanity' && i.status !== 'remove'));
  return h(
    'div',
    { class: 'card screen-card' },
    h('h3', {}, 'Vanity wall'),
    h('p', { class: 'small muted', style: 'margin:0' }, 'Centerlines, mirror, lights, outlets, cabinet.'),
    withVanity.length
      ? h(
          'div',
          { class: 'row', style: 'margin-top:8px' },
          withVanity.map((w) => h('a', { class: 'btn small-btn', href: href({ name: 'wall', jobId: doc.job.id, wallId: w.id }) }, `Wall ${w.number}`)),
        )
      : h('span', { class: 'status' }, walls.length ? 'Add a vanity in the floor plan' : 'Start the floor plan first'),
  );
}

export async function renderJobHome(root: HTMLElement, jobId: string): Promise<void> {
  const store = jobs();
  let doc: JobDoc | null;
  try {
    doc = await store.get(jobId);
  } catch (err) {
    doc = null;
    toast(err instanceof Error ? err.message : 'Could not open that job.', 'error');
  }
  if (!doc) {
    root.replaceChildren(
      topbar('Job not found', { back: href({ name: 'jobs' }) }),
      h('main', {}, h('p', { class: 'empty' }, 'That job is not saved on this phone.')),
    );
    return;
  }
  let current: JobDoc = doc;

  const title = h('h1', {}, current.job.name);
  const savedNote = h('span', { class: 'saved-note', 'aria-live': 'polite' }, '');

  // Save shortly after typing stops, so every keystroke isn't a write.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<unknown> = Promise.resolve();
  function scheduleSave() {
    savedNote.textContent = 'Saving…';
    clearTimeout(timer);
    timer = setTimeout(() => {
      pending = store
        .save(current)
        .then((saved) => {
          current = saved;
          savedNote.textContent = 'Saved';
        })
        .catch(() => {
          savedNote.textContent = 'Not saved';
          toast('Could not save. Export the job file to keep a copy.', 'error');
        });
    }, 400);
  }
  // Flush a pending save if the user leaves the screen.
  window.addEventListener(
    'hashchange',
    () => {
      if (timer) {
        clearTimeout(timer);
        void pending.then(() => store.save(current));
      }
    },
    { once: true },
  );

  function textField(label: string, key: keyof Job, attrs: Record<string, string> = {}): HTMLElement {
    const input = h('input', { type: 'text', value: String(current.job[key] ?? ''), ...attrs });
    input.addEventListener('input', () => {
      (current.job[key] as string) = input.value;
      if (key === 'name') title.textContent = input.value || 'Untitled job';
      scheduleSave();
    });
    return h('label', { class: 'field' }, h('span', {}, label), input);
  }

  const presetSelect = h(
    'select',
    {},
    (Object.keys(PRESET_LABELS) as Preset[]).map((p) =>
      h('option', { value: p, selected: p === current.job.preset }, PRESET_LABELS[p]),
    ),
  );
  presetSelect.addEventListener('change', () => {
    current.job.preset = presetSelect.value as Preset;
    scheduleSave();
  });

  const notes = h('textarea', {}, current.job.notes);
  notes.addEventListener('input', () => {
    current.job.notes = notes.value;
    scheduleSave();
  });

  const more = menuButton('Job actions', [
    { label: 'Export file', run: () => downloadText(jobFileName(current), toJobFile(current)) },
    {
      label: 'Duplicate',
      run: async () => {
        await pending;
        const copy = await store.duplicate(current.job.id);
        go({ name: 'job', jobId: copy.job.id });
      },
    },
    {
      label: 'Delete',
      danger: true,
      run: async () => {
        if (!confirm(`Delete "${current.job.name}" from this phone?`)) return;
        clearTimeout(timer);
        timer = undefined;
        await store.remove(current.job.id);
        go({ name: 'jobs' });
      },
    },
  ]);

  const bar = topbar(current.job.name, { back: href({ name: 'jobs' }), actions: [more] });
  bar.querySelector('h1')?.replaceWith(title);

  const main = h(
    'main',
    { class: 'stack' },
    h(
      'section',
      { class: 'card stack' },
      h('div', { class: 'row' }, h('h2', {}, 'Job'), h('span', { class: 'spacer' }), savedNote),
      h(
        'div',
        { class: 'form-grid' },
        textField('Job name', 'name', { autocomplete: 'off' }),
        textField('Client', 'client', { autocomplete: 'off' }),
        textField('Address', 'address', { autocomplete: 'street-address' }),
        textField('Contractor', 'contractor', { autocomplete: 'organization' }),
        textField('Date', 'date', { type: 'date' }),
        h('label', { class: 'field' }, h('span', {}, 'Who it is for'), presetSelect),
      ),
      h('label', { class: 'field' }, h('span', {}, 'Notes'), notes),
    ),
    h('h2', { style: 'margin-top:24px' }, 'Screens'),
    h(
      'div',
      { class: 'screen-grid' },
      floorPlanCard(current),
      vanityCard(current),
      SCREENS.map((s) =>
        h(
          'div',
          { class: 'card screen-card' },
          h('h3', {}, s.title),
          h('p', { class: 'small muted', style: 'margin:0' }, s.blurb),
          h('span', { class: 'status' }, `Coming in milestone ${s.milestone}`),
        ),
      ),
    ),
  );

  root.replaceChildren(bar, main);
}
