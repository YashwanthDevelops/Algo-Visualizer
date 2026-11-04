import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = {'.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.webp':'image/webp', '.md':'text/plain'};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(resolve(root) + sep)) return res.writeHead(403).end();
  try { const content = await readFile(file); res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'}); res.end(content); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const titles = {dashboard:'A place to study.AI, brought to life.', pathfinding:'Pathfinding', optimization:'N-Queens', game:'Game AI', sudoku:'Sudoku', timetable:'Timetabling', 'question-visualizer':'Question Visualizer', reference:'Algorithm explanations', guide:'AlgoAI'};
const labs = ['pathfinding', 'optimization', 'game', 'sudoku', 'timetable'];
const browser = await chromium.launch();
try {
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack));
  page.on('download', download => errors.push(`Unexpected download: ${download.suggestedFilename()}`));
  const ready = async route => {
    await page.waitForFunction(({route, title}) => location.hash === `#${route}` && document.querySelector('#app h1')?.textContent === title, {route, title:titles[route]});
  };
  const go = async route => { await page.goto(`${base}#${route}`); await ready(route); };
  const click = async (route, mobile = false) => {
    if (mobile) {
      await page.locator('.sd-mobile-toggle').click();
      if (labs.includes(route)) {
        await page.locator('[data-mobile-menu="Labs"]').click();
        await page.locator(`.sd-mobile-sub-links a[href="#${route}"]`).click();
      } else {
        await page.locator(route === 'question-visualizer' ? '.sd-mobile-cta' : `.sd-mobile-main a[href="#${route}"]`).click();
      }
    } else if (labs.includes(route)) {
      await page.locator('.sd-menu-trigger').first().click();
      await page.locator(`.sd-menu a[href="#${route}"]`).click();
    } else {
      await page.locator(route === 'dashboard' ? '.sd-home' : route === 'question-visualizer' ? '.sd-cta' : `.sd-nav-link[href="#${route}"]`).click();
    }
    await ready(route);
  };

  let transitions = 0;
  for (const source of Object.keys(titles)) {
    for (const destination of Object.keys(titles)) {
      await go(source);
      await click(destination);
      transitions++;
    }
  }
  await go('dashboard');
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.locator('.sd-home').click();
  await page.waitForFunction(() => scrollY === 0);

  for (const section of ['compare', 'history']) {
    await page.locator('.sd-menu-trigger').nth(1).click();
    await page.locator(`.sd-menu a[href="#dashboard?section=${section}"]`).click();
    await page.waitForFunction(section => location.hash === `#dashboard?section=${section}`, section);
    await page.locator(`.sd-menu a[href="#dashboard?section=${section}"][aria-current="page"]`).waitFor({state:'attached'});
    assert.deepEqual(await page.locator('.sd-menu a[aria-current="page"]').evaluateAll(links => links.map(link => link.getAttribute('href'))), [`#dashboard?section=${section}`]);
    await page.reload();
    await page.waitForFunction(section => Math.abs(document.querySelector(`[data-dashboard-section="${section}"]`).getBoundingClientRect().top) < 100, section);
  }

  await go('question-visualizer');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64');
  await page.locator('input.qv-file-input').setInputFiles({name:'question.png',mimeType:'image/png',buffer:png});
  await page.locator('.qv-selected-image img').waitFor();
  await page.locator('[data-qv-tab="review"]').click();
  await page.locator('.sd-cta').click();
  assert.equal(await page.locator('[data-qv-tab="upload"]').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('.qv-selected-image img').count(), 1);

  await go('game'); await click('sudoku'); await click('question-visualizer');
  await page.goBack(); await ready('sudoku');
  await page.goForward(); await ready('question-visualizer');
  await page.reload(); await ready('question-visualizer');

  await page.setViewportSize({width:390,height:844});
  for (const destination of Object.keys(titles)) await click(destination, true);
  await page.goto(`${base}#missing-route`); await ready('dashboard');
  assert.deepEqual(errors, []);
  console.log(`Routing passed: ${transitions} desktop transitions, all 9 mobile destinations, documents, section indicators, same-page actions, Back/Forward, refresh, and unknown-route recovery. No page errors or downloads.`);
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
