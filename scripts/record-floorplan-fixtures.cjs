/**
 * Runs each scenario in tests/fixtures/floorplan-scenarios.json through the old
 * Bathroom Floor Plan tool (public/legacy/floor-plan) in a headless browser and
 * records its check list as 'expected' and its framing schedules as
 * 'expectedFraming'. Run after adding a scenario:
 *   node scripts/record-floorplan-fixtures.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const file = path.join(root, 'tests/fixtures/floorplan-scenarios.json');
const tool = 'file://' + path.join(root, 'public/legacy/floor-plan/index.html');

(async () => {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const browser = await chromium.launch();
  for (const sc of data.scenarios) {
    const page = await browser.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript((s) => localStorage.setItem('plan1', s), JSON.stringify(sc.state));
    await page.goto(tool);
    await page.click('[data-view="de"]');
    sc.expected = await page.$$eval('#checks li', (lis) =>
      lis.map((li) => ({ level: li.querySelector('i').className || 'warn', text: li.textContent.trim() })),
    );
    await page.click('[data-view="fr"]');
    sc.expectedFraming = await page.$$eval('#frcard table', (tables) =>
      tables.map((t) =>
        [...t.querySelectorAll('tr')]
          .filter((tr) => tr.querySelector('td'))
          .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())),
      ),
    );
    await page.close();
    console.log(`${sc.name}: ${sc.expected.length} checks`);
  }
  await browser.close();
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
})();
