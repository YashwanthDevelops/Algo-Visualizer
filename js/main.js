import { timetablePage, mountTimetableRenderer } from './timetable-view.js?v=calendar-4';
import { parseTimetableJSON } from './timetable-data.js?v=calendar-4';
import { dashboardHTML, mountDashboardMotion } from "./dashboard-view.js?v=hero-glyph-1";
import { mountSiteNavigation } from "./site-navigation.js?v=routing-1";
import { mountDocumentPage } from "./document-view.js";
import { pathfindingPage, pathfindingDecision } from "./pathfinding-view.js";
import { mountPathfindingRenderer } from "./pathfinding-renderer.js";
import { mountStudySelects } from "./study-select.js";
import { mountPathfindingTools } from "./pathfinding-tools.js";
import {nqueensPage, mountNQueensRenderer, queensStudySVG} from './nqueens-view.js';
import { sudokuPage, mountSudokuRenderer } from './sudoku-view.js';
import { gamePage, mountGameRenderer } from './game-view.js';
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
import { timetableModel } from "./algorithms/csp.js?v=calendar-4";
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
import { mountQuestionWorkspace } from "./question-workspace.js?v=analysis-orb-1";
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
} from "./renderers.js?v=calendar-4";

const app = document.getElementById("app"),
  data = load(),
  names = {
    dashboard: "Dashboard",
    ...labNames,
    "question-visualizer": "Question Visualizer",
    reference: "Reference",
    guide: "Guide",
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
  historyUndo = null,
  visualCompare = null,
  compareWorker = null;
let questionWorkspace = null;
let cleanupDashboard = null;
let cleanupDocument = null;
let navigating = false;
let nqRenderer=null, nqTools=null, nqDropdowns=null, nqKey=null, nqExtras=null, nqRendering=false;
let gameRenderer=null, gameTools=null, gameDropdowns=null, gameKey=null, gameExtras=null, gameRendering=false;
let gameDelayTimer=null;
let timetableUploadId=0;
const timetableUI={renderer:null,tools:null,dropdowns:null,key:null,extras:null,rendering:false};
const sudokuUI={renderer:null,tools:null,dropdowns:null,key:null,extras:null,rendering:false};
const siteNavigation = mountSiteNavigation(document.getElementById("site-navigation"), {
  onSameRoute() {
    if (lab === "question-visualizer") questionWorkspace?.showUpload();
    const section = new URLSearchParams(location.hash.split("?")[1] || "").get("section");
    if (lab === "dashboard" && ["compare", "history"].includes(section)) jumpDashboard(section);
    else window.scrollTo({top: 0, behavior: "instant"});
  },
});
document.body.classList.add("has-site-nav");
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
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
function animateGameMove(index) {
  requestAnimationFrame(() => {
    const cell=app.querySelector(`[data-game="${index}"]`);
    if(!cell)return;
    cell.classList.remove('is-placing');
    void cell.offsetWidth;
    cell.classList.add('is-placing');
    cell.addEventListener('animationend',()=>cell.classList.remove('is-placing'),{once:true});
  });
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
  clearTimeout(gameDelayTimer);
  gameDelayTimer=null;
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
  const requestedHash = location.hash.slice(1).split("?")[0];
  const sharedLab = new URLSearchParams(location.search).get("lab");
  const requestedLab = sharedLab && Object.hasOwn(labNames, sharedLab)
    ? sharedLab
    : Object.hasOwn(names, requestedHash) ? requestedHash : "dashboard";
  const hasOutgoingPage = app.childNodes.length > 0 && requestedLab !== lab;
  const motionAllowed = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animateEntry = hasOutgoingPage && motionAllowed;
  const commit = (fallbackEntry = false) => {
    // Playback emits callbacks even when reset/paused. Keep those callbacks away
    // from the outgoing DOM until the destination has been mounted.
    navigating = true;
    try { performNavigation(); }
    finally { navigating = false; }
    if (fallbackEntry) {
      app.classList.remove("algoai-page-enter");
      void app.offsetWidth;
      app.classList.add("algoai-page-enter");
      app.addEventListener("animationend", (event) => {
        if (event.animationName === "algoai-page-enter") app.classList.remove("algoai-page-enter");
      }, { once: true });
    }
    updateFrame(playback.steps[playback.index] || null);
    updateControls();
  };

  if (animateEntry && typeof document.startViewTransition === "function") {
    document.startViewTransition(() => commit());
    return;
  }
  // Older browsers still get the short entrance motion without a dependency.
  // The first render and reduced-motion mode remain immediate.
  commit(animateEntry);
}
function performNavigation() {
  cleanupDocument?.();
  cleanupDocument = null;
  timetableUploadId++;timetableUI.tools?.destroy();timetableUI.dropdowns?.destroy();timetableUI.renderer?.destroy();Object.assign(timetableUI,{renderer:null,tools:null,dropdowns:null,key:null,extras:null});
  sudokuUI.tools?.destroy();sudokuUI.dropdowns?.destroy();sudokuUI.renderer?.destroy();Object.assign(sudokuUI,{renderer:null,tools:null,dropdowns:null,key:null,extras:null});
  gameTools?.destroy();gameTools=null;gameDropdowns?.destroy();gameDropdowns=null;gameRenderer=null;gameKey=null;
  nqTools?.destroy();nqTools=null;nqDropdowns?.destroy();nqDropdowns=null;nqRenderer?.destroy();nqRenderer=null;nqKey=null;
  pfTools?.destroy(); pfTools = null;
  pfDropdowns?.destroy();
  pfDropdowns = null; pfRenderer = null; pfConfigKey = null;
  cleanupDashboard?.();
  cleanupDashboard = null;
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
        // Shared configuration links are one-time imports. Remove their query
        // parameters so later hash navigation can select another page normally.
        const cleanUrl = new URL(location.href);
        cleanUrl.searchParams.delete("lab");
        cleanUrl.searchParams.delete("config");
        cleanUrl.hash = sharedLab;
        history.replaceState(null, "", cleanUrl);
        notify("Shared configuration loaded and validated.");
      }
    } catch (error) {
      notify(`Shared configuration was not loaded: ${error.message}`);
    }
  }
  lab = Object.hasOwn(names, hash) ? hash : "dashboard";
  if (hash && !Object.hasOwn(names, hash)) {
    history.replaceState(null, "", `${location.pathname}${location.search}#dashboard`);
    notify("That page could not be found. Open a page from the navigation.");
  }
  playback.useAnimationFrame = ['pathfinding','optimization','sudoku','timetable'].includes(lab);
  playback.reset();
  window.scrollTo(0, 0);
  render();
  if(lab==='game'&&cfg().problem.turn===cfg().problem.ai&&!winner(cfg().problem.board))run(true);
  const dashboardSection = new URLSearchParams(location.hash.split("?")[1] || "").get("section");
  if (lab === "dashboard" && ["compare", "history"].includes(dashboardSection)) {
    jumpDashboard(dashboardSection, false);
  }
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
      `<p class="hint">Click a cell to edit it. Arrow keys move focus; Space/Enter applies the selected brush. Four-direction movement pays the cost of entering the next cell.</p>`;
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
function visualHTML(frame) {
  if (busy && lab !== "pathfinding")
    return '<div class="loading">Computing in a Web Worker…<br><small>Reset cancels this computation.</small></div>';
  const c = cfg(),
    s = frame?.state;
  if (lab === "pathfinding") {
    return `<div class="grid-scroll">${pathSVG(c.problem, s, selected, false, true).replace('class="grid-svg"', `class="grid-svg" style="width:${gridZoom * 100}%;height:${gridZoom * 100}%;max-width:none"`)}</div>`;
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
        view = queensStudySVG(
          state?.queens || cfg().problem.queens,
          false,
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
let pathfindingOpenTools = new Set();
let pfRenderer = null, pfDropdowns = null, pfTools = null, pfConfigKey = null, pfExtrasKey = null;
let pfRendering = false;
function syncPathfinding(frame) {
  if (!pfRenderer) return;
  app.setAttribute('aria-busy', String(busy));
  pfRenderer.update({c:cfg(),frame,selected,busy,zoom:gridZoom,playback,result});
  const locked = busy || !!playback.steps.length;
  app.querySelectorAll('.pf-setup select, #pf-editor input:not(#grid-zoom), #pf-editor button, #pf-advanced [data-param]').forEach(el => {
    const disabled = locked && el.dataset.brush !== 'inspect';
    if (el.disabled !== disabled) el.disabled = disabled;
  });
  pfDropdowns?.sync();
  if (busy || playback.timer) pfTools?.back();
}
function renderPathfinding() {
  if (pfRendering) return;
  pfRendering = true;
  try { renderPathfindingContent(); } finally { pfRendering = false; }
}
function renderPathfindingContent() {
  const c = cfg(), frame = playback.steps[playback.index];
  const activeId = document.activeElement?.id;
  const key = JSON.stringify([c,brush,weight]);
  const html = () => pathfindingPage({ c, frame, busy, result, brush, weight, zoom: gridZoom, playback,
    visual: visualHTML(frame), decision: pathfindingDecision(c, frame, selected),
    fullExplanation: explanationHTML(lab, c, frame, selected) + lessonHTML(lab, result, frame),
    metrics: metricsHTML(lab, frame?.metrics || {}), finalMetrics: metricsHTML(lab, result?.metrics || {}),
    guide: guideHTML(), comparisons: visualComparisonHTML() + (comparison ? comparisonHTML(comparison) : ''),
    comparisonControls: `<div class="visual-compare-controls"><label>Trace A<select id="visual-alg-a">${selectOptions(algorithms[lab], visualCompare?.left.algorithm || c.algorithm)}</select></label><label>Trace B<select id="visual-alg-b">${selectOptions(algorithms[lab].filter(a => a !== (visualCompare?.left.algorithm || c.algorithm)), visualCompare?.right.algorithm || algorithms[lab].find(a => a !== c.algorithm))}</select></label><button data-action="compare-visual" ${busy ? 'disabled' : ''}>Compare visual traces</button></div>`,
    selectField, field, icon,
  });

  const extrasKey = [result,comparison,visualCompare];
  if (pfRenderer && app.querySelector('.pf-page') && pfConfigKey === key) {
    if (!pfExtrasKey || extrasKey.some((item,index)=>item!==pfExtrasKey[index])) {
      const template = document.createElement('template'); template.innerHTML = html();
      for (const id of ['pf-comparisons','pf-details']) {
        const target = document.getElementById(id);
        const content = template.content.querySelector(`#${id} .pf-tool-content`);
        target.querySelector('.pf-tool-content').replaceWith(content);
        const inspector = content.querySelector('#pf-algorithm');
        inspector?.addEventListener('toggle',()=>{if(inspector.open) updateFrame(playback.steps[playback.index]);});
        if (id==='pf-comparisons' && ((comparison && comparison!==pfExtrasKey?.[1]) || (visualCompare && visualCompare!==pfExtrasKey?.[2]))) pfTools?.show(id);
      }
      pfExtrasKey = extrasKey;
    }
    syncPathfinding(frame); updateControls(); return;
  }
  if (app.querySelector('.pf-page')) pathfindingOpenTools = new Set([...app.querySelectorAll('details[open]')].map(el=>el.id).filter(Boolean));
  const toolMode = pfTools?.mode || '';
  const compareOpen = pfTools?.compareOpen;
  pfTools?.destroy();
  pfDropdowns?.destroy();
  pfTools = null; pfDropdowns = null;
  app.innerHTML = html();
  pfConfigKey = key; pfExtrasKey = extrasKey;
  pfRenderer = mountPathfindingRenderer(app.querySelector('.pf-page'));
  for (const id of pathfindingOpenTools) document.getElementById(id)?.setAttribute('open','');
  pfTools = mountPathfindingTools(app.querySelector('.pf-page'), {
    initialMode:toolMode,
    pause:()=>playback.pause(),
    onInspect:()=>updateFrame(playback.steps[playback.index]),
    onLeaveEditor:()=>{
      brush='inspect';pfConfigKey=JSON.stringify([cfg(),brush,weight]);
      app.querySelectorAll('[data-brush]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.brush===brush)));
      const costField = document.getElementById('weight')?.closest('.field');
      if(costField)costField.hidden=true;
    },
  });
  if(compareOpen)pfTools.show('pf-comparisons');
  pfDropdowns = mountStudySelects(app.querySelector('.pf-page'));
  app.querySelectorAll('details').forEach(el => el.addEventListener('toggle', () => {
    if (el.open && el.id === 'pf-algorithm') updateFrame(playback.steps[playback.index]);
  }));
  syncPathfinding(frame);
  if (activeId) document.getElementById(activeId)?.focus({preventScroll:true});
  updateControls();
}
function syncNQueens(frame) {
  if(!nqRenderer||!app.querySelector('.nq-page'))return;
  nqRenderer.update({c:cfg(),frame,playback,busy,result});
  const locked=busy||!!playback.steps.length;
  app.querySelectorAll('.nq-setup input,.nq-setup select,.nq-setup .pf-number-step,#pf-editor input,#pf-editor button,#pf-advanced input[data-param],#pf-advanced .pf-number-step,[data-param="trialStarts"]').forEach(el=>el.disabled=locked);
  app.querySelectorAll('.nq-page .pf-number-step').forEach(button=>{
    const input=button.parentElement.querySelector('input');
    button.disabled=locked||(Number(button.dataset.numberStep)<0?Number(input.value)<=Number(input.min):Number(input.value)>=Number(input.max));
  });
  app.querySelectorAll('.nq-page [data-action="compare"],.nq-page [data-action="compare-visual"]').forEach(el=>el.disabled=busy);
  nqDropdowns?.sync();
  if(busy||playback.timer)nqTools?.back();
}
function renderNQueens() {
  if(nqRendering)return;
  nqRendering=true;
  try {
    const c=cfg(),key=JSON.stringify([c,[...openNodes]]),activeId=document.activeElement?.id;
    const extras=[comparison,visualCompare];
    const html=()=>nqueensPage({c,playback,selectField,icon,guide:guideHTML(),comparisons:visualComparisonHTML()+(comparison?comparisonHTML(comparison):''),comparisonControls:`<div class="visual-compare-controls"><label>Trace A<select id="visual-alg-a">${selectOptions(algorithms[lab],visualCompare?.left.algorithm||c.algorithm)}</select></label><label>Trace B<select id="visual-alg-b">${selectOptions(algorithms[lab].filter(a=>a!==(visualCompare?.left.algorithm||c.algorithm)),visualCompare?.right.algorithm||algorithms[lab].find(a=>a!==c.algorithm))}</select></label><button data-action="compare-visual">Compare visual traces</button></div>`});
    if(nqRenderer&&nqKey===key&&app.querySelector('.nq-page')){
      if(!nqExtras||extras.some((v,i)=>v!==nqExtras[i])){
        const template=document.createElement('template');template.innerHTML=html();
        document.querySelector('#pf-comparisons .pf-tool-content').replaceWith(template.content.querySelector('#pf-comparisons .pf-tool-content'));
        if(comparison||visualCompare)nqTools.show('pf-comparisons');
        nqExtras=extras;
      }
    }else{
      const mode=nqTools?.mode||'',compareOpen=nqTools?.compareOpen;
      nqTools?.destroy();nqDropdowns?.destroy();nqRenderer?.destroy();
      app.innerHTML=html();nqKey=key;nqExtras=extras;
      const root=app.querySelector('.nq-page');
      nqRenderer=mountNQueensRenderer(root,{edit:(row,col)=>{
        if(busy||playback.steps.length)return;
        const id=`nq-cell-${row}-${col}`;cfg().problem.queens[col]=row;cfg().arrangement='custom';comparison=null;visualCompare=null;persist();renderNQueens();document.getElementById(id)?.focus({preventScroll:true});
      }});
      nqTools=mountPathfindingTools(root,{initialMode:mode,pause:()=>playback.pause(),onInspect:()=>syncNQueens(playback.steps[playback.index]),onShow:()=>syncNQueens(playback.steps[playback.index]),onLeaveEditor:()=>{}});
      if(compareOpen)nqTools.show('pf-comparisons');
      nqDropdowns=mountStudySelects(root);
      if(activeId)document.getElementById(activeId)?.focus({preventScroll:true});
    }
    updateControls();
  }finally{nqRendering=false;}
}
function syncGameStudy(frame) {
  if(!gameRenderer||!app.querySelector('.game-study'))return;
  gameRenderer.update({c:configs.game,frame,busy,result,playback});
  const locked=busy||!!playback.steps.length;
  app.querySelectorAll('.game-setup select,#pf-advanced input,#pf-advanced select,#pf-advanced button').forEach(el=>{
    if(el.matches('[data-action="new-game"]'))return;
    el.disabled=locked;
  });
  app.querySelectorAll('.game-study [data-action="compare"],.game-study [data-action="compare-visual"]').forEach(el=>el.disabled=busy);
  gameDropdowns?.sync();
  if(busy||playback.timer)gameTools?.back();
}
function renderGameStudy() {
  if(gameRendering)return;
  gameRendering=true;
  try {
    const c=cfg(),key=JSON.stringify(c),activeId=document.activeElement?.id;
    const extras=[result,comparison,visualCompare];
    const comparisonControls=`<div class="visual-compare-controls"><label>Trace A<select id="visual-alg-a">${selectOptions(algorithms[lab],visualCompare?.left.algorithm||c.algorithm)}</select></label><label>Trace B<select id="visual-alg-b">${selectOptions(algorithms[lab].filter(a=>a!==(visualCompare?.left.algorithm||c.algorithm)),visualCompare?.right.algorithm||algorithms[lab].find(a=>a!==c.algorithm))}</select></label><button data-action="compare-visual">Compare visual traces</button></div>`;
    const tree=treeHTML(result?.output.tree,playback.steps[playback.index]?{...playback.steps[playback.index],ai:c.problem.ai}:null,openNodes);
    const html=()=>gamePage({c,frame:playback.steps[playback.index],busy,result,playback,selectField,icon,guide:guideHTML(),tree,comparisons:visualComparisonHTML()+(comparison?comparisonHTML(comparison):''),comparisonControls});
    if(gameRenderer&&gameKey===key&&app.querySelector('.game-study')){
      if(!gameExtras||extras.some((v,i)=>v!==gameExtras[i])){
        const template=document.createElement('template');template.innerHTML=html();
        for(const id of ['pf-comparisons','pf-details']){
          const content=template.content.querySelector(`#${id} .pf-tool-content`);
          document.querySelector(`#${id} .pf-tool-content`)?.replaceWith(content);
        }
        if((comparison&&comparison!==gameExtras?.[1])||(visualCompare&&visualCompare!==gameExtras?.[2]))gameTools?.show('pf-comparisons');
        gameExtras=extras;
      }
    }else{
      const mode=gameTools?.mode||'',compareOpen=gameTools?.compareOpen;
      gameTools?.destroy();gameDropdowns?.destroy();
      app.innerHTML=html();gameKey=key;gameExtras=extras;
      const root=app.querySelector('.game-study');
      gameRenderer=mountGameRenderer(root,{treeHTML,metricsHTML,treeKey:()=>[...openNodes].join(',')});
      gameTools=mountPathfindingTools(root,{initialMode:mode,pause:()=>playback.pause(),onInspect:()=>syncGameStudy(playback.steps[playback.index]),onShow:()=>syncGameStudy(playback.steps[playback.index])});
      if(compareOpen)gameTools.show('pf-comparisons');
      gameDropdowns=mountStudySelects(root);
      if(activeId)document.getElementById(activeId)?.focus({preventScroll:true});
    }
    syncGameStudy(playback.steps[playback.index]);
    updateControls();
  }finally{gameRendering=false;}
}
function syncSudoku(frame) {
  if(!sudokuUI.renderer||!app.querySelector('.sudoku-study'))return;
  app.setAttribute('aria-busy',String(busy));
  sudokuUI.renderer.update({c:cfg(),frame,playback,busy,result,editing:sudokuUI.tools?.mode==='pf-editor'});
  const locked=busy||!!playback.steps.length;
  app.querySelectorAll('.sudoku-study .pf-setup select,.sudoku-study [data-param],.sudoku-study .pf-number-step,.sudoku-study [data-action="clear-sudoku"]').forEach(el=>el.disabled=locked);
  app.querySelectorAll('.sudoku-study [data-action="compare"],.sudoku-study [data-action="compare-visual"]').forEach(el=>el.disabled=busy);
  sudokuUI.dropdowns?.sync();
  if(busy||playback.timer)sudokuUI.tools?.back();
}
function renderSudoku() {
  if(sudokuUI.rendering)return;
  sudokuUI.rendering=true;
  try {
    const c=cfg(),key=JSON.stringify(c),extras=[comparison,visualCompare],activeId=document.activeElement?.id;
    const html=()=>sudokuPage({c,playback,selectField,icon,guide:guideHTML(),comparisons:visualComparisonHTML()+(comparison?comparisonHTML(comparison):''),comparisonControls:`<div class="visual-compare-controls"><label>Trace A<select id="visual-alg-a">${selectOptions(algorithms[lab],visualCompare?.left.algorithm||c.algorithm)}</select></label><label>Trace B<select id="visual-alg-b">${selectOptions(algorithms[lab].filter(a=>a!==(visualCompare?.left.algorithm||c.algorithm)),visualCompare?.right.algorithm||algorithms[lab].find(a=>a!==c.algorithm))}</select></label><button data-action="compare-visual">Compare visual traces</button></div>`});
    if(sudokuUI.renderer&&sudokuUI.key===key&&app.querySelector('.sudoku-study')){
      if(!sudokuUI.extras||extras.some((v,i)=>v!==sudokuUI.extras[i])){
        const t=document.createElement('template');t.innerHTML=html();
        document.querySelector('#pf-comparisons .pf-tool-content').replaceWith(t.content.querySelector('#pf-comparisons .pf-tool-content'));
        if(comparison||visualCompare)sudokuUI.tools.show('pf-comparisons');
        sudokuUI.extras=extras;
      }
    }else{
      const mode=sudokuUI.tools?.mode||'',compareOpen=sudokuUI.tools?.compareOpen;
      sudokuUI.tools?.destroy();sudokuUI.dropdowns?.destroy();sudokuUI.renderer?.destroy();
      app.innerHTML=html();sudokuUI.key=key;sudokuUI.extras=extras;
      const root=app.querySelector('.sudoku-study');sudokuUI.renderer=mountSudokuRenderer(root);
      sudokuUI.tools=mountPathfindingTools(root,{initialMode:mode,pause:()=>playback.pause(),onInspect:()=>syncSudoku(playback.steps[playback.index]),onShow:()=>syncSudoku(playback.steps[playback.index]),onLeaveEditor:()=>syncSudoku(playback.steps[playback.index])});
      root.querySelector('.pf-dialog-heading p').textContent='The same puzzle. Different search decisions.';
      if(compareOpen)sudokuUI.tools.show('pf-comparisons');
      sudokuUI.dropdowns=mountStudySelects(root);
      if(activeId)document.getElementById(activeId)?.focus({preventScroll:true});
    }
    syncSudoku(playback.steps[playback.index]);updateControls();
  }finally{sudokuUI.rendering=false;}
}
function syncTimetable(frame) {
  if(!timetableUI.renderer||!app.querySelector('.timetable-study'))return;
  app.setAttribute('aria-busy',String(busy));
  timetableUI.renderer.update({c:cfg(),frame,playback,busy,result});
  const locked=busy||!!playback.steps.length;
  app.querySelectorAll('.timetable-study .pf-setup select,.timetable-study [data-param],.timetable-study .pf-number-step').forEach(el=>el.disabled=locked);
  app.querySelectorAll('.timetable-study [data-action="compare"],.timetable-study [data-action="compare-visual"]').forEach(el=>el.disabled=busy);
  app.querySelectorAll('.timetable-study #timetable-upload,.timetable-study #timetable-json,.timetable-study [data-action="apply-timetable"]').forEach(el=>el.disabled=busy);
  timetableUI.dropdowns?.sync();
  if(busy||playback.timer)timetableUI.tools?.back();
}
function renderTimetable() {
  if(timetableUI.rendering)return;
  timetableUI.rendering=true;
  try {
    const c=cfg(),key=JSON.stringify(c),extras=[comparison,visualCompare],activeId=document.activeElement?.id;
    const html=()=>timetablePage({c,playback,selectField,icon,guide:guideHTML(),comparisons:visualComparisonHTML()+(comparison?comparisonHTML(comparison):''),comparisonControls:`<div class="visual-compare-controls"><label>Trace A<select id="visual-alg-a">${selectOptions(algorithms[lab],visualCompare?.left.algorithm||c.algorithm)}</select></label><label>Trace B<select id="visual-alg-b">${selectOptions(algorithms[lab].filter(a=>a!==(visualCompare?.left.algorithm||c.algorithm)),visualCompare?.right.algorithm||algorithms[lab].find(a=>a!==c.algorithm))}</select></label><button data-action="compare-visual">Compare visual traces</button></div>`});
    if(timetableUI.renderer&&timetableUI.key===key&&app.querySelector('.timetable-study')){
      if(!timetableUI.extras||extras.some((v,i)=>v!==timetableUI.extras[i])){
        const t=document.createElement('template');t.innerHTML=html();
        document.querySelector('#pf-comparisons .pf-tool-content').replaceWith(t.content.querySelector('#pf-comparisons .pf-tool-content'));
        if(comparison||visualCompare)timetableUI.tools.show('pf-comparisons');
        timetableUI.extras=extras;
      }
    }else{
      const mode=timetableUI.tools?.mode||'',compareOpen=timetableUI.tools?.compareOpen;
      timetableUI.tools?.destroy();timetableUI.dropdowns?.destroy();timetableUI.renderer?.destroy();
      app.innerHTML=html();timetableUI.key=key;timetableUI.extras=extras;
      const root=app.querySelector('.timetable-study');timetableUI.renderer=mountTimetableRenderer(root);
      timetableUI.tools=mountPathfindingTools(root,{initialMode:mode,pause:()=>playback.pause(),onInspect:()=>syncTimetable(playback.steps[playback.index]),onShow:()=>syncTimetable(playback.steps[playback.index]),onLeaveEditor:()=>syncTimetable(playback.steps[playback.index])});
      root.querySelector('.pf-dialog-heading p').textContent='The same constraints. Different search decisions.';
      if(compareOpen)timetableUI.tools.show('pf-comparisons');
      timetableUI.dropdowns=mountStudySelects(root);
      if(activeId)document.getElementById(activeId)?.focus({preventScroll:true});
    }
    syncTimetable(playback.steps[playback.index]);updateControls();
  }finally{timetableUI.rendering=false;}
}
function renderLab() {
  if(lab==='timetable'){renderTimetable();return;}
  if(lab==='timetable'){
    updateControls();const live=document.getElementById('playback-live');if(live&&!playback.timer&&frame)live.textContent=`${frame.event}: ${frame.reason}`;return;
  }
  if(lab==='sudoku'){renderSudoku();return;}
  if (lab === 'game') { renderGameStudy(); return; }
  if (lab === 'optimization') { renderNQueens(); return; }
  if (lab === 'pathfinding') { renderPathfinding(); return; }
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
function jumpDashboard(section, animate = true) {
  const target = app.querySelector(`[data-dashboard-section="${section}"]`) || document.getElementById(`sd-${section}`);
  target?.scrollIntoView({ behavior: !animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
}
function dashboard() {
  const previousScroll = window.scrollY;
  const focusedId = document.activeElement?.id;
  cleanupDashboard?.();
  const comparisons = data.history.filter(h => h.type === "comparison" && h.lab === dashboardLab);
  const chosen = comparisons.find(h => h.id === dashboardExperiment) || comparisons[0];
  dashboardExperiment = chosen?.id || null;
  const labs = Object.keys(labNames);
  const runCount = data.history.filter(h => h.type !== "configuration").length;
  const comparisonPanel = `
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
`;
  const historyPanel = `
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
`;
  app.innerHTML = dashboardHTML({ comparisonHTML: comparisonPanel, historyHTML: historyPanel });
  cleanupDashboard = mountDashboardMotion(app.firstElementChild);
  if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
  window.scrollTo(0, previousScroll);
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
  recoveryEvaluations:
    "Candidate placements checked by the exact completion phase after local search stalls.",
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
  document.body.classList.toggle("is-dashboard", lab === "dashboard");
  document.body.classList.toggle("is-pathfinding", lab === "pathfinding");
  document.body.classList.toggle("is-optimization", lab === "optimization");
  document.body.classList.toggle("is-sudoku",lab==="sudoku");
  document.body.classList.toggle("is-timetable",lab==="timetable");
  document.body.classList.toggle("is-game", lab === "game");
  document.body.classList.toggle("is-question",lab==="question-visualizer");
  document.body.classList.toggle("is-document", ["reference", "guide"].includes(lab));
  siteNavigation.update(lab);
  if (lab === "dashboard") dashboard();
  else if (lab === "question-visualizer") {
    questionWorkspace = mountQuestionWorkspace(app, { notify });
  } else if (["reference", "guide"].includes(lab)) {
    cleanupDocument = mountDocumentPage(app, lab);
  } else renderLab();
}
function updateControls() {
  if (navigating) return;
  if (!Object.hasOwn(labNames, lab)) return;
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
  if (['pathfinding','optimization','sudoku','timetable'].includes(lab)) {
    const playing = !!playback.timer;
    get('run').querySelector('.button-text').textContent = busy ? 'Computing…' : playing ? 'Pause search' : has ? (playback.index === playback.steps.length - 1 ? 'Replay search' : 'Resume search') : 'Run search';
    get('pause').hidden = !playing;
    get('pf-play').hidden = playing;
    get('pf-play').disabled = busy;
    app.querySelector('.pf-page')?.style.setProperty('--pf-step-duration', `${playback.timer ? Math.min(110,Math.floor(400/playback.speed)) : 0}ms`);
    get('pf-step-label').textContent = busy ? 'Computing search…' : has ? `Step ${playback.index + 1} of ${playback.steps.length}` : lab==='optimization'?'Choose a board and begin':lab==='sudoku'?'Choose a puzzle and begin':lab==='timetable'?'Choose a dataset and begin':'Choose a map and begin';
    get('step-count').textContent = busy ? 'Computing…' : has ? `${playback.index + 1} / ${playback.steps.length}` : '0 / 0';
    if(lab==='optimization')syncNQueens(playback.steps[playback.index]);
  }
  if (lab === 'game') syncGameStudy(playback.steps[playback.index]);
  if (lab === 'sudoku') syncSudoku(playback.steps[playback.index]);
  if (lab === 'timetable') {syncTimetable(playback.steps[playback.index]);get('run').querySelector('.button-text').textContent=busy?'Generating…':playback.timer?'Pause search':has?(playback.index===playback.steps.length-1?'Replay search':'Resume search'):'Generate timetable';}
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
  if (navigating) return;
  if (!Object.hasOwn(labNames, lab) || (!document.getElementById("visualization") && lab !== 'game')) return;
  if(lab==='timetable'){
    updateControls();const live=document.getElementById('playback-live');if(live&&!playback.timer&&frame)live.textContent=`${frame.event}: ${frame.reason}`;return;
  }
  if(lab==='sudoku'){
    updateControls();
    const live=document.getElementById('playback-live');if(live&&!playback.timer&&frame)live.textContent=`${frame.event}: ${frame.reason}`;
    return;
  }
  if(lab==='optimization'){
    const live=document.getElementById('playback-live');if(live&&!playback.timer&&frame)live.textContent=`${frame.event}: ${frame.reason}`;
    updateControls();return;
  }
  if (lab === 'pathfinding') {
    syncPathfinding(frame);
    if (document.getElementById('pf-details')?.hidden === false) document.getElementById('metrics').innerHTML = metricsHTML(lab,frame?.metrics || {});
    if (document.getElementById('pf-algorithm')?.open) document.getElementById('pf-algorithm-content').innerHTML = explanationHTML(lab,cfg(),frame,selected)+lessonHTML(lab,result,frame);
    const live=document.getElementById('playback-live');
    if (live && !playback.timer && frame) live.textContent=`${frame.event}: ${frame.reason}`;
    updateControls();return;
  }
  if (lab === 'game') {
    const live=document.getElementById('playback-live');
    const treeFocus=document.activeElement?.closest('[data-tree]')?.dataset.tree;
    if(live&&!playback.timer&&frame)live.textContent=`${frame.event}: ${frame.reason}`;
    syncGameStudy(frame);
    if(treeFocus!==undefined)app.querySelector(`[data-tree="${treeFocus}"] summary`)?.focus({preventScroll:true});
    updateControls();
    return;
  }
  const visualization = document.getElementById('visualization');
  const treeFocus = document.activeElement?.closest('[data-tree]')?.dataset.tree;
  visualization.innerHTML = visualHTML(frame);
  document.getElementById('explanation').innerHTML=explanationHTML(lab,cfg(),frame,selected)+lessonHTML(lab,result,frame);
  document.getElementById('metrics').innerHTML=metricsHTML(lab,frame?.metrics || {});
  const live=document.getElementById('playback-live');
  if(live && !playback.timer && frame) live.textContent=`${frame.event}: ${frame.reason}`;
  if(treeFocus!==undefined) document.querySelector(`[data-tree="${treeFocus}"] summary`)?.focus({preventScroll:true});
  updateControls();
}
function run(auto = true, type = "run", viewFinal = false) {
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
    worker = new Worker(new URL("./worker.js?v=calendar-4", import.meta.url), {
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
      let gameMove=null;
      if (target === 'game' && result.output.move != null) {
        const game = configs.game.problem;
        if (game.turn === game.ai && !game.board[result.output.move] && !winner(game.board)) {
          gameMove=result.output.move;
          game.board[result.output.move] = game.ai;
          game.turn = game.ai === 'X' ? 'O' : 'X';
          configs.game.position = 'custom';
          persist();
        }
      }
      playback.load(result.steps);
      if ((target === 'game'||viewFinal) && playback.steps.length) playback.index = playback.steps.length - 1;
      renderLab();
      if(target==='game'&&gameMove!==null)animateGameMove(gameMove);
      if (auto && target !== 'game' && !viewFinal) playback.play();
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
  compareWorker = new Worker(new URL("./worker.js?v=calendar-4", import.meta.url), {
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
    if (!Number.isInteger(n) || n < 4 || n > 12) {
      document.getElementById('size').value=c.problem.queens.length;
      notify("Board size must be from 4 to 12.");
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
  if (lab === 'game' && c.problem.turn === c.problem.ai && !winner(c.problem.board)) run(true);
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
  persist();
  document.getElementById("preset").value = "custom";
  selected = id;
  comparison = null;
  updateFrame(null);
  return true;
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
function downloadJSONFile(value,name){
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function applyTimetableJSON(text,generate){
  const problem=parseTimetableJSON(text);
  const next=validateConfiguration('timetable',{...configs.timetable,problem,dataset:'custom'});
  timetableUploadId++;
  cancel();result=null;comparison=null;visualCompare=null;playback.reset();configs.timetable=next;persist();renderLab();
  document.getElementById('tt-upload-message').textContent=`Loaded ${problem.sessions.length} sessions, ${problem.slots.length} slots, and ${problem.rooms.length} rooms.`;
  if(generate){timetableUI.tools.back();run(false,'run',true);}
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
app.addEventListener("click", (event) => {
  const sectionLink = event.target.closest('a[href^="#sd-"]');
  if (lab === "dashboard" && sectionLink && !sectionLink.hasAttribute("data-dashboard-jump")) {
    event.preventDefault();
    document.getElementById(sectionLink.getAttribute("href").slice(1))?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    return;
  }
  const dashboardJump = event.target.closest("[data-dashboard-jump]");
  if (dashboardJump) {
    event.preventDefault();
    jumpDashboard(dashboardJump.dataset.dashboardJump);
    return;
  }
  if (lab === "question-visualizer") return;
  const numberStep = event.target.closest("[data-number-step]");
  if (numberStep && ['pathfinding','optimization','sudoku','timetable'].includes(lab)) {
    const input = numberStep.parentElement.querySelector('input[type="number"]');
    if (!input || numberStep.disabled) return;
    const min = Number(input.min || 0), max = Number(input.max || Number.MAX_SAFE_INTEGER);
    const step = Number(input.step || 1) * Number(numberStep.dataset.numberStep);
    input.value = String(Number(Math.min(max, Math.max(min, Number(input.value || min) + step)).toFixed(6)));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  const cell = event.target.closest("[data-cell]");
  if (cell && lab === "pathfinding") {
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
      animateGameMove(i);
      if (!winner(c.problem.board)) {
        busy=true;
        renderLab();
        gameDelayTimer=setTimeout(()=>{
          gameDelayTimer=null;
          if(lab!=='game'||c.problem.turn!==c.problem.ai||winner(c.problem.board)){
            busy=false;
            renderLab();
            return;
          }
          busy=false;
          run(true);
        },360);
      }
    }
    return;
  }
  const restore = event.target.closest("[data-restore]");
  if (restore) {
    const h = data.history.find((x) => x.id === restore.dataset.restore);
    if (h) {
      configs[h.lab] = clone(h.config);
      persist();
      if (lab === h.lab) navigate();
      else location.hash = h.lab;
    }
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "run") {
    if (['pathfinding','optimization','sudoku','timetable'].includes(lab) && playback.timer) playback.pause();
    else run();
  }
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
    if(busy||playback.steps.length)return;
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
    if(busy||playback.steps.length)return;
    cfg().problem.board.fill(0);
    cfg().puzzle = "custom";
    persist();
    renderLab();
  }
  if(action==='apply-timetable'&&lab==='timetable'&&!busy){
    try{applyTimetableJSON(document.getElementById('timetable-json').value,false);}catch(error){document.getElementById('tt-upload-message').textContent=error.message;}
  }
  if(action==='tt-template')downloadJSONFile(timetablePreset(),'algoai-timetable-example.json');
  if(action==='tt-export'&&lab==='timetable'&&result?.status==='solved'){
    const p=cfg().problem;
    downloadJSONFile({dataset:p,schedule:result.output.assignments.map((placement,i)=>({...p.sessions[i],slot:placement.slot,time:p.slots[placement.slot],room:placement.room}))},'algoai-timetable.json');
  }
  if (action === "apply-timetable-basic") applyBasicTimetable();
  if (action === "new-game") {
    reset();
    cfg().problem.board = Array(9).fill("");
    cfg().problem.turn = "X";
    cfg().position = "empty";
    persist();
    renderLab();
    if(cfg().problem.turn===cfg().problem.ai)run(true);
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
  // Removing a focused configuration field can emit a second native change.
  // Its value was already committed; do not reenter the DOM mount on blur.
  if (lab === 'pathfinding' && pfRendering) return;
  if (lab === 'optimization' && nqRendering) return;
  if (lab === 'game' && gameRendering) return;
  if (lab === 'sudoku' && sudokuUI.rendering) return;
  if (lab === 'timetable' && timetableUI.rendering) return;
  const el = event.target;
  if (lab === "question-visualizer" && el.closest(".qv-workspace")) return;
  if(el.id==='timetable-upload'&&lab==='timetable'){
    const file=el.files?.[0],ticket=++timetableUploadId,revision=requestId;if(!file||busy)return;
    try{
      if(file.size>262144)throw Error('Choose a JSON file smaller than 256 KB.');
      const text=await file.text();if(ticket!==timetableUploadId||revision!==requestId||lab!=='timetable')return;
      applyTimetableJSON(text,true);
    }catch(error){if(ticket===timetableUploadId&&lab==='timetable')document.getElementById('tt-upload-message').textContent=error.message;}
    if(el.isConnected)el.value='';return;
  }
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
    if(busy||playback.steps.length||sudokuUI.tools?.mode!=="pf-editor")return;
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
    sudokuUI.key=JSON.stringify(cfg());syncSudoku(null);
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
  if (!Object.hasOwn(labNames, lab)) return;
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
window.addEventListener("hashchange", navigate);
window.addEventListener("beforeunload", () => {
  cleanupDocument?.();
  timetableUI.tools?.destroy();timetableUI.dropdowns?.destroy();timetableUI.renderer?.destroy();
  sudokuUI.tools?.destroy();sudokuUI.dropdowns?.destroy();sudokuUI.renderer?.destroy();
  nqTools?.destroy();nqDropdowns?.destroy();nqRenderer?.destroy();
  pfTools?.destroy();
  pfDropdowns?.destroy();
  cleanupDashboard?.();
  siteNavigation.destroy();
  questionWorkspace?.destroy();
  worker?.terminate();
  playback.pause();
});
navigate();
