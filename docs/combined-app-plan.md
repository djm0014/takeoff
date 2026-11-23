# Bathroom Tools: Combined App Plan

Nov 22, 2026 · @Dylan

## Goal and scope

Combine the four separate bathroom tools into one phone-first web app where every screen works from the same job. Measure a wall or place a toilet once, and every tool sees it.

**In scope for the first version:**

- One shared job record (jobs, rooms, walls, items, survey)
- The existing tools rebuilt as screens of one app, with the same look and behavior
- Saving on the phone with no signal needed, plus export and import of a job file
- Hosting on the owner's domain through GitHub Pages

**Not in the first version:** accounts, syncing between devices, takeoffs, contractor-facing marketing pages. Each is planned for later, and the first version should be built so they slot in without rework.

**Guiding rule:** it stays a fast, accurate field tool that solves layout puzzles and produces working drawings. It is not a drafting program: no freeform drawing, and dragging only along a wall.

## What exists today

Four separate single-file HTML tools, each published as a private Claude artifact, each with its own copy of the shared helpers and its own saved jobs.

| Tool | What it does | Notes for the rebuild |
| --- | --- | --- |
| Niche Rough-In Planner | Wall tile layout with no slivers, niche sizing and rough-in, inside-niche layout, framing elevation, sheets A-1 (elevation) and A-2 (section), cut lists, plain walls, existing studs, sloped ceilings | The largest and most fragile file. Furring and tub-fit logic still needs work. |
| Vanity Wall Solver | Setup questions, presets (tight, standard, comfort, aging in place), sink and toilet centerlines, mirror or medicine cabinet, lights, outlets, storage cabinet with drawer travel, elevation and section, checks with quick fixes and undo, rough-in schedule | Best model for how every tool should feel: questions, checks, quick fixes. |
| Bathroom Floor Plan | Rectangular room with bump-ins and alcoves, existing, framing and design views, clearance checks, drag along a wall, rough-in and blocking schedule, framing takeoff | Becomes the hub: the room and its walls live here. |
| Bathroom Site Survey | Field checklist, room area, volume and fan size, flags for hazards and conditions, copyable report | Becomes the job's survey record. |

Also in place: the Bathroom Key Dimensions sheet (codes, ADA, guidelines, trade-typical numbers), the Remodeling Tool Ideas doc, and the pre-bid service sheet.

Shared pieces every tool repeats today: inch and fraction input (`59 1/2`), 1/16″ formatting, SVG drawing with dimension strings, saved jobs, the check list with colored dots, light and dark themes.

## Shared job record

One record per job, built like linked tables in Airtable. Every tool reads and writes these same records; no tool keeps its own copy of a measurement.

&#91;embedded content: shared job record · 6 linked tables\]

Each record has an id, and children point to their parent's id, so renumbering walls or reordering items never breaks a link.

| Table | Key fields | Links to |
| --- | --- | --- |
| Job | name, client, address, contractor, date, preset (tight, standard, comfort, aging in place), notes | — |
| Survey | year built, plumbing and electrical findings, moisture readings, hazards, access, photos checklist | Job |
| Room | name, length, width, ceiling height | Job |
| Wall | number (clockwise from the top), length (from the room), stud size, finish thickness, open or finished, first stud location, tile height | Room |
| Feature | type (bump-in or alcove), position, width, depth, label | Wall |
| Item | type, status (existing, new, remove), position along the wall, size, heights, type-specific fields (toilet rough-in, drain side, drawer direction, faucet reach, and so on) | Wall |

Niche and tile settings for a wall (tile size, grout, niche size, sill, shelves) live on the Wall record as a tile layout, since a wall has at most one.

**Who reads and writes what:**

| Screen | Reads | Writes |
| --- | --- | --- |
| Survey | Job | Survey, Room size |
| Floor plan | Room, Walls, Features, Items | Room, Walls, Features, Items (positions along walls) |
| Vanity wall | One Wall and its Items | That wall's Items and settings |
| Tile and niche | One Wall, its Items (tub, window) | That wall's tile layout |
| Takeoffs (later) | Everything | Nothing |

**Rule:** a measurement lives in exactly one place. The vanity wall's width comes from the floor plan's wall length; it is never typed twice.

## Storage

**Stage 1: on the phone (first version).** Each job is saved as one structured document in the browser's built-in database (IndexedDB), holding all of the tables above. It works with no signal, costs nothing and needs no login.

- Saves automatically as you work; a job list to open, rename, duplicate and delete.
- Export a job as a file (JSON) and import it again, for backup or to move it to another device.
- Every saved job carries a version number, so a later version of the app can upgrade old jobs instead of breaking them.

**Stage 2: sync between devices (later).** Add a hosted database, most likely Supabase: real tables matching the ones above, with logins so each contractor sees only their own jobs. The app keeps working from the phone's copy and syncs when there is signal. Stage 1 must keep all reads and writes behind one small storage module, so Stage 2 swaps what is behind it without touching the screens.

**Airtable (later, optional).** A “Send to Airtable” action pushes a finished job's summary into the existing Airtable base, so business tracking stays where it is. Airtable is not the live storage: its rate limits and lack of offline use make it a poor fit for that.

**Moving off the current tools.** Saved jobs in the Claude artifacts use Claude's own storage and do not carry over by themselves. Add an import that accepts each old tool's saved data so field jobs in progress are not lost.

## Shared code and style rules

**Shared code, written once and used by every screen:**

- Inch input that accepts `59 1/2`, `59-1/2`, `59.5` and `59″`, and formatting to the nearest 1/16″
- Drawing kit: walls, dimension strings, height labels, centerlines, fixtures (toilet, vanity, tub, door, window, cabinet, outlet), hatching for sections
- Checks with a level (problem, warning, fine), a message and optional quick fixes, plus Undo for the last fix
- Setup questions: steps that skip themselves when they do not apply, defaults so Next always works, a recap before results
- Presets for who the bathroom is for, read from one place
- Code minimums and rules of thumb read from one table that mirrors the Bathroom Key Dimensions sheet, so a number changes once
- Storage module (see Storage)

**Style rules (one style file):**

- Fonts: Barlow for text, Barlow Semi Condensed for headings; tabular figures for all measurements
- Colors: the current set (light gray background, dark green-gray ink, burnt orange accent, green, amber and red for check levels), with a dark theme
- Sizes: 16 px body text, 44 px minimum tap targets, inputs that open the number keypad
- Drawings: one line weight scale, one dimension style, black and white presentation option for printing
- Words: plain trade language, measurements always with ″, heights always marked AFF

**Technical choices for Claude Code to confirm:** a small modern build setup (for example Vite with plain JavaScript or TypeScript), no heavy framework unless it earns its place, automated tests that run the layout math on every change, and the app installable on a phone's home screen (a progressive web app) so it opens like an app in the field.

## App structure

1. **Jobs** — the job list: new job, open, duplicate, export, import.
2. **Job home** — the job's summary and its open checks, with a card for each screen below showing what is done.
3. **Survey** — the field checklist and report.
4. **Floor plan** — the room, its walls, bump-ins, alcoves and items, with existing, framing and design views. Tapping a wall opens it.
5. **Wall** — one wall at a time, with tabs that fit what is on it:
   - **Vanity** when it holds a sink: centerlines, mirror, lights, outlets, cabinet
   - **Tile and niche** when it gets tile
   - **Framing** for its studs, blocking and rough-ins
6. **Sheets** — printable drawings and schedules for the whole job.
7. **Takeoffs** (later) — materials for the whole job.

A wall screen is reached from the floor plan, so the right wall is always open with its true length and items. Each screen keeps the current tools' pattern: questions first, then the drawing, checks with quick fixes, and the schedule.

## Build order and milestones

Each milestone ends with something usable in the field.

1. **Foundation.** Repo on GitHub, hosting on the owner's domain, style file, shared code, storage module, job list, export and import, tests. The four current tools are copied into the repo unchanged as a backup.
2. **Floor plan on the shared record.** Rebuild the floor plan as the hub. It creates the room and walls every other screen uses.
3. **Vanity wall.** Rebuild the Vanity Wall Solver as the Vanity tab of a wall, reading the wall's length and items from the record.
4. **Tile and niche.** Rebuild the Niche Planner as the Tile tab, with the sheets A-1 and A-2. This is the biggest piece; do it after the pattern is proven.
5. **Survey and job home.** Fold the survey in and build the job summary.
6. **Switch over.** Import jobs from the old tools; stop using the artifacts.
7. **Takeoffs.** The first new feature on the combined app.
8. **Sync and accounts.** Stage 2 storage, when contractors start using it.

## Testing and switching over

- **Keep the current tools running** until the new screen that replaces each one has been used on a real job.
- **Test cases from real jobs.** Save a handful of field jobs (5×8 tub bath, tub alcove, chase, double vanity, aging in place, the tight-to-wall cabinet with sideways drawers) as fixtures. Every change runs them and compares the layout numbers, checks and schedules against the expected results.
- **Match the old tools first.** For each rebuilt screen, the same inputs should give the same tile layout, centerlines and rough-in numbers as the current tool. Differences are bugs unless they are deliberate fixes.
- **Phone check before every release:** setup questions, drawing legibility, tap targets, and working with no signal.
- **Versions.** Tag each release in GitHub so a bad update on a job day can be rolled back.

## Open questions and later

- [ ] More than one bathroom per job: one job with several rooms, or one job per bathroom?
- [ ] Is an estimate or price a separate record, or part of the job?
- [ ] Does the contractor see the same app, or a read-only report and sheets?
- [ ] Furring and tub-fit behavior in the tile screen still needs the field rules worked out.
- [ ] Plumbing wall type, linked walls that share a first course, and a PDF export of the sheets.
- [ ] Contractor-facing landing page on the domain, separate from the app.
- [ ] Later puzzles from the Remodeling Tool Ideas doc: floor tile, shower pan slope, stairs.
