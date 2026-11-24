import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KEY_DIMENSIONS, keyDimension } from '../src/data/keyDimensions';

describe('key dimensions', () => {
  it('has one row per row of docs/key-dimensions.csv', () => {
    const csvRows = readFileSync('docs/key-dimensions.csv', 'utf8').trim().split('\n').length - 1;
    expect(KEY_DIMENSIONS.length).toBe(csvRows);
  });
  it('has unique keys and known bases', () => {
    expect(new Set(KEY_DIMENSIONS.map((d) => d.key)).size).toBe(KEY_DIMENSIONS.length);
    for (const d of KEY_DIMENSIONS) expect(['Code', 'ADA', 'Guideline', 'Trade typical']).toContain(d.basis);
  });
  it('looks up rows and rejects typos', () => {
    expect(keyDimension('toilet/centerline-to-side-wall-or-obstruction').value).toBe('15″ min');
    expect(() => keyDimension('toilet/nope')).toThrow(/Unknown/);
  });
});
