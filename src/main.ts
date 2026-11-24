import './styles/app.css';
import { registerSW } from 'virtual:pwa-register';
import { h } from './lib/dom';
import { applyTheme, loadTheme } from './lib/theme';
import { href, parseRoute } from './router';
import { renderFloorPlan } from './screens/floorPlan';
import { renderJobHome } from './screens/jobHome';
import { renderJobs } from './screens/jobs';
import { topbar } from './screens/shell';

applyTheme(loadTheme());

const root = document.getElementById('app')!;

async function render(): Promise<void> {
  const route = parseRoute(location.hash);
  window.scrollTo(0, 0);
  switch (route.name) {
    case 'jobs':
      await renderJobs(root);
      break;
    case 'job':
      await renderJobHome(root, route.jobId);
      break;
    case 'plan':
      await renderFloorPlan(root, route.jobId);
      break;
    default:
      root.replaceChildren(
        topbar('Not found', { back: href({ name: 'jobs' }) }),
        h('main', {}, h('p', { class: 'empty' }, 'That page does not exist.')),
      );
  }
}

window.addEventListener('hashchange', () => void render());
void render();

// Works offline after the first visit; picks up new versions automatically.
registerSW({ immediate: true });
