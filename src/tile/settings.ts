/**
 * Tile and niche settings: the old Niche Rough-In Planner's answers
 * (public/legacy/niche-planner), kept with the same keys and defaults so the
 * same answers give the same layout.
 *
 * The old tool kept two records: S (the setup answers) and IN (the inside-the-
 * niche and framing choices on the results screen). Here they're one record;
 * the IN keys don't clash with S. A few values come from the shared job record
 * instead of being stored here (see bind.ts): wall width, ceiling, the tub,
 * stud depth and the first stud.
 */

export type Framed = '' | 'yes' | 'no';

export interface TileS {
  framed: Framed;
  wallW: number;
  ceilLevel: boolean;
  ceilL: number;
  ceilR: number;
  base: 'tub' | 'floor';
  tubH: number;
  tubPos: 'full' | 'left' | 'right' | 'center';
  tubL: number;
  tilePreset: string;
  tileH: number;
  tileW: number;
  grout: number;
  pattern: 'half' | 'third' | 'quarter' | 'stack' | 'random';
  minFrac: number;
  board: number;
  thinset: number;
  tileT: number;
  gap: number;
  rW: number;
  rH: number;
  rSill: number;
  rLeft: number;
  nPreset: string;
  nW: number;
  nH: number;
  nSill: number;
  studs: 'free' | 'bay';
  studOC: number;
  bayL: number;
  nPos: 'wall' | 'tub' | 'custom';
  nLeft: number;
  shelves: number;
  shelfT: number;
  frameOn: 'yes' | 'no';
  frameW: number;
  center: 'niche' | 'wall' | 'tub' | 'left' | 'right';
  edge: 'none' | 'left' | 'right';
  slopeMode: 'full' | 'part';
  slopeRun: number;
  studD: number;
  wallType: 'niche' | 'plain';
  widthRef: 'framing' | 'finished';
  minReach: number;
  maxReach: number;
  tubSlide: 'center' | 'left' | 'right';
  fitClear: number;
  furSplit: string;
  framing: 'new' | 'existing';
  studMode: 'oc' | 'list';
  stud1: number;
  exOC: number;
  studList: string;
  sillType: 'tile' | 'marble';
  sillT: number;
  sillProj: number;
  /* the old tool's IN: inside the niche, framing choices */
  start: 'bottom' | 'top' | 'balance' | 'match';
  shelfPos: 'center' | 'auto' | 'custom' | 'even';
  shelf1: number;
  shelf2: number;
  pat: 'wall' | 'stack';
  side: 'auto' | 'tile' | 'joint';
  studStart: 'left' | 'right';
  block: 'flat' | 'edge';
  sides: 'full' | 'block';
  /** Layout line moved off center (new, not in the old tool): inches, negative is left. */
  shift: number;
  /** With the line on center: let the planner pick, or force a tile or a joint on it (new; looks use it). */
  onCenter: 'auto' | 'tile' | 'joint';
  /** The grout joint can't change (handmade / zellige laid with a minimal joint). New. */
  groutFixed: boolean;
  /** How the niche is built: new blocking anywhere, or between existing studs ('' until answered). New; sets framed and studs. */
  build: '' | 'new' | 'bay' | 'prefab';
  /** How far the niche width may move from nW to fit the tile (0 = the old tool's 2″). New. */
  nWTol: number;
  /** The style the tile was ordered for; the planner fits the niche to it. New. */
  style: '' | 'classic' | 'balanced' | 'organic' | 'simple';
  /** Random-looking pattern: which arrangement (Shuffle picks another). New. */
  seed: number;
  /** Prefabricated niche (build 'prefab'): model, inside opening, lip the tile butts to, and the rough opening it needs. */
  pfModel: string;
  pfW: number;
  pfH: number;
  pfLip: number;
  pfRW: number;
  pfRH: number;
  /** Avoid thin pieces beside the niche (the old tool always did). Looks turn it off: sides don't matter. New. */
  sideLegs: boolean;
  /* set by tileS(): the finished tile wall */
  _tile?: boolean;
  _frW?: number;
  _offL?: number;
  _furL?: number;
  _furR?: number;
}

export const DEF: TileS = {
  framed: '', wallW: 60, ceilLevel: true, ceilL: 96, ceilR: 96, base: 'tub', tubH: 15, tubPos: 'full', tubL: 60,
  tilePreset: '3x12', tileH: 3, tileW: 12, grout: 0.125, pattern: 'half', minFrac: 0.5,
  board: 0.5, thinset: 0.125, tileT: 0.375, gap: 0.125,
  rW: 14.5, rH: 26, rSill: 46, rLeft: 22.75,
  nPreset: '12x24', nW: 12, nH: 24, nSill: 48, studs: 'free', studOC: 16, bayL: 22.75, nPos: 'wall', nLeft: 22,
  shelves: 1, shelfT: 0.5, frameOn: 'no', frameW: 2, center: 'niche', edge: 'none', slopeMode: 'full', slopeRun: 24, studD: 3.5,
  wallType: 'niche', widthRef: 'framing', minReach: 0.25, maxReach: 0.5, tubSlide: 'center', fitClear: 0.125, furSplit: 'even',
  framing: 'new', studMode: 'oc', stud1: 16, exOC: 16, studList: '', sillType: 'tile', sillT: 0.75, sillProj: 1,
  start: 'bottom', shelfPos: 'center', shelf1: 6, shelf2: 12, pat: 'wall', side: 'auto', studStart: 'left', block: 'flat', sides: 'full',
  shift: 0,
  onCenter: 'auto',
  groutFixed: false,
  sideLegs: true,
  build: '',
  style: 'classic',
  nWTol: 0,
  seed: 1,
  pfModel: 'kb12x28',
  pfW: 12,
  pfH: 28,
  pfLip: 0,
  pfRW: 14.375,
  pfRH: 30.375,
};

/** Keys the old tool kept in IN rather than S. */
export const IN_KEYS = ['start', 'shelfPos', 'shelf1', 'shelf2', 'pat', 'side', 'studStart', 'block', 'sides'] as const;

/** Settings from saved answers, keeping only known keys of the right type (as the old tool loaded them). */
export function fromSaved(saved: Record<string, unknown> | null | undefined): TileS {
  const S: TileS = { ...DEF };
  if (!saved) return S;
  const rec = S as unknown as Record<string, unknown>;
  for (const k of Object.keys(DEF)) if (typeof saved[k] === typeof rec[k]) rec[k] = saved[k];
  return S;
}

/** The old tool stored a marble shelf at the sill's thickness. */
export function normalize(S: TileS): void {
  if (S.sillType === 'marble') S.shelfT = S.sillT;
}

/** Framing gap around a prefabricated niche, each side (owner, Nov 28). */
export const PF_GAP = 1 / 16;

/** Prefabricated niches to pick from: inside opening W × H. Schluter KERDI-BOARD-SN sits flush with 1/2″ board (no lip). */
export const PREFABS: { key: string; name: string; w: number; h: number; lip: number }[] = [
  { key: 'kb12x6', name: 'Schluter KERDI-BOARD-SN 12 × 6', w: 12, h: 6, lip: 0 },
  { key: 'kb12x12', name: 'Schluter KERDI-BOARD-SN 12 × 12', w: 12, h: 12, lip: 0 },
  { key: 'kb12x20', name: 'Schluter KERDI-BOARD-SN 12 × 20', w: 12, h: 20, lip: 0 },
  { key: 'kb12x28', name: 'Schluter KERDI-BOARD-SN 12 × 28', w: 12, h: 28, lip: 0 },
];

export const isPrefab = (S: TileS) => S.build === 'prefab' && S.framed !== 'yes' && S.wallType !== 'plain';
/** Where the wall tile stops around a prefab: its opening plus the lip on each side. */
export const pfStopW = (S: TileS) => S.pfW + 2 * S.pfLip;
export const pfStopH = (S: TileS) => S.pfH + 2 * S.pfLip;
