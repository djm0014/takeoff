/**
 * Bathroom Key Dimensions, mirrored from docs/key-dimensions.xlsx.
 * Generated once from the sheet; edit this file and the sheet together.
 *
 * Each row has a stable `key`. When a screen's checks are rebuilt, they read
 * their numbers from here (adding numeric fields such as `min` or `max` to the
 * rows they use), so a number changes in one place.
 */

export type Basis = 'Code' | 'ADA' | 'Guideline' | 'Trade typical';

export interface KeyDimension {
  key: string;
  category: string;
  item: string;
  /** The value as written on the sheet, e.g. "15″ min". */
  value: string;
  basis: Basis;
  source: string;
  notes: string;
}

export const KEY_DIMENSIONS_NOTE =
  "Key bathroom dimensions. Code values are model-code minimums (IRC, NEC); your local adopted edition and amendments govern. ADA values are for accessible and aging-in-place work; most private homes don't require them.";

export const KEY_DIMENSIONS: readonly KeyDimension[] = [
  {"key": "toilet/centerline-to-side-wall-or-obstruction", "category": "Toilet", "item": "Centerline to side wall or obstruction", "value": "15″ min", "basis": "Code", "source": "IRC P2705.1", "notes": "Counts walls, vanities, tubs and partitions."},
  {"key": "toilet/centerline-to-side-wall-comfortable", "category": "Toilet", "item": "Centerline to side wall, comfortable", "value": "18″", "basis": "Guideline", "source": "NKBA", "notes": ""},
  {"key": "toilet/clear-floor-in-front-of-bowl", "category": "Toilet", "item": "Clear floor in front of bowl", "value": "21″ min", "basis": "Code", "source": "IRC P2705.1", "notes": "From the front of the bowl to any wall, fixture or door."},
  {"key": "toilet/clear-floor-in-front-comfortable", "category": "Toilet", "item": "Clear floor in front, comfortable", "value": "30″", "basis": "Guideline", "source": "NKBA", "notes": ""},
  {"key": "toilet/adjacent-fixtures-center-to-center", "category": "Toilet", "item": "Adjacent fixtures, center to center", "value": "30″ min", "basis": "Code", "source": "IRC P2705.1", "notes": ""},
  {"key": "toilet/separate-toilet-compartment", "category": "Toilet", "item": "Separate toilet compartment", "value": "30″ wide × 60″ deep min", "basis": "Code", "source": "IPC 405.3.1", "notes": "NKBA suggests 36″ × 66″."},
  {"key": "toilet/flange-rough-in-from-finished-wall", "category": "Toilet", "item": "Flange rough-in from finished wall", "value": "12″ typical", "basis": "Trade typical", "source": "", "notes": "10″ and 14″ exist, mostly in older homes."},
  {"key": "toilet/supply-stop", "category": "Toilet", "item": "Supply stop", "value": "About 8″ AFF, up to 6″ left of centerline", "basis": "Trade typical", "source": "", "notes": "Check the toilet's spec sheet."},
  {"key": "toilet/seat-height-comfort-height", "category": "Toilet", "item": "Seat height (comfort height)", "value": "17–19″ to top of seat", "basis": "ADA", "source": "ADA 604.4", "notes": "Standard bowls are about 15″. Accessible dwelling units may use 15–19″."},
  {"key": "toilet/accessible-centerline-from-side-wall", "category": "Toilet", "item": "Accessible centerline from side wall", "value": "16–18″", "basis": "ADA", "source": "ADA 604.2", "notes": ""},
  {"key": "toilet/accessible-clear-floor-at-toilet", "category": "Toilet", "item": "Accessible clear floor at toilet", "value": "60″ wide × 56″ deep min", "basis": "ADA", "source": "ADA 604.3", "notes": "ICC A117.1 uses 59″ deep for floor-mounted toilets."},
  {"key": "toilet/toilet-paper-holder-accessible", "category": "Toilet", "item": "Toilet paper holder, accessible", "value": "7–9″ in front of bowl to holder center; outlet 15–48″ AFF", "basis": "ADA", "source": "ADA 604.7", "notes": ""},
  {"key": "toilet/toilet-paper-holder-homes", "category": "Toilet", "item": "Toilet paper holder, homes", "value": "8–12″ in front of bowl, about 26″ AFF", "basis": "Guideline", "source": "NKBA", "notes": ""},
  {"key": "grab-bars/bar-height", "category": "Grab bars", "item": "Bar height", "value": "33–36″ AFF to top of bar", "basis": "ADA", "source": "ADA 609.4", "notes": "Horizontal bars in one shower sit at the same height."},
  {"key": "grab-bars/bar-diameter", "category": "Grab bars", "item": "Bar diameter", "value": "1 1/4–2″", "basis": "ADA", "source": "ADA 609.2.1", "notes": "Most bars are 1 1/4″ or 1 1/2″."},
  {"key": "grab-bars/space-between-bar-and-wall", "category": "Grab bars", "item": "Space between bar and wall", "value": "1 1/2″", "basis": "ADA", "source": "ADA 609.3", "notes": ""},
  {"key": "grab-bars/clear-space-above-bar", "category": "Grab bars", "item": "Clear space above bar", "value": "12″ min to anything projecting", "basis": "ADA", "source": "ADA 609.3", "notes": "1 1/2″ is allowed to shower controls and other bars."},
  {"key": "grab-bars/toilet-side-wall-bar", "category": "Grab bars", "item": "Toilet side wall bar", "value": "42″ long min, 12″ max from rear wall, reaching 54″ min from rear wall", "basis": "ADA", "source": "ADA 604.5.1", "notes": ""},
  {"key": "grab-bars/toilet-rear-wall-bar", "category": "Grab bars", "item": "Toilet rear wall bar", "value": "36″ long min: 12″ min one side of centerline, 24″ min the other", "basis": "ADA", "source": "ADA 604.5.2", "notes": "Longer side toward the open side."},
  {"key": "grab-bars/tub-back-wall", "category": "Grab bars", "item": "Tub back wall", "value": "Two bars: one at 33–36″ AFF, one 8–10″ above the tub rim", "basis": "ADA", "source": "ADA 607.4", "notes": ""},
  {"key": "grab-bars/tub-control-end-wall", "category": "Grab bars", "item": "Tub control end wall", "value": "24″ long min, at the front edge of the tub", "basis": "ADA", "source": "ADA 607.4", "notes": ""},
  {"key": "grab-bars/tub-head-end-wall", "category": "Grab bars", "item": "Tub head end wall", "value": "12″ long min, at the front edge of the tub", "basis": "ADA", "source": "ADA 607.4.2", "notes": "Tubs without a permanent seat."},
  {"key": "grab-bars/transfer-shower-36-36", "category": "Grab bars", "item": "Transfer shower (36″ × 36″)", "value": "Across the control wall and the back wall, to 18″ from the control wall", "basis": "ADA", "source": "ADA 608.3.1", "notes": ""},
  {"key": "grab-bars/roll-in-shower", "category": "Grab bars", "item": "Roll-in shower", "value": "Within 6″ of adjacent walls; three walls if no seat", "basis": "ADA", "source": "ADA 608.3.2", "notes": "With a seat: back wall and the wall opposite the seat."},
  {"key": "grab-bars/blocking-in-homes", "category": "Grab bars", "item": "Blocking in homes", "value": "Block the walls so bars can be added later", "basis": "ADA", "source": "ADA 604.5 exception", "notes": "Lets a home skip the bars now. Cover the 33–36″ heights and the tub's low bar."},
  {"key": "sink/sink-centerline-to-side-wall", "category": "Sink", "item": "Sink centerline to side wall", "value": "15″ min", "basis": "Code", "source": "IRC P2705.1", "notes": "Some jurisdictions don't apply this to vanity sinks; check locally."},
  {"key": "sink/sink-centerline-to-side-wall-comfortable", "category": "Sink", "item": "Sink centerline to side wall, comfortable", "value": "20″", "basis": "Guideline", "source": "NKBA", "notes": ""},
  {"key": "sink/clear-floor-in-front", "category": "Sink", "item": "Clear floor in front", "value": "21″ min", "basis": "Code", "source": "IRC P2705.1", "notes": ""},
  {"key": "sink/clear-floor-in-front-comfortable", "category": "Sink", "item": "Clear floor in front, comfortable", "value": "30″", "basis": "Guideline", "source": "NKBA", "notes": ""},
  {"key": "sink/double-sinks-center-to-center", "category": "Sink", "item": "Double sinks, center to center", "value": "30″ min; 30–36″ comfortable", "basis": "Guideline", "source": "NKBA", "notes": "30″ is also the code minimum between adjacent fixtures."},
  {"key": "sink/vanity-or-counter-height", "category": "Sink", "item": "Vanity or counter height", "value": "32–36″ common; 34–36″ comfort height", "basis": "Guideline", "source": "NKBA", "notes": "NKBA allows 32–43″ to fit the user."},
  {"key": "sink/accessible-sink-height", "category": "Sink", "item": "Accessible sink height", "value": "34″ max to rim or counter, whichever is higher", "basis": "ADA", "source": "ADA 606.3", "notes": ""},
  {"key": "sink/accessible-knee-clearance", "category": "Sink", "item": "Accessible knee clearance", "value": "27″ high min, 8″ deep min from the front edge", "basis": "ADA", "source": "ADA 306", "notes": ""},
  {"key": "sink/drain-stub", "category": "Sink", "item": "Drain stub", "value": "18–20″ AFF", "basis": "Trade typical", "source": "", "notes": "Check pedestal and wall-hung sink specs."},
  {"key": "sink/supply-stubs", "category": "Sink", "item": "Supply stubs", "value": "20–22″ AFF, 4″ each side of centerline (8″ apart)", "basis": "Trade typical", "source": "", "notes": "Some set them 22–24″."},
  {"key": "sink/accessible-mirror", "category": "Sink", "item": "Accessible mirror", "value": "Bottom of the glass 40″ max AFF over the sink", "basis": "ADA", "source": "ADA 603.3", "notes": ""},
  {"key": "shower/minimum-size", "category": "Shower", "item": "Minimum size", "value": "900 sq in and 30″ min each way", "basis": "Code", "source": "IRC P2708.1", "notes": "Measured to finished surfaces. UPC areas require 1,024 sq in and a 30″ circle."},
  {"key": "shower/comfortable-size", "category": "Shower", "item": "Comfortable size", "value": "36″ × 36″", "basis": "Guideline", "source": "NKBA", "notes": ""},
  {"key": "shower/door-or-entry-clear-width", "category": "Shower", "item": "Door or entry clear width", "value": "22″ min", "basis": "Code", "source": "IRC P2708.1", "notes": "Hinged shower doors swing out."},
  {"key": "shower/clear-floor-in-front-of-opening", "category": "Shower", "item": "Clear floor in front of opening", "value": "24″ min", "basis": "Code", "source": "IRC R307.1", "notes": ""},
  {"key": "tub/clear-floor-in-front-of-tub", "category": "Tub", "item": "Clear floor in front of tub", "value": "21″ min; 30″ comfortable", "basis": "Guideline", "source": "Common practice", "notes": "Confirm locally."},
  {"key": "shower/ceiling-over-showerhead", "category": "Shower", "item": "Ceiling over showerhead", "value": "6′8″ min over a 30″ × 30″ area", "basis": "Code", "source": "IRC R305.1", "notes": ""},
  {"key": "shower/floor-slope-to-drain", "category": "Shower", "item": "Floor slope to drain", "value": "1/4–1/2″ per foot", "basis": "Code", "source": "IRC P2709.1", "notes": ""},
  {"key": "shower/curb-height-above-drain", "category": "Shower", "item": "Curb height above drain", "value": "2″ min, 9″ max", "basis": "Code", "source": "IRC P2709.1", "notes": "Threshold also sits at least 1″ below the sides and back."},
  {"key": "shower/pan-liner-slope", "category": "Shower", "item": "Pan liner slope", "value": "1/4″ per foot to the weep holes", "basis": "Code", "source": "IRC P2709", "notes": ""},
  {"key": "shower/shower-valve-stall", "category": "Shower", "item": "Shower valve (stall)", "value": "48″ AFF typical (38–48″)", "basis": "Trade typical", "source": "", "notes": ""},
  {"key": "shower/showerhead-arm", "category": "Shower", "item": "Showerhead arm", "value": "About 80″ AFF (72–80″)", "basis": "Trade typical", "source": "", "notes": ""},
  {"key": "tub/tub-shower-valve", "category": "Tub", "item": "Tub/shower valve", "value": "About 28″ AFF", "basis": "Trade typical", "source": "", "notes": "Or follow the valve spec's spout-to-valve distance."},
  {"key": "tub/tub-spout", "category": "Tub", "item": "Tub spout", "value": "About 4″ above the tub rim", "basis": "Trade typical", "source": "", "notes": "Must sit above the flood rim."},
  {"key": "shower/accessible-shower-controls", "category": "Shower", "item": "Accessible shower controls", "value": "Above the grab bar, 48″ max AFF", "basis": "ADA", "source": "ADA 608.5", "notes": ""},
  {"key": "shower/accessible-shower-seat", "category": "Shower", "item": "Accessible shower seat", "value": "17–19″ AFF", "basis": "ADA", "source": "ADA 610.3", "notes": ""},
  {"key": "glass/safety-glazing-near-tub-or-shower", "category": "Glass", "item": "Safety glazing near tub or shower", "value": "Glass under 60″ above the standing surface and within 60″ of the water's edge", "basis": "Code", "source": "IRC R308.4.5", "notes": ""},
  {"key": "electrical/sink-receptacle", "category": "Electrical", "item": "Sink receptacle", "value": "Within 3′ of the outside edge of each basin", "basis": "Code", "source": "NEC 210.52(D)", "notes": "One outlet between two sinks can serve both if within 3′ of each."},
  {"key": "electrical/receptacle-circuit", "category": "Electrical", "item": "Receptacle circuit", "value": "20A, bathroom receptacles only", "basis": "Code", "source": "NEC 210.11(C)(3)", "notes": ""},
  {"key": "electrical/gfci", "category": "Electrical", "item": "GFCI", "value": "All bathroom receptacles", "basis": "Code", "source": "NEC 210.8(A)(1)", "notes": ""},
  {"key": "electrical/receptacles-near-tub-or-shower", "category": "Electrical", "item": "Receptacles near tub or shower", "value": "None within 3′ horizontally of the tub or shower", "basis": "Code", "source": "NEC 406.9(C)", "notes": "2023 NEC; small-room exceptions."},
  {"key": "electrical/hanging-lights-and-fans-near-tub-or-shower", "category": "Electrical", "item": "Hanging lights and fans near tub or shower", "value": "None within 3′ horizontally and 8′ above the rim or threshold", "basis": "Code", "source": "NEC 410.10(D)", "notes": "Fixtures over the tub or shower within 8′ must be damp- or wet-rated."},
  {"key": "room/ceiling-height", "category": "Room", "item": "Ceiling height", "value": "6′8″ min", "basis": "Code", "source": "IRC R305.1", "notes": ""},
  {"key": "room/exhaust-fan", "category": "Room", "item": "Exhaust fan", "value": "50 CFM intermittent or 20 CFM continuous min", "basis": "Code", "source": "IRC R303.3, M1505.4.4", "notes": "Vent to the outdoors."},
  {"key": "room/fan-sizing", "category": "Room", "item": "Fan sizing", "value": "About 1 CFM per sq ft (8′ ceiling)", "basis": "Guideline", "source": "HVI", "notes": "Over 100 sq ft, size by fixture count."},
  {"key": "room/entry-door", "category": "Room", "item": "Entry door", "value": "32″ wide or more", "basis": "Guideline", "source": "NKBA", "notes": ""},
  {"key": "room/walkway-behind-someone-at-a-fixture", "category": "Room", "item": "Walkway behind someone at a fixture", "value": "48″ (18″ user + 30″ to pass)", "basis": "Guideline", "source": "NKBA", "notes": ""},
  {"key": "room/accessible-turning-space", "category": "Room", "item": "Accessible turning space", "value": "60″ circle or T-turn", "basis": "ADA", "source": "ADA 603.2.1", "notes": ""},
];

const BY_KEY = new Map(KEY_DIMENSIONS.map((d) => [d.key, d]));

/** Look up a row by key. Throws on a typo so a missing rule never passes silently. */
export function keyDimension(key: string): KeyDimension {
  const d = BY_KEY.get(key);
  if (!d) throw new Error(`Unknown key dimension: ${key}`);
  return d;
}
