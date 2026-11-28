# Tile looks: auto mode rules

From the owner's questionnaire answers (Nov 28, 2026). This is the spec the
auto mode is built from. Items marked **Open** still need an answer.

## How it works

- The Tile tab's results open in **Auto**: a card for every look on every
  wall (changed Nov 28: "all walls should have all options except for the
  Simple look"). When a wall can't keep every rule, the card shows the
  closest layout and says which rule it breaks.
- **Simple** shows only when the niche goes between studs: the setup's "It
  must fit an existing stud bay", in the bay you measured.
- Each card is the best layout for the wall that keeps that look's rules,
  with the planner's own fixes (moving the layout line, picking tile or joint
  on center, sizing the niche, adjusting the grout) applied by itself.
- Tapping a card opens it in today's screen. Any change after that marks it
  **Modified**, e.g. "Modified Classic".
- The look's name prints on the sheets.
- A look suggests a niche shape; you can change it.
- Later, parts of this may become a questionnaire the client fills in early
  on, so names and descriptions should read well to a client.

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
| **Classic** (symmetrical) | half bond or stacked | centered on the wall (a niche never goes above or below a valve) | tile or joint on center, whichever cuts better; never moved off center | exactly equal both ends |
| **Balanced** | half bond, stacked or 1/4 offset | stays centered; only the tile moves | may move up to a quarter tile off center | at least a quarter tile |
| **Offset** | random-looking (no repeating step): each row at least 4″ from the row below; a joint may line up with the one two rows up; long tile (over 18″) steps no more than 1/3 of the tile | anywhere its top and bottom land best on grout lines; edges line up with tile joints | free | at least a quarter tile |
| **Simple** (fits the framing) | the planner's best | in the existing stud bay closest to center | free | at least a quarter tile |

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
