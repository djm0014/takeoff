# Bathroom Tools — notes for Claude

A phone-first field app for bathroom remodel layout, replacing four separate
tools (Claude artifacts) with one app on a shared job record. The owner is a
remodeling carpenter who tests every change on an iPhone in the field.

Read first: `docs/combined-app-plan.md` (goals, scope, milestones),
`docs/backlog.md` (what's left, field-test notes), `README.md` (status).

## Working with the owner

- Plain trade language, no jargon. Measurements always with ″; heights "AFF".
- Explain what changed and what to check on the phone; say plainly what wasn't
  tested (real-phone behavior can't be checked here: iPhone Safari rules,
  keyboard, touch quirks).
- Keep a running list in `docs/backlog.md`: add their field notes there
  (dated, in their words), check items off when they ship.
- Workflow: develop on branch `claude/project-setup-repo-migration-224gw1`,
  push, open a PR to `main` when they want to test; they merge, GitHub Pages
  deploys (djm0014.github.io/takeoff). After a merge, restart the branch from
  `origin/main` before new work. One PR per testable change.
- They prefer moving forward over polishing; park non-blocking issues on the
  backlog.

## Tech

- Vite + TypeScript, no framework (`h()` in `src/lib/dom.ts`). PWA, works
  offline. Hash routes (`src/router.ts`): `#/`, `#/job/:id`, `#/job/:id/plan`,
  `#/job/:id/wall/:wallId`.
- `npm test` (Vitest), `npm run build` (tsc + vite). CI runs both on every
  push; `main` deploys.
- Browser checks: Playwright + Chromium are preinstalled (`require('playwright')`
  with `NODE_PATH=$(npm root -g)`); use `devices['iPhone 13']` and
  `'iPhone 13 landscape'`, `npx vite preview` on a free port, `p.tap()` for touch.
  Chromium is not Safari: it won't show Safari-only behavior.

## Code map

- `src/data/model.ts` — the shared job record (job, survey, rooms, walls,
  items). All lengths are inches. `SCHEMA_VERSION` + `MIGRATIONS` for shape
  changes (optional new fields need no migration).
- `src/data/storage.ts` — the only place that touches IndexedDB (Stage 2 sync
  swaps this). Reads wait for saves in progress. `jobfile.ts` export/import.
- `src/lib/` — `inches.ts` (parse `59 1/2`, `4' 11"`; format to 1/16″),
  `keypad.ts` (the app's own number pad; fields opt in with `keypadAttrs()`),
  `autosave.ts`, `dom.ts`, `theme.ts`.
- `src/plan/` — floor plan: `geometry.ts` (walk-the-room → walls, local
  frames), `items.ts` (door, window, tub, shower, toilet, vanity), `checks.ts`,
  `framing.ts`, `draw.ts`, `room.ts` (editing walls), `rules.ts` (numbers tied
  to Key Dimensions rows).
- `src/vanity/` — vanity wall: `settings.ts`, `solve.ts` (checks, quick fixes,
  schedule), `draw.ts` (elevation, presentation), `bind.ts` (record ↔ settings).
- `src/tile/` — tile and niche (the old Niche Rough-In Planner): `settings.ts`
  (answers, old S and IN merged), `solve.ts` (layout, options, cuts, sheets,
  framing), `draw.ts` (tile/framing elevations, sheets A-1 and A-2, exact SVG
  text of the old tool), `fields.ts` (setup steps), `bind.ts` (record ↔ settings).
- `src/screens/` — `jobs`, `jobHome`, `floorPlan`, `wallScreen` (tabs; route
  `#/job/:id/wall/:wallId/(vanity|tile)`), `vanityTab`, `tileTab`, `shell`.
- `src/data/keyDimensions.ts` — mirror of `docs/key-dimensions.xlsx`.
- `public/legacy/` — the old tools, unchanged, served for comparison.
  Never edit them.

## Rules and decisions

- **A measurement lives in one place.** Screens read and write through the
  record (e.g. the vanity's width/place is the floor plan's vanity item; wall
  width comes from the floor plan; studs/finish live on the Wall).
- **Match the old tools first.** Each rebuilt screen is checked against the
  old tool's recorded output: `scripts/record-*-fixtures.cjs` drive the old
  tool in a browser and write `tests/fixtures/*.json`; tests require the new
  code to give the same checks and numbers. Differences are bugs unless
  deliberate and noted. Port logic as is first; improve after.
- **Rooms are walked**: walls in the order walked from a starting corner,
  each with a length and a turn (±90° or any angle up to 135°); wall 1 is drawn
  going up. Bump-ins/alcoves are just walls. Positions along a wall are from
  its **left corner as faced from inside**; `v` is into the room.
- Floor plan: Existing / Framing / Design views; build mode (hides job bar
  and tabs, manual exit); Dims toggle; pinned drawing (side by side in
  landscape); tap selects (item or wall) and scrolls to its card without
  opening the pad; tap-and-slide drags along the wall.
- Number entry: the app's keypad (digits, eighths/16ths, ft, Next, nudges
  ±1″ ±1/8″) on touch screens; the phone keyboard stays down.
- iPhone Safari: focus a field only inside the tap's own event handler;
  never redraw the SVG under a finger on pointerdown; stray clicks after a tap
  are swallowed.
- Vanity wall: no section view (by request). Presentation is black on white.
- Tile tab: wall width is stud to stud (floor plan length + 1/2″ each corner),
  read-only; the tub comes from the floor plan (end walls see the tub's end);
  build-up is written as the wall's finish thickness. Drawing tests compare
  sha1 fingerprints of the old tool's SVG text (`record-niche-fixtures.cjs`).
- Colors/fonts match the old tools (`src/styles/app.css`, Barlow, light/dark).

## Milestones

1. Foundation — done (custom domain still open).
2. Floor plan — done, in field testing.
3. Vanity wall — built, in field testing.
4. Tile and niche — built, in field testing (furring/tub-fit rules still open).
5. Survey and job home. 6. Switch over (import old tools' saved jobs; see
   `docs/legacy-tools.md`). 7. Takeoffs. 8. Sync and accounts.

Future, planned with the owner: a 3D / AR presentation view (three.js, AR Quick
Look via USDZ) between Survey and Takeoffs, and an App Store app later by
wrapping this code with Capacitor (no rewrite). Details in `docs/backlog.md`
under "3D and presentation".
