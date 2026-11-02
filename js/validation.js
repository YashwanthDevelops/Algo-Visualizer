import { algorithms, defaults } from "./models.js";
import { clone } from "./core.js";

const fail = (message) => {
  throw new Error(message);
};
export function validateConfiguration(lab, raw) {
  if (
    !Object.hasOwn(defaults, lab) ||
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  )
    fail("Choose a supported lab and configuration.");
  const c = { ...clone(defaults[lab]), ...clone(raw) };
  if (!algorithms[lab].includes(c.algorithm))
    fail(`Unsupported ${lab} algorithm.`);
  if (!Number.isInteger(c.limit) || c.limit < 1 || c.limit > 1000000)
    fail("Search/iteration limit must be an integer from 1 to 1,000,000.");
  if (lab === "pathfinding") {
    c.heuristic = c.heuristic || "manhattan";
    if (!["manhattan", "euclidean", "zero"].includes(c.heuristic))
      fail("Heuristic must be manhattan, euclidean, or zero.");
    const p = c.problem;
    if (
      !p ||
      !Number.isInteger(p.rows) ||
      !Number.isInteger(p.cols) ||
      p.rows < 1 ||
      p.rows > 40 ||
      p.cols < 1 ||
      p.cols > 40 ||
      !Array.isArray(p.cells) ||
      p.cells.length !== p.rows * p.cols ||
      !Number.isInteger(p.start) ||
      !Number.isInteger(p.goal) ||
      p.start < 0 ||
      p.goal < 0 ||
      p.start >= p.cells.length ||
      p.goal >= p.cells.length ||
      p.cells[p.start] <= 0 ||
      p.cells[p.goal] <= 0 ||
      p.cells.some((x) => !Number.isFinite(x) || x < 0)
    )
      fail(
        "Use a 1-40 row and column grid with valid endpoints and non-negative terrain costs.",
      );
  } else if (lab === "optimization") {
    c.sidewaysLimit = c.sidewaysLimit ?? 0;
    c.restarts = c.restarts ?? 0;
    if (
      !Number.isInteger(c.sidewaysLimit) ||
      c.sidewaysLimit < 0 ||
      c.sidewaysLimit > 100 ||
      !Number.isInteger(c.restarts) ||
      c.restarts < 0 ||
      c.restarts > 20
    )
      fail("Sideways limit must be 0-100 and restarts 0-20.");
    const q = c.problem?.queens;
    if (
      !Array.isArray(q) ||
      q.length < 4 ||
      q.length > 12 ||
      q.some((x) => !Number.isInteger(x) || x < 0 || x >= q.length)
    )
      fail("Use 4-12 queens and one valid row per column.");
  } else if (lab === "game") {
    c.depthLimit = c.depthLimit ?? 0;
    if (!Number.isInteger(c.depthLimit) || c.depthLimit < 0 || c.depthLimit > 9)
      fail(
        "Game depth limit must be 0 (full search) or an integer from 1 to 9.",
      );
  } else {
    c.variableOrdering = c.variableOrdering || "fixed";
    c.valueOrdering = c.valueOrdering || "natural";
    if (
      !["fixed", "mrv"].includes(c.variableOrdering) ||
      !["natural", "lcv"].includes(c.valueOrdering)
    )
      fail("Choose valid CSP variable and value ordering options.");
  }
  return c;
}
