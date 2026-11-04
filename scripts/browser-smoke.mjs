import http from "node:http";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const target = path.resolve(
      root,
      `.${pathname === "/" ? "/index.html" : pathname}`,
    );
    if (target !== root && !target.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    const info = await stat(target);
    const file = info.isDirectory() ? path.join(target, "index.html") : target;
    res.writeHead(200, {
      "content-type": mime[path.extname(file)] || "application/octet-stream",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(`http://127.0.0.1:${server.address().port}/#pathfinding`);
  await page.locator("#run").click();
  await page.waitForFunction(
    () =>
      Number(document.querySelector("#scrub")?.max) > 1 &&
      !document.querySelector("#pause")?.hidden,
  );
  await page.locator("#pause").click();
  const before = Number(await page.locator("#scrub").inputValue());
  await page.locator("#next").click();
  await page.waitForFunction(
    (value) => Number(document.querySelector("#scrub")?.value) > value,
    before,
  );
  const advanced = Number(await page.locator("#scrub").inputValue());
  await page.locator("#previous").click();
  await page.waitForFunction(
    (value) => Number(document.querySelector("#scrub")?.value) === value,
    Math.max(0, advanced - 1),
  );
  await page.locator('.sd-home').click();
  await page.locator('.sd-menu-trigger').first().click();
  await page.locator('.sd-menu a[href="#pathfinding"]').click();
  await page.waitForFunction(
    () => document.querySelector("#pf-step-label")?.textContent === "Choose a map and begin",
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("#pf-step-label")?.textContent === "Choose a map and begin",
  );
  const persisted = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("so-playground-v1") || "null");
    } catch {
      return null;
    }
  });
  if (!persisted?.history?.some((entry) => entry.lab === "pathfinding"))
    throw new Error("Pathfinding run summary was not persisted across reload.");
  const artifactDir = process.env.SMOKE_ARTIFACT_DIR;
  if (artifactDir) {
    await mkdir(artifactDir, { recursive: true });
    await page.screenshot({
      path: path.join(artifactDir, "workbench-normal.png"),
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.screenshot({
      path: path.join(artifactDir, "workbench-reduced-motion.png"),
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileFits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  if (!mobileFits) throw new Error("Mobile viewport has horizontal overflow.");
  if (artifactDir)
    await page.screenshot({
      path: path.join(artifactDir, "workbench-mobile.png"),
      fullPage: true,
    });
  console.log(
    "Browser smoke passed: pathfinding run, next, previous, navigation, and reload.",
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
