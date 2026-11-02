import test from "node:test";
import assert from "node:assert/strict";
import {
  graphSVG,
  normalizeGraphDraft,
  QUESTION_ALGORITHMS,
  solveGraph,
  validateGraphDraft,
} from "../js/question-graph.js";

function graph() {
  return {
    questionText: "Known route graph",
    algorithm: null,
    algorithmCandidates: ["bfs", "greedy", "ucs", "astar"],
    directed: true,
    startId: "S",
    goalId: "E",
    nodes: [
      { id: "S", label: "S", heuristic: 4 },
      { id: "A", label: "A", heuristic: 8 },
      { id: "B", label: "B", heuristic: 3 },
      { id: "H", label: "H", heuristic: 2 },
      { id: "G", label: "G", heuristic: 1 },
      { id: "E", label: "E", heuristic: 0 },
    ],
    edges: [
      { id: "sa", source: "S", target: "A", cost: 8 },
      { id: "sb", source: "S", target: "B", cost: 1 },
      { id: "ae", source: "A", target: "E", cost: 8 },
      { id: "bh", source: "B", target: "H", cost: 1 },
      { id: "hg", source: "H", target: "G", cost: 1 },
      { id: "ge", source: "G", target: "E", cost: 1 },
    ],
  };
}

test("question graph normalizer returns bounded cloned partial drafts with stable IDs", () => {
  const raw = { nodes: [{ label: "S" }], edges: [{ source: "node-1" }] };
  const normalized = normalizeGraphDraft(raw);
  assert.equal(normalized.nodes[0].id, "node-1");
  assert.equal(normalized.edges[0].id, "edge-1");
  assert.equal(normalized.edges[0].cost, null);
  normalized.nodes[0].label = "changed";
  assert.equal(raw.nodes[0].label, "S");
  assert.throws(() =>
    normalizeGraphDraft({ nodes: Array(51).fill({}), edges: [] }),
  );
  assert.throws(() => normalizeGraphDraft({ nodes: "not-an-array" }));
});

test("validation blocks unresolved direction and required missing costs", () => {
  const draft = graph();
  draft.directed = null;
  draft.edges[0].cost = null;
  const check = validateGraphDraft(draft, "ucs");
  assert.equal(check.valid, false);
  assert.ok(check.errors.some((entry) => entry.field === "directed"));
  assert.ok(check.errors.some((entry) => entry.field === "edges.cost"));
  assert.equal(QUESTION_ALGORITHMS.length, 5);
});

test("BFS follows edge insertion order and minimizes edge count; Greedy follows supplied h", () => {
  const draft = graph();
  const bfs = solveGraph("bfs", draft, { trace: false });
  const greedy = solveGraph("greedy", draft, { trace: false });
  assert.deepEqual(bfs.output.path, ["S", "A", "E"]);
  assert.equal(bfs.metrics.pathLength, 2);
  assert.deepEqual(greedy.output.path, ["S", "B", "H", "G", "E"]);
  assert.equal(greedy.metrics.pathLength, 4);
  const depthFirst = solveGraph("dfs", draft, { trace: false });
  assert.deepEqual(depthFirst.output.path, ["S", "A", "E"]);
});

test("UCS and consistent A* choose the lowest-cost route", () => {
  const draft = graph();
  for (const algorithm of ["ucs", "astar"]) {
    const result = solveGraph(algorithm, draft, { trace: false });
    assert.equal(result.status, "solved");
    assert.deepEqual(result.output.path, ["S", "B", "H", "G", "E"]);
    assert.equal(result.output.pathCost, 4);
    assert.equal(result.metrics.pathCost, 4);
  }
});

test("A* reopens an improved node with an inconsistent heuristic", () => {
  const draft = {
    directed: true,
    startId: "S",
    goalId: "G",
    nodes: [
      { id: "S", heuristic: 0 },
      { id: "A", heuristic: 0 },
      { id: "B", heuristic: 3 },
      { id: "G", heuristic: 0 },
    ],
    edges: [
      { id: "sa", source: "S", target: "A", cost: 4 },
      { id: "sb", source: "S", target: "B", cost: 1 },
      { id: "ba", source: "B", target: "A", cost: 1 },
      { id: "ag", source: "A", target: "G", cost: 10 },
      { id: "bg", source: "B", target: "G", cost: 20 },
    ],
  };
  const result = solveGraph("astar", draft, { trace: false });
  assert.deepEqual(result.output.path, ["S", "B", "A", "G"]);
  assert.equal(result.metrics.pathCost, 12);
  assert.ok(
    result.output.warnings.some((warning) =>
      /inconsistent/.test(warning.message),
    ),
  );
  assert.ok(result.metrics.maxFrontier <= draft.nodes.length);
});

test("unknown edge costs are allowed outside weighted search and never reported as zero", () => {
  const draft = graph();
  draft.edges.forEach((edge) => (edge.cost = null));
  const result = solveGraph("bfs", draft, { trace: false });
  assert.equal(result.status, "solved");
  assert.equal(result.metrics.pathCost, null);
  assert.equal(result.output.pathCost, null);
  assert.throws(
    () => solveGraph("ucs", draft, { trace: false }),
    /requires a cost/,
  );
});

test("recorded graph states replay without leaking the final path into initialization", () => {
  const result = solveGraph("bfs", graph());
  assert.deepEqual(result.steps[0].state.path, []);
  assert.deepEqual(result.steps.at(-1).state.path, result.output.path);
  assert.notEqual(
    result.steps[0].state.parents,
    result.steps.at(-1).state.parents,
  );
  assert.equal(result.steps.at(-1).event, "solved");
  const capped = solveGraph("dfs", graph(), { limit: 1 });
  assert.equal(capped.status, "search-limit");
});

test("unreachable goals and directed edge traversal have explicit outcomes", () => {
  const draft = graph();
  draft.edges = draft.edges.filter((edge) => edge.target !== "E");
  const result = solveGraph("bfs", draft, { trace: false });
  assert.equal(result.status, "no-solution");
  assert.deepEqual(result.output.path, []);
  assert.equal(result.metrics.pathCost, null);
});

test("SVG escapes labels, marks path/current states, and namespaces directed arrows", () => {
  const draft = graph();
  draft.nodes[0].label = "<S>";
  const svg = graphSVG(
    draft,
    {
      current: "S",
      frontier: [{ id: "A" }],
      path: ["S", "A"],
      parentEdges: { A: "sa" },
    },
    {
      interactive: true,
      markerId: "panel left",
      showCosts: true,
      showHeuristics: true,
    },
  );
  assert.match(svg, /&lt;S&gt;/);
  assert.match(svg, /qv-node-current/);
  assert.match(svg, /qv-node-frontier/);
  assert.match(svg, /qv-edge-path/);
  assert.match(svg, /qv-arrow-panel-left/);
  assert.match(svg, /data-qv-node="S"/);
  assert.doesNotMatch(svg, /<S>/);
});

test("prototype-like node IDs remain ordinary graph keys", () => {
  const draft = {
    directed: true,
    startId: "__proto__",
    goalId: "constructor",
    nodes: [{ id: "__proto__" }, { id: "constructor" }],
    edges: [
      {
        id: "prototype-edge",
        source: "__proto__",
        target: "constructor",
        cost: 1,
      },
    ],
  };
  const result = solveGraph("bfs", draft, { trace: true });
  assert.deepEqual(result.output.path, ["__proto__", "constructor"]);
  assert.equal(result.steps.at(-1).state.parents.constructor, "__proto__");
  assert.equal(Object.prototype.polluted, undefined);
});
