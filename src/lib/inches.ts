/**
 * Inch input and formatting, shared by every screen.
 *
 * All measurements in the app are stored as plain numbers of inches.
 * Parsing accepts the ways people type a tape reading in the field:
 *   59 1/2   59-1/2   59.5   59"   59″   59 1/2"   1/2
 *   4' 11 1/2"   4'11-1/2   4'   4 ft 11 in
 * Formatting rounds to the nearest 1/16″ and reduces the fraction.
 */

export const SIXTEENTH = 1 / 16;

/** Round a value in inches to the nearest 1/16″. */
export function roundToSixteenth(inches: number): number {
  return Math.round(inches * 16) / 16;
}

const INCH_MARKS = /(?:″|"|''|”|\s*in(?:ch(?:es)?)?\.?)\s*$/i;
const FOOT_MARK = /(?:′|'|’|\s*f(?:ee|oo)?t\.?)/i;

/** Parse the inch part: "59", "59.5", "59 1/2", "59-1/2", "1/2", "59 1/2\"". */
function parseInchPart(raw: string): number | null {
  let s = raw.trim().replace(INCH_MARKS, '').trim();
  if (s === '') return null;
  let sign = 1;
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1).trim();
  }
  // whole + fraction, separated by space or hyphen
  let m = /^(\d+(?:\.\d+)?)\s*(?:-|\s)\s*(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) {
    const den = Number(m[3]);
    if (den === 0) return null;
    return sign * (Number(m[1]) + Number(m[2]) / den);
  }
  // bare fraction
  m = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) {
    const den = Number(m[2]);
    if (den === 0) return null;
    return sign * (Number(m[1]) / den);
  }
  // decimal or whole
  m = /^(\d+(?:\.\d*)?|\.\d+)$/.exec(s);
  if (m) return sign * Number(m[1]);
  return null;
}

/**
 * Parse a typed measurement into inches. Returns null when the text is not a
 * measurement, so callers can show the field as invalid instead of guessing.
 */
export function parseInches(input: string): number | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (s === '') return null;

  const footMatch = FOOT_MARK.exec(s);
  if (footMatch) {
    const feetText = s.slice(0, footMatch.index).trim();
    const rest = s.slice(footMatch.index + footMatch[0].length).replace(/^\s*-\s*/, '').trim();
    const feet = parseInchPart(feetText);
    if (feet === null || feet < 0) return null;
    if (rest === '') return feet * 12;
    const inches = parseInchPart(rest);
    if (inches === null || inches < 0) return null;
    return feet * 12 + inches;
  }
  return parseInchPart(s);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export interface FormatOptions {
  /** Add the inch mark (″). Default true. */
  mark?: boolean;
  /** Show feet and inches (4′-11 1/2″) when 12″ or more. Default false. */
  feet?: boolean;
}

/** Format inches to the nearest 1/16″: 59.5 → `59 1/2″`, 0.0625 → `1/16″`. */
export function formatInches(inches: number, opts: FormatOptions = {}): string {
  const { mark = true, feet = false } = opts;
  if (!Number.isFinite(inches)) return '—';
  const sixteenths = Math.round(Math.abs(inches) * 16);
  const sign = inches < 0 && sixteenths !== 0 ? '-' : '';
  const inchMark = mark ? '″' : '';

  let wholeInches = Math.floor(sixteenths / 16);
  const remainder = sixteenths % 16;
  let frac = '';
  if (remainder !== 0) {
    const g = gcd(remainder, 16);
    frac = `${remainder / g}/${16 / g}`;
  }

  if (feet && wholeInches >= 12) {
    const ft = Math.floor(wholeInches / 12);
    wholeInches = wholeInches % 12;
    const inchText = frac ? `${wholeInches} ${frac}` : `${wholeInches}`;
    return `${sign}${ft}′-${inchText}${inchMark}`;
  }

  if (wholeInches === 0 && frac) return `${sign}${frac}${inchMark}`;
  return `${sign}${wholeInches}${frac ? ' ' + frac : ''}${inchMark}`;
}

/** Format a height above finished floor: `36″ AFF`. */
export function formatAFF(inches: number): string {
  return `${formatInches(inches)} AFF`;
}
