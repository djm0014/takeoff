import { describe, expect, it } from 'vitest';
import { applyKey, nudgeValue } from '../src/lib/keypad';
import { parseInches } from '../src/lib/inches';

/** Type a sequence of keys into a field that starts with `start` (just entered). */
function type(start: string, keys: (string | 'back' | 'clear' | 'dot' | 'feet')[]): string {
  let v = start;
  let fresh = true;
  for (const k of keys) {
    const key =
      k === 'back' || k === 'clear' || k === 'dot' || k === 'feet' ? k : k.includes('/') ? { fraction: k } : { digit: k };
    v = applyKey(v, key, fresh);
    fresh = false;
  }
  return v;
}

describe('keypad typing', () => {
  it('replaces the old value with the first digit', () => {
    expect(type('59 1/2', ['6', '0'])).toBe('60');
  });

  it('adds a fraction after whole inches', () => {
    expect(type('', ['5', '9', '1/2'])).toBe('59 1/2');
    expect(parseInches(type('', ['5', '9', '1/2']))).toBe(59.5);
  });

  it('keeps the whole inches when a fraction is the first key', () => {
    expect(type('59 1/2', ['3/4'])).toBe('59 3/4');
    expect(type('59', ['3/8'])).toBe('59 3/8');
    expect(type('59.5', ['3/8'])).toBe('59 3/8');
  });

  it('starts a new number when a digit follows a fraction', () => {
    expect(type('', ['5', '9', '3/4', '2', '4'])).toBe('24');
  });

  it('swaps a fraction for another', () => {
    expect(type('', ['5', '9', '1/2', '5/8'])).toBe('59 5/8');
  });

  it('types a bare fraction', () => {
    expect(type('', ['3/16'])).toBe('3/16');
    expect(type('', ['clear', '3/16'])).toBe('3/16');
  });

  it('types feet and inches', () => {
    const v = type('', ['6', 'feet', '4', '1/2']);
    expect(v).toBe("6' 4 1/2");
    expect(parseInches(v)).toBe(76.5);
    expect(type('', ['6', 'feet', '3/4'])).toBe("6' 3/4");
    expect(parseInches("6' 3/4")).toBe(72.75);
  });

  it('only allows one decimal point per number', () => {
    expect(type('', ['dot', '5', 'dot'])).toBe('.5');
    expect(type('', ['5', '9', 'dot', '5'])).toBe('59.5');
  });

  it('backspaces and clears', () => {
    expect(type('', ['5', '9', '1/2', 'back', 'back'])).toBe('59 1');
    expect(type('', ['6', 'feet', 'back'])).toBe('6');
    expect(type('59 1/2', ['clear'])).toBe('');
  });
});

describe('nudges', () => {
  it('nudges by inches and eighths', () => {
    expect(nudgeValue('59 1/2', 1)).toBe('60 1/2');
    expect(nudgeValue('59 1/2', -1 / 8)).toBe('59 3/8');
    expect(nudgeValue("6' 4", 1 / 8)).toBe('76 1/8');
    expect(nudgeValue('', 1)).toBe('1');
  });
  it('never goes below zero', () => {
    expect(nudgeValue('1/16', -1)).toBe('0');
  });
  it('leaves junk alone', () => {
    expect(nudgeValue('abc', 1)).toBeNull();
  });
});
