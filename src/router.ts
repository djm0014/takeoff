/**
 * Hash routes (#/job/abc) so the app works on GitHub Pages and offline with
 * no server rewrites.
 */
export type Route =
  | { name: 'jobs' }
  | { name: 'job'; jobId: string }
  | { name: 'plan'; jobId: string }
  | { name: 'wall'; jobId: string; wallId: string }
  | { name: 'notFound' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/' || path === '') return { name: 'jobs' };
  const w = /^\/job\/([^/]+)\/wall\/([^/]+)\/?$/.exec(path);
  if (w) return { name: 'wall', jobId: decodeURIComponent(w[1]!), wallId: decodeURIComponent(w[2]!) };
  const m = /^\/job\/([^/]+)(?:\/(plan))?\/?$/.exec(path);
  if (m) return { name: m[2] ? 'plan' : 'job', jobId: decodeURIComponent(m[1]!) };
  return { name: 'notFound' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'jobs':
      return '#/';
    case 'job':
      return `#/job/${encodeURIComponent(route.jobId)}`;
    case 'plan':
      return `#/job/${encodeURIComponent(route.jobId)}/plan`;
    case 'wall':
      return `#/job/${encodeURIComponent(route.jobId)}/wall/${encodeURIComponent(route.wallId)}`;
    default:
      return '#/';
  }
}

export function go(route: Route): void {
  location.hash = href(route);
}
