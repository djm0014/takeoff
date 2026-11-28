# Tile looks: auto mode rules

From the owner's questionnaire answers (Nov 28, 2026). This is the spec the
auto mode is built from. Items marked **Open** still need an answer.

## How it works (style first, Nov 28)

- "The tiles are ordered to look and feel the classic, balanced, and organic
  styles. then the niche goes in. the rule makes the style after all. we just
  need to make the niche fit." The **Style** is the first question on the Tile
  step: Classic, Balanced, Organic, and Simple for a niche bound by studs
  (between existing studs, or a prefab). The pattern choices are the ones the
  style allows.
- The results open on that style's layout, already applied: the best layout
  that keeps the style's rules, with the niche fitted to it. The Style card at
  the top switches style; Organic has **Shuffle the offsets**.
- When a wall can't keep every rule in that style, it shows the closest fit
  and names the rules it breaks.
- Any change after that shows **Modified Classic**, with **Back to Classic**.
- A niche bound by studs stays in its bay whatever the style; on new blocking
  it's centered on the wall.
- The style's name prints on the sheets.
- Walls laid out before the style question keep their layout until a style
  is picked.

## Rules every look keeps

| Rule | Value |
| --- | --- |
| Corner pieces (both ends, every row) | at least a quarter of the tile length. Both corners count; most are seen |
| Niche top and bottom | on a grout joint, or a full tile; no strips above or below. Every look snaps them there, moving the sill or head block of an already-framed niche if it has to (the card says "reframe: head block 3/8″ down") |
| Niche sides | slivers allowed (not a priority) |
| Top course at the ceiling | at least half the tile height |
| Bottom course on the tub or shower pan | full tile preferred; may be cut down to 3/4 of the tile height when that brings the ceiling course to at least half |
| Splitting a sliver with the next tile | not used |
| Grout joint | may change between 1/16″ and 3/16″ to make a look work, **unless the tile is marked "joint fixed"** (handmade / zellige, stacked with a minimal joint) |
| Niche sill (bottom), AFF | 40″ to 52″, aim for 42″ to 48″ |
| Niche height | whole courses; width free. Sizes from the setup and the shape buttons are **targets, not limits**: the niche grows or shrinks to land its sill and head on grout lines (owner, Nov 28) |
| Niche clear space | every bay (above and below a shelf too) at least 10″ tall: shampoo bottles |
| Niche depth | stud depth (deeper when nothing is behind the wall: later) |
| Blocking | new blocking always allowed (walls are opened) |
| Niche wider than one stud bay | cut the stud, add a header |

## What to expect

Checked over every wall width from 48″ to 72″ (1/16″ steps), 12″ and 24″ tile:

- **Classic in half bond** fits about half of wall widths. Perfect symmetry
  fixes where the field lands, and with half bond the two kinds of rows end
  half a tile apart, so one of them is under a quarter tile on about half of
  walls. Changing the grout from 1/16″ to 3/16″ only helps a few more walls
  (50% → 52–56%): over a 5′ wall it moves the field less than 1″.
- **Classic stacked** fits every width (tile or joint on center covers it).
- So on many walls the cards will be Classic (stacked), Balanced and Offset,
  with Classic in half bond missing. That's the rules working, not a bug.

## Looks

| Look | Pattern | Niche | Layout line | Corners |
| --- | --- | --- | --- | --- |
| **Classic** | running bond (half bond), any tile size: the familiar subway pattern | centered on the wall (new blocking) | centered; moves up to a quarter tile where that keeps slivers off the corners | a quarter tile or more (equal both ends preferred) |
| **Balanced** | stacked by default (an even grid), or a 1/3 or 1/4 offset; never running bond | centered on the wall (new blocking) | centered; moves up to a quarter tile if needed | a quarter tile or more (equal both ends preferred) |
| **Organic** | random-looking (no repeating step), or a 1/4 offset (Nov 28: "set the smallest of organic to 2″ and allow a 4th step"): each course's joints at least 2″ from the course below; a joint may line up with the one two courses up; long tile (over 18″) steps no more than 1/3 of the tile; corners a quarter tile or more. Shuffle picks another arrangement. The layout sheet lists each course's left piece | anywhere its top and bottom land best on grout lines; edges line up with tile joints | free | at least a quarter tile |
| **Simple** (only for a niche bound by studs) | the planner's best | in the existing stud bay closest to center | free | at least a quarter tile |

Simple is the budget option: less planning, the tile lines up as it falls.
A linear niche is wider than a bay, so it isn't Simple.

## Niche shapes

| Shape | Finished size (W × H) | Notes |
| --- | --- | --- |
| Square | about 14 × 14 | |
| Tall | 12–15 × about 28 | shelf: asked in the setup |
| Linear | 26–32 × 10–12 | wider than tall; at least 10″ tall; top and bottom on grout lines; wider than a bay → header |

Shelves are asked in the setup. An accent tile on the niche's back wall is a
design option (later).

## Answered (Nov 28, 2026)

1. A niche never goes above or below a valve, so Classic centers it on the wall.
2. Random-looking: rows step at least 4″; a joint may line up two rows up;
   long tile steps no more than 1/3.
3. Grout 1/16″ to 3/16″.
4. Balanced may use 1/4 offset.
5. "Fit the framing" is called **Simple**.
6. A shower pan follows the same bottom-course rule as a tub.

## Build steps

1. Look cards for Classic, Balanced and Simple; niche shapes; grout; Modified
   label; name on the sheets. **Built** (`src/tile/looks.ts`, Nov 28).
2. Offset with the random-looking pattern.
3. Later: accent back wall, deeper niche, client questionnaire.

## Notes from building step 1

- Looks don't fight for the niche sides (your answer: sides don't matter).
  The Cuts list still shows a thin piece beside the niche, marked "Allowed".
- When a look gives the same layout as another, its card says "same as
  Classic on this wall".
- Simple uses the stud bay nearest the wall's middle, from the studs on the
  Build-up step (new framing: 16″ on center from the left corner).
- The cards show first; nothing changes until you tap one.

## Prefabricated niche (Nov 28)

- Fixed size: entered by its inside opening, the lip the tile butts to (0 when
  it sits flush with the 1/2″ board, like Schluter KERDI-BOARD-SN; up to 1″
  for a framed lip) and the rough opening it needs. Framed 1/16″ larger on
  every side. Not tiled inside.
- Its bottom (where the tile stops) lands on a grout line; the head lands
  where its height puts it. Looks only move it by whole courses.
- Simple puts it centered in your stud bay; Classic and Balanced center it on
  the wall with new blocking. No niche-shape buttons.

## Organic: what to expect (Nov 28)

- Random offsets: each course steps 2″ or more from the one below (a third of
  the tile for tile under 6″), and long tile no more than a third.
- 1/4 offset can keep corner pieces of a quarter tile on only some wall
  widths (about 1 in 5 with 12″ tile, 1 in 25 with 24″ tile): its four kinds
  of courses end a quarter tile apart. When it can't, Organic uses random
  offsets and the Style card says so.

## Every wall gets every style (Nov 28)

"I think every wall should be able to portray each of the looks... the
classic look is simply a running bond with whatever tile size... for tiles
that have no variation in course, I think we should call that a stacked
pattern. but I don't necessarily know if balanced is always stacked."

- Each style keeps to its own patterns and never borrows another's, so the
  styles always look different: Classic running bond; Balanced stacked (or
  1/3, 1/4 offset if picked); Organic random (or 1/4 offset); Simple any.
- Classic no longer insists on equal corners (that made it fail on half of
  walls and fall back to stacked, the same as Balanced). It prefers equal
  corners and moves the tile up to a quarter tile when it has to.
- Checked on every wall width from 44″ to 72″ with 3×12, 4×12 and 6×24 tile:
  Classic, Balanced and Organic each keep every rule in their own pattern.
