/**
 * Save a job shortly after edits stop, so every keystroke isn't a write.
 * Any unsaved edit is flushed when the user leaves the screen.
 */
import type { JobDoc } from '../data/model';
import type { JobStore } from '../data/storage';
import { toast } from './dom';

export interface Autosaver {
  /** Call after every edit. */
  schedule(): void;
  /** Save now if anything is waiting. */
  flush(): Promise<void>;
  /** Stop without saving (the job was deleted). */
  cancel(): void;
}

export function autosave(
  store: JobStore,
  getDoc: () => JobDoc,
  onStatus: (text: string) => void,
  delay = 400,
): Autosaver {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let waiting = false;
  let chain: Promise<void> = Promise.resolve();

  const save = () => {
    waiting = false;
    timer = undefined;
    chain = chain
      .then(() => store.save(getDoc()))
      .then(
        () => onStatus('Saved'),
        () => {
          onStatus('Not saved');
          toast('Could not save. Export the job file to keep a copy.', 'error');
        },
      );
    return chain;
  };

  const api: Autosaver = {
    schedule() {
      waiting = true;
      onStatus('Saving…');
      clearTimeout(timer);
      timer = setTimeout(save, delay);
    },
    flush() {
      clearTimeout(timer);
      return waiting ? save() : chain;
    },
    cancel() {
      clearTimeout(timer);
      waiting = false;
    },
  };

  // Leaving the screen (or the app going to the background) saves right away.
  const onHidden = () => {
    if (document.visibilityState === 'hidden') void api.flush();
  };
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener(
    'hashchange',
    () => {
      document.removeEventListener('visibilitychange', onHidden);
      void api.flush();
    },
    { once: true },
  );
  return api;
}
