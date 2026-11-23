/**
 * Hash routes (#/job/abc) so the app works on GitHub Pages and offline with
 * no server rewrites.
 */
export type Route =
  | { name: 'jobs' }
  | { name: 'job'; jobId: string }
  | { name: 'notFound' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/' || path === '') return { name: 'jobs' };
  const m = /^\/job\/([^/]+)\/?$/.exec(path);
  if (m) return { name: 'job', jobId: decodeURIComponent(m[1]!) };
  return { name: 'notFound' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'jobs':
      return '#/';
    case 'job':
      return `#/job/${encodeURIComponent(route.jobId)}`;
    default:
      return '#/';
  }
}

export function go(route: Route): void {
  location.hash = href(route);
}
