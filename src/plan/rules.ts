/**
 * The numbers the floor plan checks use. Each one points at its row in the
 * Bathroom Key Dimensions sheet (src/data/keyDimensions.ts); a test makes
 * sure the number still appears in that row, so the sheet and the checks
 * can't drift apart.
 */
export interface Rule {
  value: number;
  /** Row in KEY_DIMENSIONS, or null for a rule carried over from the old tool. */
  key: string | null;
}

export const PLAN_RULES = {
  /** Toilet centerline to a side wall or obstruction, each side. */
  toiletSide: { value: 15, key: 'toilet/centerline-to-side-wall-or-obstruction' },
  /** Clear floor in front of the toilet bowl. */
  toiletFront: { value: 21, key: 'toilet/clear-floor-in-front-of-bowl' },
  /** Clear floor in front of a sink. */
  sinkFront: { value: 21, key: 'sink/clear-floor-in-front' },
  /** Width of the clear floor checked in front of a toilet or sink (15″ each side of center). Carried over from the old tool. */
  fixtureClearWidth: { value: 30, key: null },
  /** Clear floor in front of a tub. */
  tubFront: { value: 21, key: 'tub/clear-floor-in-front-of-tub' },
  /** How wide the clear floor in front of a tub must be. Carried over from the old tool. */
  tubFrontWidth: { value: 30, key: null },
  /** Clear floor in front of a shower opening. */
  showerFront: { value: 24, key: 'shower/clear-floor-in-front-of-opening' },
  /** Shower minimum: each way, and area. */
  showerMinSide: { value: 30, key: 'shower/minimum-size' },
  showerMinArea: { value: 900, key: 'shower/minimum-size' },
} satisfies Record<string, Rule>;
