import http from "node:http";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const target = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (target !== root && !target.startsWith(root + path.sep)) return res.writeHead(403).end();
    const info = await stat(target);
    const file = info.isDirectory() ? path.join(target, "index.html") : target;
    res.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end("Not found"); }
});

const draft = {
  algorithm: "astar", algorithmCandidates: ["astar"],
  questionText: "Use breadth-first search to find a route from S to E.",
  directed: false, startId: "S", goalId: "E",
  nodes: [
    { id: "S", label: "S", heuristic: null, x: 0.08, y: 0.5 },
    { id: "B", label: "B", heuristic: null, x: 0.28, y: 0.25 },
    { id: "H", label: "H", heuristic: null, x: 0.28, y: 0.75 },
    { id: "G", label: "G", heuristic: null, x: 0.62, y: 0.5 },
    { id: "E", label: "E", heuristic: null, x: 0.9, y: 0.5 },
  ],
  edges: [
    { id: "SB", source: "S", target: "B", cost: null },
    { id: "SH", source: "S", target: "H", cost: null },
    { id: "BG", source: "B", target: "G", cost: null },
    { id: "HG", source: "H", target: "G", cost: null },
    { id: "GE", source: "G", target: "E", cost: null },
  ],
};
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=", "base64");
let browser;
const pageErrors = [];
const apiCalls = [];
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const base = `http://127.0.0.1:${server.address().port}`;
  const networkRequests = [];
  page.on("request", (request) => networkRequests.push(request.url()));
  const artifactDir = process.env.SMOKE_ARTIFACT_DIR || path.join(root, "reports", "question-visualizer-preview");
  await mkdir(artifactDir, { recursive: true });
  await page.route("**/api/analyze-question", async (route) => {
    const request = route.request();
    apiCalls.push({ url: request.url(), method: request.method(), body: request.postDataJSON() });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schemaVersion: 1, draft, uncertainties: [{ id: "edge-review", field: "edges", message: "Check that the graph has no missing connections.", blocking: true }] }) });
  });

  await page.goto(base);
  await page.locator('a[href="#question-visualizer"]').first().click();
  await page.locator('[data-qv-algorithm="bfs"]').click();
  await page.locator("input.qv-file-input").setInputFiles({ name: "question.png", mimeType: "image/png", buffer: tinyPng });
  await page.locator('[data-qv-action="analyze"]').click();
  await page.locator('[data-qv-tab="review"]').waitFor();
  await page.getByText("Use breadth-first search to find a route from S to E.").waitFor();

  const imagePayload = apiCalls[0]?.body;
  if (!imagePayload || apiCalls.length !== 1) throw new Error("Image analysis did not make exactly one mocked API call.");
  if (imagePayload.schemaVersion !== 1 || imagePayload.selectedAlgorithm !== "bfs" || imagePayload.image?.mimeType !== "image/png") throw new Error("Question Visualizer sent an unexpected API request.");
  if (imagePayload.image.base64 !== tinyPng.toString("base64")) throw new Error("Image upload bytes changed before API submission.");
  if (JSON.stringify(imagePayload).includes("GEMINI_API_KEY")) throw new Error("A provider API key appeared in the browser request.");

  if (await page.locator('[data-qv-field="directed"]').inputValue() !== "false") throw new Error("Extracted undirected value was not shown for review.");
  if (await page.locator('[data-edge-index="0"][data-edge-key="cost"]').inputValue() !== "") throw new Error("Unknown edge costs were fabricated instead of left blank.");
  await page.locator('[data-qv-action="keep-selected-algorithm"]').click();
  await page.locator('[data-qv-action="resolve-uncertainty"]').click();
  await page.locator('[data-qv-action="solve"]').click();
  await page.waitForFunction(() => Number(document.querySelector("[data-qv-scrub]")?.max) > 1);
  await page.locator('[data-qv-action="next"]').click();
  await page.waitForFunction(() => Number(document.querySelector("[data-qv-scrub]")?.value) > 0);
  const advanced = Number(await page.locator("[data-qv-scrub]").inputValue());
  await page.locator('[data-qv-action="previous"]').click();
  await page.waitForFunction((value) => Number(document.querySelector("[data-qv-scrub]")?.value) === value, Math.max(0, advanced - 1));
  await page.locator("[data-qv-scrub]").evaluate((slider) => {
    slider.value = slider.max;
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByText("Path cost: Not supplied. One or more edge costs are unknown.").waitFor();
  await page.screenshot({ path: path.join(artifactDir, "question-desktop.png"), fullPage: true });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({ path: path.join(artifactDir, "question-reduced-motion.png"), fullPage: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error("Question Visualizer overflows horizontally on mobile.");
  await page.screenshot({ path: path.join(artifactDir, "question-mobile.png"), fullPage: true });

  await page.locator('[data-qv-tab="review"]').click();
  await page.locator('[data-node-index="1"][data-node-key="label"]').fill("Bee");
  await page.locator('[data-qv-action="solve"]').waitFor();
  await page.locator('[data-qv-tab="visualize"]').click();
  if (await page.locator(".qv-visual-content").count()) throw new Error("Editing the graph did not invalidate the previous solution.");

  const failurePage = await context.newPage();
  failurePage.on("pageerror", (error) => pageErrors.push(error.message));
  failurePage.on("request", (request) => networkRequests.push(request.url()));
  await failurePage.route("**/api/analyze-question", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "configuration_missing", message: "Question analysis is not configured on this server." } }) }));
  await failurePage.goto(`${base}/#question-visualizer`);
  await failurePage.locator('[data-qv-algorithm="bfs"]').click();
  await failurePage.locator("input.qv-file-input").setInputFiles({ name: "question.png", mimeType: "image/png", buffer: tinyPng });
  await failurePage.locator('[data-qv-action="analyze"]').click();
  await failurePage.getByText("Image analysis is not available on this deployment. You can enter the graph manually.").waitFor();
  if (pageErrors.length) throw new Error(`Browser console exceptions: ${pageErrors.join(" | ")}`);
  if (networkRequests.some((url) => !url.startsWith(base))) throw new Error("Browser made a request outside the local mocked smoke server.");
  console.log("Question Visualizer browser smoke passed with a mocked API: image upload, review, missing costs, algorithm conflict, uncertainty confirmation, worker playback, edit invalidation, missing-key state, reduced-motion, and mobile layout.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
