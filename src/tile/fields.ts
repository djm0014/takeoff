/**
 * The tile tab's setup questions and fields, from the old Niche Rough-In
 * Planner (same labels, hints, steps and skips). Differences, all because a
 * measurement lives in one place on the job record:
 *
 * - the wall width (stud to stud), the ceiling and the tub come from the floor
 *   plan and show read-only here
 * - the width is always measured at the studs (the old "Measure the wall
 *   width at" question is gone)
 * - the saved-jobs list on the first step is gone (the app keeps jobs)
 */
import { PF_GAP, PREFABS, isPrefab, type TileS } from './settings';
import { LOOKS, STYLE_PATTERNS, lookName, studBound } from './looks';
import { bu, cRv, finW, fitText, fmt, isPlain, slopeRun, tubFit } from './solve';

type Txt = string | ((S: TileS) => string);
type Show = (S: TileS) => boolean;
export type Key = keyof TileS & string;

export interface NumF {
  t: 'num';
  id: Key;
  label: Txt;
  hint?: Txt;
  step: number;
  min: number;
  max: number;
  show?: Show;
  nicheOnly?: boolean;
}
export interface ChoiceF {
  t: 'choice';
  id: Key;
  label?: Txt;
  hint?: Txt;
  big?: boolean;
  /** value, label, sub-label, shown when */
  opts: [string | number, string, (string | null)?, Show?][];
  on?: (S: TileS, v: string | number) => void;
  show?: Show;
  nicheOnly?: boolean;
}
export interface CheckF {
  t: 'check';
  id: Key;
  label: Txt;
  show?: Show;
  nicheOnly?: boolean;
}
export interface TextF {
  t: 'text';
  id: Key;
  label: Txt;
  hint?: Txt;
  show?: Show;
  nicheOnly?: boolean;
}
export interface InfoF {
  t: 'info';
  key: string;
  text: (S: TileS) => string;
  show?: Show;
  nicheOnly?: boolean;
}
/** A value that lives elsewhere on the job record, shown read-only. */
export interface ReadF {
  t: 'read';
  key: string;
  label: Txt;
  text: (S: TileS) => string;
  hint?: Txt;
  show?: Show;
  nicheOnly?: boolean;
}
export type Field = NumF | ChoiceF | CheckF | TextF | InfoF | ReadF;

export interface Step {
  id: string;
  title: Txt;
  sub?: Txt;
  preview?: boolean;
  skip?: Show;
  fields: Field[];
}

export const lab = (x: Txt | undefined, S: TileS): string => (typeof x === 'function' ? x(S) : (x ?? ''));
const isTub = (S: TileS) => S.base === 'tub';
const TUB_POS: Record<TileS['tubPos'], string> = {
  full: 'wall to wall (alcove)',
  left: 'at the left end, open floor at right',
  right: 'at the right end, open floor at left',
  center: 'in the middle, open floor both sides',
};
const tilePreset = (S: TileS, v: string | number) => {
  if (v !== 'custom') {
    const [a, b] = String(v).split('x').map(Number);
    S.tileH = a!;
    S.tileW = b!;
  }
};
const nichePreset = (S: TileS, v: string | number) => {
  if (v !== 'custom') {
    const [a, b] = String(v).split('x').map(Number);
    S.nW = a!;
    S.nH = b!;
  }
};

export const STEPS: Step[] = [
  {
    id: 'start',
    title: 'Start a wall',
    sub: 'This decides what the planner works out for you.',
    fields: [
      { t: 'choice', id: 'wallType', big: true, label: 'What’s on this wall?', opts: [['niche', 'A niche', 'Lay out the tile and find the niche rough-in'], ['plain', 'Just tile', 'Lay out the courses, cuts and framing']] },
      {
        // Replaces the old tool's "Is the niche framed yet?" (owner, Nov 28): an existing niche is never reused;
        // what matters is whether it follows the existing stud spacing.
        t: 'choice',
        id: 'build',
        big: true,
        label: 'How is the niche built?',
        show: (S) => S.wallType !== 'plain',
        opts: [
          ['new', 'New blocking', 'Frame it wherever the tile layout wants it, any size'],
          ['bay', 'Between existing studs', 'It goes in a stud bay you measure'],
          ['prefab', 'Prefabricated niche', 'A fixed size (like Schluter KERDI-BOARD-SN), in an existing stud bay'],
        ],
        on: (S, v) => {
          S.framed = 'no';
          S.studs = v === 'new' ? 'free' : 'bay';
        },
      },
    ],
  },
  {
    id: 'wall',
    title: 'Wall and tub',
    sub: 'The wall width, ceiling and tub come from the floor plan. The sketch updates as you go.',
    preview: true,
    fields: [
      { t: 'read', key: 'wallW', label: 'Wall width, stud to stud', text: (S) => fmt(S.wallW), hint: 'From the floor plan: the wall’s length plus the drywall at each corner' },
      { t: 'check', id: 'ceilLevel', label: 'Ceiling is level' },
      { t: 'read', key: 'ceilL', label: (S) => (S.ceilLevel ? 'Floor to ceiling' : 'Floor to ceiling, left end'), text: (S) => fmt(S.ceilL), hint: 'From the floor plan' },
      { t: 'num', id: 'ceilR', label: 'Floor to ceiling, right end', step: 0.125, min: 24, max: 240, show: (S) => !S.ceilLevel },
      { t: 'choice', id: 'slopeMode', label: 'The slope runs', opts: [['full', 'Corner to corner'], ['part', 'Partway, then goes flat']], show: (S) => !S.ceilLevel },
      { t: 'num', id: 'slopeRun', label: 'Slope length, from the low end', hint: 'Measured level along the floor', step: 0.25, min: 0.5, max: 240, show: (S) => !S.ceilLevel && S.slopeMode === 'part' },
      {
        t: 'info',
        key: 'slope',
        text: (S) => {
          const rise = Math.abs(cRv(S) - S.ceilL);
          const run = slopeRun(S);
          const a = (Math.atan2(rise, run) * 180) / Math.PI;
          return rise < 0.01
            ? 'Both ends are the same height.'
            : `The ceiling rises ${fmt(rise)} over ${fmt(run)}: about ${Math.round(a)}° from level.` + (run < S.wallW - 0.05 ? ` Flat at ${fmt(Math.max(S.ceilL, cRv(S)))} after that.` : '');
        },
        show: (S) => !S.ceilLevel,
      },
      {
        t: 'read',
        key: 'base',
        label: 'Tile starts on',
        text: (S) => (isTub(S) ? `A ${fmt(S.tubL)} tub, ${TUB_POS[S.tubPos]}` : 'The floor or shower pan'),
        hint: (S) => (isTub(S) ? 'From the floor plan' : 'No tub against this wall in the floor plan'),
      },
      { t: 'num', id: 'tubH', label: 'Floor to top of tub', hint: 'Where the tile sits. Kept on the tub.', step: 0.125, min: 4, max: 40, show: isTub },
      {
        t: 'choice',
        id: 'edge',
        label: 'Outside corner with a bullnose edge',
        hint: (S) => (S.edge === 'none' ? '' : 'The niche and tile center on the field inside the bullnose.'),
        opts: [['none', 'None, both ends are inside corners'], ['left', 'Left end'], ['right', 'Right end']],
      },
      { t: 'choice', id: 'tubSlide', label: 'The tub sits', opts: [['center', 'Centered between studs'], ['left', 'Against the left studs'], ['right', 'Against the right studs']], show: (S) => isTub(S) && S.tubPos === 'full' && S.edge === 'none' },
      { t: 'num', id: 'minReach', label: 'Tile onto the tub lip, at least', step: 0.0625, min: 0, max: 1, show: (S) => isTub(S) && S.tubPos === 'full' && S.edge === 'none' },
      { t: 'num', id: 'maxReach', label: 'Tile onto the tub lip, at most', step: 0.0625, min: 0, max: 2, show: (S) => isTub(S) && S.tubPos === 'full' && S.edge === 'none' },
      {
        t: 'info',
        key: 'fur',
        text: (S) => {
          const f = tubFit(S);
          return (f ? fitText(S, f) + ' ' : '') + (f && f.low ? 'Fur out in the field, then change the wall in the floor plan to the new width. ' : '') + (f && !f.narrow ? '' : `Finished tile width now: ${fmt(finW(S))}.`);
        },
      },
    ],
  },
  {
    id: 'tile',
    title: 'Tile',
    sub: 'The style the tile was ordered for comes first; the niche is fitted to it. Sizes are height × length, laid horizontally.',
    fields: [
      {
        t: 'choice',
        id: 'style',
        big: true,
        label: 'Style',
        opts: LOOKS.map((l): [string, string, string, ((S: TileS) => boolean)?] => [l.key, l.name, l.blurb, l.key === 'simple' ? studBound : undefined]),
        // Keep the pattern to one the style allows.
        on: (S, v) => {
          const ok = STYLE_PATTERNS[v as keyof typeof STYLE_PATTERNS];
          if (ok && !ok.includes(S.pattern)) S.pattern = ok[0]!;
        },
      },
      {
        t: 'choice',
        id: 'tilePreset',
        label: 'Field tile',
        opts: [['3x6', '3 × 6'], ['3x12', '3 × 12'], ['4x12', '4 × 12'], ['4x16', '4 × 16'], ['6x24', '6 × 24'], ['12x24', '12 × 24'], ['custom', 'Custom']],
        on: tilePreset,
      },
      { t: 'num', id: 'tileH', label: 'Tile height', step: 0.125, min: 0.5, max: 48, show: (S) => S.tilePreset === 'custom' },
      { t: 'num', id: 'tileW', label: 'Tile length', step: 0.125, min: 0.5, max: 96, show: (S) => S.tilePreset === 'custom' },
      {
        t: 'choice',
        id: 'grout',
        label: 'Grout joint',
        opts: [[0.03125, 'Butted, no spacers'], [0.0625, '1/16″'], [0.125, '1/8″'], [0.1875, '3/16″']],
        hint: (S) => (S.grout < 0.05 ? 'Planned as a 1/32″ joint, about what stacked tile leaves with no spacers. Over many courses it adds up, so it still counts.' : ''),
      },
      {
        t: 'choice',
        id: 'pattern',
        label: 'Pattern',
        hint: 'Only the patterns this style allows.',
        opts: (
          [
            ['half', 'Running bond 1/2'],
            ['third', '1/3 offset'],
            ['quarter', '1/4 offset'],
            ['stack', 'Stacked'],
          ] as [TileS['pattern'], string][]
        ).map(([v, l]): [string, string, null, (S: TileS) => boolean] => [v, l, null, (S) => !S.style || (STYLE_PATTERNS[S.style] ?? []).includes(v)]),
        show: (S) => S.style !== 'organic',
      },
      { t: 'check', id: 'groutFixed', label: 'Grout joint can’t change (handmade or zellige tile)' },
      { t: 'choice', id: 'minFrac', label: 'Smallest cut you accept', opts: [[0.5, 'Half a tile'], [0.3333, 'A third'], [0.25, 'A quarter']] },
    ],
  },
  {
    id: 'build',
    title: 'Wall build-up',
    sub: 'Every face of the niche gets board, thinset and tile, so the finished opening is smaller than the framing.',
    fields: [
      { t: 'choice', id: 'board', label: 'Backer board', opts: [[0.5, '1/2″'], [0.25, '1/4″'], [0.625, '5/8″']] },
      { t: 'choice', id: 'thinset', label: 'Thinset', opts: [[0.125, '1/8″'], [0.1875, '3/16″']] },
      { t: 'choice', id: 'framing', label: 'Studs in this wall', opts: [['new', 'New framing'], ['existing', 'Existing studs']] },
      { t: 'choice', id: 'studMode', label: 'Existing studs', opts: [['oc', 'Regular spacing'], ['list', 'List each stud']], show: (S) => S.framing === 'existing' },
      { t: 'num', id: 'stud1', label: 'First stud center', hint: 'From the left corner framing. Shared with the vanity wall.', step: 0.125, min: 0, max: 240, show: (S) => S.framing === 'existing' && S.studMode === 'oc' },
      { t: 'choice', id: 'exOC', label: 'Spacing', opts: [[16, '16″'], [24, '24″'], [12, '12″']], show: (S) => S.framing === 'existing' && S.studMode === 'oc' },
      { t: 'text', id: 'studList', label: 'Stud centers from the left corner', hint: 'Separate with commas, like 15 3/4, 31 1/2, 47 1/4', show: (S) => S.framing === 'existing' && S.studMode === 'list' },
      { t: 'choice', id: 'studD', label: 'Wall framing', opts: [[3.5, '2×4 studs (3 1/2″ deep)'], [5.5, '2×6 studs (5 1/2″ deep)']] },
      { t: 'choice', id: 'tileT', label: 'Tile thickness', opts: [[0.25, '1/4″'], [0.3125, '5/16″'], [0.375, '3/8″'], [0.5, '1/2″']] },
      { t: 'info', key: 'bu', text: (S) => `Each face builds up ${fmt(bu(S))}, so the finished opening is ${fmt(2 * bu(S))} smaller than the framing in width and height.` },
      { t: 'num', id: 'gap', label: 'Gap at tub, ceiling and corners', hint: 'Caulk joint', step: 0.0625, min: 0, max: 0.5 },
    ],
  },
  {
    id: 'niche',
    skip: isPlain,
    title: (S) => (S.framed === 'yes' ? 'The framed opening' : isPrefab(S) ? 'The prefabricated niche' : 'The niche you want'),
    sub: (S) =>
      S.framed === 'yes'
        ? 'Measure the framing as it is now.'
        : isPrefab(S)
          ? 'Its size can’t change, so the planner puts its bottom on a grout line and frames it tight with 1/16″ each side.'
          : 'Give rough targets. The planner nudges them to land on grout lines and whole tiles.',
    fields: [
      { t: 'num', id: 'rW', label: 'Rough opening width', step: 0.125, min: 2, max: 96, show: (S) => S.framed === 'yes' },
      { t: 'num', id: 'rH', label: 'Rough opening height', step: 0.125, min: 2, max: 120, show: (S) => S.framed === 'yes' },
      { t: 'num', id: 'rSill', label: 'Floor to rough sill', step: 0.125, min: 0, max: 200, show: (S) => S.framed === 'yes' },
      { t: 'num', id: 'rLeft', label: 'Left corner to opening', hint: 'To the left side of the framing', step: 0.125, min: 0, max: 240, show: (S) => S.framed === 'yes' },
      { t: 'choice', id: 'studOC', label: 'Stud spacing', opts: [[16, '16″ on center'], [24, '24″ on center']], show: (S) => S.framed !== 'yes' && S.studs === 'bay' },
      { t: 'num', id: 'bayL', label: 'Left corner to the bay', hint: 'To the face of the stud on the bay’s left side', step: 0.125, min: 0, max: 240, show: (S) => S.framed !== 'yes' && S.studs === 'bay' },
      {
        t: 'info',
        key: 'bay',
        text: (S) => `The bay is ${fmt(S.studOC - 1.5)} wide between studs, so the finished width will be ${fmt(S.studOC - 1.5 - 2 * bu(S))}.`,
        show: (S) => S.framed !== 'yes' && S.studs === 'bay' && !isPrefab(S),
      },
      {
        t: 'choice',
        id: 'pfModel',
        label: 'Which niche',
        opts: [...PREFABS.map((p): [string, string] => [p.key, p.name]), ['custom', 'Other (type its sizes)']],
        on: (S, v) => {
          const p = PREFABS.find((x) => x.key === v);
          if (!p) return;
          S.pfW = p.w;
          S.pfH = p.h;
          S.pfLip = p.lip;
          S.pfRH = Math.round((S.pfRW - p.w + p.h) * 16) / 16;
        },
        show: isPrefab,
      },
      { t: 'num', id: 'pfW', label: 'Inside opening width', step: 0.125, min: 2, max: 72, show: (S) => isPrefab(S) && S.pfModel === 'custom' },
      { t: 'num', id: 'pfH', label: 'Inside opening height', step: 0.125, min: 2, max: 96, show: (S) => isPrefab(S) && S.pfModel === 'custom' },
      { t: 'num', id: 'pfLip', label: 'Lip the tile butts to', hint: '0 when it sits flush with the board and the tile runs to the opening (Schluter); up to 1″ for a framed lip', step: 0.0625, min: 0, max: 1.5, show: isPrefab },
      { t: 'num', id: 'pfRW', label: 'Rough opening it needs, width', hint: 'From the box or spec sheet', step: 0.0625, min: 2, max: 72, show: isPrefab },
      { t: 'num', id: 'pfRH', label: 'Rough opening it needs, height', hint: 'From the box or spec sheet', step: 0.0625, min: 2, max: 96, show: isPrefab },
      {
        t: 'info',
        key: 'pf',
        text: (S) => {
          const need = S.pfRW + 2 * PF_GAP;
          const bay = S.studOC - 1.5;
          return `Framed opening ${fmt(need)} × ${fmt(S.pfRH + 2 * PF_GAP)} (${fmt(PF_GAP)} each side). ` + (need > bay + 1e-6 ? `That’s ${fmt(need - bay)} wider than a ${fmt(S.studOC)} on-center bay: a stud gets trimmed or moved.` : `It fits a ${fmt(S.studOC)} on-center bay (${fmt(bay)}).`);
        },
        show: isPrefab,
      },
      {
        t: 'choice',
        id: 'nPreset',
        label: 'Finished size, about',
        hint: 'Width × height inside the tile',
        opts: [['12x12', '12 × 12'], ['12x24', '12 × 24'], ['14x24', '14 × 24'], ['24x12', '24 wide × 12'], ['custom', 'Custom']],
        on: nichePreset,
        show: (S) => S.framed !== 'yes' && !isPrefab(S),
      },
      { t: 'num', id: 'nW', label: 'Finished width', step: 0.25, min: 4, max: 72, show: (S) => S.framed !== 'yes' && !isPrefab(S) && S.nPreset === 'custom' && S.studs !== 'bay' },
      { t: 'num', id: 'nH', label: 'Finished height', step: 0.25, min: 4, max: 72, show: (S) => S.framed !== 'yes' && !isPrefab(S) && S.nPreset === 'custom' },
      { t: 'num', id: 'nSill', label: 'Floor to bottom of niche, about', hint: 'Finished height. It moves to the nearest grout line.', step: 0.5, min: 6, max: 200, show: (S) => S.framed !== 'yes' },
      {
        t: 'choice',
        id: 'nPos',
        label: 'Center the niche on',
        opts: [['wall', 'The wall'], ['tub', 'The tub', null, (S) => isTub(S) && S.tubPos !== 'full'], ['custom', 'Set the left side']],
        show: (S) => S.framed !== 'yes' && S.studs !== 'bay',
      },
      { t: 'num', id: 'nLeft', label: 'Left corner to opening', hint: 'To the left side of the rough framing', step: 0.125, min: 0, max: 240, show: (S) => S.framed !== 'yes' && S.studs !== 'bay' && S.nPos === 'custom' },
    ],
  },
  {
    id: 'extras',
    skip: (S) => (isPlain(S) || isPrefab(S)) && S.edge === 'none',
    title: (S) => (isPlain(S) ? 'Bullnose edge' : 'Shelf and bullnose'),
    sub: (S) => (isPlain(S) ? 'Size of the bullnose tile on the outside corner.' : 'Inside the niche, tile is laid out on its own, centered side to side and starting full on the sill.'),
    fields: [
      { t: 'choice', id: 'shelves', nicheOnly: true, show: (S) => !isPrefab(S), label: 'Shelves', opts: [[0, 'None'], [1, '1 shelf'], [2, '2 shelves']] },
      { t: 'choice', id: 'sillType', nicheOnly: true, show: (S) => !isPrefab(S), label: 'Niche sill', opts: [['tile', 'Tile, same as the walls'], ['marble', 'Marble or stone piece']] },
      { t: 'num', id: 'sillT', nicheOnly: true, label: 'Sill thickness', step: 0.0625, min: 0.25, max: 2, show: (S) => S.sillType === 'marble' },
      { t: 'num', id: 'sillProj', nicheOnly: true, label: 'Projects past field tile', step: 0.125, min: 0, max: 3, show: (S) => S.sillType === 'marble' },
      {
        t: 'info',
        key: 'sill',
        nicheOnly: true,
        text: (S) => `The field tile stops one grout joint below the sill so the joint lines up${S.shelves > 0 ? '. Shelves use the same marble and thickness' : ''}.`,
        show: (S) => S.sillType === 'marble',
      },
      { t: 'num', id: 'shelfT', nicheOnly: true, label: 'Shelf thickness', step: 0.0625, min: 0.125, max: 3, show: (S) => S.shelves > 0 && S.sillType !== 'marble' },
      { t: 'choice', id: 'frameOn', nicheOnly: true, show: (S) => !isPrefab(S), label: 'Bullnose border around the niche', opts: [['no', 'No'], ['yes', 'Yes']] },
      {
        t: 'num',
        id: 'frameW',
        label: 'Bullnose tile height',
        hint: (S) => (S.frameOn === 'yes' && S.edge !== 'none' ? 'Used for the niche border and the corner edge. ' : '') + 'Length matches the field tile.',
        step: 0.125,
        min: 0.25,
        max: 12,
        show: (S) => S.frameOn === 'yes' || S.edge !== 'none',
      },
    ],
  },
  { id: 'results', title: 'Your layout', fields: [] },
];

const find = <T extends Field>(step: string, id: string) => STEPS.find((s) => s.id === step)!.fields.find((f) => 'id' in f && f.id === id) as T;

/** The results screen's Adjust card. */
export const ADJ: Field[] = [
  {
    t: 'choice',
    id: 'center',
    label: 'Center the field tile on',
    on: (S) => {
      S.shift = 0;
      S.onCenter = 'auto';
    },
    opts: [['niche', 'The niche', null, (S) => !isPlain(S)], ['wall', 'The wall'], ['tub', 'The tub', null, (S) => isTub(S) && S.tubPos !== 'full'], ['left', 'Full tile at left corner'], ['right', 'Full tile at right corner']],
  },
  find('tile', 'minFrac'),
  find('tile', 'pattern'),
  find('wall', 'edge'),
  find('extras', 'frameW'),
];

/** "Your answers" on the results screen: step index, label, summary. */
export function answers(S: TileS): [number, string, string][] {
  // A prefab has no shelf or border choices.
  return allAnswers(S).filter((a) => !(isPrefab(S) && a[0] === 5));
}
function allAnswers(S: TileS): [number, string, string][] {
  const tub = isTub(S);
  const PATN: Record<string, string> = { half: 'running bond 1/2', third: '1/3 offset', quarter: '1/4 offset', stack: 'stacked', random: 'random offset' };
  return [
    [0, 'Wall type', isPlain(S) ? 'Just tile' : S.framed === 'yes' ? 'Niche, already framed' : isPrefab(S) ? 'Prefabricated niche' : S.studs === 'bay' ? 'Niche, between existing studs' : 'Niche, new blocking'],
    [
      1,
      'Wall',
      `${fmt(S.wallW)} wide, ${S.ceilLevel ? fmt(S.ceilL) : fmt(S.ceilL) + ' to ' + fmt(S.ceilR)} to ceiling, ` +
        (tub ? `${S.tubPos === 'full' ? 'wall-to-wall' : fmt(S.tubL)} tub ${fmt(S.tubH)} high` : 'no tub') +
        (S.edge !== 'none' ? `, bullnose on the ${S.edge} outside corner` : ''),
    ],
    [2, 'Tile', `${S.style ? lookName(S.style) + ' style, ' : ''}${fmt(S.tileH)} × ${fmt(S.tileW)}, ${S.grout < 0.05 ? 'butted joint' : fmt(S.grout) + ' joint'}, ${PATN[S.pattern]}`],
    [3, 'Build-up', `${fmt(bu(S))} per face`],
    ...(isPlain(S)
      ? []
      : ([
          [
            4,
            'Niche',
            S.framed === 'yes'
              ? `Framed ${fmt(S.rW)} × ${fmt(S.rH)}, sill ${fmt(S.rSill)} up`
              : isPrefab(S)
                ? `Prefab ${fmt(S.pfW)} × ${fmt(S.pfH)} inside${S.pfLip ? `, ${fmt(S.pfLip)} lip` : ''}, rough ${fmt(S.pfRW)} × ${fmt(S.pfRH)}, sill near ${fmt(S.nSill)}`
                : `About ${S.studs === 'bay' ? 'bay width' : fmt(S.nW)} × ${fmt(S.nH)} finished, sill near ${fmt(S.nSill)}`,
          ],
          [
            5,
            'Shelf and border',
            `${S.shelves ? S.shelves + (S.shelves > 1 ? ' shelves' : ' shelf') + ' ' + fmt(S.shelfT) : 'No shelf'}, ${S.frameOn === 'yes' ? fmt(S.frameW) + ' border' : 'no border'}${S.sillType === 'marble' ? `, ${fmt(S.sillT)} marble sill` : ''}`,
          ],
        ] as [number, string, string][])),
  ];
}
