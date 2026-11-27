import { describe, expect, it } from 'vitest';
import { href, parseRoute } from '../src/router';

describe('router', () => {
  it('parses routes', () => {
    expect(parseRoute('')).toEqual({ name: 'jobs' });
    expect(parseRoute('#/')).toEqual({ name: 'jobs' });
    expect(parseRoute('#/job/abc-123')).toEqual({ name: 'job', jobId: 'abc-123' });
    expect(parseRoute('#/job/abc/plan')).toEqual({ name: 'plan', jobId: 'abc' });
    expect(parseRoute('#/job/abc/wall/w1')).toEqual({ name: 'wall', jobId: 'abc', wallId: 'w1' });
    expect(parseRoute('#/job/abc/wall/w1/tile')).toEqual({ name: 'wall', jobId: 'abc', wallId: 'w1', tab: 'tile' });
    expect(parseRoute('#/job/abc/wall/w1/nope')).toEqual({ name: 'notFound' });
    expect(parseRoute('#/job/abc/nope')).toEqual({ name: 'notFound' });
    expect(parseRoute('#/nope')).toEqual({ name: 'notFound' });
  });
  it('round-trips wall links', () => {
    const route = { name: 'wall', jobId: 'a b', wallId: 'c/d' } as const;
    expect(parseRoute(href(route))).toEqual(route);
    const tile = { name: 'wall', jobId: 'a', wallId: 'b', tab: 'tile' } as const;
    expect(parseRoute(href(tile))).toEqual(tile);
  });
  it('round-trips job links', () => {
    for (const name of ['job', 'plan'] as const) {
      const route = { name, jobId: 'a b/c' };
      expect(parseRoute(href(route))).toEqual(route);
    }
  });
});
