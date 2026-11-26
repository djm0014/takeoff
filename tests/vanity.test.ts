import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEF, type VanityD } from '../src/vanity/settings';
import { checks, schedule, solve, type Fix } from '../src/vanity/solve';

interface Recorded {
  checks: { level: string; text: string; fixes: string[] }[];
  schedule: string[][];
}
const fixtures = JSON.parse(readFileSync('tests/fixtures/vanity-scenarios.json', 'utf8')) as {
  scenarios: { name: string; state: VanityD; applyFix?: number; expected: Recorded; afterFix?: Recorded }[];
};

function run(D: VanityD) {
  const R = solve(D);
  const ck = checks(D, R);
  // The old tool shows quick fixes only on problems and warnings, numbered in order.
  const fixes: Fix[] = [];
  const shown = ck.map(([level, text, f]) => {
    const labels = level !== 'good' && f && f.length ? f.map((x) => (fixes.push(x), x[0])) : [];
    return { level, text, fixes: labels };
  });
  return { recorded: { checks: shown, schedule: schedule(D, R) } as Recorded, fixes };
}

describe('vanity wall matches the old tool', () => {
  for (const sc of fixtures.scenarios) {
    it(sc.name, () => {
      const D: VanityD = { ...DEF, ...sc.state, qdone: '1' };
      const { recorded, fixes } = run(D);
      expect(recorded).toEqual(sc.expected);
      if (sc.applyFix !== undefined) {
        const fixed = structuredClone(D);
        fixes[sc.applyFix]![1](fixed);
        expect(run(fixed).recorded).toEqual(sc.afterFix);
      }
    });
  }
});
