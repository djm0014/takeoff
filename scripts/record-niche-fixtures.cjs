/**
 * Runs each scenario in tests/fixtures/niche-scenarios.json through the old
 * Niche Rough-In Planner (public/legacy/niche-planner) in a headless browser
 * and records what it works out: the options, and for the chosen option the
 * cuts, the rough-in (or layout) sheet, the framing rows, the courses above
 * and below the niche, and a fingerprint of every drawing (tile elevation,
 * framing elevation, sheets A-1 and A-2, and the setup sketch).
 *
 * It calls the old tool's own functions in the page, so the drawings are its
 * exact SVG text, not the browser's re-serialized copy. The date on the sheets
 * is fixed (see DATE). Run after adding a scenario:
 *   node scripts/record-niche-fixtures.cjs [--dump dir]
 * --dump also writes each drawing's SVG text to that folder, for debugging.
 */
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const file = path.join(root, 'tests/fixtures/niche-scenarios.json');
const tool = 'file://' + path.join(root, 'public/legacy/niche-planner/index.html');
const DATE = '2026-01-15T12:00:00';
const dumpAt = process.argv.indexOf('--dump');
const dump = dumpAt > 0 ? process.argv[dumpAt + 1] : null;

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');

(async () => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const browser = await chromium.launch();
  for (const sc of data.scenarios) {
    const page = await browser.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript(
      ({ state, date }) => {
        const fixed = new Date(date).getTime();
        const RealDate = Date;
        // eslint-disable-next-line no-global-assign
        Date = class extends RealDate {
          constructor(...a) {
            super(...(a.length ? a : [fixed]));
          }
          static now() {
            return fixed;
          }
        };
        localStorage.setItem('nichePlanner1', JSON.stringify(state));
      },
      { state: { S: sc.S, IN: { shelfV: 2, ...(sc.IN || {}) }, cur: 6 }, date: DATE },
    );
    await page.goto(tool);
    const out = await page.evaluate((sc) => {
      /* global S, IN, tileS, renderResults, cache, lastR, framingFor, framingPlain, cutsFor, cutsPlain, sheetFor, sheetPlainRows,
         framingRows, framingRowsPlain, capture, draw, drawFraming, sheetSVG, sheetPlain, sheetA2, optTitle, worstOf, courseRoom, fmt, EPS, bu */
      renderResults(false);
      const a = sc.adj || {};
      optIdx = sc.optIdx || 0;
      adjH = a.adjH || 0;
      adjS = a.adjS || 0;
      adjHin = a.adjHin || 0;
      adjSin = a.adjSin || 0;
      renderResults(true);
      const tS = tileS(S);
      const res = cache.res;
      const B = bu(tS);
      const options = res.map((o) => {
        const w = worstOf(o.plain ? cutsPlain(tS, o) : cutsFor(tS, o));
        const line = o.plain
          ? `First course ${o.p < tS.tileH - EPS ? fmt(o.p) : 'full'} · top ${Math.min(o.cl, o.cr) < tS.tileH - EPS ? fmt(Math.min(o.cl, o.cr)) : 'full'}`
          : `Finished ${fmt(o.h.w)} × ${fmt(o.hF)} · rough sill ${fmt(o.sF - B)}`;
        return { title: optTitle(tS, o), line, worst: w, pinned: !!o.pinned };
      });
      if (!res.length) return { options, none: true, preview: capture((o) => draw(o, S, null)) };
      const r = lastR;
      const PL = !!r.plain;
      const fr = PL ? framingPlain(tS) : framingFor(tS, r);
      const drawings = {
        preview: capture((o) => draw(o, S, null)),
        tile: capture((o) => draw(o, tS, r)),
        framing: capture((o) => drawFraming(o, tS, r, fr)),
        a1: PL ? sheetPlain(tS, r, fr) : sheetSVG(tS, r, fr),
      };
      if (!PL) drawings.a2 = sheetA2(tS, r, fr);
      return {
        options,
        optIdx,
        adjusted: { adjH, adjS, adjHin, adjSin },
        items: PL ? cutsPlain(tS, r) : cutsFor(tS, r),
        sheet: PL ? sheetPlainRows(tS, r) : sheetFor(tS, r),
        frRows: PL ? framingRowsPlain(tS, fr) : framingRows(tS, fr),
        room: PL ? null : courseRoom(tS, r),
        drawings,
      };
    }, sc);
    const drawings = {};
    for (const [k, v] of Object.entries(out.drawings || { preview: out.preview })) {
      const text = typeof v === 'string' ? v : v.vb + '\n' + v.h;
      drawings[k] = sha(text);
      if (dump) {
        fs.mkdirSync(dump, { recursive: true });
        fs.writeFileSync(path.join(dump, `${sc.name.replace(/[^a-z0-9]+/gi, '-')}.${k}.txt`), text);
      }
    }
    delete out.preview;
    out.drawings = drawings;
    // JSON can't hold Infinity; the tool never shows it, so none of these need it.
    sc.expected = JSON.parse(JSON.stringify(out));
    await page.close();
    console.log(`${sc.name}: ${out.options.length} options, ${(out.items || []).length} cuts, ${(out.sheet || []).length} sheet rows`);
  }
  await browser.close();
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
})();
