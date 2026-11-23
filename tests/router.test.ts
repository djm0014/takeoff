import { describe, expect, it } from 'vitest';
import { href, parseRoute } from '../src/router';

describe('router', () => {
  it('parses routes', () => {
    expect(parseRoute('')).toEqual({ name: 'jobs' });
    expect(parseRoute('#/')).toEqual({ name: 'jobs' });
    expect(parseRoute('#/job/abc-123')).toEqual({ name: 'job', jobId: 'abc-123' });
    expect(parseRoute('#/nope')).toEqual({ name: 'notFound' });
  });
  it('round-trips job links', () => {
    const route = { name: 'job', jobId: 'a b/c' } as const;
    expect(parseRoute(href(route))).toEqual(route);
  });
});
