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
- [x] Taps on items didn't register until a field had been used (iPhone
  Safari). Fixed; first tap works.
- [x] **Tap selects instead of opening the number pad** (Nov 25). Tapping an
  item or a wall (or its number) in the drawing turns it orange and brings its
  card or row to the top of the fields, name first, outlined in orange. Tap a
  field to change a number. Walls weren't tappable in the drawing before.
- [ ] The Dims and Build buttons can sit on top of the top dimension string.
  Keep the drawing clear of them, or move them.
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

## Vanity wall (Milestone 3)

From building it (Nov 26, 2026):

- [ ] Build mode and a dims toggle on the wall screen, like the floor plan: in
  landscape the elevation is limited by height.
- [ ] A vanity added from the wall screen is "new", so the floor plan shows it
  in the Design view, not Existing. Consider asking existing or new.
- [ ] Section at the sink left out for now (by request).
- [ ] The old tool's per-wall "toilet measured from the right wall" choice is
  gone: the toilet comes from the floor plan, measured from the left corner.

Idea (Nov 25, 2026):

- [ ] **Item details and product link.** Double-tap (or long press, or an ⓘ on
  the item's card) opens one item on its own: its size, height AFF and rough-in
  numbers, plus a product link, model number, notes, and an attached spec
  sheet or photo kept on the phone with the job. Key spec numbers (rough opening
  W × H, recess depth) are typed in; the app can't read them off a
  manufacturer's site. Phones use double-tap to zoom, so the drawing would turn
  that off.
- [ ] **Check a recessed medicine cabinet against the studs.** With its rough
  opening stored, check it on the wall's stud layout: fits the stud bay, or
  needs a stud cut with a header and cripples, and where the bottom lands AFF.

## 3D and presentation (future milestone, after Survey, before Takeoffs)

Discussed Nov 27, 2026. For showing clients the design.

- [ ] **3D view in the web app.** A third view beside the floor plan and the
  walls, built from the job record we already have: walls raised to the
  ceiling height from the walked room, doors, windows and fixtures placed from
  the floor plan, heights from the vanity wall (counter, mirror, cabinet,
  lights). Clean "white model" look; orbit around it with a finger. Uses
  three.js, which runs well in iPhone Safari. Small rooms are an easy load.
- [ ] **View in AR, no app needed.** Export the model as USDZ (three.js can) and
  open it in iPhone AR Quick Look: the new vanity shows in the real room through
  the camera, at full scale.
- [ ] **Materials and finishes** for presentations: tile, vanity color, wood,
  glass. Not photo-realistic rendering (heavy for a phone, little gain).
- [ ] **Fixture models**: simple stand-ins sized to the job's numbers first.
  Exact product models (manufacturer 3D files) later, if worth collecting.

Limits: photo-real renders, exact product libraries, and battery/heat with long
3D sessions. LiDAR room scanning (Apple RoomPlan) and Bluetooth laser measures
on iPhone need an App Store app; a web page can't use them.

**If it goes to the App Store later:** keep the TypeScript code and wrap it with
**Capacitor** (a native app shell around the web app, with plugins for LiDAR
scanning, Bluetooth laser measures, files and camera). No language change or
rewrite. React Native or Flutter would mean a rewrite; native Swift only makes
sense for an AR-first, iPhone-only product. The code is already set up for it:
layout math and drawings are separate from the screens, and storage sits behind
one module. The App Store also needs an Apple Developer account ($99/yr), a Mac
with Xcode or a cloud build service, Apple's review, a privacy policy, and a
separate Android listing if wanted.

## App

- [ ] Custom domain for the site.

## Open questions (from the plan)

- [ ] More than one bathroom per job: one job with several rooms, or one job per bathroom?
- [ ] Is an estimate or price a separate record, or part of the job?
- [ ] Does the contractor see the same app, or a read-only report and sheets?
- [ ] Furring and tub-fit behavior in the tile screen needs the field rules worked out.
