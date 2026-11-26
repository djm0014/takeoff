/**
 * Vanity wall settings: the old Vanity Wall Solver's answers, field list,
 * presets and setup steps, kept as they were so the numbers match it.
 *
 * Settings are a flat record of strings keyed like the old tool (D). Some keys
 * are read from the shared job record instead of stored here (see bind.ts):
 * wall width, ceiling, studs, finish, the toilet and the vanity's place.
 */
import { parseInches } from '../lib/inches';

export type VanityD = Record<string, string>;

export const DEF: VanityD = {
  wall: '60', ceil: '96', stud: '', vpos: 'center', vside: 'R', qdone: '', wallc: 'open', wcmove: 'keep', plumb: 'keep', exdx: '',
  vref: 'clear', voff: '12', vw: '36', ctr: '36', bs: '4', sinks: '1', space: '', sink: 'under', vh: '5',
  fau: 'deck', fh: '10', spout: '4', mir: 'mirror', mm: 'one', mw: '24', mh: '30', mro: '', mroh: '', place: 'eye', mc: '64', mt: '76', fgap: '2',
  lt: 'bar', lw: '24', lh: '6', lgap: '3', sw: '5', sh: '12', sgap: '4', saff: '', rec: 'R', rech: '42', drain: '19', sup: '22', spread: '8',
  pw: '24', prim: '34', fig: 'sink', figh: '69', preset: 'comfort', mb: '40', lbkeep: 'move', lbx: '', lbh: '', bid: 'none', bidx: '', bidh: '20',
  wo: 'none', wox: '12', woh: '16', studd: '3.5', wfin: '1/2', vd: '21', pd: '18', freach: '5', mcd: '5', mrd: '3 1/2', ldp: '5', sdp: '7',
  cab: 'none', cabface: 'front', cabd: '18', cabx: '', cabw: '18', cabh: '34 1/2', cabb: '0', cabn: '4',
  wc: 'none', wcx: '18', wcseat: '17', wct: '30', wch: '8', wcs: '6', wcri: '12',
};

/** Old tool preset keys; the job record uses the long names. */
export const PRESET_KEYS = { tight: 'tight', standard: 'std', comfort: 'comfort', aging: 'aip' } as const;

export const PRESETS: Record<string, VanityD> = {
  tight: { ctr: '32', vd: '18', wcseat: '15', place: 'low', rech: '42' },
  std: { ctr: '32', vd: '21', wcseat: '15', place: 'low', rech: '42' },
  comfort: { ctr: '36', vd: '21', wcseat: '17', place: 'eye', mc: '64', rech: '42' },
  aip: { ctr: '34', vd: '21', wcseat: '18', place: 'bot', mb: '40', rech: '42' },
};

export const PDESC: Record<string, string> = {
  tight: 'Code minimums: 15″ beside the toilet and sink, 21″ in front, 32″ counter, 18″-deep vanity, mirror just above the faucet. Checks accept the minimums and fixes aim for them.',
  std: 'Traditional heights: 32″ counter, 15″ toilet seat, mirror just above the faucet. Checks aim for 18″ beside the toilet and 20″ from sink to wall.',
  comfort: '36″ counter, 17″ toilet seat, mirror centered at 64″. Checks aim for 18″ beside the toilet and 20″ from sink to wall.',
  aip: '34″ counter (ADA max), 18″ toilet seat, mirror bottom at 40″, outlets within 15–48″. Adds grab bar blocking to the schedule.',
};

type Txt = string | ((D: VanityD) => string);
type Show = (D: VanityD) => boolean;
type Opts = [string, string][] | ((D: VanityD) => [string, string][]);

export interface NumField {
  t: 'num';
  id: string;
  label: Txt;
  hint?: Txt;
  show?: Show;
}
export interface ChoiceField {
  t: 'choice';
  id: string;
  label: Txt;
  opts: Opts;
  show?: Show;
  hint?: Txt;
}
export interface SpecialField {
  t: 'has' | 'snap';
  id: string;
  label: string;
  show?: Show;
}
export type Field = NumField | ChoiceField | SpecialField;

const N = (id: string, label: Txt, hint?: Txt, show?: Show): NumField => ({ t: 'num', id, label, hint, show });
const C = (id: string, label: Txt, opts: Opts, show?: Show): ChoiceField => ({ t: 'choice', id, label, opts, show });

export const txt = (t: Txt | undefined, D: VanityD): string => (typeof t === 'function' ? t(D) : (t ?? ''));
export const optsOf = (o: Opts, D: VanityD): [string, string][] => (typeof o === 'function' ? o(D) : o);

const num = (s: string | undefined) => parseInches(String(s ?? '')) ?? NaN;

export const SECTIONS: { title: string; open?: boolean; fields: Field[] }[] = [
  { title: 'Bathroom', open: true, fields: [C('preset', 'Who is this bathroom for?', [['tight', 'Tight space'], ['std', 'Standard'], ['comfort', 'Comfort height'], ['aip', 'Aging in place']])] },
  {
    title: 'Wall',
    open: true,
    fields: [
      N('wall', 'Wall width', 'From the floor plan'),
      N('ceil', 'Ceiling height', 'From the floor plan'),
      C('studd', 'Stud depth', [['3.5', '2×4'], ['5.5', '2×6']]),
      N('wfin', 'Wall finish thickness', 'Drywall 1/2″; board and tile about 1″'),
      C('wallc', 'Is the wall open to the studs?', [['open', 'Open'], ['closed', 'Still finished']]),
      N('stud', 'First stud center from left', 'Leave blank if unknown; studs assumed 16″ OC', (D) => D.wallc !== 'closed'),
    ],
  },
  {
    title: 'Vanity and sink',
    open: true,
    fields: [
      C('sink', 'Sink type', [['under', 'Undermount / drop-in'], ['vessel', 'Vessel'], ['ped', 'Pedestal']]),
      N('vw', 'Vanity width', '', (D) => D.sink !== 'ped'),
      N('vd', 'Vanity depth', 'Cabinet, without the top', (D) => D.sink !== 'ped'),
      N('pw', 'Sink width', 'Widest part of the basin', (D) => D.sink === 'ped'),
      N('pd', 'Sink depth', 'Wall to front edge', (D) => D.sink === 'ped'),
      N('prim', 'Rim height', 'Top of the basin, usually 33–36″', (D) => D.sink === 'ped'),
      C('vpos', 'Vanity position', (D) => [
        ['center', 'Centered on wall'],
        ...(D.wc !== 'none' ? ([['beside', 'Centered between toilet and wall'], ['far', 'Tight to the wall']] as [string, string][]) : []),
        ...(D.plumb === 'keep' && num(D.exdx) > 0 && (D.sinks !== '2' || D.sink === 'ped') ? ([['drain', 'Centered on existing drain']] as [string, string][]) : []),
        ['left', 'Set from left'],
      ]),
      N('voff', 'Vanity from left wall', '', (D) => D.vpos === 'left'),
      C('vside', 'Vanity is on this side of the toilet', [['L', 'Left'], ['R', 'Right']], (D) => D.wc !== 'none' && (D.vpos === 'beside' || D.vpos === 'far')),
      C('vref', 'Center between the wall and the toilet’s', [['clear', '15″ clearance line'], ['edge', 'Tank edge'], ['cl', 'Centerline']], (D) => D.wc !== 'none' && D.vpos === 'beside'),
      N('ctr', 'Countertop height', 'Top of counter', (D) => D.sink !== 'ped'),
      N('bs', 'Backsplash height', '0 for none', (D) => D.sink !== 'ped'),
      C('sinks', 'Sinks', [['1', 'One'], ['2', 'Two']], (D) => D.sink !== 'ped'),
      N('space', 'Sink spacing', 'Center to center; blank splits the vanity in half', (D) => D.sinks === '2' && D.sink !== 'ped'),
      N('vh', 'Vessel height', 'Above counter', (D) => D.sink === 'vessel'),
    ],
  },
  {
    title: 'Toilet',
    open: true,
    fields: [
      C('wcmove', 'Is the toilet flange staying where it is?', [['keep', 'Staying — I’ll measure it'], ['move', 'Moving — help me place it']], (D) => D.wc !== 'none'),
      N('wcx', (D) => (D.wcmove === 'move' ? 'New flange centerline from left wall' : 'Existing flange centerline from left wall'), (D) => (D.wcmove === 'move' ? 'Start around 18″ and watch the checks' : 'Measure to the center of the flange'), (D) => D.wc !== 'none'),
      N('wcseat', 'Seat height', 'About 15″ standard, 17″ comfort height', (D) => D.wc !== 'none'),
      N('wct', 'Tank top height', '', (D) => D.wc !== 'none'),
      N('wch', 'Supply stop height', '', (D) => D.wc !== 'none'),
      N('wcs', 'Supply stop left of centerline', '', (D) => D.wc !== 'none'),
      N('wcri', 'Flange rough-in', 'Flange center from the finished wall', (D) => D.wc !== 'none'),
    ],
  },
  {
    title: 'Presentation',
    fields: [
      C('fig', 'Scale figure', [['sink', 'At the sink'], ['side', 'Beside the vanity'], ['none', 'None']]),
      N('figh', 'Figure height', 'In inches: 5′4″ = 64, 5′9″ = 69, 6′0″ = 72', (D) => D.fig !== 'none'),
    ],
  },
  {
    title: 'Storage cabinet',
    fields: [
      C('cab', 'Built-in cabinet on this wall', [['none', 'None'], ['yes', 'Add one']]),
      { t: 'snap', id: 'cabsnap', label: 'Place it', show: (D) => D.cab === 'yes' },
      N('cabx', 'Left edge from left wall', 'Blank puts it 15″ past the toilet centerline', (D) => D.cab === 'yes'),
      N('cabw', 'Width', 'Along this wall', (D) => D.cab === 'yes'),
      C('cabface', 'Drawers open', [['front', 'Out into the room'], ['left', 'Sideways, to the left'], ['right', 'Sideways, to the right']], (D) => D.cab === 'yes'),
      N('cabd', 'Depth from the wall', '', (D) => D.cab === 'yes' && D.cabface === 'front'),
      N('cabh', 'Top height', 'Above the floor', (D) => D.cab === 'yes'),
      N('cabb', 'Bottom height', '0 if it sits on the floor; higher if wall-hung', (D) => D.cab === 'yes'),
      N('cabn', 'Drawers', '0 for a door', (D) => D.cab === 'yes'),
    ],
  },
  {
    title: 'Faucet and plumbing',
    fields: [
      C('fau', 'Faucet', [['deck', 'Deck-mount'], ['wall', 'Wall-mount']]),
      N('fh', 'Faucet height', 'Overall, above sink rim', (D) => D.fau === 'deck'),
      N('freach', 'Spout reach', (D) => (D.fau === 'wall' ? 'Wall to spout outlet' : 'Faucet body to spout outlet')),
      N('spout', 'Spout above rim', 'Outlet height above the sink rim', (D) => D.fau === 'wall'),
      C('plumb', 'Are the sink drain and supplies staying?', [['keep', 'Staying — I’ll measure them'], ['move', 'New rough-in']]),
      N('exdx', 'Existing drain centerline from left wall', 'Leave blank if you can’t see it yet', (D) => D.plumb === 'keep'),
      N('drain', (D) => (D.plumb === 'keep' ? 'Existing drain stub height' : 'Drain stub height')),
      N('sup', (D) => (D.plumb === 'keep' ? 'Existing supply height' : 'Supply height')),
      N('spread', 'Supply spread', 'Hot to cold'),
    ],
  },
  {
    title: 'Mirror or medicine cabinet',
    fields: [
      C('mir', 'Type', [['mirror', 'Mirror'], ['surf', 'Cabinet, surface'], ['rec', 'Cabinet, recessed'], ['none', 'None']]),
      C('mm', 'With two sinks', [['one', 'One centered'], ['each', 'One per sink']], (D) => D.sinks === '2' && D.sink !== 'ped' && D.mir !== 'none'),
      N('mw', 'Width', '', (D) => D.mir !== 'none'),
      N('mh', 'Height', '', (D) => D.mir !== 'none'),
      N('mro', 'Rough opening width', 'From the cabinet spec; blank = width − 1 3/4″', (D) => D.mir === 'rec'),
      N('mroh', 'Rough opening height', 'Blank = height − 1 3/4″', (D) => D.mir === 'rec'),
      N('mcd', 'Cabinet depth', '', (D) => D.mir === 'surf'),
      N('mrd', 'Cabinet body depth', 'The part that goes into the wall', (D) => D.mir === 'rec'),
      C('place', 'Set the height by', [['low', 'Just above faucet'], ['eye', 'Center height'], ['top', 'Top height'], ['bot', 'Bottom height']], (D) => D.mir !== 'none'),
      N('mb', 'Bottom height', '40″ max for seated use', (D) => D.mir !== 'none' && D.place === 'bot'),
      N('mc', 'Center height', '', (D) => D.mir !== 'none' && D.place === 'eye'),
      N('mt', 'Top height', 'e.g. match the door head', (D) => D.mir !== 'none' && D.place === 'top'),
      N('fgap', 'Gap above faucet', '', (D) => D.mir !== 'none'),
    ],
  },
  {
    title: 'Lights and outlets',
    fields: [
      C('lt', 'Lights', [['bar', 'Bar above'], ['sconce', 'Sconces each side'], ['none', 'None']]),
      C('lbkeep', 'Is the light box staying?', [['move', 'New location'], ['keep', 'Staying — I’ll measure it']], (D) => D.lt !== 'none'),
      N('lbx', 'Existing box from left wall', 'To the box center', (D) => D.lt !== 'none' && D.lbkeep === 'keep'),
      N('lbh', 'Existing box height', 'Box center, above the floor', (D) => D.lt !== 'none' && D.lbkeep === 'keep'),
      N('lw', 'Bar width', '', (D) => D.lt === 'bar'),
      N('lh', 'Bar height', '', (D) => D.lt === 'bar'),
      N('lgap', 'Gap above mirror', '', (D) => D.lt === 'bar'),
      N('sw', 'Sconce width', '', (D) => D.lt === 'sconce'),
      N('sh', 'Sconce height', '', (D) => D.lt === 'sconce'),
      N('sgap', 'Gap from mirror edge', '', (D) => D.lt === 'sconce'),
      N('saff', 'Sconce box height', 'Blank = a little above the mirror center', (D) => D.lt === 'sconce'),
      N('ldp', 'Bar projection', 'From the wall', (D) => D.lt === 'bar'),
      N('sdp', 'Sconce projection', 'From the wall', (D) => D.lt === 'sconce'),
      C('rec', 'Vanity outlet', [['L', 'Left of mirror'], ['R', 'Right of mirror'], ['none', 'None']]),
      N('rech', 'Vanity outlet height', '', (D) => D.rec !== 'none'),
      C('bid', 'Bidet outlet', [['none', 'None'], ['yes', 'Add one']]),
      N('bidx', 'Bidet outlet from left wall', (D) => (D.wc !== 'none' ? 'Blank puts it 12″ right of the toilet centerline' : 'Distance to the outlet center'), (D) => D.bid === 'yes'),
      N('bidh', 'Bidet outlet height', '', (D) => D.bid === 'yes'),
      C('wo', 'Wall outlet', [['none', 'None'], ['yes', 'Add one']]),
      N('wox', 'Wall outlet from left wall', 'Distance to the outlet center', (D) => D.wo === 'yes'),
      N('woh', 'Wall outlet height', '', (D) => D.wo === 'yes'),
    ],
  },
];

export const FIELDS: Record<string, Field> = {};
SECTIONS.forEach((s) => s.fields.forEach((f) => (FIELDS[f.id] = f)));
FIELDS.has = { t: 'has', id: 'has', label: 'What’s going on this wall?' };
(FIELDS.preset as ChoiceField).hint = (D) => PDESC[D.preset ?? ''] || '';

/** Things that can go on the wall besides the vanity. The toilet comes from the floor plan. */
export const HAS: [string, string, (D: VanityD) => boolean, (D: VanityD, on: boolean) => void][] = [
  ['cab', 'Storage cabinet', (D) => D.cab === 'yes', (D, on) => void (D.cab = on ? 'yes' : 'none')],
  ['mir', 'Mirror or medicine cabinet', (D) => D.mir !== 'none', (D, on) => void (D.mir = on ? (D.mir === 'none' ? 'mirror' : (D.mir ?? 'mirror')) : 'none')],
  ['lt', 'Lights', (D) => D.lt !== 'none', (D, on) => void (D.lt = on ? (D.lt === 'none' ? 'bar' : (D.lt ?? 'bar')) : 'none')],
  ['rec', 'Vanity outlet', (D) => D.rec !== 'none', (D, on) => void (D.rec = on ? (D.rec === 'none' ? 'R' : (D.rec ?? 'R')) : 'none')],
  ['bid', 'Bidet outlet', (D) => D.bid === 'yes', (D, on) => void (D.bid = on ? 'yes' : 'none')],
  ['wo', 'Wall outlet', (D) => D.wo === 'yes', (D, on) => void (D.wo = on ? 'yes' : 'none')],
];

export interface Step {
  t: string;
  p?: string;
  show?: Show;
  f: string[];
}

export const STEPS: Step[] = [
  { t: 'Who is this bathroom for?', p: 'This sets starting heights and what the checks aim for. Any number can still be changed later.', f: ['preset'] },
  { t: 'What’s on this wall?', p: 'The vanity or sink is always included, and a toilet on this wall comes from the floor plan. Pick everything else that goes on this wall.', f: ['has'] },
  { t: 'The wall', p: 'Width and ceiling come from the floor plan. Studs and finish are shared with the floor plan’s framing.', f: ['wall', 'ceil', 'studd', 'wfin', 'wallc', 'stud'] },
  { t: 'Toilet', show: (D) => D.wc !== 'none', p: 'The flange usually decides where everything else on this wall goes. Its place comes from the floor plan.', f: ['wcmove', 'wcx', 'wcri', 'wcseat', 'wct', 'wch', 'wcs'] },
  { t: 'Sink plumbing', p: 'If the drain is staying, its location may set the sink centerline.', f: ['plumb', 'exdx', 'drain', 'sup', 'spread'] },
  { t: 'Vanity or sink', f: ['sink', 'vw', 'vd', 'pw', 'pd', 'prim', 'ctr', 'bs', 'sinks', 'space', 'vh', 'vpos', 'vside', 'vref', 'voff'] },
  { t: 'Faucet', f: ['fau', 'fh', 'spout', 'freach'] },
  { t: 'Mirror or medicine cabinet', show: (D) => D.mir !== 'none', f: ['mir', 'mm', 'mw', 'mh', 'mro', 'mroh', 'mcd', 'mrd', 'place', 'mc', 'mt', 'fgap'] },
  { t: 'Lights and outlets', show: (D) => D.lt !== 'none' || D.rec !== 'none' || D.bid === 'yes' || D.wo === 'yes', f: ['lt', 'lbkeep', 'lbx', 'lbh', 'lw', 'lh', 'lgap', 'ldp', 'sw', 'sh', 'sgap', 'saff', 'sdp', 'rec', 'rech', 'bid', 'bidx', 'bidh', 'wo', 'wox', 'woh'] },
  { t: 'Storage cabinet', show: (D) => D.cab === 'yes', f: ['cab', 'cabsnap', 'cabx', 'cabw', 'cabface', 'cabd', 'cabh', 'cabb', 'cabn'] },
];

/** Fields whose values live on the shared record and can't be changed on this screen. */
export const READ_ONLY = new Set(['wall', 'ceil']);
