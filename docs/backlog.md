# Backlog

Running list of changes to make, from field testing and ideas along the way.
Newest notes at the top of each section. Check items off when they ship.

## Floor plan

Number entry (Nov 25, 2026):

- [x] **App's own number pad** for measurements, so the phone keyboard never
  covers the drawing: digits, eighths (16ths on a toggle), ft, Next, Done.
  The first digit replaces the old value; a fraction keeps the whole inches.
- [x] **Nudge buttons** on the pad for distances: −1″, −1/8″, +1/8″, +1″.
- [ ] Customize the nudge steps (now set in `NUDGES` in `src/lib/keypad.ts`).
- [ ] Bluetooth laser measure (Bosch, Leica) straight into a field. Only
  possible on Android: iPhone browsers don't let web apps use Bluetooth.

From the second phone test (Nov 24, 2026):

- [x] Pinned drawing works as intended so far.
- [x] **Landscape layout.** Drawing on the left filling the height, fields
  scrolling on the right, number pad docked under the fields only. The size
  button switches the drawing between about half and two thirds of the width,
  or hides it.
- [x] **Bigger drawing** (Nov 25): build mode hides the job bar and view tabs
  until you tap Exit; a Dims button turns dimension strings off (wall numbers
  move onto the walls); dimensions take less room when on; items have a
  fingertip-size touch area. Landscape, build mode with dims off draws the
  room about 2.6× the size it was.
- [ ] Taps on items still sometimes don't register. Seen: the first tap after
  opening the screen doesn't select anything; once a wall's field has been
  used, taps work. Likely iPhone Safari ignoring a field opened a moment
  after the tap (fixed to open during the tap; confirm on the phone).
- [x] Fixture labels caught taps, so touching an item on its name did nothing.
  Labels and dimension text now let taps through.
- [x] **Highlight the item being edited in orange,** like the wall. Today an
  item only gets a slightly heavier outline while its fields are in use.
- [x] **Tap an item in the drawing to edit it.** A quick tap (no slide) scrolls
  to that item's fields and puts the cursor in its first one (its distance
  from the left corner), so a known dimension can be typed in. Tap and slide
  keeps dragging it along the wall as now.

From the first phone test (Nov 24, 2026):

- [x] **Keep the drawing in view while editing.** The drawing is pinned under
  the top bar (half screen, bigger, or hidden), the wall or item being edited
  is highlighted, and an arrow shows which way the next wall goes. To check on
  a real phone: the drawing shrinks while the keyboard is up, so the field you're
  typing in stays visible.
- [ ] **Door jamb minimum from a wall.** Set a minimum distance from a corner
  to a door jamb (for trim and the door's swing), and flag doors closer than
  that.
- [ ] **Center things.** Center an item on its wall, or between two things,
  like a pedestal sink centered between a side wall and the toilet.
- [ ] **Make walking the room more intuitive.** It worked but wasn't as
  intuitive as expected. Keep testing with real sketches and note exactly
  where it trips you up (which step, what you expected to happen).

Known from building it:

- [ ] Dimension strings can still crowd at very short walls next to a jog.
- [ ] Angled corners: framing is laid out to the framing faces and flagged to
  check by hand; no corner framing details yet.
- [x] Fractions can't be typed on a phone's number keypad (no `/` key).
  Fixed by the app's own number pad.

## App

- [ ] Custom domain for the site.

## Open questions (from the plan)

- [ ] More than one bathroom per job: one job with several rooms, or one job per bathroom?
- [ ] Is an estimate or price a separate record, or part of the job?
- [ ] Does the contractor see the same app, or a read-only report and sheets?
- [ ] Furring and tub-fit behavior in the tile screen needs the field rules worked out.
