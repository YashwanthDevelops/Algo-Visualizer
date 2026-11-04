import {calendarHTML} from './timetable-layout.js?v=calendar-4';
import { escapeHTML as e, labels } from "./core.js";
import { iconSprite } from "./icons.js";
export const labNames = {
  pathfinding: "Pathfinding",
  optimization: "N-Queens optimization",
  game: "Game AI",
  sudoku: "Sudoku",
  timetable: "Timetabling",
};
export const descriptions = {
  pathfinding:
    "Edit a map. Follow the frontier. Discover why the shortest route and the cheapest route can differ.",
  optimization:
    "Move one queen per column. Watch local decisions shape the search for zero conflicts.",
  game: "Play against an optimal opponent, then inspect the decisions behind every move.",
  sudoku:
    "See assignments, candidate domains, and the moment a solver has to turn back.",
  timetable:
    "Turn session requirements into a schedule with real availability and conflict constraints.",
};
export const metricLabels = {
  expanded: "Nodes expanded",
  discovered: "Cells discovered",
  maxFrontier: "Max frontier",
  pathLength: "Path length",
  pathCost: "Path cost",
  executionMs: "Compute time",
  candidateEvaluations: "Score evaluations",
  iterations: "Iterations",
  currentScore: "Current conflicts",
  bestScore: "Best conflicts",
  worseAccepted: "Worse moves accepted",
  sidewaysMoves: "Sideways moves",
  restarts: "Restarts",
  recoveryEvaluations: "Exact recovery checks",
  nodesEvaluated: "Nodes evaluated",
  terminalEvaluations: "Terminal scores",
  heuristicEvaluations: "Heuristic evaluations",
  depthCutoffs: "Depth cutoffs",
  cutoffs: "Cutoffs",
  searchDepth: "Search depth",
  assignmentsAttempted: "Assignments tried",
  backtracks: "Backtracks",
  valuesRemoved: "Values removed",
  assigned: "Assigned",
  total: "Total variables",
};
export const metricKeys = {
  pathfinding: [
    "expanded",
    "maxFrontier",
    "pathLength",
    "pathCost",
    "executionMs",
  ],
  optimization: [
    "candidateEvaluations",
    "iterations",
    "currentScore",
    "bestScore",
    "worseAccepted",
    "sidewaysMoves",
    "restarts",
    "recoveryEvaluations",
    "executionMs",
  ],
  game: [
    "nodesEvaluated",
    "terminalEvaluations",
    "heuristicEvaluations",
    "depthCutoffs",
    "cutoffs",
    "searchDepth",
    "executionMs",
  ],
  sudoku: [
    "assignmentsAttempted",
    "backtracks",
    "valuesRemoved",
    "assigned",
    "executionMs",
  ],
  timetable: [
    "assignmentsAttempted",
    "backtracks",
    "valuesRemoved",
    "assigned",
    "executionMs",
  ],
};
export const format = (value, key) =>
  value == null || !Number.isFinite(value)
    ? "Not available"
    : key === "executionMs"
      ? `${value.toFixed(2)} ms`
      : Number.isInteger(value)
        ? String(value)
        : value.toFixed(1);
export function metricsHTML(lab, values = {}) {
  return metricKeys[lab]
    .map(
      (key) =>
        `<div class="metric"><span>${metricLabels[key]}</span><strong>${format(values[key], key)}</strong></div>`,
    )
    .join("");
}
export function pathSVG(p, state = {}, selected = null, preview = false, flush = false) {
  const size = 32,
    front = new Set((state.frontier || []).map((v) => v.id)),
    path = new Set(state.path || []);
  let cells = "";
  for (let id = 0; id < p.cells.length; id++) {
    const x = (id % p.cols) * size,
      y = Math.floor(id / p.cols) * size;
    let fill =
        p.cells[id] === 0
          ? "var(--color-cell-wall)"
          : p.cells[id] > 1
            ? "var(--color-cell-weight)"
            : "var(--color-canvas)",
      symbol = p.cells[id] === 0 ? "×" : p.cells[id] > 1 ? p.cells[id] : "";
    if (state.closed?.[id]) {
      fill = "var(--color-cell-line)";
      symbol = "·";
    }
    if (front.has(id)) {
      fill = "var(--color-cell-frontier)";
      symbol = "○";
    }
    if (path.has(id)) {
      fill = "var(--color-cell-path)";
      symbol = "↗";
    }
    if (id === state.current) {
      fill = "var(--color-cell-current)";
      symbol = "◎";
    }
    if (id === p.start) {
      fill = "var(--color-cell-start)";
      symbol = "S";
    }
    if (id === p.goal) {
      fill = "var(--color-cell-path)";
      symbol = "G";
    }
    const name = `Row ${Math.floor(id / p.cols) + 1}, column ${(id % p.cols) + 1}; ${id === p.start ? "start" : id === p.goal ? "goal" : p.cells[id] === 0 ? "wall" : `movement cost ${p.cells[id]}`}`;
    const kind = id === p.start ? 'start' : id === p.goal ? 'goal' : id === state.current ? 'current' : path.has(id) ? 'path' : front.has(id) ? 'frontier' : state.closed?.[id] ? 'expanded' : p.cells[id] === 0 ? 'wall' : p.cells[id] > 1 ? 'weight' : 'empty';
    cells += `<g class="cell" data-cell="${id}" data-cell-state="${kind}" ${preview ? "" : `role="button" tabindex="${id === (selected ?? p.start) ? 0 : -1}" aria-label="${name}"`}><rect x="${x + (flush ? 0 : 1)}" y="${y + (flush ? 0 : 1)}" width="${flush ? 32 : 30}" height="${flush ? 32 : 30}" rx="2" fill="${fill}" stroke="${selected === id ? "var(--color-accent)" : "var(--color-cell-line)"}" stroke-width="${selected === id ? 2 : 1}"/><text x="${x + 16}" y="${y + 21}" text-anchor="middle" fill="var(--color-ink)" font-size="13" font-family="var(--font-mono)">${symbol}</text></g>`;
  }
  return `<svg class="${preview ? "" : "grid-svg"}" viewBox="0 0 ${p.cols * size} ${p.rows * size}" role="${preview ? "img" : "group"}" aria-label="Four-direction search grid. S start, G goal, cross wall, circle frontier, dot expanded, arrow path.">${cells}</svg>`;
}
export function queensSVG(queens, candidate = null, preview = false) {
  const n = queens.length,
    s = 40;
  let html = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      html += `<rect x="${c * s}" y="${r * s}" width="${s}" height="${s}" fill="${(r + c) % 2 ? "var(--color-board-light)" : "var(--color-canvas)"}"/>`;
  for (let c = 0; c < n; c++)
    html += `<svg x="${c * s + 5}" y="${queens[c] * s + 5}" width="30" height="30" viewBox="0 0 256 256" aria-hidden="true" focusable="false" color="var(--color-ink)"><use href="${iconSprite}#crown-simple"></use></svg>`;
  if (candidate && candidate.row !== queens[candidate.col])
    html += `<rect x="${candidate.col * s + 2}" y="${candidate.row * s + 2}" width="36" height="36" fill="var(--color-accent-soft)" stroke="var(--color-accent)" stroke-dasharray="3 3"/><text x="${candidate.col * s + 20}" y="${candidate.row * s + 25}" text-anchor="middle" fill="var(--color-accent)" font-size="19">?</text>`;
  return `<svg class="${preview ? "" : "queens-svg"}" viewBox="0 0 ${n * s} ${n * s}" role="img" aria-label="${n} queens; one per column. Rows ${queens.map((v) => v + 1).join(", ")}. Dashed question mark indicates the candidate move.">${html}</svg>`;
}
export function miniBoard(board) {
  let s = "";
  for (let i = 0; i < 9; i++)
    s += `<rect x="${(i % 3) * 10}" y="${Math.floor(i / 3) * 10}" width="9" height="9" fill="var(--color-canvas)"/><text x="${(i % 3) * 10 + 4.5}" y="${Math.floor(i / 3) * 10 + 7}" fill="${board[i] === "O" ? "var(--color-accent)" : "var(--color-ink)"}" font-size="7" text-anchor="middle">${board[i] || ""}</text>`;
  return `<svg viewBox="0 0 30 30" role="img" aria-label="${board.map((v) => v || "empty").join(", ")}">${s}</svg>`;
}
export function scoreChart(points) {
  if (!points?.length) return "";
  const w = 520,
    h = 150,
    max = Math.max(1, ...points.map((p) => p.score)),
    last = Math.max(1, points.at(-1).iteration),
    x = (i) => 40 + (i / last) * 465,
    y = (v) => 115 - (v / max) * 90;
  const line = (key) =>
    points.map((p) => `${x(p.iteration)},${y(p[key])}`).join(" ");
  return `<svg class="score-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Conflict score by iteration: current ${points.at(-1).score}, best ${points.at(-1).best}."><path d="M40 20V115H505" fill="none" stroke="var(--color-chart-rule)"/><text x="6" y="26">${max}</text><text x="18" y="118">0</text><text x="40" y="139">0</text><text x="475" y="139">${last}</text><text x="210" y="145">iteration</text><polyline points="${line("score")}" fill="none" stroke="var(--color-accent)" stroke-width="2"/><polyline points="${line("best")}" fill="none" stroke="var(--color-ink)" stroke-width="2" stroke-dasharray="5 3"/><text x="340" y="15">━ current  ┄ best</text></svg>`;
}
export function sudokuHTML(config, state = null) {
  const values = state?.assignments || config.problem.board,
    domains = state?.domains;
  return `<div class="sudoku-board" aria-label="Sudoku grid">${values
    .map((v, i) => {
      const given = !!config.problem.board[i],
        cur = state?.current === i;
      return `<div class="sudoku-cell ${given ? "given" : ""} ${cur ? "current" : ""} ${cur && state.rejected ? "rejected" : ""}">${!v && domains ? `<div class="domains" aria-hidden="true">${Array.from({ length: 9 }, (_, j) => `<span>${domains[i].includes(j + 1) ? j + 1 : "·"}</span>`).join("")}</div>` : ""}<input data-sudoku="${i}" value="${v || ""}" inputmode="numeric" maxlength="1" aria-label="Row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1}${domains ? `, candidates ${domains[i].join(", ")}` : ""}" ${state ? "disabled" : ""}></div>`;
    })
    .join("")}</div>`;
}
export function timetableHTML(p,state=null){return calendarHTML(p,state);}
export function treeHTML(tree, state, openNodes) {
  if (!tree?.length)
    return '<p class="hint">Make a move, then run the decision to inspect the search tree.</p>';
  let count = 0;
  const event = state?.eventIndex ?? Infinity;
  const render = (id) => {
    if (++count > 140)
      return '<p class="hint">Visible tree limit reached. Collapse branches to inspect others.</p>';
    const n = tree[id];
    if (!n)
      return '<p class="hint">This subtree was computed but exceeds the retained-tree limit. Use a midgame position for a complete small tree.</p>';
    const visited = !state || id < (state.metrics?.nodesEvaluated ?? Infinity),
      updates = n.updates?.filter((u) => u.event <= event),
      view = updates?.at(-1) || {
        value: null,
        alpha: -Infinity,
        beta: Infinity,
        bound: n.bound === "heuristic" ? "heuristic" : "pending",
      };
    return `<details data-tree="${id}" ${openNodes.has(id) ? "open" : ""}><summary class="${state?.state?.nodeId === id ? "active-node" : ""}">${miniBoard(n.board)}<span>${n.player === state?.ai ? "MAX" : "MIN"} d${n.depth}${n.move === null ? " · root" : ` · #${n.move + 1}`}<br><span class="${view.bound !== "exact" ? "bound" : ""}">${visited ? `v=${view.value ?? "?"} · α=${view.alpha} β=${view.beta}` : "not visited yet"}${view.bound && view.bound !== "exact" && view.value !== null ? ` · ${view.bound === "heuristic" ? "estimated" : view.bound}` : ""}</span></span></summary>${openNodes.has(id) ? `<div class="children">${n.pruned.length && n.cutoffEvent <= event ? `<div class="pruned">× Pruned squares ${n.pruned.map((m) => m + 1).join(", ")}; no terminal values evaluated.</div>` : ""}${n.children.map(render).join("")}${!n.children.length && n.value !== null ? `<div class="hint">${visited ? (n.bound === "heuristic" ? "Heuristic estimate · not a terminal score" : "Terminal score") : "Unvisited leaf"}</div>` : ""}</div>` : ""}</details>`;
  };
  return render(0);
}
export const pseudocode = {
  pathfinding: (a) => [
    "frontier ← {start}; g[start] ← 0",
    a === "bfs"
      ? "current ← queue.dequeue()"
      : a === "dfs"
        ? "current ← stack.pop()"
        : `current ← pop minimum ${a === "ucs" ? "g" : a === "greedy" ? "h" : "g + h"}`,
    "if goal: return; else expand current",
    "discover / relax neighbors; store parents",
    "return path or frontier-exhausted failure",
  ],
  optimization: (a) => [
    "score ← attacking queen pairs",
    a === "hill"
      ? "evaluate every single-queen move"
      : "sample a seeded single-queen move",
    a === "hill"
      ? "if no improvement: stop"
      : "accept if Δ ≤ 0 or random < exp(−Δ/T)",
    a === "hill"
      ? "take lowest-score improvement"
      : "cool T; update current and best",
    "stop at zero score or run limit",
  ],
  game: () => [
    "visit state at MAX or MIN level",
    "if terminal: return utility (+1, 0, −1)",
    "back up max/min child value; update α/β",
    "if pruning and α ≥ β: cut off siblings",
    "return best root move",
  ],
  sudoku: (a) => [
    "build domains from fixed clues",
    "choose next unassigned cell",
    "try candidate; count attempt",
    a === "forward"
      ? "check constraints; prune peer domains"
      : "check row, column, and box constraints",
    "on failure: undo assignment + restore domains",
    "return solution, exhausted, or search limit",
  ],
  timetable: (a) => [
    "domains ← available (slot, room) pairs",
    "choose next unscheduled session",
    "try a (slot, room) placement",
    a === "forward"
      ? "check conflicts; prune invalid combinations"
      : "check teacher, group, and room conflicts",
    "on failure: undo placement + restore domains",
    "return full schedule, exhausted, or limit",
  ],
};
export function explanationHTML(lab, config, frame, selected = null) {
  const code = pseudocode[lab](config.algorithm);
  let detail = "";
  const s = frame?.state;
  if (lab === "pathfinding") {
    const p = config.problem;
    detail = `<div class="inspector"><h3>${config.algorithm === "bfs" ? "Queue · next out first" : config.algorithm === "dfs" ? "Stack · top first" : "Priority frontier · smallest first"}</h3><div class="structure-list">${
      (s?.frontier || [])
        .slice(0, 24)
        .map(
          (v) =>
            `<span class="structure-item">${Math.floor(v.id / p.cols) + 1},${(v.id % p.cols) + 1}${["ucs", "greedy", "astar"].includes(config.algorithm) ? ` · ${v.priority}` : ""}</span>`,
        )
        .join("") || '<span class="muted">Empty</span>'
    }</div>${s?.frontier?.length > 24 ? `<small>Showing 24 of ${s.frontier.length} cells.</small>` : ""}`;
    if (selected !== null) {
      const min = Math.min(...p.cells.filter((v) => v > 0)),
        dr = Math.abs(Math.floor(selected / p.cols) - Math.floor(p.goal / p.cols)),
        dc = Math.abs((selected % p.cols) - (p.goal % p.cols)),
        h = (config.heuristic === 'zero' ? 0 : config.heuristic === 'euclidean' ? Math.hypot(dr, dc) : dr + dc) * min,
        g = s?.g[selected],
        parent = s?.parents[selected];
      detail += `<h3 style="margin-top:16px">Cell (${Math.floor(selected / p.cols) + 1}, ${(selected % p.cols) + 1})</h3><dl><dt>Terrain cost</dt><dd>${p.cells[selected] || "wall"}</dd><dt>g / h / f</dt><dd>${format(g)} / ${h} / ${format(g + h)}</dd><dt>Parent</dt><dd>${parent == null ? "None" : `${Math.floor(parent / p.cols) + 1},${(parent % p.cols) + 1}`}</dd></dl>`;
    }
    detail += "</div>";
  }
  if (lab === "optimization" && s) {
    detail = `<div class="inspector"><dl><dt>Temperature</dt><dd>${Number(s.temperature).toFixed(4)}</dd><dt>Acceptance p</dt><dd>${s.candidate?.probability?.toFixed(4) ?? "None"}</dd><dt>Random draw</dt><dd>${s.candidate?.draw?.toFixed(4) ?? "None"}</dd><dt>Seed</dt><dd>${config.seed}</dd><dt>Candidate Δ</dt><dd>${s.candidate?.delta ?? "None"}</dd></dl></div>`;
  }
  if (["sudoku", "timetable"].includes(lab) && s) {
    const cur = s.current;
    detail = `<div class="inspector"><h3>${cur === null ? "Constraint state" : lab === "sudoku" ? `Cell r${Math.floor(cur / 9) + 1}c${(cur % 9) + 1}` : e(config.problem.sessions[cur].id)}</h3><p class="hint">${cur === null ? "All assignments are shown on the board." : `Domain: ${s.domains[cur].map((v) => (typeof v === "object" ? `${e(config.problem.slots[v.slot])}/${e(v.room)}` : v)).join(", ") || "∅ empty"}`}</p>${
      s.removed.length
        ? `<p class="hint">Removed: ${s.removed
            .slice(0, 12)
            .map((v) =>
              lab === "sudoku"
                ? `r${Math.floor(v.variable / 9) + 1}c${(v.variable % 9) + 1}:${v.value}`
                : `${e(config.problem.sessions[v.variable].id)}:${e(v.value.room)}@${v.value.slot + 1}`,
            )
            .join(" · ")}${s.removed.length > 12 ? " …" : ""}</p>`
        : ""
    }</div>`;
  }
  return `<div><span class="event-badge">${e(frame?.event?.replaceAll("-", " ") || "READY TO EXPLORE")}</span><p class="decision" aria-live="polite">${e(frame?.reason || "Configure your problem, then Run or take the first step. Every decision is recorded so you can go backwards without recomputing.")}</p></div><div><span class="subheading">PSEUDOCODE · ${e(labels[config.algorithm])}</span><ol class="pseudocode">${code.map((line, i) => `<li class="${i === frame?.line ? "active" : ""}"><span class="line-number">${i + 1}</span>${e(line)}</li>`).join("")}</ol></div>${detail}`;
}
