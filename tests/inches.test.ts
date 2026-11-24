import { describe, expect, it } from 'vitest';
import { formatAFF, formatInches, parseInches, roundToSixteenth } from '../src/lib/inches';

describe('parseInches', () => {
  it.each([
    ['59 1/2', 59.5],
    ['59-1/2', 59.5],
    ['59.5', 59.5],
    ['59″', 59],
    ['59"', 59],
    ['59 1/2"', 59.5],
    ['59 1/2″', 59.5],
    ['  60  ', 60],
    ['1/2', 0.5],
    ['3/16', 0.1875],
    ['.75', 0.75],
    ['0', 0],
    ['59 in', 59],
    ["4'", 48],
    ["4' 11 1/2\"", 59.5],
    ["4'-11 1/2", 59.5],
    ["4'11-1/2", 59.5],
    ['4′-11 1/2″', 59.5],
    ['4 ft 11 in', 59],
    ['8 feet', 96],
    ['-1/4', -0.25],
  ])('%s → %d', (text, expected) => {
    expect(parseInches(text)).toBeCloseTo(expected, 10);
  });

  it.each(['', '   ', 'abc', '1/0', '5 1/0', '59 1/2 3', "4' x", '--1'])(
    'rejects %j',
    (text) => {
      expect(parseInches(text)).toBeNull();
    },
  );
});

describe('formatInches', () => {
  it.each([
    [59.5, '59 1/2″'],
    [60, '60″'],
    [0.0625, '1/16″'],
    [0.5, '1/2″'],
    [12.375, '12 3/8″'],
    [59.99, '60″'],
    [59.97, '60″'],
    [59.96, '59 15/16″'],
    [0, '0″'],
    [-0.25, '-1/4″'],
    [-0.01, '0″'],
  ])('%d → %s', (value, expected) => {
    expect(formatInches(value)).toBe(expected);
  });

  it('can drop the inch mark', () => {
    expect(formatInches(59.5, { mark: false })).toBe('59 1/2');
  });

  it('can show feet and inches', () => {
    expect(formatInches(59.5, { feet: true })).toBe('4′-11 1/2″');
    expect(formatInches(96, { feet: true })).toBe('8′-0″');
    expect(formatInches(11.5, { feet: true })).toBe('11 1/2″');
  });

  it('handles non-numbers', () => {
    expect(formatInches(Number.NaN)).toBe('—');
  });

  it('round-trips every sixteenth up to 10 feet', () => {
    for (let s = 0; s <= 120 * 16; s++) {
      const v = s / 16;
      expect(parseInches(formatInches(v))).toBe(v);
    }
  });
});

describe('helpers', () => {
  it('rounds to the nearest sixteenth', () => {
    expect(roundToSixteenth(1.03)).toBe(1.0);
    expect(roundToSixteenth(1.04)).toBe(1.0625);
  });
  it('marks heights AFF', () => {
    expect(formatAFF(36)).toBe('36″ AFF');
  });
});
