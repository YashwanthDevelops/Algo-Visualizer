import { PriorityQueue, clone } from "./core.js";

export const QUESTION_ALGORITHMS = [
  {
    id: "bfs",
    label: "Breadth-first search",
    description:
      "Explore by number of edges; finds a path with the fewest edges.",
  },
  {
    id: "dfs",
    label: "Depth-first search",
    description: "Follow the next inserted neighbor as far as possible.",
  },
  {
    id: "ucs",
    label: "Uniform-cost search",
    description:
      "Expand the pending path with the lowest accumulated edge cost.",
  },
  {
    id: "greedy",
    label: "Greedy best-first search",
    description:
      "Expand the pending node with the lowest supplied heuristic h.",
  },
  {
    id: "astar",
    label: "A* search",
    description:
      "Expand the pending node with the lowest accumulated cost plus h.",
  },
];

const algorithmIds = new Set(QUESTION_ALGORITHMS.map(({ id }) => id));
const COST_LIMIT = 1_000_000;
const MAX_NODES = 50;
const MAX_EDGES = 150;
const TRACE_LIMIT = 1800;
const MAX_ID_LENGTH = 80;
const MAX_LABEL_LENGTH = 120;
const MAX_QUESTION_LENGTH = 5000;
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

function partialNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Normalize untrusted graph JSON into a bounded, cloned partial draft. */
export function normalizeGraphDraft(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("Graph draft must be an object.");
  if (raw.nodes !== undefined && !Array.isArray(raw.nodes))
    throw Error("Graph nodes must be an array.");
  if (raw.edges !== undefined && !Array.isArray(raw.edges))
    throw Error("Graph edges must be an array.");
  const sourceNodes = raw.nodes ?? [];
  const sourceEdges = raw.edges ?? [];
  if (sourceNodes.length > MAX_NODES)
    throw Error(`A question graph can contain at most ${MAX_NODES} nodes.`);
  if (sourceEdges.length > MAX_EDGES)
    throw Error(`A question graph can contain at most ${MAX_EDGES} edges.`);
  if (
    raw.algorithmCandidates !== undefined &&
    (!Array.isArray(raw.algorithmCandidates) ||
      raw.algorithmCandidates.length > 5)
  )
    throw Error("Algorithm candidates must be a list of at most five choices.");
  if (
    sourceNodes.some(
      (node) => !node || typeof node !== "object" || Array.isArray(node),
    ) ||
    sourceEdges.some(
      (edge) => !edge || typeof edge !== "object" || Array.isArray(edge),
    )
  )
    throw Error("Every graph node and edge must be an object.");

  const nodes = sourceNodes.map((node, index) => {
    const id =
      typeof node.id === "string" && node.id.trim()
        ? node.id
        : `node-${index + 1}`;
    const label = typeof node.label === "string" ? node.label : id;
    if (id.length > MAX_ID_LENGTH || label.length > MAX_LABEL_LENGTH)
      throw Error("Node IDs are limited to 80 characters and labels to 120.");
    const normalized = { id, label, heuristic: partialNumber(node.heuristic) };
    if (typeof node.x === "number" && Number.isFinite(node.x))
      normalized.x = node.x;
    if (typeof node.y === "number" && Number.isFinite(node.y))
      normalized.y = node.y;
    return normalized;
  });
  const edges = sourceEdges.map((edge, index) => {
    const id =
      typeof edge.id === "string" && edge.id.trim()
        ? edge.id
        : `edge-${index + 1}`;
    const source = typeof edge.source === "string" ? edge.source : null;
    const target = typeof edge.target === "string" ? edge.target : null;
    if (
      id.length > MAX_ID_LENGTH ||
      source?.length > MAX_ID_LENGTH ||
      target?.length > MAX_ID_LENGTH
    )
      throw Error("Edge IDs and node references are limited to 80 characters.");
    return { id, source, target, cost: partialNumber(edge.cost) };
  });
  const questionText =
    typeof raw.questionText === "string" ? raw.questionText : "";
  if (questionText.length > MAX_QUESTION_LENGTH)
    throw Error(
      `Question text is limited to ${MAX_QUESTION_LENGTH} characters.`,
    );
  const startId = typeof raw.startId === "string" ? raw.startId : null;
  const goalId = typeof raw.goalId === "string" ? raw.goalId : null;
  if (startId?.length > MAX_ID_LENGTH || goalId?.length > MAX_ID_LENGTH)
    throw Error("Start and goal node references are limited to 80 characters.");
  return {
    algorithm: algorithmIds.has(raw.algorithm) ? raw.algorithm : null,
    algorithmCandidates: Array.isArray(raw.algorithmCandidates)
      ? [
          ...new Set(
            raw.algorithmCandidates.filter((id) => algorithmIds.has(id)),
          ),
        ]
      : [],
    questionText,
    directed: typeof raw.directed === "boolean" ? raw.directed : null,
    startId,
    goalId,
    nodes,
    edges,
  };
}

/** Return readiness errors and algorithm caveats without throwing on semantic gaps. */
export function validateGraphDraft(
  draft,
  selectedAlgorithm = draft?.algorithm,
) {
  const errors = [];
  const warnings = [];
  const error = (field, message) => errors.push({ field, message });
  const warning = (field, message) => warnings.push({ field, message });
  let graph;
  try {
    graph = normalizeGraphDraft(draft);
  } catch (cause) {
    return {
      valid: false,
      errors: [{ field: "graph", message: cause.message }],
      warnings,
    };
  }
  if (!algorithmIds.has(selectedAlgorithm))
    error("algorithm", "Choose one of BFS, DFS, UCS, Greedy, or A*.");
  if (graph.directed === null)
    error("directed", "Choose whether edges are directed or undirected.");
  if (!graph.nodes.length) error("nodes", "Add at least one node.");
  const ids = new Set();
  for (const [index, node] of graph.nodes.entries()) {
    if (!node.id.trim())
      error(`nodes.${index}.id`, "Node IDs cannot be blank.");
    if (ids.has(node.id))
      error(`nodes.${index}.id`, `Duplicate node ID “${node.id}”.`);
    ids.add(node.id);
    if (!node.label.trim())
      error(`nodes.${index}.label`, "Node labels cannot be blank.");
    if (
      node.heuristic !== null &&
      (node.heuristic < 0 || node.heuristic > COST_LIMIT)
    )
      error(
        `nodes.${index}.heuristic`,
        `Heuristics must be from 0 to ${COST_LIMIT}.`,
      );
    for (const axis of ["x", "y"])
      if (node[axis] !== undefined && (node[axis] < 0 || node[axis] > 1))
        error(
          `nodes.${index}.${axis}`,
          "Node positions must be between 0 and 1.",
        );
  }
  const start = ids.has(graph.startId),
    goal = ids.has(graph.goalId);
  if (!start) error("startId", "Choose a valid start node.");
  if (!goal) error("goalId", "Choose a valid goal node.");
  const edgeIds = new Set();
  for (const [index, edge] of graph.edges.entries()) {
    if (!edge.id.trim())
      error(`edges.${index}.id`, "Edge IDs cannot be blank.");
    if (edgeIds.has(edge.id))
      error(`edges.${index}.id`, `Duplicate edge ID “${edge.id}”.`);
    edgeIds.add(edge.id);
    if (!ids.has(edge.source))
      error(`edges.${index}.source`, "Choose a valid source node.");
    if (!ids.has(edge.target))
      error(`edges.${index}.target`, "Choose a valid target node.");
    if (edge.cost !== null && (edge.cost < 0 || edge.cost > COST_LIMIT))
      error(
        `edges.${index}.cost`,
        `Edge costs must be from 0 to ${COST_LIMIT}.`,
      );
  }
  if (
    ["ucs", "astar"].includes(selectedAlgorithm) &&
    graph.edges.some((edge) => edge.cost === null)
  )
    error(
      "edges.cost",
      `${selectedAlgorithm.toUpperCase()} requires a cost on every edge; use unit costs when weights are not given.`,
    );
  if (["greedy", "astar"].includes(selectedAlgorithm)) {
    if (graph.nodes.some((node) => node.heuristic === null))
      error(
        "nodes.heuristic",
        `${selectedAlgorithm === "astar" ? "A*" : "Greedy"} requires a non-negative heuristic for every node.`,
      );
    if (
      selectedAlgorithm === "astar" &&
      goal &&
      graph.nodes.find((node) => node.id === graph.goalId)?.heuristic !== 0
    )
      error("goal.heuristic", "The goal heuristic must be 0 for A*.");
  }
  if (
    selectedAlgorithm === "astar" &&
    graph.directed !== null &&
    graph.nodes.every((n) => n.heuristic !== null) &&
    graph.edges.every((e) => e.cost !== null)
  ) {
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const inconsistent = graph.edges.some((edge) => {
      const hSource = nodes.get(edge.source)?.heuristic;
      const hTarget = nodes.get(edge.target)?.heuristic;
      return (
        hSource > edge.cost + hTarget + 1e-9 ||
        (!graph.directed && hTarget > edge.cost + hSource + 1e-9)
      );
    });
    warning(
      "heuristic.consistency",
      inconsistent
        ? "This heuristic is inconsistent on at least one edge. A* reopens improved nodes, but optimality still requires an admissible heuristic."
        : "Edge consistency is checked, but admissibility cannot be proven from these values alone; optimality is not guaranteed.",
    );
  }
  return { valid: errors.length === 0, errors, warnings };
}

function makeRecorder(enabled, cap = TRACE_LIMIT) {
  const steps = [];
  let eventIndex = 0;
  let skipped = 0;
  return {
    steps,
    get skipped() {
      return skipped;
    },
    add(event, state, metrics, line, reason, final = false) {
      eventIndex += 1;
      if (!enabled) return;
      if (steps.length >= cap && !final) {
        skipped += 1;
        return;
      }
      steps.push({
        event,
        eventIndex,
        state: clone(state),
        metrics: clone(metrics),
        line,
        reason,
      });
    },
  };
}

/** Run a deterministic search over a validated question graph. */
export function solveGraph(algorithm, draft, options = {}) {
  const checked = validateGraphDraft(draft, algorithm);
  if (!checked.valid)
    throw Error(checked.errors.map(({ message }) => message).join(" "));
  const graph = normalizeGraphDraft(draft);
  const trace = options.trace !== false;
  const limit = options.limit ?? 5000;
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000)
    throw Error("Expansion limit must be an integer from 1 to 5,000.");
  const started = performance.now();
  const rec = makeRecorder(trace);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) {
    adjacency
      .get(edge.source)
      .push({ id: edge.target, edgeId: edge.id, cost: edge.cost });
    if (!graph.directed)
      adjacency
        .get(edge.target)
        .push({ id: edge.source, edgeId: edge.id, cost: edge.cost });
  }
  const prioritySearch = ["ucs", "greedy", "astar"].includes(algorithm);
  const frontier = new PriorityQueue(
    (a, b) => a.priority - b.priority || a.order - b.order,
  );
  const deque = [];
  const gScore = new Map([[graph.startId, 0]]);
  const pathCostByNode = new Map([[graph.startId, 0]]);
  const depthByNode = new Map([[graph.startId, 0]]);
  const parents = Object.create(null);
  const parentEdges = Object.create(null);
  const discovered = new Set([graph.startId]);
  const expanded = new Set();
  const expansionOrder = [];
  const selectedOrder = [];
  const metrics = {
    expanded: 0,
    discovered: 1,
    maxFrontier: 1,
    pathLength: null,
    pathCost: null,
  };
  const h = (id) => nodeById.get(id).heuristic;
  const priority = (id, g) =>
    algorithm === "ucs"
      ? g
      : algorithm === "greedy"
        ? h(id)
        : algorithm === "astar"
          ? g + h(id)
          : (depthByNode.get(id) ?? 0);
  let insertionOrder = 0;
  const entryFor = (id) => ({
    id,
    searchG: gScore.get(id),
    g: pathCostByNode.get(id) ?? null,
    h: nodeById.get(id).heuristic,
    priority: priority(id, gScore.get(id)),
    order: insertionOrder++,
  });
  const push = (entry) => {
    if (prioritySearch) frontier.push(entry);
    else if (algorithm === "dfs") deque.unshift(entry);
    else deque.push(entry);
  };
  const pop = () => (prioritySearch ? frontier.pop() : deque.shift());
  const rawFrontier = () =>
    prioritySearch ? frontier.values() : deque.slice();
  const activeFrontier = () =>
    rawFrontier().filter(
      (entry) =>
        gScore.get(entry.id) === entry.searchG && !expanded.has(entry.id),
    );
  const frontierState = () =>
    activeFrontier().map(({ id, g, h: estimate, priority: rank }) => ({
      id,
      g,
      h: estimate,
      priority: rank,
    }));
  const currentState = (current, path = []) => ({
    current,
    frontier: frontierState(),
    visited: [...expanded],
    parents: Object.assign(Object.create(null), parents),
    parentEdges: Object.assign(Object.create(null), parentEdges),
    path: path.slice(),
  });
  const record = (event, line, reason, current, path = [], final = false) => {
    if (trace)
      rec.add(event, currentState(current, path), metrics, line, reason, final);
  };
  push(entryFor(graph.startId));
  record(
    "initialize",
    0,
    "Place the start node in the frontier; no goal path is known yet.",
    null,
  );
  let status = "no-solution";
  let current = null;
  let path = [];
  let pathEdges = [];
  while ((prioritySearch ? frontier.size : deque.length) > 0) {
    const entry = pop();
    if (entry.searchG !== gScore.get(entry.id) || expanded.has(entry.id))
      continue;
    current = entry.id;
    selectedOrder.push(current);
    record(
      "select",
      1,
      `Select ${nodeById.get(current).label}; priority ${entry.priority}.`,
      current,
    );
    if (current === graph.goalId) {
      status = "solved";
      path = [current];
      pathEdges = [];
      while (path[0] !== graph.startId) {
        const child = path[0];
        path.unshift(parents[child]);
        pathEdges.unshift(parentEdges[child]);
      }
      metrics.pathLength = path.length - 1;
      metrics.pathCost = pathEdges.every(
        (edgeId) =>
          graph.edges.find((edge) => edge.id === edgeId)?.cost !== null,
      )
        ? pathEdges.reduce(
            (sum, edgeId) =>
              sum + graph.edges.find((edge) => edge.id === edgeId).cost,
            0,
          )
        : null;
      break;
    }
    if (metrics.expanded >= limit) {
      status = "search-limit";
      break;
    }
    expanded.add(current);
    expansionOrder.push(current);
    metrics.expanded = expansionOrder.length;
    record(
      "expand",
      2,
      algorithm === "dfs"
        ? `Expand ${nodeById.get(current).label}; push neighbors in reverse insertion order so the first inserted is selected next.`
        : `Expand ${nodeById.get(current).label}; inspect neighbors in edge insertion order.`,
      current,
    );
    const neighbors = adjacency.get(current);
    const processOrder =
      algorithm === "dfs" ? neighbors.slice().reverse() : neighbors;
    for (const neighbor of processOrder) {
      const nextSearchG =
        algorithm === "bfs" || algorithm === "dfs"
          ? (depthByNode.get(current) ?? 0) + 1
          : algorithm === "greedy"
            ? 0
            : entry.searchG + neighbor.cost;
      const nextCost =
        pathCostByNode.get(current) === null || neighbor.cost === null
          ? null
          : pathCostByNode.get(current) + neighbor.cost;
      const isNew = !discovered.has(neighbor.id);
      const canImprove =
        algorithm === "ucs" || algorithm === "astar"
          ? nextSearchG < (gScore.get(neighbor.id) ?? Infinity)
          : isNew;
      if (!canImprove) continue;
      if (isNew) {
        discovered.add(neighbor.id);
        metrics.discovered = discovered.size;
      }
      gScore.set(neighbor.id, nextSearchG);
      pathCostByNode.set(neighbor.id, nextCost);
      depthByNode.set(neighbor.id, (depthByNode.get(current) ?? 0) + 1);
      parents[neighbor.id] = current;
      parentEdges[neighbor.id] = neighbor.edgeId;
      expanded.delete(neighbor.id);
      push(entryFor(neighbor.id));
      const live = activeFrontier();
      metrics.maxFrontier = Math.max(
        metrics.maxFrontier,
        new Set(live.map((item) => item.id)).size,
      );
      record(
        isNew ? "discover" : "relax",
        3,
        `${isNew ? "Discover" : "Improve"} ${nodeById.get(neighbor.id).label}${nextCost === null ? "; traversed path cost is unknown." : `; accumulated cost is ${nextCost}.`}`,
        current,
      );
    }
  }
  metrics.discovered = discovered.size;
  metrics.executionMs = performance.now() - started;
  record(
    status,
    4,
    status === "solved"
      ? `Goal reached. Path length ${metrics.pathLength}; ${metrics.pathCost === null ? "path cost is unknown" : `path cost ${metrics.pathCost}`}.`
      : status === "search-limit"
        ? "Expansion limit reached; the graph may still contain a path."
        : "The frontier is empty; no path exists from the selected start to goal.",
    current,
    path,
    true,
  );
  return {
    steps: rec.steps,
    status,
    metrics,
    output: {
      path,
      pathEdges,
      expansionOrder,
      selectedOrder,
      pathCost: metrics.pathCost,
      warnings: checked.warnings,
    },
    traceSkipped: rec.skipped,
  };
}

/** Build an escaped, labeled SVG graph. Coordinates may be supplied in [0,1]. */
export function graphSVG(draft, state = null, options = {}) {
  const graph = normalizeGraphDraft(draft);
  const width = Number.isFinite(options.width)
    ? Math.min(2000, Math.max(280, options.width))
    : 900;
  const height = Number.isFinite(options.height)
    ? Math.min(1400, Math.max(240, options.height))
    : 520;
  const pad = 70;
  const positions = new Map();
  graph.nodes.forEach((node, index) => {
    const angle =
      -Math.PI / 2 + (2 * Math.PI * index) / Math.max(1, graph.nodes.length);
    positions.set(node.id, {
      x:
        node.x === undefined
          ? width / 2 + Math.cos(angle) * (width / 2 - pad)
          : pad + Math.max(0, Math.min(1, node.x)) * (width - pad * 2),
      y:
        node.y === undefined
          ? height / 2 + Math.sin(angle) * (height / 2 - pad)
          : pad + Math.max(0, Math.min(1, node.y)) * (height - pad * 2),
    });
  });
  const classes = new Set(state?.classes || []);
  const current = state?.current ?? null;
  const frontier = new Set(
    (state?.frontier || []).map((item) =>
      typeof item === "string" ? item : item.id,
    ),
  );
  const visited = new Set(state?.visited || []);
  const pathNodes = new Set(state?.path || []);
  const path = state?.path || [];
  const pathEdges = new Set(
    state?.pathEdges ||
      path
        .slice(1)
        .map((nodeId) => state?.parentEdges?.[nodeId])
        .filter(Boolean),
  );
  const markerId = `qv-arrow-${String(options.markerId ?? options.markerPrefix ?? "graph").replace(/[^A-Za-z0-9_-]/g, "-")}`;
  const showCosts =
    options.showCosts ?? graph.edges.some((edge) => edge.cost !== null);
  const showHeuristics =
    options.showHeuristics ??
    graph.nodes.some((node) => node.heuristic !== null);
  const edges = graph.edges
    .map((edge) => {
      const from = positions.get(edge.source),
        to = positions.get(edge.target);
      if (!from || !to) return "";
      const pathClass = pathEdges.has(edge.id) ? " qv-edge-path" : "";
      const midX = (from.x + to.x) / 2,
        midY = (from.y + to.y) / 2;
      const label = showCosts
        ? `<text class="qv-edge-cost" x="${midX}" y="${midY - 7}" text-anchor="middle">${edge.cost === null ? "?" : escape(edge.cost)}</text>`
        : "";
      const marker = graph.directed ? ` marker-end="url(#${markerId})"` : "";
      return `<g class="qv-edge${pathClass}" data-qv-edge="${escape(edge.id)}"><line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"${marker}/>${label}</g>`;
    })
    .join("");
  const nodes = graph.nodes
    .map((node) => {
      const point = positions.get(node.id);
      const activeClasses = [
        current === node.id ? "qv-node-current" : "",
        frontier.has(node.id) ? "qv-node-frontier" : "",
        visited.has(node.id) ? "qv-node-visited" : "",
        pathNodes.has(node.id) ? "qv-node-path" : "",
        options.selectedNode === node.id ? "qv-node-selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const heuristic = showHeuristics
        ? `<text class="qv-node-heuristic" x="${point.x}" y="${point.y + 36}" text-anchor="middle">h=${node.heuristic === null ? "?" : escape(node.heuristic)}</text>`
        : "";
      const semantics = options.interactive
        ? ` role="button" tabindex="0" aria-label="Select node ${escape(node.label)}"`
        : ` role="img" aria-label="${escape(node.label)}${showHeuristics ? `, heuristic ${node.heuristic ?? "unknown"}` : ""}"`;
      return `<g class="qv-node ${activeClasses}" data-qv-node="${escape(node.id)}"${semantics}><circle cx="${point.x}" cy="${point.y}" r="25"/><text class="qv-node-label" x="${point.x}" y="${point.y + 5}" text-anchor="middle">${escape(node.label)}</text>${heuristic}</g>`;
    })
    .join("");
  const marker = graph.directed
    ? `<defs><marker id="${markerId}" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L8,3 z"/></marker></defs>`
    : "";
  return `<svg class="question-graph" viewBox="0 0 ${width} ${height}" role="${options.interactive ? "group" : "img"}" aria-label="${graph.directed ? "Directed" : graph.directed === false ? "Undirected" : "Graph"} question diagram">${marker}<g class="qv-edges">${edges}</g><g class="qv-nodes">${nodes}</g></svg>`;
}
