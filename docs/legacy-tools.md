# Legacy tools

Unchanged copies of the tools this app replaces, served at `/legacy/…` so old
and new can be compared side by side. Do not edit them; fixes go into the app.

| Tool | Path | Replaced by | Saved state key |
| --- | --- | --- | --- |
| Bathroom Floor Plan | `public/legacy/floor-plan/` | Milestone 2, Floor plan | `plan1` |
| Vanity Wall Solver | `public/legacy/vanity-wall/` | Milestone 3, Vanity tab | `vanity1` |
| Niche Rough-In Planner | `public/legacy/niche-planner/` | Milestone 4, Tile tab | `nichePlanner1` |
| Bathroom Site Survey | `public/legacy/site-survey/` | Milestone 5, Survey | `survey1` |
| Sheet goods takeoff calculator | `public/legacy/takeoff-calculator/` | Milestone 7, Takeoffs | — |

**Matching rule:** for each rebuilt screen, the same inputs give the same tile
layout, centerlines and rough-in numbers as the old tool. Differences are bugs
unless they are deliberate fixes, noted in the commit.

**Saved jobs (Milestone 6 import):** each tool keeps its current work in the
browser under the key above, and its named saved jobs in Claude's artifact
storage (`window.claude` db, collection `data/users/<uid>`). Hosted copies here
have no Claude storage, so they keep only the current work, per browser. The
import needs each tool to export its saved jobs as a file from inside Claude.
