import test from "node:test";
import assert from "node:assert/strict";
import { execute, compare } from "../js/engine.js";
import {
  fresh,
  gridPreset,
  sudokuPreset,
  timetablePreset,
} from "../js/models.js";
import { Queue, Stack, PriorityQueue, random } from "../js/core.js";
import { conflicts } from "../js/algorithms/optimization.js";
import { winner } from "../js/algorithms/game.js";
import { sudokuModel, timetableModel } from "../js/algorithms/csp.js";
import { Playback } from "../js/playback.js";
import { validateConfiguration } from "../js/validation.js";
import {
  encodeConfiguration,
  decodeConfiguration,
  importData,
} from "../js/storage.js";

const weighted = {
  rows: 3,
  cols: 5,
  start: 0,
  goal: 4,
  cells: [1, 9, 9, 9, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
};
function routeValid(p, r) {
  assert.equal(r.output.path[0], p.start);
  assert.equal(r.output.path.at(-1), p.goal);
  let cost = 0;
  for (let i = 1; i < r.output.path.length; i++) {
    const a = r.output.path[i - 1],
      b = r.output.path[i];
    assert.ok(p.cells[b] > 0);
    assert.equal(
      Math.abs(Math.floor(a / p.cols) - Math.floor(b / p.cols)) +
        Math.abs((a % p.cols) - (b % p.cols)),
      1,
    );
    cost += p.cells[b];
  }
  assert.equal(r.metrics.pathCost, cost);
  assert.equal(r.metrics.pathLength, r.output.path.length - 1);
}
test("queue, stack, and stable priority queue enforce algorithm selection rules", () => {
  const q = new Queue(),
    s = new Stack(),
    p = new PriorityQueue();
  [1, 2, 3].forEach((v) => {
    q.push(v);
    s.push(v);
  });
  assert.deepEqual([q.pop(), q.pop(), q.pop()], [1, 2, 3]);
  assert.deepEqual([s.pop(), s.pop(), s.pop()], [3, 2, 1]);
  p.push({ priority: 4, order: 0 });
  p.push({ priority: 1, order: 1 });
  p.push({ priority: 1, order: 2 });
  assert.deepEqual([p.pop().order, p.pop().order, p.pop().order], [1, 2, 0]);
});
test("weighted map distinguishes fewest moves from lowest entry cost", () => {
  for (const algorithm of ["bfs", "dfs", "ucs", "greedy", "astar"]) {
    const r = execute("pathfinding", {
      ...fresh("pathfinding"),
      algorithm,
      problem: weighted,
    });
    assert.equal(r.status, "solved");
    routeValid(weighted, r);
    if (algorithm === "bfs") {
      assert.equal(r.metrics.pathLength, 4);
      assert.equal(r.metrics.pathCost, 28);
    }
    if (["ucs", "astar"].includes(algorithm)) {
      assert.equal(r.metrics.pathLength, 6);
      assert.equal(r.metrics.pathCost, 6);
    }
  }
});
test("unweighted maze agrees across optimal methods; all search methods find valid paths", () => {
  const p = gridPreset("maze"),
    lengths = [];
  for (const algorithm of ["bfs", "dfs", "ucs", "greedy", "astar"]) {
    const r = execute(
      "pathfinding",
      { ...fresh("pathfinding"), algorithm, problem: p },
      false,
    );
    assert.equal(r.status, "solved");
    routeValid(p, r);
    assert.ok(r.metrics.expanded <= p.cells.length);
    if (["bfs", "ucs", "astar"].includes(algorithm))
      lengths.push(r.metrics.pathLength);
  }
  assert.equal(new Set(lengths).size, 1);
});
test("unreachable, zero-move goal, search limit, and invalid endpoints are distinct", () => {
  for (const algorithm of ["bfs", "dfs", "ucs", "greedy", "astar"])
    assert.equal(
      execute(
        "pathfinding",
        {
          ...fresh("pathfinding"),
          algorithm,
          problem: gridPreset("unreachable"),
        },
        false,
      ).status,
      "no-solution",
    );
  const p = { ...weighted, goal: 0 };
  const r = execute("pathfinding", { ...fresh("pathfinding"), problem: p });
  assert.equal(r.metrics.pathLength, 0);
  assert.equal(r.metrics.pathCost, 0);
  assert.equal(r.metrics.expanded, 0);
  assert.equal(
    execute(
      "pathfinding",
      { ...fresh("pathfinding"), problem: weighted, limit: 1 },
      false,
    ).status,
    "search-limit",
  );
  assert.throws(() =>
    execute("pathfinding", {
      ...fresh("pathfinding"),
      problem: { ...weighted, start: 10 },
    }),
  );
});
test("recorded snapshots are independent; previous/seek reproduce exact earlier frames", () => {
  const input = {
      ...fresh("pathfinding"),
      algorithm: "bfs",
      problem: structuredClone(weighted),
    },
    before = structuredClone(input),
    r = execute("pathfinding", input);
  assert.deepEqual(input, before);
  assert.equal(r.steps[0].metrics.expanded, 0);
  assert.equal(r.steps[0].state.g[4], Infinity);
  assert.notEqual(r.steps[0].state.g, r.steps.at(-1).state.g);
  let current;
  const player = new Playback(
    (frame) => (current = frame),
    () => {},
  );
  player.load(r.steps);
  const original = structuredClone(current);
  player.next();
  player.previous();
  assert.deepEqual(current, original);
  player.seek(r.steps.length - 1);
  assert.deepEqual(current.state.path, r.output.path);
  player.reset();
  assert.equal(current, null);
});
test("N-Queens scores each pair once and recovers valid boards after local-search stalls", () => {
  assert.equal(conflicts([1, 3, 0, 2]), 0);
  assert.equal(conflicts([0, 0, 0, 0]), 6);
  const c = { ...fresh("optimization"), problem: { queens: [0, 1, 3, 2] } };
  const r = execute("optimization", c);
  assert.equal(r.status, "solved-after-recovery");
  assert.equal(r.metrics.bestScore, 0);
  assert.equal(r.metrics.candidateEvaluations, 13);
  assert.equal(r.metrics.iterations, 1);
  assert.equal(conflicts(r.output.queens),0);
  assert(r.metrics.recoveryEvaluations>0);
  assert.equal(r.steps.at(-1).event,'solved-after-recovery');
  assert.equal(
    execute("optimization", { ...c, problem: { queens: [1, 3, 0, 2] } }).status,
    "solved",
  );
});
test("annealing replays seeded choices, accepts worse moves, and preserves best score", () => {
  const c = {
    ...fresh("optimization"),
    algorithm: "anneal",
    seed: 101,
    temperature: 100,
    cooling: 0.99,
    limit: 40,
    problem: { queens: [0, 1, 3, 2] },
  };
  const a = execute("optimization", c),
    b = execute("optimization", c);
  assert.deepEqual(a.steps, b.steps);
  assert.deepEqual(a.output, b.output);
  assert.ok(a.metrics.worseAccepted > 0);
  assert.ok(a.metrics.bestScore <= a.metrics.currentScore);
  for (const step of a.steps.filter(
    (s) => s.event === "accept" && s.state.candidate.delta > 0,
  )) {
    const candidate = step.state.candidate;
    assert.equal(
      candidate.probability,
      Math.exp(-candidate.delta / step.state.temperature),
    );
    assert.ok(candidate.draw < candidate.probability);
  }
  assert.equal(a.metrics.bestScore, conflicts(a.output.bestQueens));
});
test("seed zero is reproducible and does not produce a degenerate zero stream", () => {
  const a = random(0),
    b = random(0);
  const xs = Array.from({ length: 6 }, () => a());
  assert.deepEqual(
    xs,
    Array.from({ length: 6 }, () => b()),
  );
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.ok(new Set(xs).size > 1);
});
test("strict local minimum preset has score one and every neighbor is worse", () => {
  const q = [0, 5, 1, 4, 6, 3, 7, 2];
  assert.equal(conflicts(q), 1);
  for (let c = 0; c < 8; c++)
    for (let r = 0; r < 8; r++)
      if (r !== q[c]) {
        const next = q.slice();
        next[c] = r;
        assert.ok(conflicts(next) > 1);
      }
  const result = execute("optimization", {
    ...fresh("optimization"),
    problem: { queens: q },
  });
  assert.equal(result.status, "solved-after-recovery");
  assert.equal(result.metrics.bestScore, 0);
  assert.equal(conflicts(result.output.queens),0);
});
test("N-Queens exact completion finds solutions at every supported board size",()=>{
  for(let n=4;n<=12;n++){
    const result=execute('optimization',{...fresh('optimization'),problem:{queens:Array(n).fill(0)},limit:1});
    assert.equal(result.status,'solved-after-recovery',`${n} queens`);
    assert.equal(result.output.queens.length,n);
    assert.equal(conflicts(result.output.queens),0,`${n} queens`);
    assert(result.steps.some(step=>step.event==='recovery'));
  }
});
test("Minimax and alpha-beta agree; winning and blocking decisions are legal", () => {
  const positions = [
    ["X", "X", "", "O", "O", "", "", "", ""],
    ["X", "X", "", "", "O", "", "", "", ""],
    ["X", "O", "X", "", "O", "", "", "", ""],
    ["X", "", "", "", "", "", "", "", ""],
  ];
  for (const board of positions) {
    const turn =
      board.filter((v) => v === "X").length ===
      board.filter((v) => v === "O").length
        ? "X"
        : "O";
    for (const ordering of ["natural", "center"]) {
      const c = {
          ...fresh("game"),
          problem: { board, turn, ai: turn },
          ordering,
        },
        a = execute("game", { ...c, algorithm: "minimax" }, false),
        b = execute("game", { ...c, algorithm: "alphabeta" }, false);
      assert.equal(a.output.value, b.output.value);
      assert.equal(a.output.move, b.output.move);
      assert.ok(b.metrics.nodesEvaluated <= a.metrics.nodesEvaluated);
      assert.equal(board[b.output.move], "");
    }
  }
  const win = execute(
    "game",
    { ...fresh("game"), problem: { board: positions[0], turn: "X", ai: "X" } },
    false,
  );
  assert.equal(win.output.move, 2);
  const block = execute(
    "game",
    { ...fresh("game"), problem: { board: positions[1], turn: "O", ai: "O" } },
    false,
  );
  assert.equal(block.output.move, 2);
});
test("optimal O opponent cannot be defeated by any sequence of human X moves", () => {
  const cache = new Map();
  function explore(board, turn) {
    const end = winner(board);
    if (end) {
      assert.notEqual(end, "X");
      return;
    }
    if (turn === "O") {
      const key = board.join("-");
      let move = cache.get(key);
      if (move === undefined) {
        move = execute(
          "game",
          { ...fresh("game"), problem: { board, turn, ai: "O" } },
          false,
        ).output.move;
        cache.set(key, move);
      }
      const next = board.slice();
      next[move] = "O";
      explore(next, "X");
    } else
      for (let i = 0; i < 9; i++)
        if (!board[i]) {
          const next = board.slice();
          next[i] = "X";
          explore(next, "O");
        }
  }
  explore(Array(9).fill(""), "X");
});
test("game rejects impossible boards and terminal utility is correct", () => {
  assert.throws(() =>
    execute("game", {
      ...fresh("game"),
      problem: {
        board: ["X", "X", "X", "O", "O", "O", "", "", ""],
        turn: "X",
        ai: "O",
      },
    }),
  );
  const board = ["X", "X", "X", "O", "O", "", "", "", ""];
  const r = execute(
    "game",
    { ...fresh("game"), problem: { board, turn: "O", ai: "O" } },
    false,
  );
  assert.equal(r.status, "terminal");
  assert.equal(r.output.value, -1);
  assert.equal(r.output.move, null);
});
test("opening Minimax completes its full search while bounding retained tree and trace memory", () => {
  const r = execute("game", { ...fresh("game"), algorithm: "minimax" });
  assert.equal(r.output.value, 0);
  assert.equal(r.metrics.nodesEvaluated, 549946);
  assert.ok(r.output.treeTruncated);
  assert.ok(r.output.treeRetained < 30100);
  assert.ok(r.traceSkipped > 0);
  assert.equal(r.steps.length, 12001);
  assert.equal(r.steps.at(-1).event, "decision");
  assert.ok(r.output.tree[0].children.every((id) => r.output.tree[id]));
});
function validCSP(model, values) {
  assert.ok(values.every((v) => v !== null));
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++)
      assert.ok(!model.conflict(i, values[i], j, values[j]));
}
test("both Sudoku solvers preserve clues and produce a valid identical solution", () => {
  const board = sudokuPreset("easy"),
    outputs = [];
  for (const algorithm of ["backtracking", "forward"]) {
    const r = execute("sudoku", {
      ...fresh("sudoku"),
      algorithm,
      problem: { board },
    });
    assert.equal(r.status, "solved");
    validCSP(sudokuModel(board), r.output.assignments);
    board.forEach((v, i) => {
      if (v) assert.equal(r.output.assignments[i], v);
    });
    outputs.push(r.output.assignments);
    if (algorithm === "forward")
      assert.ok(r.steps.some((s) => s.event === "prune"));
  }
  assert.deepEqual(outputs[0], outputs[1]);
});
test("Sudoku invalid givens, exhaustive failure, and bounded interruption differ", () => {
  assert.throws(
    () =>
      execute("sudoku", {
        ...fresh("sudoku"),
        problem: { board: sudokuPreset("invalid") },
      }),
    /Invalid Sudoku/,
  );
  const impossible = execute(
    "sudoku",
    {
      ...fresh("sudoku"),
      problem: { board: sudokuPreset("impossible") },
      limit: 100000,
    },
    false,
  );
  assert.equal(impossible.status, "no-solution");
  assert.equal(
    execute("sudoku", { ...fresh("sudoku"), limit: 1 }, false).status,
    "search-limit",
  );
});
test("both timetable solvers respect all conflicts, availability, and required sessions", () => {
  const p = timetablePreset();
  for (const algorithm of ["backtracking", "forward"]) {
    const r = execute("timetable", {
      ...fresh("timetable"),
      algorithm,
      problem: p,
    });
    assert.equal(r.status, "solved");
    validCSP(timetableModel(p), r.output.assignments);
    r.output.assignments.forEach((v, i) => {
      assert.ok(
        p.rooms.find((room) => room.id === v.room).available.includes(v.slot),
      );
      assert.ok(
        p.teachers
          .find((t) => t.id === p.sessions[i].teacher)
          .available.includes(v.slot),
      );
      assert.ok(p.sessions[i].rooms.includes(v.room));
    });
    if (algorithm === "backtracking") assert.ok(r.metrics.backtracks > 0);
  }
});
test("impossible timetable is proved separately from reaching a limit", () => {
  for (const algorithm of ["backtracking", "forward"])
    assert.equal(
      execute(
        "timetable",
        {
          ...fresh("timetable"),
          algorithm,
          problem: timetablePreset("impossible"),
        },
        false,
      ).status,
      "no-solution",
    );
  assert.equal(
    execute("timetable", { ...fresh("timetable"), limit: 1 }, false).status,
    "search-limit",
  );
});
test("comparisons measure actual repeated runs on identical inputs and paired seeds", () => {
  const c = { ...fresh("pathfinding"), problem: weighted },
    before = structuredClone(c),
    rows = compare("pathfinding", c);
  assert.deepEqual(c, before);
  assert.equal(rows.length, 5);
  for (const row of rows) {
    assert.equal(row.runs.length, 5);
    assert.ok(row.metrics.executionMs >= 0);
    assert.equal(new Set(row.runs.map((r) => r.metrics.expanded)).size, 1);
  }
  const opt = compare("optimization", { ...fresh("optimization"), limit: 25 });
  assert.equal(opt.length, 2);
  assert.equal(opt[0].runs.length, 20);
  for (let i = 0; i < 20; i++) {
    assert.equal(opt[0].runs[i].seed, opt[1].runs[i].seed);
    assert.deepEqual(
      opt[0].runs[i].startingQueens,
      opt[1].runs[i].startingQueens,
    );
  }
  assert.ok(opt.every((r) => r.successRate >= 0 && r.successRate <= 1));
});

test("configuration validation, share encoding, and import merge preserve normalized data", () => {
  const c = fresh("game"),
    copy = validateConfiguration("game", c);
  copy.problem.board[0] = "X";
  assert.equal(c.problem.board[0], "");
  assert.throws(() => validateConfiguration("game", { ...c, depthLimit: 10 }));
  const decoded = decodeConfiguration(encodeConfiguration("game", c));
  assert.equal(decoded.lab, "game");
  assert.deepEqual(decoded.config, c);
  const merged = importData(
    JSON.stringify({ configs: { game: { ...c, depthLimit: 2 } }, history: [] }),
    { configs: { pathfinding: fresh("pathfinding") }, history: [] },
  );
  assert.equal(merged.configs.game.depthLimit, 2);
  assert.ok(merged.configs.pathfinding);
});
test("grid presets scale and bounded game search marks heuristic leaf results", () => {
  const p = gridPreset("weighted", 22, 31);
  assert.equal(p.cells.length, 22 * 31);
  assert.equal(p.rows, 22);
  const c = { ...fresh("game"), depthLimit: 2 },
    r = execute("game", c, false);
  assert.equal(r.status, "evaluated");
  assert.equal(r.output.heuristicResult, true);
  assert.ok(r.metrics.heuristicEvaluations > 0);
  assert.ok(r.output.value >= -0.95 && r.output.value <= 0.95);
});

test("MRV with degree tie-break and LCV solves a valid Sudoku", () => {
  const board = sudokuPreset("easy");
  const result = execute(
    "sudoku",
    {
      ...fresh("sudoku"),
      algorithm: "forward",
      variableOrdering: "mrv",
      valueOrdering: "lcv",
      problem: { board },
    },
    false,
  );
  assert.equal(result.status, "solved");
  validCSP(sudokuModel(board), result.output.assignments);
  board.forEach((value, i) => {
    if (value) assert.equal(result.output.assignments[i], value);
  });
});

test("hill sideways moves and seeded restarts are reproducible and track best", () => {
  const plateau = {
    ...fresh("optimization"),
    problem: { queens: [0, 1, 3, 2] },
    sidewaysLimit: 1,
    limit: 2,
  };
  const sideways = execute("optimization", plateau, false);
  assert.equal(sideways.metrics.sidewaysMoves, 1);
  assert.equal(
    sideways.metrics.bestScore,
    conflicts(sideways.output.bestQueens),
  );

  const restart = {
    ...fresh("optimization"),
    seed: 77,
    problem: { queens: [0, 5, 1, 4, 6, 3, 7, 2] },
    restarts: 2,
    limit: 15,
  };
  const first = execute("optimization", restart, false);
  const second = execute("optimization", restart, false);
  assert.ok(first.metrics.restarts > 0);
  assert.deepEqual(first.output, second.output);
  const { executionMs: _firstTiming, ...firstCounters } = first.metrics;
  const { executionMs: _secondTiming, ...secondCounters } = second.metrics;
  assert.deepEqual(firstCounters, secondCounters);
  assert.equal(first.metrics.bestScore, conflicts(first.output.bestQueens));
  assert.equal(first.metrics.currentScore, conflicts(first.output.queens));
});

test("depth-limited Minimax and alpha-beta agree on estimated values and moves", () => {
  const config = { ...fresh("game"), depthLimit: 2 };
  const minimax = execute("game", { ...config, algorithm: "minimax" }, false);
  const alphabeta = execute(
    "game",
    { ...config, algorithm: "alphabeta" },
    false,
  );
  assert.equal(minimax.status, "evaluated");
  assert.equal(alphabeta.status, "evaluated");
  assert.equal(minimax.output.heuristicResult, true);
  assert.equal(alphabeta.output.heuristicResult, true);
  assert.equal(minimax.output.move, alphabeta.output.move);
  assert.equal(minimax.output.value, alphabeta.output.value);
  assert.ok(minimax.metrics.heuristicEvaluations > 0);
  assert.ok(alphabeta.metrics.heuristicEvaluations > 0);

  const terminal = execute(
    "game",
    {
      ...fresh("game"),
      depthLimit: 1,
      problem: {
        board: ["X", "X", "X", "O", "O", "", "", "", ""],
        turn: "O",
        ai: "O",
      },
    },
    false,
  );
  assert.equal(terminal.status, "terminal");
  assert.equal(terminal.metrics.heuristicEvaluations, 0);
});
