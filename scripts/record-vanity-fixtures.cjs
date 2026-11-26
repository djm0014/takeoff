/**
 * Runs each scenario in tests/fixtures/vanity-scenarios.json through the old
 * Vanity Wall Solver (public/legacy/vanity-wall) in a headless browser and
 * records its checks (with quick-fix labels) and rough-in schedule. With
 * 'applyFix', also taps that quick fix and records the result. Run after
 * adding a scenario:
 *   node scripts/record-vanity-fixtures.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const file = path.join(root, 'tests/fixtures/vanity-scenarios.json');
const tool = 'file://' + path.join(root, 'public/legacy/vanity-wall/index.html');

async function read(page) {
  const checks = await page.$$eval('#checks li', (lis) =>
    lis.map((li) => {
      const span = li.querySelector('span');
      const text = [...span.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      return { level: li.querySelector('i').className, text, fixes: [...li.querySelectorAll('[data-fix]')].map((b) => b.textContent.trim()) };
    }),
  );
  const schedule = await page.$$eval('#sched tr', (trs) => trs.filter((tr) => tr.querySelector('td')).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent)));
  return { checks, schedule };
}

(async () => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const browser = await chromium.launch();
  for (const sc of data.scenarios) {
    const page = await browser.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript((s) => localStorage.setItem('vanity1', s), JSON.stringify({ ...sc.state, qdone: '1' }));
    await page.goto(tool);
    sc.expected = await read(page);
    if (sc.applyFix != null) {
      await page.click(`[data-fix="${sc.applyFix}"]`);
      sc.afterFix = await read(page);
    }
    await page.close();
    console.log(`${sc.name}: ${sc.expected.checks.length} checks, ${sc.expected.schedule.length} schedule rows`);
  }
  await browser.close();
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
})();
