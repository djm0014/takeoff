# Bathroom Tools

A phone-first field app for bathroom remodel layout. One shared job record
feeds every screen: measure a wall or place a toilet once, and every tool sees
it. See [docs/combined-app-plan.md](docs/combined-app-plan.md) for goals,
scope and milestones.

## Status

**Milestone 1 — Foundation** (in progress)

- [x] Vite + TypeScript build, installable on a phone (works with no signal)
- [x] Style file: Barlow fonts, light and dark themes, 44 px tap targets
- [x] Inch input (`59 1/2`, `59-1/2`, `59.5`, `59″`, `4' 11 1/2"`) and 1/16″ formatting
- [x] Shared job record with a version number and upgrade path
- [x] Storage module (IndexedDB on the phone, swappable for sync later)
- [x] Job list: new, open, rename, duplicate, delete, export and import a job file
- [x] Tests run on every push
- [x] Old tools copied in unchanged, served at `/legacy/…` ([docs/legacy-tools.md](docs/legacy-tools.md))
- [x] Key Dimensions table (`src/data/keyDimensions.ts`, from `docs/key-dimensions.xlsx`)
- [x] Colors and fonts match the old tools
- [ ] Custom domain

## Working on it

```sh
npm install
npm run dev        # local server with live reload
npm test           # run the tests once
npm run test:watch # rerun tests on every change
npm run build      # typecheck and build to dist/
```

## Layout

```
src/
  data/      job record (model.ts), storage module, job file export/import
  lib/       shared code: inches, DOM helpers, theme
  screens/   one file per screen
  styles/    the one style file
tests/       automated tests (Vitest)
public/      icons and files served as-is
  legacy/    unchanged copies of the old tools, for comparison
docs/        plan, key dimensions sheet, service sheet, tool ideas
marketing/   contractor landing page (not part of the app build yet)
```

## Rules

- All lengths are stored as inches (numbers). Format with `formatInches`;
  heights with `formatAFF`.
- A measurement lives in exactly one place in the job record.
- Screens read and write jobs only through `jobs()` in `src/data/storage.ts`.
- When the job record's shape changes, bump `SCHEMA_VERSION` and add a step to
  `MIGRATIONS` in `src/data/model.ts`, with a test.

## Releases

Pushes to `main` build, test and publish to GitHub Pages. Tag each release
(`v0.1.0`, …) so a bad update can be rolled back on a job day.
