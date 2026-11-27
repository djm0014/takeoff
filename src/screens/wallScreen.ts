/**
 * Wall screen: one wall at a time, with a tab for each kind of work on it:
 * Vanity (the old Vanity Wall Solver) and Tile (the old Niche Rough-In
 * Planner). Each tab is its own file; this file loads the wall and shows the
 * tabs.
 */
import type { JobDoc, Wall } from '../data/model';
import { jobs, type JobStore } from '../data/storage';
import { autosave, type Autosaver } from '../lib/autosave';
import { h, toast } from '../lib/dom';
import { roomWalls } from '../plan/room';
import { href, type WallTab } from '../router';
import { vanityItemOf } from '../vanity/bind';
import { topbar } from './shell';
import { renderTileTab } from './tileTab';
import { renderVanityTab } from './vanityTab';

/** What a tab gets to work with. */
export interface WallCtx {
  root: HTMLElement;
  doc: JobDoc;
  wall: Wall;
  /** Wall number in the walk. */
  number: number;
  jobId: string;
  bar: HTMLElement;
  /** The tab's own area, under the tab strip. */
  body: HTMLElement;
  saver: Autosaver;
  store: JobStore;
  /** Load the wall again and redraw the tab. */
  rerender: () => Promise<void>;
}

/** The tab a wall opens on when the link doesn't say. */
export function defaultTab(doc: JobDoc, wall: Wall): WallTab {
  if (vanityItemOf(doc, wall.id)) return 'vanity';
  const wet = doc.items.some((i) => i.wallId === wall.id && (i.type === 'tub' || i.type === 'shower') && i.status !== 'remove');
  return wall.tileLayout || wet ? 'tile' : 'vanity';
}

export async function renderWallScreen(root: HTMLElement, jobId: string, wallId: string, tab?: WallTab): Promise<void> {
  const store = jobs();
  let loaded: JobDoc | null = null;
  try {
    loaded = await store.get(jobId);
  } catch {
    toast('Could not open that job.', 'error');
  }
  const wall = loaded?.walls.find((w) => w.id === wallId);
  if (!loaded || !wall) {
    root.replaceChildren(
      topbar('Wall not found', { back: href(loaded ? { name: 'plan', jobId } : { name: 'jobs' }) }),
      h('main', {}, h('p', { class: 'empty' }, 'That wall is not in this job.')),
    );
    return;
  }
  const doc: JobDoc = loaded;
  const number = roomWalls(doc, wall.roomId).findIndex((w) => w.id === wall.id) + 1;
  const which = tab ?? defaultTab(doc, wall);

  const savedNote = h('span', { class: 'saved-note', 'aria-live': 'polite' }, '');
  const saver = autosave(store, () => doc, (t) => (savedNote.textContent = t));
  const bar = topbar(`Wall ${number}`, { back: href({ name: 'plan', jobId }), actions: [savedNote] });
  const tabs = h(
    'nav',
    { class: 'tabs wall-tabs', 'aria-label': 'Wall' },
    (
      [
        ['vanity', 'Vanity'],
        ['tile', 'Tile and niche'],
      ] as [WallTab, string][]
    ).map(([t, label]) =>
      h('a', { href: href({ name: 'wall', jobId, wallId, tab: t }), 'aria-current': t === which ? 'page' : null, role: 'tab', 'aria-selected': String(t === which) }, label),
    ),
  );
  const body = h('div', {});
  const main = h('main', { class: 'plan-main' }, tabs, body);
  root.replaceChildren(bar, main);

  const ctx: WallCtx = { root, doc, wall, number, jobId, bar, body, saver, store, rerender: () => renderWallScreen(root, jobId, wallId, which) };
  if (which === 'tile') renderTileTab(ctx);
  else renderVanityTab(ctx);
}
