/**
 * Doors, windows and fixtures on the floor plan: their fields, defaults and
 * footprints. Fields and defaults match the old Bathroom Floor Plan tool.
 *
 * Every item is stored the same way (position, width, depth along its wall);
 * the fields here translate to and from what you measure in the field, like a
 * toilet's centerline or a door's leaf size.
 */
import { newId, type Id, type Item, type ItemStatus } from '../data/model';

export const PLAN_ITEM_TYPES = ['door', 'window', 'tub', 'shower', 'toilet', 'vanity'] as const;
export type PlanItemType = (typeof PLAN_ITEM_TYPES)[number];

export const ITEM_NAMES: Record<PlanItemType, string> = {
  door: 'Door',
  window: 'Window',
  tub: 'Tub',
  shower: 'Shower',
  toilet: 'Toilet',
  vanity: 'Vanity',
};

export const isPlanItem = (it: Item): it is Item & { type: PlanItemType } =>
  (PLAN_ITEM_TYPES as readonly string[]).includes(it.type);
export const isFixture = (it: Item): boolean => ['tub', 'shower', 'toilet', 'vanity'].includes(it.type);
export const isOpening = (it: Item): boolean => it.type === 'door' || it.type === 'window';

/** Toilet footprint: 20″ wide tank, bowl reaching rough-in + 17″ from the wall. */
export const TOILET_WIDTH = 20;
export const TOILET_REACH = 17;
/** A door's opening is the leaf plus 3/4″ jambs each side. */
export const DOOR_JAMBS = 1.5;

export interface NumberField {
  key: string;
  label: string;
  get(it: Item): number;
  set(it: Item, v: number): void;
}
export interface ChoiceField {
  key: string;
  label: string;
  options: [string, string][];
  get(it: Item): string;
  set(it: Item, v: string): void;
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

const position: NumberField = {
  key: 'position',
  label: 'From left corner',
  get: (it) => it.position,
  set: (it, v) => (it.position = v),
};
const width = (label: string): NumberField => ({
  key: 'width',
  label,
  get: (it) => it.width,
  set: (it, v) => (it.width = v),
});
const depth: NumberField = { key: 'depth', label: 'Depth', get: (it) => it.depth, set: (it, v) => (it.depth = v) };

export const doorSize = (it: Item) => num(it.props.size, it.width - DOOR_JAMBS);
export const roughIn = (it: Item) => num(it.props.roughIn, 12);
export const toiletCenter = (it: Item) => it.position + it.width / 2;

export const NUMBER_FIELDS: Record<PlanItemType, NumberField[]> = {
  door: [
    { ...position, label: 'Jamb from left corner' },
    {
      key: 'size',
      label: 'Door size',
      get: doorSize,
      set: (it, v) => {
        it.props.size = v;
        it.width = v + DOOR_JAMBS;
      },
    },
  ],
  window: [{ ...position, label: 'Opening from left corner' }, width('Opening width')],
  tub: [position, width('Length'), depth],
  shower: [position, width('Width'), depth],
  toilet: [
    {
      key: 'center',
      label: 'Centerline from left corner',
      get: toiletCenter,
      set: (it, v) => (it.position = v - it.width / 2),
    },
    {
      key: 'roughIn',
      label: 'Rough-in from wall',
      get: roughIn,
      set: (it, v) => {
        it.props.roughIn = v;
        it.depth = v + TOILET_REACH;
      },
    },
  ],
  vanity: [position, width('Width'), depth],
};

const prop = (key: string, label: string, options: [string, string][], dflt: string): ChoiceField => ({
  key,
  label,
  options,
  get: (it) => (typeof it.props[key] === 'string' ? (it.props[key] as string) : dflt),
  set: (it, v) => (it.props[key] = v),
});

export const CHOICE_FIELDS: Record<PlanItemType, ChoiceField[]> = {
  door: [
    prop('hinge', 'Hinge side', [['left', 'Left'], ['right', 'Right']], 'left'),
    prop('swing', 'Swings', [['in', 'In'], ['out', 'Out']], 'in'),
  ],
  window: [],
  tub: [prop('drain', 'Drain end', [['left', 'Left'], ['right', 'Right']], 'left')],
  shower: [],
  toilet: [],
  vanity: [],
};

/** A new item with the old tool's defaults. */
export function newPlanItem(type: PlanItemType, wallId: Id, status: ItemStatus): Item {
  const base: Item = {
    id: newId(),
    wallId,
    type,
    status,
    position: 0,
    width: 0,
    depth: 0,
    height: null,
    elevation: null,
    label: '',
    props: {},
  };
  switch (type) {
    case 'door':
      return { ...base, position: 6, width: 30 + DOOR_JAMBS, props: { size: 30, hinge: 'left', swing: 'in' } };
    case 'window':
      return { ...base, position: 12, width: 30 };
    case 'tub':
      return { ...base, position: 0, width: 60, depth: 30, props: { drain: 'left' } };
    case 'shower':
      return { ...base, position: 0, width: 36, depth: 36 };
    case 'toilet':
      return { ...base, position: 18 - TOILET_WIDTH / 2, width: TOILET_WIDTH, depth: 12 + TOILET_REACH, props: { roughIn: 12 } };
    case 'vanity':
      return { ...base, position: 0, width: 30, depth: 21 };
  }
}

/** Footprint in wall-local coordinates: [u0, u1, v0, v1]. */
export function span(it: Item): [number, number, number, number] {
  return [it.position, it.position + it.width, 0, it.depth];
}

export function itemName(it: Item): string {
  return isPlanItem(it) ? ITEM_NAMES[it.type] : it.type;
}
