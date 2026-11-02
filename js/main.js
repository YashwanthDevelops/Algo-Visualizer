import { clone, escapeHTML as e, labels } from "./core.js";
import { icon } from "./icons.js";
import {
  fresh,
  algorithms,
  gridPreset,
  queensPreset,
  sudokuPreset,
  timetablePreset,
} from "./models.js";
import { winner } from "./algorithms/game.js";
import { timetableModel } from "./algorithms/csp.js";
import { Playback } from "./playback.js";
import {
  load,
  save,
  summary,
  importData,
  encodeConfiguration,
  decodeConfiguration,
} from "./storage.js";
import { validateConfiguration } from "./validation.js";
import { lessonHTML } from "./lessons.js";
import { mountQuestionWorkspace } from "./question-workspace.js";
import {
  labNames,
  descriptions,
  metricKeys,
  metricLabels,
  format,
  metricsHTML,
  pathSVG,
  queensSVG,
  miniBoard,
  scoreChart,
  sudokuHTML,
  timetableHTML,
  treeHTML,
  explanationHTML,
} from "./renderers.js";

const app = document.getElementById("app"),
  data = load(),
  names = {
    dashboard: "Dashboard",
    ...labNames,
    "question-visualizer": "Question Visualizer",
  },
  labIcons = {
    dashboard: "squares-four",
    pathfinding: "path",
    optimization: "crown-simple",
    game: "strategy",
    sudoku: "grid-nine",
    timetable: "calendar-dots",
    "question-visualizer": "path",
  };
const configs = Object.fromEntries(
  Object.keys(labNames).map((lab) => [
    lab,
    { ...fresh(lab), ...data.configs[lab] },
  ]),
);
let lab = "dashboard",
  result = null,
  comparison = null,
  worker = null,
  busy = false,
  requestId = 0,
  brush = "inspect",
  weight = 5,
  gridZoom = 1,
  selected = null,
  openNodes = new Set([0]),
  toastTimer = null,
  dashboardLab = "pathfinding",
  dashboardExperiment = null,
  pendingComparison = null,
  paintStroke = false,
  paintChanged = false,
  skipCellClick = false,
  historyUndo = null,
  visualCompare = null,
  compareWorker = null;
let questionWorkspace = null;
const playback = new Playback(updateFrame, updateControls);
const settingsMedia = window.matchMedia("(min-width:768px)");
let settingsExpanded = settingsMedia.matches;
settingsMedia.addEventListener("change", ({ matches }) => {
  settingsExpanded = matches;
  const panel = app.querySelector("details.settings");
  if (panel) panel.open = matches;
});
function cfg() {
  return configs[lab];
}
function notify(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 5000);
}
function persist() {
  data.configs = clone(configs);
  if (!save(data))
    notify(
      "Browser storage is unavailable or full. Your current experiment still works in memory.",
    );
}
function remember(entry) {
  data.history.unshift(entry);
  data.history = data.history.slice(0, 50);
  persist();
}
function cancel() {
  requestId++;
  worker?.terminate();
  compareWorker?.terminate();
  worker = null;
  compareWorker = null;
  busy = false;
  playback.pause();
}
function reset() {
  cancel();
  result = null;
  comparison = null;
  visualCompare = null;
  selected = null;
  openNodes = new Set([0]);
  playback.reset();
  render();
}
function navigate() {
  questionWorkspace?.destroy();
  questionWorkspace = null;
  cancel();
  result = null;
  comparison = null;
  visualCompare = null;
  selected = null;
  openNodes = new Set([0]);
  let hash = location.hash.slice(1).split("?")[0];
  const target = new URLSearchParams(location.search),
    encoded = target.get("config"),
    sharedLab = target.get("lab");
  if (encoded && sharedLab) {
    try {
      const decoded = decodeConfiguration(encoded);
      if (decoded.lab === sharedLab) {
        configs[sharedLab] = validateConfiguration(sharedLab, decoded.config);
        hash = sharedLab;
        persist();
        notify("Shared configuration loaded and validated.");
      }
    } catch (error) {
      notify(`Shared configuration was not loaded: ${error.message}`);
    }
  }
  lab = Object.hasOwn(names, hash) ? hash : "dashboard";
  playback.reset();
  render();
  if (data.recoveryWarnings?.length) notify(data.recoveryWarnings.join(" "));
  if (pendingComparison === lab) {
    pendingComparison = null;
    run(false, "compare");
  }
}
function selectOptions(values, current) {
  return values
    .map(
      (value) =>
        `<option value="${e(value)}" ${value === current ? "selected" : ""}>${e(labels[value] || value)}</option>`,
    )
    .join("");
}
function field(label, key, value, type = "number", attrs = "") {
  return `<div class="field"><label for="${key}">${label}</label><input id="${key}" data-param="${key}" type="${type}" value="${e(value)}" ${attrs}></div>`;
}
function selectField(label, key, values, current) {
  return `<div class="field select-field"><label for="${key}">${label}</label><span class="select-control"><select id="${key}" data-param="${key}">${values
    .map((v) => {
      const [val, text] = Array.isArray(v) ? v : [v, labels[v] || v];
      return `<option value="${e(val)}" ${val === current ? "selected" : ""}>${e(text)}</option>`;
    })
    .join("")}</select>${icon("caret-down", "select-chevron")}</span></div>`;
}
function settingsHTML() {
  const c = cfg();
  let extra = "";
  if (lab === "pathfinding")
    extra =
      selectField(
        "Example map",
        "preset",
        [
          ["weighted", "Weighted terrain"],
          ["maze", "Unweighted maze"],
          ["unreachable", "Unreachable goal"],
          ["blank", "Blank canvas"],
          ["custom", "Custom edited map"],
        ],
        c.preset || "custom",
      ) +
      field(
        "Rows",
        "gridRows",
        c.problem.rows,
        "number",
        'min="5" max="40" step="1"',
      ) +
      field(
        "Columns",
        "gridCols",
        c.problem.cols,
        "number",
        'min="5" max="40" step="1"',
      ) +
      selectField(
        "A* heuristic",
        "heuristic",
        [
          ["manhattan", "Manhattan distance"],
          ["euclidean", "Euclidean distance"],
        ],
        c.heuristic || "manhattan",
      ) +
      `<div class="field"><label for="grid-zoom">Grid zoom</label><input id="grid-zoom" type="range" min="1" max="2.5" step="0.1" value="${gridZoom}"><small>Scroll the map to inspect distant cells.</small></div><hr class="divider"><span class="subheading">GRID EDITOR</span><div class="brushes">${[
        ["inspect", "Inspect", "magnifying-glass"],
        ["start", "S Start", "map-pin"],
        ["goal", "G Goal", "flag"],
        ["wall", "Wall", "wall"],
        ["clear", "Clear", "eraser"],
        ["weight", "Weight", "barbell"],
      ]
        .map(
          ([id, text, glyph]) =>
            `<button type="button" data-brush="${id}" class="${brush === id ? "active" : ""}" aria-pressed="${brush === id}">${icon(glyph)}${text}</button>`,
        )
        .join("")}</div>` +
      field(
        "Terrain entry cost",
        "weight",
        weight,
        "number",
        'min="1" max="99" step="1"',
      ) +
      `<p class="hint">Click or drag to edit cells. Arrow keys move focus; Space/Enter applies the selected brush. Four-direction movement pays the cost of entering the next cell.</p>`;
  if (lab === "optimization")
    extra =
      field(
        "Board size",
        "size",
        c.problem.queens.length,
        "number",
        'min="4" max="12" step="1"',
      ) +
      field(
        "Random seed",
        "seed",
        c.seed,
        "number",
        'min="0" max="4294967295" step="1"',
      ) +
      selectField(
        "Starting arrangement",
        "arrangement",
        [
          ["random", "Seeded random"],
          ["aligned", "All queens in row 1"],
          ["stalled", "Plateau · N = 4"],
          ["local", "Local minimum · N = 8"],
          ["solved", "Solved · N = 4"],
          ["custom", "Custom arrangement"],
        ],
        c.arrangement || "custom",
      ) +
      `<div class="field"><label for="queen-rows">Rows by column (1-based)</label><input id="queen-rows" value="${c.problem.queens.map((v) => v + 1).join(", ")}" aria-describedby="queen-help"><small id="queen-help">One row number for each column.</small><button data-action="apply-queens" class="small-button" style="margin-top:7px">${icon("check")}Apply rows</button></div>` +
      `<details class="advanced"><summary>Advanced search settings</summary>${c.algorithm === "anneal" ? field("Initial temperature", "temperature", c.temperature, "number", 'min="0.001" max="1000" step="0.1"') + field("Cooling multiplier", "cooling", c.cooling, "number", 'min="0.001" max="0.9999" step="0.001"') : ""}${field("Sideways moves", "sidewaysLimit", c.sidewaysLimit ?? 0, "number", 'min="0" max="100" step="1"')}${field("Restarts", "restarts", c.restarts ?? 0, "number", 'min="0" max="20" step="1"')}</details>` +
      selectField(
        "Comparison starting boards",
        "trialStarts",
        [
          ["current", "Current board"],
          ["random", "Paired random boards"],
        ],
        c.trialStarts,
      ) +
      `<p class="hint">Hill climbing takes the best improving move. Annealing may accept worse moves to escape local minima.</p>`;
  if (lab === "game")
    extra =
      `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-pruning ${c.algorithm === "alphabeta" ? "checked" : ""}>Use alpha-beta pruning</label>` +
      selectField(
        "Your side",
        "human",
        [
          ["X", "X · move first"],
          ["O", "O · move second"],
        ],
        c.problem.ai === "O" ? "X" : "O",
      ) +
      selectField(
        "Move ordering",
        "ordering",
        [
          ["natural", "Square order 1 → 9"],
          ["center", "Center → corners → edges"],
        ],
        c.ordering,
      ) +
      selectField(
        "Example position",
        "position",
        [
          ["empty", "New game"],
          ["win", "Win in one move"],
          ["block", "Must block a threat"],
          ["midgame", "Inspect a midgame"],
          ["custom", "Current played position"],
        ],
        c.position || "custom",
      ) +
      `<details class="advanced"><summary>Advanced search</summary>${selectField("Depth limit", "depthLimit", [["0", "Full search"], ...Array.from({ length: 9 }, (_, i) => [String(i + 1), `Depth ${i + 1}`])], c.depthLimit || 0)}</details><p class="hint">Click an empty square on your turn. Replay the search or choose “Play AI move.” A depth limited result is an estimate, not a proven outcome.</p>`;
  if (lab === "sudoku")
    extra =
      selectField(
        "Puzzle preset",
        "puzzle",
        [
          ["easy", "Teaching puzzle · 36 blanks"],
          ["classic", "Classic · deeper search"],
          ["invalid", "Invalid · duplicate clue"],
          ["impossible", "Valid clues · no solution"],
          ["custom", "Custom entered puzzle"],
        ],
        c.puzzle || "custom",
      ) +
      selectField(
        "Choose next cell",
        "variableOrdering",
        [
          ["fixed", "Fixed row order"],
          ["mrv", "Smallest domain (MRV)"],
        ],
        c.variableOrdering || "fixed",
      ) +
      selectField(
        "Try values",
        "valueOrdering",
        [
          ["natural", "Natural order"],
          ["lcv", "Least constraining first"],
        ],
        c.valueOrdering || "natural",
      ) +
      `<p class="hint">Enter digits 1–9; blank clears a clue. Small digits show candidate domains during playback.</p>` +
      `<button data-action="clear-sudoku">${icon("eraser")}Clear all clues</button>`;
  if (lab === "timetable")
    extra =
      selectField(
        "Dataset",
        "dataset",
        [
          ["feasible", "Five sessions · feasible"],
          ["impossible", "Teacher availability · impossible"],
          ["custom", "Custom dataset"],
        ],
        c.dataset || "custom",
      ) +
      `<details class="basic-timetable"><summary>Build a timetable</summary>${field("Time slots (comma separated)", "tt-slots", (c.problem.slots || []).join(", "), "text")}${field("Rooms (comma separated)", "tt-rooms", (c.problem.rooms || []).map((r) => r.id).join(", "), "text")}${field("Teachers (comma separated)", "tt-teachers", [...new Set((c.problem.sessions || []).map((s) => s.teacher))].join(", "), "text")}${field("Sessions (comma separated)", "tt-sessions", (c.problem.sessions || []).map((s) => s.name).join(", "), "text")}<button data-action="apply-timetable-basic" class="small-button">${icon("check")}Apply timetable</button></details><details class="advanced"><summary>Advanced dataset JSON</summary><label for="timetable-json">Slots, rooms, teachers, sessions</label><textarea id="timetable-json" rows="16" spellcheck="false">${e(JSON.stringify(c.problem, null, 2))}</textarea><button data-action="apply-timetable" class="small-button">${icon("check")}Apply JSON</button></details><p class="hint">Sessions share no teacher, group, or room in the same slot. Advanced JSON supports availability and allowed pair constraints.</p>`;
  return `<summary class="panel-header"><div class="settings-title"><h3 class="with-icon">${icon("sliders-horizontal")}Problem settings</h3><small class="settings-current">${e(labels[c.algorithm])}</small></div><span class="settings-disclosure">${icon("caret-down")}<span>Edit settings</span></span></summary><div class="panel-body">${selectField("Algorithm", "algorithm", algorithms[lab], c.algorithm)}${extra}${lab !== "game" ? field(lab === "optimization" ? "Iteration limit" : "Search limit", "limit", c.limit, "number", 'min="1" max="1000000" step="1"') : ""}<p class="hint">${lab === "optimization" ? "20 paired seeded trials in comparisons." : "Comparisons use identical inputs, one warm-up, and five timed runs."} Reset before changing an active experiment.</p></div>`;
}
function playbackHTML() {
  return `<div class="playback"><div class="playback-buttons"><button id="run" class="primary" data-action="run">${icon("play")}<span class="button-text">Run</span></button><button id="pause" data-action="pause">${icon("pause")}Pause</button><button id="previous" data-action="previous">${icon("skip-back")}Previous</button><button id="next" data-action="next">${icon("skip-forward")}Next</button><button data-action="jump-prev">${icon("skip-back")}Key event</button><button data-action="jump-next">Key event ${icon("skip-forward")}</button><button id="reset" data-action="reset">${icon("arrow-counter-clockwise")}Reset</button><span class="step-count" id="step-count">Ready</span></div><div class="timeline"><div><label for="scrub">Recorded decisions <span id="event-progress">0</span></label><div class="timeline-track"><input type="range" id="scrub" min="0" max="0" value="0" aria-label="Seek a recorded step"><div id="timeline-markers" aria-hidden="true"></div></div><small id="trace-gap-label" class="hint"></small></div><div><label for="speed">Speed <span id="speed-label">${playback.speed} steps/s</span></label><input type="range" id="speed" min="1" max="30" value="${playback.speed}"></div></div><p class="playback-hint">Space play/pause · ← / → step · J / K previous/next key event</p></div>`;
}
function gameHTML(frame) {
  const c = cfg(),
    win = winner(c.problem.board),
    human = c.problem.ai === "X" ? "O" : "X",
    canMove = !busy && !win && c.problem.turn === human;
  const message = win
    ? win === "draw"
      ? "Game over · draw"
      : `Game over · ${win} wins`
    : busy
      ? "Computing the AI decision…"
      : c.problem.turn === human
        ? `Your turn · ${human}`
        : result
          ? "AI decision ready · replay or play the move"
          : `AI to move · ${c.problem.ai}`;
  return `<div class="game-layout"><div><div class="game-board" aria-label="Tic-Tac-Toe board">${c.problem.board.map((v, i) => `<button data-game="${i}" class="${v.toLowerCase()}" ${!canMove || v ? "disabled" : ""} aria-label="Square ${i + 1}, ${v || "empty"}">${v || ""}</button>`).join("")}</div><p class="game-message">${e(message)}</p>${result?.output.move !== null && result && c.problem.turn === c.problem.ai && !win ? `<button class="primary" data-action="apply-ai">${icon("play")}Play AI move · #${result.output.move + 1}</button>` : ""}${frame ? `<p class="hint" style="margin-top:14px">Current search position · depth ${frame.state.depth || 0}</p><div style="width:70px">${miniBoard(frame.state.board)}</div>` : ""}<button data-action="new-game" class="small-button" style="margin-top:14px">${icon("arrow-counter-clockwise")}New game</button></div><div><div class="subheading" style="margin-bottom:10px">SEARCH TREE · EXPAND A NODE</div>${result ? `<button data-action="focus-branch" class="small-button" style="margin-bottom:10px">${icon("tree-structure")}Reveal current branch</button>` : ""}${result?.output.treeTruncated ? `<p class="hint">Retained ${result.output.treeRetained.toLocaleString()} nodes including the top two levels; all ${result.metrics.nodesEvaluated.toLocaleString()} nodes were evaluated. Use a midgame for a smaller full tree.</p>` : ""}<div class="tree-container" id="tree">${treeHTML(result?.output.tree, frame ? { ...frame, ai: c.problem.ai } : null, openNodes)}</div></div></div>`;
}
function visualHTML(frame) {
  if (busy)
    return '<div class="loading">Computing in a Web Worker…<br><small>Reset cancels this computation.</small></div>';
  const c = cfg(),
    s = frame?.state;
  if (lab === "pathfinding") {
    const width = c.problem.cols * 36 * gridZoom;
    return `<div class="grid-scroll">${pathSVG(c.problem, s, selected).replace('class="grid-svg"', `class="grid-svg" style="width:${width}px;max-width:none"`)}</div><div class="legend"><span><b>S / G</b>start / goal</span><span><b>×</b>wall</span><span><b>9</b>entry cost</span><span><b>◎</b>current</span><span><b>○</b>frontier</span><span><b>·</b>expanded</span><span><b>↗</b>path</span></div>`;
  }
  if (lab === "optimization") {
    const q = s?.queens || c.problem.queens;
    return `${queensSVG(q, s?.candidate)}<div class="legend"><span>${icon("crown-simple")}queen</span><span><b>?</b>candidate move</span><span><b>0</b>conflicts = solved</span></div>${s ? scoreChart(s.chart) : ""}${
      s?.candidates?.length
        ? `<div class="candidate-table"><table class="compact-table"><thead><tr><th>Candidate</th><th>Conflicts</th><th>Change</th></tr></thead><tbody>${s.candidates
            .slice(-20)
            .map(
              (v) =>
                `<tr><td>Column ${v.col + 1} → row ${v.row + 1}</td><td>${v.score}</td><td>${v.delta >= 0 ? "+" : ""}${v.delta}</td></tr>`,
            )
            .join(
              "",
            )}</tbody></table><p class="hint">Latest ${Math.min(20, s.candidates.length)} candidates of this iteration.</p></div>`
        : ""
    }`;
  }
  if (lab === "game") return gameHTML(frame);
  if (lab === "sudoku")
    return `${sudokuHTML(c, s)}<div class="legend"><span><b>Bold</b>given clue</span><span><b>Small digits</b>domain</span><span><b>Outline</b>current variable</span><span><b>Reject</b>explained alongside</span></div>`;
  return `${timetableHTML(c.problem, s)}<div class="legend"><span><b>×</b>unavailable room</span><span><b>Free</b>available slot</span><span><b>Session label</b>assigned placement</span></div>`;
}
function guideHTML() {
  const text = {
    pathfinding:
      "BFS minimizes the number of moves when each move has equal cost. UCS minimizes cumulative entry cost. Greedy and DFS do not guarantee cheapest routes. A* uses h = Manhattan distance × minimum traversable entry cost. This heuristic is admissible and consistent on the four-direction grid: it never overestimates, and obeys h(n) ≤ cost(n,n′) + h(n′). UCS/A* update cheaper paths and stop when the goal is selected from the priority queue.",
    optimization:
      "A pair attacks if its queens share a row or diagonal. Each unordered pair is counted once. Hill climbing evaluates every move and stops if none strictly improves the score. Equal alternatives are called a plateau; strictly worse alternatives indicate a strict local minimum. Simulated annealing can escape by accepting a worse proposal with exp(−Δ/T), but a finite cooling schedule does not guarantee success.",
    game: "MAX is the AI, MIN is its opponent. Terminal utility is +1 for an AI win, −1 for a loss, and 0 for a draw. Alpha-beta skips siblings when α ≥ β. It returns the same root utility as Minimax; ordering affects savings and ties. Cutoff-node values may be bounds rather than exact utilities. The tree outlines the completed search, but values appear only as their replay events occur.",
    sudoku:
      "Every row, column, and 3×3 box must contain distinct digits 1-9. Basic backtracking checks a value against assigned peers. Forward checking also removes inconsistent values from unassigned peers, detects empty domains early, and restores domains when backtracking. Invalid givens are rejected before search; exhaustive failure and a search limit are separate outcomes.",
    timetable:
      "Every required session is a variable. A domain value pairs a time slot with a room allowed for that session. Teacher/room availability constrains initial domains. Two simultaneous sessions cannot share a teacher, group, or room. Forward checking removes conflicting possibilities from unscheduled sessions. Exhausted search proves infeasibility; a search limit does not.",
  };
  const links = {
    pathfinding: [
      "Berkeley informed search",
      "https://inst.eecs.berkeley.edu/~cs188/textbook/search/informed.html",
    ],
    optimization: [
      "Berkeley local search",
      "https://inst.eecs.berkeley.edu/~cs188/textbook/search/local.html",
    ],
    game: [
      "Berkeley Minimax",
      "https://inst.eecs.berkeley.edu/~cs188/textbook/games/minimax.html",
    ],
    sudoku: [
      "Berkeley constraint filtering",
      "https://inst.eecs.berkeley.edu/~cs188/textbook/csp/filtering.html",
    ],
    timetable: [
      "Berkeley constraint filtering",
      "https://inst.eecs.berkeley.edu/~cs188/textbook/csp/filtering.html",
    ],
  };
  return `<details class="guide"><summary>Algorithm rules & correctness</summary><p>${text[lab]}</p><p><a href="${links[lab][1]}" target="_blank" rel="noopener">${links[lab][0]}${icon("arrow-up-right")}</a></p></details>`;
}
function visualComparisonBoardsHTML() {
  if (!visualCompare) return "";
  return ["left", "right"]
    .map((key) => {
      const pack = visualCompare[key];
      const result = pack.result;
      const index = Math.round(
        visualCompare.progress * Math.max(0, result.steps.length - 1),
      );
      const frame = result.steps[index];
      const state = frame?.state;
      let view = "";
      if (lab === "pathfinding") view = pathSVG(cfg().problem, state);
      if (lab === "optimization")
        view = queensSVG(
          state?.queens || cfg().problem.queens,
          state?.candidate,
        );
      if (lab === "sudoku") view = sudokuHTML(cfg(), state);
      if (lab === "timetable") view = timetableHTML(cfg().problem, state);
      if (lab === "game")
        view = `<div class="game-board">${(state?.board || cfg().problem.board)
          .map((value) => `<span>${e(value || "·")}</span>`)
          .join("")}</div>`;
      return `<section class="compare-board"><h4>${e(labels[pack.algorithm])}</h4><div class="compare-visual">${view}</div><p><b>Outcome:</b> ${e(result.status)} · step ${index + 1}/${result.steps.length} · event ${e(frame?.event || "none")}${result.traceSkipped ? ` · ${result.traceSkipped} events omitted` : ""}</p><p>${e(frame?.reason || "No recorded decision")}</p></section>`;
    })
    .join("");
}

function visualComparisonHTML() {
  if (!visualCompare) return "";
  return `<section class="visual-comparison"><h3>Same input · independent traces</h3><p class="hint">Normalized recorded progress is synchronized across two independent traces. Each side shows its own step and event count. This does not represent equal work or equal time.</p><label class="normalized-progress">Recorded progress <input id="visual-progress" type="range" min="0" max="1000" value="${Math.round(visualCompare.progress * 1000)}"><output id="visual-progress-label">${Math.round(visualCompare.progress * 100)}%</output></label><div class="compare-boards">${visualComparisonBoardsHTML()}</div></section>`;
}
function comparisonHTML(entry) {
  if (!entry) return "";
  const target = entry.lab || lab,
    rows = entry.results || entry;
  return `<div class="table-wrap"><table class="history-table"><thead><tr><th>Algorithm</th><th>Outcome</th>${metricKeys[target].map((key) => `<th>${metricLabels[key]}</th>`).join("")}${target === "optimization" ? "<th>Success rate</th>" : ""}</tr></thead><tbody>${rows.map((r) => `<tr><td>${e(labels[r.algorithm])}</td><td>${e(r.status)}</td>${metricKeys[target].map((key) => `<td class="mono">${format(r.metrics[key], key)}</td>`).join("")}${target === "optimization" ? `<td>${Math.round(r.successRate * 100)}% / ${r.trials} trials</td>` : ""}</tr>`).join("")}</tbody></table></div><p class="metric-guidance">${metricKeys[target].map((key) => `<b>${metricLabels[key]}:</b> ${metricDirection(key)}`).join(" ")}</p><p class="status-note">${target === "optimization" ? `20 paired trials on ${entry.config?.trialStarts === "random" ? "seeded random boards" : "the configured starting board"}, with consecutive seeds. Each trial uses the median of three trace-free timing repetitions; both algorithms receive identical inputs.` : "Medians over five trace-free runs after one warm-up, with the exact same input and ordering."} Computation excludes animation, DOM rendering, worker startup, and message transfer.</p>`;
}
function renderLab() {
  const c = cfg(),
    frame = playback.steps[playback.index],
    algPair = algorithms[lab],
    active = document.activeElement,
    focusId = active?.id || ``;
  app.setAttribute("aria-busy", String(busy));
  app.innerHTML = `<section class="page-heading"><div><h1>${labNames[lab]}</h1><p>${descriptions[lab]}</p></div><div class="heading-actions"><button data-action="save-setup">${icon("bookmark-simple")}Save setup</button><button data-action="share-setup">${icon("link-simple")}Share setup</button><button data-action="compare" ${busy ? "disabled" : ""}>${icon("chart-bar")}Compare algorithms</button></div></section><div class="visual-compare-controls"><label>Trace A<select id="visual-alg-a">${selectOptions(algPair, cfg().algorithm)}</select></label><label>Trace B<select id="visual-alg-b">${selectOptions(
    algPair.filter(
      (a) => a !== (visualCompare?.left.algorithm || cfg().algorithm),
    ),
    visualCompare?.right.algorithm ||
      algPair.find((a) => a !== cfg().algorithm),
  )}</select></label><button data-action="compare-visual" ${busy ? "disabled" : ""}>Compare visual traces</button></div><div id="error-slot" role="alert"></div><div class="lab-layout"><details class="panel settings" ${settingsExpanded ? "open" : ""}>${settingsHTML()}</details><section><div class="work-grid"><div class="panel stage"><div class="panel-header"><h2>${lab === "game" ? "Board & decision tree" : lab === "sudoku" ? "Constraint board" : lab === "timetable" ? "Session placements" : lab === "optimization" ? "The search landscape" : "Search map"}</h2><span id="run-status" class="${busy ? "busy-indicator" : "result-status"}">${busy ? "Computing" : playback.steps.length ? "Recorded playback" : "Ready"}</span></div><div class="canvas-area" id="visualization">${visualHTML(frame)}</div>${playbackHTML()}${result?.traceSkipped ? `<div class="trace-warning">${result.traceSkipped.toLocaleString()} events omitted after the trace cap. Playback holds a partial trace; final outcome and full metrics are shown separately.</div>` : ""}</div><aside class="panel explanation"><div class="panel-header"><h3 class="with-icon">${icon("note-pencil")}Decision notebook</h3></div><div class="panel-body" id="explanation">${explanationHTML(lab, c, frame, selected)}${lessonHTML(lab, result, frame)}</div></aside></div><section class="panel results"><div class="panel-header"><h3 class="with-icon">${icon("chart-bar")}Experiment results</h3><span id="result-status" class="result-status ${result && result.status !== "solved" && result.status !== "terminal" ? "warning" : ""}">${e(result?.status?.replaceAll("-", " ") || "Not run")}</span></div><div class="panel-body"><p class="replay-state">${frame ? `Replay position: ${playback.index + 1} of ${playback.steps.length} · ${e(frame.event?.replaceAll("-", " ") || "recorded decision")}` : "No replay frame selected"}${result ? ` · Final engine outcome: ${e(result.status)}` : ""}</p><div class="metrics" id="metrics">${metricsHTML(lab, frame ? frame.metrics : {})}</div>${result ? `<div class="final-run-metrics"><h4>Complete run · final engine metrics</h4><div class="metrics">${metricsHTML(lab, result.metrics)}</div></div>` : ""}<p class="status-note" id="result-note">${result ? "Replay counts follow the selected trace frame. Final outcome and complete-run timing remain available above." : "Results will appear here after a real algorithm run."}</p>${visualComparisonHTML()}${comparison ? comparisonHTML(comparison) : ""}${guideHTML()}</div></section></section></div><span id="playback-live" class="sr-only" aria-live="polite" aria-atomic="true"></span>`;
  const locked = busy || !!playback.steps.length;
  app
    .querySelectorAll(
      ".settings input,.settings select,.settings textarea,.settings button",
    )
    .forEach((el) => {
      el.disabled = locked && el.dataset.brush !== "inspect";
    });
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  updateControls();
}
function preview(l) {
  if (l === "pathfinding") return pathSVG(gridPreset(), {}, null, true);
  if (l === "optimization")
    return queensSVG([0, 4, 7, 5, 2, 6, 1, 3], null, true);
  if (l === "game") return miniBoard(["X", "O", "", "", "X", "", "O", "", ""]);
  if (l === "sudoku")
    return `<svg viewBox="0 0 150 80" role="img" aria-label="Sudoku puzzle preview">${[5, 3, 0, 6, 0, 0, 0, 9, 8, 8, 0, 0, 4, 0, 0, 7, 0, 0].map((v, i) => `<rect x="${(i % 9) * 16}" y="${Math.floor(i / 9) * 32 + 7}" width="15" height="29" fill="${i % 2 ? "var(--color-board-light)" : "var(--color-canvas)"}"/>${v ? `<text x="${(i % 9) * 16 + 8}" y="${Math.floor(i / 9) * 32 + 27}" text-anchor="middle" fill="var(--color-ink)" font-size="14">${v}</text>` : ""}`).join("")}</svg>`;
  return `<svg viewBox="0 0 240 95" role="img" aria-label="Five session requirements, before scheduling">${timetablePreset()
    .sessions.map(
      (s, i) =>
        `<rect x="10" y="${i * 17 + 5}" width="220" height="14" rx="1" fill="var(--color-board-light)"/><text x="20" y="${i * 17 + 16}" fill="var(--color-ink-2)" font-size="10">${e(s.name)} · ${s.teacher} · Group ${s.group}</text>`,
    )
    .join("")}</svg>`;
}
function dashboard() {
  const comparisons = data.history.filter(
    (h) => h.type === "comparison" && h.lab === dashboardLab,
  );
  const chosen =
    comparisons.find((h) => h.id === dashboardExperiment) || comparisons[0];
  dashboardExperiment = chosen?.id || null;
  const labs = Object.keys(labNames),
    featured = "pathfinding",
    others = labs.filter((id) => id !== featured);
  const summaries = {
    optimization: "Move queens toward a board with zero conflicts.",
    game: "Play Tic-Tac-Toe and inspect the opponent’s search.",
    sudoku: "Watch assignments, domain reductions, and backtracking.",
    timetable: "Schedule classes with availability and conflict constraints.",
  };
  const runCount = data.history.filter(
    (h) => h.type !== "configuration",
  ).length;
  app.innerHTML = `
    <section class="hero">
      <div><h1>Follow every decision.</h1><p>Configure a problem, replay the search, and compare how algorithms work. Your experiments stay in this browser.</p></div>
      <div class="heading-actions"><a class="button-link primary" href="#question-visualizer">${icon("path")}Visualize a question</a><a class="button-link" href="README.md" target="_blank" rel="noopener">${icon("book-open")}Project guide</a></div>
    </section>
    <div class="section-title"><h2>Choose a problem</h2><small>Five labs · shared playback controls</small></div>
    <section class="lab-index" aria-label="Learning laboratories">
      <a class="lab-feature" href="#${featured}">
        <div class="lab-feature-copy"><h2>${labNames[featured]}</h2><p>Edit a map and follow the frontier. Compare the fewest moves with the lowest movement cost.</p>
          <div class="method-list">${algorithms[featured].map((a) => `<span>${e(labels[a])}</span>`).join("")}</div>
        </div>
        <div class="lab-feature-map">${preview(featured)}</div>
        <span class="lab-open">Open pathfinding${icon("arrow-up-right")}</span>
      </a>
      <div class="lab-list">${others
        .map(
          (l) => `
        <a class="lab-row" href="#${l}">
          <span class="lab-row-preview">${preview(l)}</span>
          <span class="lab-row-copy"><span class="lab-row-title">${l === "optimization" ? "N-Queens" : labNames[l]}</span><span class="lab-row-description">${summaries[l]}</span><span class="lab-methods">${algorithms[l].map((a) => labels[a]).join(" · ")}</span></span>
          <span class="lab-row-arrow">${icon("arrow-up-right")}</span>
        </a>`,
        )
        .join("")}
      </div>
    </section>
    <section class="dashboard-section">
      <div class="section-title"><div><h2 class="with-icon">${icon("chart-bar")}Compare results</h2><p class="section-intro">Same input. Different algorithms. Measured computation.</p></div>${runCount ? `<span class="section-count">${runCount} recorded runs</span>` : ""}</div>
      <div class="panel"><div class="panel-body">
        <div class="comparison-controls">
          <label>Lab<span class="select-control"><select id="dashboard-lab">${labs.map((l) => `<option value="${l}" ${l === dashboardLab ? "selected" : ""}>${labNames[l]}</option>`).join("")}</select>${icon("caret-down", "select-chevron")}</span></label>
          ${
            chosen
              ? `
            <label>Experiment<span class="select-control"><select id="dashboard-experiment">${comparisons.map((h) => `<option value="${h.id}" ${h.id === chosen.id ? "selected" : ""}>${e(new Date(h.date).toLocaleString())}</option>`).join("")}</select>${icon("caret-down", "select-chevron")}</span></label>
            <label>Metric<span class="select-control"><select id="chart-metric">${metricKeys[dashboardLab].map((key) => `<option value="${key}">${metricLabels[key]}</option>`).join("")}</select>${icon("caret-down", "select-chevron")}</span></label>`
              : ""
          }
          <button data-action="dashboard-compare" class="primary">${icon("chart-bar")}Run comparison</button>
        </div>
        ${chosen ? `<div id="comparison-chart">${comparisonChart(chosen, metricKeys[dashboardLab][0])}</div>${comparisonHTML(chosen)}` : `<div class="empty-state">${icon("chart-bar")}<div><strong>No comparison recorded.</strong>Choose a lab and run its algorithms on the same input.</div></div>`}
      </div></div>
    </section>
    <section class="dashboard-section">
      <div class="section-title"><div><h2 class="with-icon">${icon("clock-counter-clockwise")}Experiment history</h2><p class="section-intro">Revisit an input or export your results.</p></div><div class="heading-actions"><button data-action="import" class="small-button">${icon("upload-simple")}Import JSON</button><button data-action="export" class="small-button">${icon("download-simple")}Export JSON</button><button data-action="clear-history" class="small-button danger">${icon("trash")}Clear history</button>${historyUndo ? `<button data-action="undo-clear" class="small-button">${icon("arrow-counter-clockwise")}Undo clear</button>` : ""}</div></div>
      <div class="panel">${
        data.history.length
          ? `
        <div class="table-wrap"><table class="history-table"><thead><tr><th>When</th><th>Laboratory</th><th>Experiment</th><th>Outcome</th><th>Revisit</th></tr></thead><tbody>
          ${data.history.map((h) => `<tr><td>${e(new Date(h.date).toLocaleString())}</td><td>${labNames[h.lab]}</td><td>${h.type === "comparison" ? `${h.results.length} algorithms compared` : h.type === "configuration" ? (h.name ? `Setup · ${e(h.name)}` : "Saved configuration") : e(labels[h.algorithm])}</td><td>${e(h.status || "recorded")}</td><td><button data-restore="${h.id}">${icon("arrow-up-right")}Load input</button></td></tr>`).join("")}
        </tbody></table></div>`
          : `<div class="empty-state history-empty">${icon("bookmark-simple")}<div><strong>No experiments saved.</strong>Run an algorithm or save a setup in any lab to begin.</div></div>`
      }
      </div>
    </section>
    <footer class="app-footer"><span>Search & Optimization Playground</span><a href="docs/ALGORITHMS.md" target="_blank" rel="noopener">Algorithm reference${icon("arrow-up-right")}</a><span>Stored locally · computation runs in your browser</span></footer>
  `;
}
const metricGuidance = {
  expanded:
    "Search effort for the same map and outcome; fewer expansions means less search work.",
  discovered: "Cells reached so far; this is progress, not a quality score.",
  maxFrontier:
    "Peak queue size, a memory-use indicator. Lower is smaller memory demand.",
  pathLength:
    "Number of moves in the returned route. Shorter routes use fewer steps, but may cost more on weighted terrain.",
  pathCost:
    "Total movement cost for the returned route. Lower cost is better when a route is found.",
  executionMs:
    "Elapsed algorithm time for this run; lower means faster measured computation.",
  candidateEvaluations:
    "N-Queens score calculations; fewer means less evaluation work when final conflicts are comparable.",
  iterations:
    "Search iterations; interpret with the final conflict count and search limit.",
  currentScore:
    "Attacking queen pairs in the current state. Zero is solved; lower is better.",
  bestScore:
    "Best attacking-pair count found. Zero is solved; lower is better.",
  worseAccepted:
    "Annealing moves accepted despite increasing conflicts. This is a strategy signal, not a score to minimize.",
  sidewaysMoves:
    "Equal-score moves used to cross plateaus; this describes search behavior.",
  restarts:
    "Additional starting trajectories; interpret alongside the best conflict score.",
  nodesEvaluated:
    "Game-tree states inspected. Fewer can mean less work when outcomes are equally proven.",
  terminalEvaluations:
    "Terminal game positions scored; indicates searched coverage, not direct quality.",
  heuristicEvaluations:
    "Non-terminal cutoff positions estimated. These values are not proven game outcomes.",
  depthCutoffs:
    "Branches stopped at the configured depth. A cutoff is not a proof of the game result.",
  cutoffs:
    "Alpha-beta branches skipped; more cutoffs can reduce work, depending on ordering.",
  searchDepth:
    "Deepest line examined. Greater depth gives more look-ahead, with higher search cost.",
  assignmentsAttempted:
    "Constraint values tried; fewer indicates less search when the same solution status is reached.",
  backtracks:
    "Assignments undone after conflicts. Fewer can indicate easier search on the same instance.",
  valuesRemoved:
    "Candidate domain values pruned; a measure of propagation, not inherently better or worse.",
  assigned: "Variables assigned at this replay point.",
  total: "Variables required by this problem.",
};
function metricDirection(key) {
  return (
    metricGuidance[key] ||
    "Compare this measure alongside each algorithm’s outcome."
  );
}
function comparisonChart(entry, key) {
  const rows = entry.results,
    valid = rows.filter((r) => Number.isFinite(r.metrics[key]));
  if (!valid.length)
    return '<p class="hint">This metric has no finite result for this experiment.</p>';
  const max = Math.max(1, ...valid.map((r) => r.metrics[key])),
    height = rows.length * 38 + 25;
  return `<p class="metric-guidance">${metricDirection(key)}</p><svg class="comparison-chart" style="height:${height}px" viewBox="0 0 700 ${height}" role="img" aria-label="${metricLabels[key]} by algorithm. ${metricDirection(key)}">${rows.map((r, i) => `<text x="0" y="${i * 38 + 21}" fill="var(--color-ink-2)">${e(labels[r.algorithm])}</text><rect x="170" y="${i * 38 + 6}" width="${Number.isFinite(r.metrics[key]) ? Math.max(1, (r.metrics[key] / max) * 390) : 0}" height="22" rx="2" fill="var(--color-accent)"/><text x="${Number.isFinite(r.metrics[key]) ? 180 + (r.metrics[key] / max) * 390 : 180}" y="${i * 38 + 22}">${format(r.metrics[key], key)}</text>`).join("")}</svg>`;
}
function render() {
  document.getElementById("breadcrumb").textContent =
    lab === "dashboard" ? "Overview" : names[lab];
  document.getElementById("navigation").innerHTML = Object.entries(names)
    .map(
      ([id, name]) =>
        `<a href="#${id}" class="nav-link ${id === lab ? "active" : ""}" ${id === lab ? 'aria-current="page"' : ""}>${icon(labIcons[id], "nav-icon")}<span>${id === "optimization" ? "N-Queens" : id === "timetable" ? "Timetable" : id === "game" ? "Game AI" : name}</span></a>`,
    )
    .join("");
  if (lab === "dashboard") dashboard();
  else if (lab === "question-visualizer") {
    questionWorkspace = mountQuestionWorkspace(app, { notify });
  } else renderLab();
}
function updateControls() {
  if (lab === "dashboard") return;
  const get = (id) => document.getElementById(id),
    has = !!playback.steps.length;
  if (!get("run")) return;
  get("run").disabled = busy;
  get("run").querySelector(".button-text").textContent = playback.timer
    ? "Running"
    : has
      ? "Resume"
      : "Run";
  get("pause").disabled = !playback.timer;
  get("previous").disabled = !has || playback.index === 0;
  get("next").disabled =
    busy || (has && playback.index === playback.steps.length - 1);
  const resetLabel = busy ? "Cancel computation" : "Reset";
  if (get("reset").textContent !== resetLabel)
    get("reset").innerHTML =
      icon(busy ? "stop" : "arrow-counter-clockwise") + resetLabel;
  get("step-count").textContent = busy
    ? "Computing…"
    : has
      ? `Step ${playback.index + 1} / ${playback.steps.length}`
      : "Ready";
  get("scrub").disabled = !has;
  get("scrub").max = Math.max(0, playback.steps.length - 1);
  get("scrub").value = playback.index;
  get("event-progress").textContent = has
    ? `Event ${playback.steps[playback.index].eventIndex}`
    : "0";
  get("speed-label").textContent = `${playback.speed} steps/s`;
  const marks = get("timeline-markers");
  if (marks && has) {
    const ids = new Set(playback.jumpPoints);
    marks.innerHTML = playback.steps
      .map((s, i) =>
        ids.has(i)
          ? `<i style="left:${playback.steps.length > 1 ? (i / (playback.steps.length - 1)) * 100 : 0}%" title="${e(s.event || "Key event")}"></i>`
          : "",
      )
      .join("");
  }
  const gap = get("trace-gap-label");
  if (gap && result?.traceSkipped) {
    const before = playback.steps[playback.index - 1],
      now = playback.steps[playback.index],
      crossed = before && now && now.eventIndex > before.eventIndex + 1;
    gap.textContent = crossed
      ? `Trace gap: events ${before.eventIndex + 1}–${now.eventIndex - 1} omitted; final replay event follows the retained trace.`
      : `${result.traceSkipped.toLocaleString()} events omitted after the trace cap; playback shows retained recorded progress.`;
  } else if (gap) gap.textContent = "";
}
function updateFrame(frame) {
  if (lab === "dashboard" || !document.getElementById("visualization")) return;
  const visualization = document.getElementById("visualization"),
    focused = document.activeElement?.matches("[data-cell]")
      ? document.activeElement.dataset.cell
      : null,
    treeFocus = document.activeElement?.closest("[data-tree]")?.dataset.tree,
    html = visualHTML(frame);
  if (
    lab === "pathfinding" &&
    !busy &&
    visualization.querySelector(".grid-svg")
  ) {
    const holder = document.createElement("template");
    holder.innerHTML = html;
    const oldSvg = visualization.querySelector(".grid-svg"),
      newSvg = holder.content.querySelector(".grid-svg");
    if (newSvg) {
      oldSvg.setAttribute("aria-label", newSvg.getAttribute("aria-label"));
      oldSvg.setAttribute("style", newSvg.getAttribute("style") || "");
      for (const fresh of newSvg.querySelectorAll(".cell")) {
        const old = oldSvg.querySelector(`[data-cell="${fresh.dataset.cell}"]`);
        if (!old) continue;
        for (const a of [...old.attributes])
          if (!fresh.hasAttribute(a.name)) old.removeAttribute(a.name);
        for (const a of [...fresh.attributes])
          old.setAttribute(a.name, a.value);
        const oldRect = old.querySelector("rect"),
          newRect = fresh.querySelector("rect");
        for (const a of [...oldRect.attributes])
          if (!newRect.hasAttribute(a.name)) oldRect.removeAttribute(a.name);
        for (const a of [...newRect.attributes])
          oldRect.setAttribute(a.name, a.value);
        const oldText = old.querySelector("text"),
          newText = fresh.querySelector("text");
        oldText.textContent = newText.textContent;
        for (const a of [...oldText.attributes])
          if (!newText.hasAttribute(a.name)) oldText.removeAttribute(a.name);
        for (const a of [...newText.attributes])
          oldText.setAttribute(a.name, a.value);
      }
    }
  } else visualization.innerHTML = html;
  document.getElementById("explanation").innerHTML =
    explanationHTML(lab, cfg(), frame, selected) +
    lessonHTML(lab, result, frame);
  document.getElementById("metrics").innerHTML = metricsHTML(
    lab,
    frame ? frame.metrics : {},
  );
  const live = document.getElementById("playback-live");
  if (live && !playback.timer && frame)
    live.textContent = `${frame.event || "Step"}: ${frame.reason || ""}`;
  if (focused !== null)
    document
      .querySelector(`[data-cell="${focused}"]`)
      ?.focus({ preventScroll: true });
  if (treeFocus !== undefined)
    document
      .querySelector(`[data-tree="${treeFocus}"] summary`)
      ?.focus({ preventScroll: true });
  updateControls();
}
function run(auto = true, type = "run") {
  if (busy) return;
  if (type === "run" && playback.steps.length) {
    auto ? playback.play() : playback.next();
    return;
  }
  if (location.protocol === "file:") {
    notify(
      "Launch with a local HTTP server. Module workers cannot run reliably from file://. See README.",
    );
    return;
  }
  compareWorker?.terminate();
  compareWorker = null;
  playback.pause();
  busy = true;
  const id = ++requestId,
    input = clone(cfg()),
    target = lab;
  renderLab();
  try {
    worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
  } catch (error) {
    busy = false;
    renderLab();
    notify(error.message);
    return;
  }
  worker.onmessage = ({ data: message }) => {
    if (message.id !== requestId || lab !== target) return;
    worker?.terminate();
    worker = null;
    busy = false;
    if (message.error) {
      renderLab();
      document.getElementById("error-slot").innerHTML =
        `<div class="alert">${e(message.error)}</div>`;
      return;
    }
    if (type === "compare") {
      comparison = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        type: "comparison",
        lab: target,
        config: input,
        results: message.result,
        status: "compared",
      };
      remember(comparison);
      renderLab();
      notify(
        "Comparison saved. Open Dashboard to explore the chart and export results.",
      );
    } else {
      result = message.result;
      openNodes = new Set([0]);
      remember(summary(target, input, result));
      playback.load(result.steps);
      renderLab();
      if (auto) playback.play();
      else if (target === "game")
        notify("AI decision ready. Replay the search or play the chosen move.");
    }
  };
  worker.onerror = (error) => {
    cancel();
    renderLab();
    document.getElementById("error-slot").innerHTML =
      `<div class="alert">${e(error.message || "Worker failed. Launch through HTTP and check the browser console.")}</div>`;
  };
  worker.postMessage({ id, type, lab: target, config: input });
}
function compareVisual() {
  if (busy || lab === "dashboard") return;
  const a = document.getElementById("visual-alg-a").value,
    b = document.getElementById("visual-alg-b").value;
  if (!a || !b || a === b) {
    notify("Choose two different algorithms.");
    return;
  }
  compareWorker?.terminate();
  const id = ++requestId,
    target = lab,
    input = clone(cfg());
  compareWorker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  compareWorker.onmessage = ({ data: message }) => {
    if (message.id !== id || lab !== target) return;
    compareWorker.terminate();
    compareWorker = null;
    if (message.error) {
      notify(message.error);
      return;
    }
    visualCompare = {
      left: message.result[a],
      right: message.result[b],
      progress: 0,
    };
    renderLab();
  };
  compareWorker.onerror = (error) => {
    compareWorker?.terminate();
    compareWorker = null;
    notify(error.message || "Visual comparison failed.");
  };
  compareWorker.postMessage({
    id,
    type: "visual-compare",
    lab: target,
    config: input,
    algorithms: [a, b],
  });
  notify("Computing independent traces for the same input…");
}
function updateSetting(key, value) {
  if (busy || playback.steps.length) return;
  const c = cfg();
  if (key === "algorithm") c.algorithm = value;
  else if (key === "preset") {
    if (value !== "custom")
      c.problem = gridPreset(value, c.problem.rows, c.problem.cols);
    c.preset = value;
    selected = null;
  } else if (["gridRows", "gridCols"].includes(key)) {
    const rows = key === "gridRows" ? +value : c.problem.rows,
      cols = key === "gridCols" ? +value : c.problem.cols;
    if (
      !Number.isInteger(rows) ||
      rows < 5 ||
      rows > 40 ||
      !Number.isInteger(cols) ||
      cols < 5 ||
      cols > 40
    ) {
      notify("Grid rows and columns must be between 5 and 40.");
      return;
    }
    c.problem = gridPreset(
      c.preset === "custom" ? "blank" : c.preset,
      rows,
      cols,
    );
    c.preset = "custom";
    selected = null;
  } else if (key === "heuristic") c.heuristic = value;
  else if (key === "variableOrdering" || key === "valueOrdering")
    c[key] = value;
  else if (key === "depthLimit") c.depthLimit = +value;
  else if (key === "weight") {
    if (!Number.isInteger(+value) || +value < 1 || +value > 99) {
      notify("Terrain cost must be an integer from 1 to 99.");
      return;
    }
    weight = +value;
  } else if (key === "size") {
    const n = +value;
    if (!Number.isInteger(n) || n < 5 || n > 40) {
      notify("Board size must be from 5 to 40.");
      return;
    }
    c.problem.queens = queensPreset(n, c.seed);
  } else if (key === "seed") {
    if (!Number.isInteger(+value) || +value < 0 || +value > 4294967295) {
      notify("Seed must be an unsigned 32-bit integer.");
      return;
    }
    c.seed = +value;
    c.problem.queens = queensPreset(c.problem.queens.length, c.seed);
  } else if (key === "arrangement") {
    if (value === "random")
      c.problem.queens = queensPreset(c.problem.queens.length, c.seed);
    if (value === "aligned") c.problem.queens.fill(0);
    if (value === "stalled") c.problem.queens = [0, 1, 3, 2];
    if (value === "solved") c.problem.queens = [1, 3, 0, 2];
    if (value === "local") c.problem.queens = [0, 5, 1, 4, 6, 3, 7, 2];
    c.arrangement = value;
  } else if (key === "temperature") {
    if (!(+value > 0)) {
      notify("Temperature must be positive.");
      return;
    }
    c.temperature = +value;
  } else if (key === "cooling") {
    if (!(+value > 0 && +value < 1)) {
      notify("Cooling must be between 0 and 1.");
      return;
    }
    c.cooling = +value;
  } else if (["sidewaysLimit", "restarts"].includes(key)) {
    const n = +value;
    if (!Number.isInteger(n) || n < 0 || n > (key === "restarts" ? 20 : 100)) {
      notify(
        key === "restarts"
          ? "Restarts must be 0–20."
          : "Sideways moves must be 0–100.",
      );
      return;
    }
    c[key] = n;
  } else if (key === "limit") {
    if (!Number.isInteger(+value) || +value < 1 || +value > 1000000) {
      notify("Choose an integer limit from 1 to 1,000,000.");
      return;
    }
    c.limit = +value;
  } else if (key === "human") {
    c.problem = {
      board: Array(9).fill(""),
      turn: "X",
      ai: value === "X" ? "O" : "X",
    };
    c.position = "empty";
  } else if (key === "trialStarts") c.trialStarts = value;
  else if (key === "ordering") c.ordering = value;
  else if (key === "position") {
    if (value === "custom") {
      c.position = value;
      persist();
      renderLab();
      return;
    }
    c.position = value;
    let board = Array(9).fill(""),
      ai = c.problem.ai;
    if (value === "win") {
      board = ["X", "X", "", "O", "O", "", "", "", ""];
      ai = "X";
    }
    if (value === "block") {
      board = ["X", "X", "", "", "O", "", "", "", ""];
      ai = "O";
    }
    if (value === "midgame") {
      board = ["X", "O", "X", "", "O", "", "", "", ""];
      ai = "X";
    }
    const turn =
      board.filter((v) => v === "X").length ===
      board.filter((v) => v === "O").length
        ? "X"
        : "O";
    c.problem = { board, turn, ai };
  } else if (key === "puzzle") {
    if (value !== "custom") c.problem = { board: sudokuPreset(value) };
    c.puzzle = value;
  } else if (key === "dataset") {
    if (value !== "custom") c.problem = timetablePreset(value);
    c.dataset = value;
  }
  if (["size", "seed"].includes(key)) c.arrangement = "random";
  comparison = null;
  visualCompare = null;
  persist();
  renderLab();
}
function paint(id) {
  const p = cfg().problem;
  if (brush === "inspect" || playback.steps.length || busy) {
    selected = id;
    updateFrame(playback.steps[playback.index]);
    return false;
  }
  if (brush === "start" || brush === "goal") {
    if (id === p[brush === "start" ? "goal" : "start"]) {
      notify("Start and goal need separate cells in the editor.");
      return;
    }
    p[brush] = id;
    p.cells[id] = 1;
  } else if (id === p.start || id === p.goal) {
    return false;
  } else p.cells[id] = brush === "wall" ? 0 : brush === "weight" ? weight : 1;
  cfg().preset = "custom";
  if (!paintStroke) persist();
  document.getElementById("preset").value = "custom";
  selected = id;
  comparison = null;
  paintChanged = true;
  if (paintStroke) {
    const svg = document.createElement("template");
    svg.innerHTML = pathSVG(p, {}, selected);
    const freshCell = svg.content.querySelector(`[data-cell="${id}"]`),
      oldCell = document.querySelector(`[data-cell="${id}"]`);
    if (freshCell && oldCell) oldCell.replaceWith(freshCell);
  } else updateFrame(null);
  return true;
}
function finishPaint() {
  if (paintChanged) {
    persist();
    paintChanged = false;
    updateFrame(playback.steps[playback.index] || null);
  }
  paintStroke = false;
  app.classList.remove("is-painting");
}
function applyBasicTimetable() {
  const c = cfg(),
    slots = document
      .getElementById("tt-slots")
      .value.split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    rooms = document
      .getElementById("tt-rooms")
      .value.split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    teachers = document
      .getElementById("tt-teachers")
      .value.split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    sessions = document
      .getElementById("tt-sessions")
      .value.split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  if (!slots.length || !rooms.length || !teachers.length || !sessions.length) {
    notify("Add at least one slot, room, teacher, and session.");
    return;
  }
  const problem = {
    slots,
    rooms: rooms.map((id) => ({ id, available: slots.map((_, i) => i) })),
    teachers: teachers.map((id) => ({ id, available: slots.map((_, i) => i) })),
    sessions: sessions.map((name, i) => ({
      id: `S${i + 1}`,
      name,
      teacher: teachers[i % teachers.length],
      group: `G${i + 1}`,
      rooms: [...rooms],
    })),
  };
  try {
    const clean = validateConfiguration(lab, {
      ...c,
      problem,
      dataset: "custom",
    });
    configs[lab] = clean;
    configs[lab].dataset = "custom";
    persist();
    reset();
    notify("Timetable applied.");
  } catch (err) {
    notify(err.message);
  }
}
function download() {
  const blob = new Blob(
      [
        JSON.stringify(
          { exported: new Date().toISOString(), ...data },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "search-optimization-experiments.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
app.addEventListener("pointerdown", (event) => {
  if (lab === "question-visualizer") return;
  const cell = event.target.closest("[data-cell]");
  if (
    !cell ||
    lab !== "pathfinding" ||
    brush === "inspect" ||
    event.button !== 0
  )
    return;
  skipCellClick = true;
  paintStroke = true;
  paintChanged = false;
  app.classList.add("is-painting");
  paint(+cell.dataset.cell);
});
app.addEventListener("pointerover", (event) => {
  if (lab === "question-visualizer") return;
  if (!paintStroke) return;
  const cell = event.target.closest("[data-cell]");
  if (cell && lab === "pathfinding") paint(+cell.dataset.cell);
});
window.addEventListener("pointerup", finishPaint);
window.addEventListener("pointercancel", finishPaint);
app.addEventListener("click", (event) => {
  if (lab === "question-visualizer") return;
  const cell = event.target.closest("[data-cell]");
  if (cell && lab === "pathfinding") {
    if (skipCellClick) {
      skipCellClick = false;
      return;
    }
    paint(+cell.dataset.cell);
    return;
  }
  const brushButton = event.target.closest("[data-brush]");
  if (brushButton) {
    brush = brushButton.dataset.brush;
    renderLab();
    return;
  }
  const gameButton = event.target.closest("[data-game]");
  if (gameButton) {
    const c = cfg(),
      human = c.problem.ai === "X" ? "O" : "X",
      i = +gameButton.dataset.game;
    if (
      !busy &&
      !winner(c.problem.board) &&
      c.problem.turn === human &&
      !c.problem.board[i]
    ) {
      cancel();
      result = null;
      comparison = null;
      visualCompare = null;
      playback.reset();
      c.problem.board[i] = human;
      c.problem.turn = c.problem.ai;
      c.position = "custom";
      persist();
      renderLab();
      if (!winner(c.problem.board)) run(false);
    }
    return;
  }
  const restore = event.target.closest("[data-restore]");
  if (restore) {
    const h = data.history.find((x) => x.id === restore.dataset.restore);
    if (h) {
      configs[h.lab] = clone(h.config);
      persist();
      location.hash = h.lab;
    }
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "run") run();
  if (action === "pause") {
    playback.pause();
    document.getElementById("playback-live").textContent = "Playback paused.";
  }
  if (action === "next") run(false);
  if (action === "previous") playback.previous();
  if (action === "jump-next") playback.jump(1);
  if (action === "jump-prev") playback.jump(-1);
  if (action === "reset") reset();
  if (action === "compare") run(false, "compare");
  if (action === "compare-visual") compareVisual();
  if (action === "save-setup") {
    const name = window.prompt(
      "Name this setup (optional, up to 80 characters):",
      "",
    );
    if (name === null) return;
    remember({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      type: "configuration",
      lab,
      config: clone(cfg()),
      algorithm: cfg().algorithm,
      name: name.trim().slice(0, 80),
      status: "saved",
    });
    notify("Configuration saved, including the complete problem and seed.");
  }
  if (action === "share-setup") {
    try {
      const url = new URL(location.href);
      url.searchParams.set("lab", lab);
      url.searchParams.set("config", encodeConfiguration(lab, cfg()));
      if (navigator.clipboard?.writeText)
        navigator.clipboard
          .writeText(url.toString())
          .then(() =>
            notify(
              "Share URL copied. It contains this validated configuration.",
            ),
          )
          .catch(() => {
            window.prompt("Copy this share URL:", url.toString());
          });
      else window.prompt("Copy this share URL:", url.toString());
    } catch (error) {
      notify(error.message);
    }
  }
  if (action === "import") document.getElementById("import-config")?.click();
  if (action === "apply-queens") {
    const values = document
        .getElementById("queen-rows")
        .value.split(/[\s,]+/)
        .filter(Boolean)
        .map((v) => +v - 1),
      n = cfg().problem.queens.length;
    if (
      values.length !== n ||
      values.some((v) => !Number.isInteger(v) || v < 0 || v >= n)
    ) {
      notify(`Enter ${n} row numbers between 1 and ${n}.`);
      return;
    }
    cfg().problem.queens = values;
    cfg().arrangement = "custom";
    persist();
    renderLab();
  }
  if (action === "clear-sudoku") {
    cfg().problem.board.fill(0);
    cfg().puzzle = "custom";
    persist();
    renderLab();
  }
  if (action === "apply-timetable") {
    try {
      const p = JSON.parse(document.getElementById("timetable-json").value);
      timetableModel(p);
      cfg().problem = p;
      cfg().dataset = "custom";
      persist();
      renderLab();
      notify("Timetable dataset applied.");
    } catch (error) {
      notify(error.message);
    }
  }
  if (action === "apply-timetable-basic") applyBasicTimetable();
  if (action === "new-game") {
    reset();
    cfg().problem.board = Array(9).fill("");
    cfg().problem.turn = "X";
    cfg().position = "empty";
    persist();
    renderLab();
  }
  if (action === "apply-ai") {
    const c = cfg(),
      move = result?.output.move;
    if (
      move !== null &&
      move !== undefined &&
      c.problem.turn === c.problem.ai &&
      !c.problem.board[move] &&
      !winner(c.problem.board)
    ) {
      cancel();
      c.problem.board[move] = c.problem.ai;
      c.position = "custom";
      c.problem.turn = c.problem.ai === "X" ? "O" : "X";
      result = null;
      comparison = null;
      visualCompare = null;
      playback.reset();
      persist();
      renderLab();
    }
  }
  if (action === "focus-branch") {
    let id = playback.steps[playback.index]?.state.nodeId;
    if (id !== undefined && result) {
      while (id !== null) {
        openNodes.add(id);
        id = result.output.tree[id].parent;
      }
      updateFrame(playback.steps[playback.index]);
      app.querySelector(".active-node")?.scrollIntoView({ block: "nearest" });
    }
  }
  if (action === "dashboard-compare") {
    pendingComparison = dashboardLab;
    location.hash = dashboardLab;
  }
  if (action === "export") download();
  if (action === "clear-history") {
    historyUndo = clone(data.history);
    data.history = [];
    persist();
    dashboard();
    notify("Experiment history cleared. Use Undo clear to restore it.");
  }
  if (action === "undo-clear" && historyUndo) {
    data.history = historyUndo;
    historyUndo = null;
    persist();
    dashboard();
    notify("Experiment history restored.");
  }
});
document.addEventListener("change", async (event) => {
  const el = event.target;
  if (lab === "question-visualizer" && el.closest(".qv-workspace")) return;
  if (el.id === "import-config" && el.files?.[0]) {
    try {
      const incoming = await el.files[0].text(),
        merged = importData(incoming, data);
      Object.keys(data).forEach((k) => delete data[k]);
      Object.assign(data, merged);
      persist();
      for (const key of Object.keys(labNames))
        configs[key] = { ...fresh(key), ...data.configs[key] };
      cancel();
      result = null;
      visualCompare = null;
      playback.reset();
      notify("Import validated and merged. Invalid history rows were skipped.");
      render();
    } catch (error) {
      notify(`Import failed: ${error.message}`);
    }
    el.value = "";
    return;
  }
  if (el.dataset.pruning !== undefined)
    updateSetting("algorithm", el.checked ? "alphabeta" : "minimax");
  if (el.dataset.param) updateSetting(el.dataset.param, el.value);
  if (el.dataset.sudoku !== undefined) {
    const text = el.value.trim();
    if (!/^[0-9]?$/.test(text)) {
      el.value = "";
      notify("Use one digit from 1 to 9, or blank.");
      return;
    }
    cfg().problem.board[+el.dataset.sudoku] = Number(text) || 0;
    cfg().puzzle = "custom";
    document.getElementById("puzzle").value = "custom";
    persist();
  }
  if (
    el.id === "visual-alg-a" &&
    el.value === document.getElementById("visual-alg-b").value
  ) {
    const alt = algorithms[lab].find((a) => a !== el.value);
    document.getElementById("visual-alg-b").value = alt;
  }
  if (
    el.id === "visual-alg-b" &&
    el.value === document.getElementById("visual-alg-a").value
  ) {
    const alt = algorithms[lab].find((a) => a !== el.value);
    document.getElementById("visual-alg-a").value = alt;
  }
  if (el.id === "dashboard-lab") {
    dashboardLab = el.value;
    dashboardExperiment = null;
    dashboard();
  }
  if (el.id === "dashboard-experiment") {
    dashboardExperiment = el.value;
    dashboard();
  }
  if (el.id === "chart-metric") {
    const h = data.history.find((x) => x.id === dashboardExperiment);
    if (h)
      document.getElementById("comparison-chart").innerHTML = comparisonChart(
        h,
        el.value,
      );
  }
});
app.addEventListener("input", (event) => {
  if (lab === "question-visualizer") return;
  if (event.target.id === "grid-zoom") {
    gridZoom = +event.target.value;
    updateFrame(playback.steps[playback.index] || null);
  }
  if (event.target.id === "speed") playback.setSpeed(+event.target.value);
  if (event.target.id === "scrub") playback.seek(+event.target.value);
  if (event.target.id === "visual-progress" && visualCompare) {
    visualCompare.progress = +event.target.value / 1000;
    app.querySelector(".compare-boards").innerHTML =
      visualComparisonBoardsHTML();
    document.querySelector("#visual-progress-label").textContent =
      `${Math.round(visualCompare.progress * 100)}%`;
  }
});
app.addEventListener("keydown", (event) => {
  if (lab === "question-visualizer") return;
  if (event.target.matches("[data-cell]")) {
    const id = +event.target.dataset.cell,
      p = cfg().problem,
      arrows = {
        ArrowUp: [-1, 0],
        ArrowRight: [0, 1],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
      };
    if (arrows[event.key]) {
      event.preventDefault();
      const [dr, dc] = arrows[event.key],
        r = Math.floor(id / p.cols) + dr,
        c = (id % p.cols) + dc;
      if (r >= 0 && r < p.rows && c >= 0 && c < p.cols) {
        selected = r * p.cols + c;
        updateFrame(playback.steps[playback.index]);
        app.querySelector(`[data-cell="${selected}"]`)?.focus();
      }
    } else if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      paint(id);
      app.querySelector(`[data-cell="${id}"]`)?.focus();
    }
    return;
  }
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.target.matches('input,select,textarea,[contenteditable="true"]') ||
    event.target.closest('button,a,summary,[role="button"]')
  )
    return;
  if (event.key === " ") {
    event.preventDefault();
    if (playback.timer) {
      playback.pause();
      document.getElementById("playback-live").textContent = "Playback paused.";
    } else {
      playback.play();
    }
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    playback.previous();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    playback.next();
  } else if (event.key.toLowerCase() === "j") playback.jump(-1);
  else if (event.key.toLowerCase() === "k") playback.jump(1);
});
app.addEventListener(
  "toggle",
  (event) => {
    if (lab === "question-visualizer") return;
    const el = event.target;
    if (el.matches("details.settings")) {
      settingsExpanded = el.open;
      return;
    }
    if (!el.matches("details[data-tree]")) return;
    const id = +el.dataset.tree;
    if (el.open === openNodes.has(id)) return;
    el.open ? openNodes.add(id) : openNodes.delete(id);
    if (openNodes.size > 45) {
      openNodes.delete(id);
      notify("Collapse another branch before expanding more nodes.");
    }
    updateFrame(playback.steps[playback.index]);
  },
  true,
);
document.querySelector(".storage-note").innerHTML =
  icon("bookmark-simple") + "Saved in this browser";
document.getElementById("project-docs").innerHTML =
  `Project documentation${icon("arrow-up-right")}`;
window.addEventListener("hashchange", navigate);
window.addEventListener("beforeunload", () => {
  questionWorkspace?.destroy();
  worker?.terminate();
  playback.pause();
});
navigate();
