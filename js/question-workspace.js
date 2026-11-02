import { escapeHTML as e } from "./core.js";
import { Playback } from "./playback.js";
import {
  QUESTION_ALGORITHMS,
  graphSVG,
  normalizeGraphDraft,
  validateGraphDraft,
} from "./question-graph.js";
import { QUESTION_API_URL } from "./question-api-config.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_EDGE = 8192;
const MAX_IMAGE_PIXELS = 40_000_000;

const sampleDraft = () =>
  normalizeGraphDraft({
    algorithm: "ucs",
    algorithmCandidates: ["ucs"],
    questionText: "Find a lowest-cost route from A to F.",
    directed: false,
    startId: "A",
    goalId: "F",
    nodes: [
      { id: "A", label: "A", heuristic: 7, x: 0.08, y: 0.5 },
      { id: "B", label: "B", heuristic: 6, x: 0.3, y: 0.2 },
      { id: "C", label: "C", heuristic: 4, x: 0.3, y: 0.8 },
      { id: "D", label: "D", heuristic: 3, x: 0.53, y: 0.37 },
      { id: "E", label: "E", heuristic: 2, x: 0.74, y: 0.62 },
      { id: "F", label: "F", heuristic: 0, x: 0.93, y: 0.5 },
    ],
    edges: [
      { id: "AB", source: "A", target: "B", cost: 1 },
      { id: "AC", source: "A", target: "C", cost: 4 },
      { id: "BD", source: "B", target: "D", cost: 4 },
      { id: "CD", source: "C", target: "D", cost: 1 },
      { id: "BE", source: "B", target: "E", cost: 7 },
      { id: "DE", source: "D", target: "E", cost: 1 },
      { id: "EF", source: "E", target: "F", cost: 2 },
      { id: "CF", source: "C", target: "F", cost: 9 },
    ],
  });

function validateImage(file) {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) throw Error("Choose a JPG, PNG, or WEBP image.");
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES)
    throw Error("Choose an image smaller than 8 MB.");
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (
        image.naturalWidth > MAX_IMAGE_EDGE ||
        image.naturalHeight > MAX_IMAGE_EDGE ||
        image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS
      ) {
        reject(Error("Choose an image no larger than 8,192 px per side."));
        return;
      }
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Error("The selected image could not be decoded."));
    };
    image.src = url;
  });
}

function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(Error("The selected image could not be read."));
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.slice(value.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

function algorithmLabel(id) {
  return QUESTION_ALGORITHMS.find((item) => item.id === id)?.label || id;
}

function pseudocodeFor(algorithm) {
  const common = {
    bfs: [
      "Add the start to a FIFO queue",
      "Remove the oldest frontier node",
      "Stop when the goal is selected",
      "Add each unvisited neighbor",
      "Follow parent links to build the path",
    ],
    dfs: [
      "Add the start to a stack",
      "Remove the newest frontier node",
      "Stop when the goal is selected",
      "Add each unvisited neighbor",
      "Follow parent links to build the path",
    ],
    ucs: [
      "Add the start with cost 0",
      "Select the frontier node with lowest g",
      "Stop when the goal is selected",
      "Relax neighbors with edge costs",
      "Follow parent links to build the path",
    ],
    greedy: [
      "Add the start ordered by h",
      "Select the node with lowest h",
      "Stop when the goal is selected",
      "Add neighbors ordered by h",
      "Follow parent links to build the path",
    ],
    astar: [
      "Add the start with priority g + h",
      "Select the node with lowest f",
      "Stop when the goal is selected",
      "Relax neighbors and update g + h",
      "Follow parent links to build the path",
    ],
  };
  return common[algorithm] || common.bfs;
}

export function mountQuestionWorkspace(container, { notify = () => {} } = {}) {
  const workspaceId = `question-${crypto.randomUUID()}`;
  let selectedAlgorithm = null;
  let draft = normalizeGraphDraft({});
  let uncertainties = [];
  let resolvedUncertainties = new Set();
  let algorithmConflictDecision = null;
  let assumptions = [];
  let activeTab = "upload";
  let imageFile = null;
  let croppedFile = null;
  let originalUrl = null;
  let cropUrl = null;
  let imageDimensions = null;
  let analysisController = null;
  let analysisRequestId = 0;
  let solverWorker = null;
  let solutionRequestId = 0;
  let solution = null;
  let selectedNode = null;
  let endpointMode = "start";
  let statusMessage = "";
  let statusKind = "info";
  let destroyed = false;
  let validation = validateGraphDraft(draft, selectedAlgorithm);
  let playback;

  const setStatus = (message, kind = "info") => {
    statusMessage = message;
    statusKind = kind;
    const status = container.querySelector("[data-qv-status]");
    if (status) {
      status.textContent = message;
      status.className = `qv-status qv-status-${kind}`;
    }
  };

  const invalidateSolution = () => {
    solutionRequestId += 1;
    solverWorker?.terminate();
    solverWorker = null;
    solution = null;
    playback?.reset();
  };

  const cancelAnalysis = () => {
    analysisRequestId += 1;
    analysisController?.abort();
    analysisController = null;
  };

  const checked = () => {
    validation = validateGraphDraft(draft, selectedAlgorithm);
    const errors = [...validation.errors];
    if (
      draft.algorithm &&
      draft.algorithm !== selectedAlgorithm &&
      !algorithmConflictDecision
    ) {
      errors.push({
        field: "algorithm",
        message: `Confirm whether to keep ${algorithmLabel(selectedAlgorithm)} or use ${algorithmLabel(draft.algorithm)}.`,
      });
    }
    for (const item of uncertainties) {
      if (
        (item.blocking || item.field === "algorithm") &&
        !resolvedUncertainties.has(String(item.id))
      ) {
        errors.push({
          field: item.field || "uncertain detail",
          message:
            item.message ||
            "Review and confirm this uncertain detail before solving.",
        });
      }
    }
    validation = { ...validation, errors, valid: errors.length === 0 };
    return validation;
  };

  const setTab = (tab) => {
    activeTab = tab;
    render();
    container.querySelector(`[data-qv-tab="${tab}"]`)?.focus();
  };

  const closePreviews = () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (cropUrl) URL.revokeObjectURL(cropUrl);
    originalUrl = null;
    cropUrl = null;
    imageFile = null;
    croppedFile = null;
    imageDimensions = null;
  };

  const chooseAlgorithm = (algorithm) => {
    if (!QUESTION_ALGORITHMS.some((item) => item.id === algorithm)) return;
    if (selectedAlgorithm !== algorithm) {
      selectedAlgorithm = algorithm;
      algorithmConflictDecision = null;
      invalidateSolution();
    }
    if (draft.nodes.length || draft.questionText || draft.algorithm) {
      validation = validateGraphDraft(draft, selectedAlgorithm);
      activeTab = "review";
    } else {
      activeTab = "upload";
    }
    statusMessage = "";
    render();
  };

  const selectImage = async (file) => {
    analysisRequestId += 1;
    analysisController?.abort();
    analysisController = null;
    try {
      const dimensions = await validateImage(file);
      if (destroyed) return;
      closePreviews();
      imageFile = file;
      imageDimensions = dimensions;
      originalUrl = URL.createObjectURL(file);
      uncertainties = [];
      resolvedUncertainties.clear();
      algorithmConflictDecision = null;
      invalidateSolution();
      statusMessage = "Image ready. Analyze it when you’re ready.";
      statusKind = "success";
      activeTab = "upload";
      render();
    } catch (error) {
      statusMessage = error.message;
      statusKind = "error";
      render();
    }
  };

  const applyCrop = async () => {
    if (!imageFile || !imageDimensions) return;
    const values = Object.fromEntries(
      ["x", "y", "width", "height"].map((key) => [
        key,
        Number(container.querySelector(`[data-crop="${key}"]`)?.value),
      ]),
    );
    const { x, y, width, height } = values;
    if (
      ![x, y, width, height].every(Number.isFinite) ||
      x < 0 ||
      y < 0 ||
      width < 1 ||
      height < 1 ||
      x + width > 100 ||
      y + height > 100
    ) {
      setStatus(
        "Crop bounds must fit inside the image and remain at least 1% wide and high.",
        "error",
      );
      return;
    }
    try {
      const image = new Image();
      image.src = originalUrl;
      await image.decode();
      const sx = Math.round((x / 100) * image.naturalWidth);
      const sy = Math.round((y / 100) * image.naturalHeight);
      const sw = Math.max(1, Math.round((width / 100) * image.naturalWidth));
      const sh = Math.max(1, Math.round((height / 100) * image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const context = canvas.getContext("2d");
      context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(Error("Crop could not be created.")),
          "image/png",
        ),
      );
      croppedFile = new File([blob], "question-crop.png", {
        type: "image/png",
      });
      if (cropUrl) URL.revokeObjectURL(cropUrl);
      cropUrl = URL.createObjectURL(croppedFile);
      invalidateSolution();
      setStatus(
        "Crop applied. The original image is still available.",
        "success",
      );
      render();
    } catch (error) {
      setStatus(error.message || "Image crop failed.", "error");
    }
  };

  const changeAlgorithm = (algorithm) => {
    if (selectedAlgorithm === algorithm) return;
    selectedAlgorithm = algorithm;
    analysisRequestId += 1;
    analysisController?.abort();
    analysisController = null;
    invalidateSolution();
    checked();
    setStatus(
      `Selected ${algorithmLabel(algorithm)}. The image and graph draft are unchanged; the solution was cleared.`,
      "info",
    );
    render();
  };

  const analyzeImage = async () => {
    if (!imageFile || !selectedAlgorithm) return;
    const requestId = ++analysisRequestId;
    analysisController?.abort();
    analysisController = new AbortController();
    invalidateSolution();
    activeTab = "review";
    statusMessage = "Analyzing the image…";
    statusKind = "busy";
    render();
    try {
      const source = croppedFile || imageFile;
      const base64 = await fileAsBase64(source);
      const response = await fetch(QUESTION_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: analysisController.signal,
        body: JSON.stringify({
          schemaVersion: 1,
          selectedAlgorithm,
          image: { mimeType: source.type, base64 },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (destroyed || requestId !== analysisRequestId) return;
      if (!response.ok) {
        const code = body?.error?.code;
        if (response.status === 503 || code === "configuration_missing") {
          statusMessage =
            "Image analysis is not available on this deployment. You can enter the graph manually.";
        } else if (code === "provider_timeout") {
          statusMessage =
            "Image analysis took too long. You can retry or continue with manual graph entry.";
        } else {
          statusMessage =
            "Image analysis failed. You can retry or continue with manual graph entry.";
        }
        statusKind = "error";
        render();
        return;
      }
      if (body.schemaVersion !== 1 || !body.draft)
        throw Error(
          "The image analysis response was incomplete. You can enter the graph manually.",
        );
      draft = normalizeGraphDraft(body.draft);
      uncertainties = Array.isArray(body.uncertainties)
        ? body.uncertainties
        : [];
      resolvedUncertainties = new Set();
      algorithmConflictDecision = null;
      assumptions = [];
      checked();
      statusMessage = "Review the extracted question and graph before solving.";
      statusKind = "success";
      activeTab = "review";
      render();
    } catch (error) {
      if (
        error.name === "AbortError" ||
        destroyed ||
        requestId !== analysisRequestId
      )
        return;
      statusMessage =
        error.message ||
        "Image analysis failed. You can retry or continue with manual graph entry.";
      statusKind = "error";
      render();
    }
  };

  const manualEntry = () => {
    analysisRequestId += 1;
    analysisController?.abort();
    analysisController = null;
    invalidateSolution();
    if (!draft.nodes.length && !draft.questionText)
      draft = normalizeGraphDraft({ directed: false });
    checked();
    activeTab = "review";
    statusMessage =
      "Enter the graph details, then check that the draft is ready to solve.";
    statusKind = "info";
    render();
  };

  const loadSample = () => {
    cancelAnalysis();
    invalidateSolution();
    draft = sampleDraft();
    uncertainties = [];
    resolvedUncertainties.clear();
    algorithmConflictDecision = null;
    assumptions = [];
    checked();
    activeTab = "review";
    statusMessage =
      "Sample graph loaded. This example was not extracted from an image.";
    statusKind = "info";
    render();
  };

  const unitCosts = () => {
    draft = normalizeGraphDraft({
      ...draft,
      edges: draft.edges.map((edge) => ({ ...edge, cost: edge.cost ?? 1 })),
    });
    assumptions.push(
      "Unit cost (1) was supplied for each edge that had no cost.",
    );
    invalidateSolution();
    checked();
    render();
  };

  const zeroHeuristics = () => {
    draft = normalizeGraphDraft({
      ...draft,
      nodes: draft.nodes.map((node) => ({
        ...node,
        heuristic: node.heuristic ?? 0,
      })),
    });
    assumptions.push(
      "Zero heuristic was explicitly supplied for each node with no h value.",
    );
    invalidateSolution();
    checked();
    render();
  };

  const updateField = (el) => {
    const key = el.dataset.qvField;
    if (key === "questionText") draft.questionText = el.value;
    if (key === "directed")
      draft.directed =
        el.value === "true" ? true : el.value === "false" ? false : null;
    if (key === "startId") draft.startId = el.value || null;
    if (key === "goalId") draft.goalId = el.value || null;
    const nodeIndex = el.dataset.nodeIndex;
    if (nodeIndex !== undefined) {
      const node = draft.nodes[Number(nodeIndex)];
      if (!node) return;
      if (el.dataset.nodeKey === "label") node.label = el.value;
      if (el.dataset.nodeKey === "heuristic")
        node.heuristic = el.value === "" ? null : Number(el.value);
      if (el.dataset.nodeKey === "id") {
        const previous = node.id;
        node.id = el.value.trim();
        draft.edges.forEach((edge) => {
          if (edge.source === previous) edge.source = node.id;
          if (edge.target === previous) edge.target = node.id;
        });
        if (draft.startId === previous) draft.startId = node.id;
        if (draft.goalId === previous) draft.goalId = node.id;
      }
    }
    const edgeIndex = el.dataset.edgeIndex;
    if (edgeIndex !== undefined) {
      const edge = draft.edges[Number(edgeIndex)];
      if (!edge) return;
      if (el.dataset.edgeKey === "source" || el.dataset.edgeKey === "target")
        edge[el.dataset.edgeKey] = el.value || null;
      if (el.dataset.edgeKey === "cost")
        edge.cost = el.value === "" ? null : Number(el.value);
    }
    invalidateSolution();
    checked();
    statusMessage =
      "Graph edited. The previous solution was cleared; check the updated draft before solving.";
    statusKind = "info";
  };

  const nodeOptions = (selected) =>
    `<option value="">Choose a node</option>${draft.nodes
      .map(
        (node) =>
          `<option value="${e(node.id)}" ${node.id === selected ? "selected" : ""}>${e(node.label)} · ${e(node.id)}</option>`,
      )
      .join("")}`;

  const graphPreview = (interactive = false, state = null) =>
    draft.nodes.length
      ? graphSVG(draft, state, {
          markerId: workspaceId,
          interactive,
          selectedNode,
          width: 900,
          height: 500,
        })
      : `<div class="qv-empty-graph"><p>Add nodes and edges to build a graph.</p><button type="button" data-qv-action="add-node">Add a node</button></div>`;

  const uncertaintyHTML = () => {
    const conflicts = draft.algorithm && draft.algorithm !== selectedAlgorithm;
    return `${conflicts ? `<div class="qv-warning"><strong>Algorithm in the question: ${e(algorithmLabel(draft.algorithm))}.</strong><p>Your selected algorithm remains ${e(algorithmLabel(selectedAlgorithm))}. Confirm which one to use.</p><button type="button" data-qv-action="keep-selected-algorithm">Keep ${e(algorithmLabel(selectedAlgorithm))}</button><button type="button" data-qv-action="use-detected-algorithm">Use ${e(algorithmLabel(draft.algorithm))}</button></div>` : ""}${
      uncertainties.length
        ? `<section class="qv-uncertainties"><h3>Review uncertain details</h3><ul>${uncertainties
            .map((item) => {
              const requiresReview =
                item.blocking || item.field === "algorithm";
              const unresolved =
                requiresReview && !resolvedUncertainties.has(String(item.id));
              return `<li class="${requiresReview ? "is-blocking" : ""}"><b>${e(item.field || "Graph detail")}</b><span>${e(item.message || "Confirm this value against the question.")}</span>${unresolved ? `<button type="button" data-qv-action="resolve-uncertainty" data-index="${e(String(item.id))}">I reviewed this detail</button>` : requiresReview ? "<span>Reviewed</span>" : ""}</li>`;
            })
            .join("")}</ul></section>`
        : ""
    }${assumptions.length ? `<section class="qv-assumptions"><h3>Assumptions you supplied</h3><ul>${assumptions.map((item) => `<li>${e(item)}</li>`).join("")}</ul></section>` : ""}`;
  };

  const readinessHTML = () => {
    checked();
    const costsMissing = draft.edges.some((edge) => edge.cost === null);
    const heuristicsMissing = draft.nodes.some(
      (node) => node.heuristic === null,
    );
    return `<section class="qv-readiness" aria-live="polite"><h3>${validation.valid ? "Ready to solve" : "Complete the graph before solving"}</h3>${validation.errors.length ? `<ul class="qv-errors">${validation.errors.map((item) => `<li data-field-error="${e(item.field)}">${e(item.message)}</li>`).join("")}</ul>` : ""}${validation.warnings.length ? `<ul class="qv-warnings">${validation.warnings.map((item) => `<li><b>${e(item.field)}:</b> ${e(item.message)}</li>`).join("")}</ul>` : ""}${["ucs", "astar"].includes(selectedAlgorithm) && costsMissing ? `<div class="qv-assumption-action"><p>Some edge costs are missing. If the question treats every edge equally, choose unit costs explicitly.</p><button type="button" data-qv-action="unit-costs">Use unit costs for missing edges</button></div>` : ""}${["greedy", "astar"].includes(selectedAlgorithm) && heuristicsMissing ? `<div class="qv-assumption-action"><p>Some heuristic values are missing. This choice is explicit; A* optimality cannot be guaranteed from an arbitrary heuristic.</p><button type="button" data-qv-action="zero-heuristics">Set missing h values to zero</button></div>` : ""}</section>`;
  };

  const editorHTML = () =>
    `<div class="qv-review-grid"><section class="qv-graph-preview"><div class="qv-section-heading"><h3>Graph preview</h3><p>Click a node after choosing whether to set Start or Goal.</p></div><div class="qv-graph-frame">${graphPreview(true)}</div><div class="qv-endpoint-tools"><button type="button" data-qv-action="endpoint-start" aria-pressed="${endpointMode === "start"}">Set clicked node as Start</button><button type="button" data-qv-action="endpoint-goal" aria-pressed="${endpointMode === "goal"}">Set clicked node as Goal</button></div></section><section class="qv-graph-editor"><div class="qv-section-heading"><h3>Edit graph data</h3><p>Names, heuristics, edge connections, and costs remain editable.</p></div><label class="qv-field">Question text<textarea data-qv-field="questionText" rows="3" maxlength="5000">${e(draft.questionText)}</textarea></label><div class="qv-editor-controls"><label class="qv-field">Edges are<select data-qv-field="directed"><option value="" ${draft.directed === null ? "selected" : ""}>Not specified</option><option value="false" ${draft.directed === false ? "selected" : ""}>Undirected</option><option value="true" ${draft.directed === true ? "selected" : ""}>Directed</option></select></label><label class="qv-field">Start node<select data-qv-field="startId">${nodeOptions(draft.startId)}</select></label><label class="qv-field">Goal node<select data-qv-field="goalId">${nodeOptions(draft.goalId)}</select></label></div><div class="qv-section-heading"><h4>Nodes</h4><button type="button" data-qv-action="add-node">Add node</button></div><div class="qv-node-list">${draft.nodes.map((node, index) => `<fieldset class="qv-node-row"><legend>${e(node.label || node.id || `Node ${index + 1}`)}</legend><label class="qv-field">ID<input data-node-index="${index}" data-node-key="id" value="${e(node.id)}" maxlength="80"></label><label class="qv-field">Label<input data-node-index="${index}" data-node-key="label" value="${e(node.label)}" maxlength="120"></label><label class="qv-field">Heuristic h<input data-node-index="${index}" data-node-key="heuristic" type="number" min="0" max="1000000" step="any" value="${node.heuristic ?? ""}" placeholder="Unknown"></label><button type="button" class="qv-remove" data-qv-action="remove-node" data-index="${index}">Remove node</button></fieldset>`).join("") || `<p class="qv-empty-note">No nodes yet.</p>`}</div><div class="qv-section-heading"><h4>Edges</h4><button type="button" data-qv-action="add-edge" ${draft.nodes.length < 2 ? "disabled" : ""}>Add edge</button></div><div class="qv-edge-list">${draft.edges.map((edge, index) => `<fieldset class="qv-edge-row"><legend>Edge ${index + 1}</legend><label class="qv-field">From<select data-edge-index="${index}" data-edge-key="source">${nodeOptions(edge.source)}</select></label><label class="qv-field">To<select data-edge-index="${index}" data-edge-key="target">${nodeOptions(edge.target)}</select></label><label class="qv-field">Cost<input data-edge-index="${index}" data-edge-key="cost" type="number" min="0" max="1000000" step="any" value="${edge.cost ?? ""}" placeholder="Unknown"></label><button type="button" class="qv-remove" data-qv-action="remove-edge" data-index="${index}">Remove edge</button></fieldset>`).join("") || `<p class="qv-empty-note">No edges yet.</p>`}</div></section></div>`;

  const imagePanelHTML = (review = false) => {
    if (!imageFile)
      return `<div class="qv-empty-upload"><p>No image selected. Add a JPG, PNG, or WEBP question image, or enter the graph manually.</p><button type="button" data-qv-action="manual-entry">Enter a graph manually</button><button type="button" data-qv-action="sample">Load labeled sample graph</button></div>`;
    return `<div class="qv-image-previews ${review ? "is-review" : ""}"><figure><img src="${e(originalUrl)}" alt="Original uploaded question image"><figcaption>Original image · ${imageDimensions.width} × ${imageDimensions.height}</figcaption></figure>${croppedFile ? `<figure><img src="${e(cropUrl)}" alt="Cropped image that will be sent for analysis"><figcaption>Crop used for analysis · ${croppedFile.type}</figcaption></figure>` : ""}</div>`;
  };

  const uploadHTML = () =>
    `<section class="qv-upload-panel"><div class="qv-section-heading"><h2>Upload a question image</h2><p>Supported formats: JPG, PNG, WEBP · Maximum size 8 MB.</p></div><div class="qv-dropzone" data-qv-dropzone><input id="${workspaceId}-file" class="qv-file-input" type="file" accept="image/jpeg,image/png,image/webp"><label for="${workspaceId}-file"><span class="qv-drop-icon" aria-hidden="true">↑</span><b>Choose an image</b><span>or drop it here</span><small>Only JPG, PNG, and WEBP are accepted.</small></label></div>${imagePanelHTML()}${
      imageFile
        ? `<section class="qv-crop-panel"><div class="qv-section-heading"><h3>Crop the image</h3><p>Crop is made in your browser. The original stays available for review.</p></div><div class="qv-crop-fields">${[
            ["x", "Left"],
            ["y", "Top"],
            ["width", "Width"],
            ["height", "Height"],
          ]
            .map(
              ([key, label]) =>
                `<label class="qv-field">${label} (%)<input type="number" data-crop="${key}" min="${key === "width" || key === "height" ? 1 : 0}" max="100" step="1" value="${key === "width" || key === "height" ? 100 : 0}"></label>`,
            )
            .join(
              "",
            )}</div><button type="button" data-qv-action="apply-crop">Apply crop</button><div class="qv-image-actions"><label class="qv-button" for="${workspaceId}-replace">Replace image<input id="${workspaceId}-replace" class="qv-file-input" type="file" accept="image/jpeg,image/png,image/webp"></label><button type="button" class="qv-danger" data-qv-action="remove-image">Remove image</button></div></section>`
        : ""
    }<div class="qv-upload-actions"><button type="button" class="primary" data-qv-action="analyze" ${!imageFile || !selectedAlgorithm ? "disabled" : ""}>${statusKind === "busy" ? "Analyzing…" : "Analyze question"}</button><button type="button" data-qv-action="cancel-analysis" ${statusKind !== "busy" ? "disabled" : ""}>Cancel analysis</button><button type="button" data-qv-action="manual-entry">Continue with manual graph</button><button type="button" data-qv-action="sample">Load labeled sample graph</button></div></section>`;

  const reviewHTML = () =>
    `${imageFile ? `<section class="qv-review-images"><div class="qv-section-heading"><h2>Question image</h2><p>The original and analyzed crop are kept separate.</p></div>${imagePanelHTML(true)}</section>` : ""}${uncertaintyHTML()}${editorHTML()}${readinessHTML()}<div class="qv-review-actions"><button type="button" data-qv-action="solve" class="primary" ${validation.valid ? "" : "disabled"}>Visualize solution with ${e(algorithmLabel(selectedAlgorithm))}</button></div>`;

  const currentFrame = () => playback?.steps[playback.index] || null;
  const frontierHTML = (frame) => {
    const entries = frame?.state?.frontier || [];
    const ordering =
      {
        bfs: "Queue order",
        dfs: "Stack order",
        ucs: "Ordered by accumulated cost g",
        greedy: "Ordered by heuristic h",
        astar: "Ordered by g + h",
      }[selectedAlgorithm] || "Frontier order";
    const rows = entries
      .map((entry, index) => {
        const node = draft.nodes.find((item) => item.id === entry.id);
        let details = "";
        if (selectedAlgorithm === "bfs" || selectedAlgorithm === "dfs") {
          details = `${index + 1}. ${selectedAlgorithm === "bfs" ? "next from queue" : "next from stack"}`;
        } else if (selectedAlgorithm === "ucs") {
          details = `g=${entry.g ?? "Unknown"}`;
        } else if (selectedAlgorithm === "greedy") {
          details = `h=${entry.h ?? "Unknown"}`;
        } else {
          details = `g=${entry.g ?? "Unknown"}, h=${entry.h ?? "Unknown"}, f=${entry.priority ?? "Unknown"}`;
        }
        return `<li><b>${e(node?.label || entry.id)}</b><span>${e(details)}</span></li>`;
      })
      .join("");
    return `<section class="qv-frontier"><h4>Frontier</h4><p>${e(ordering)}</p>${rows ? `<ol>${rows}</ol>` : `<p class="qv-empty-note">No pending nodes.</p>`}</section>`;
  };

  const visualizationHTML = () => {
    const frame = currentFrame();
    const final = solution && playback.index === playback.steps.length - 1;
    const noPath = final && solution.status === "no-solution";
    const metrics = frame?.metrics || {};
    return `<section class="qv-visual-layout"><div class="qv-visual-main"><div class="qv-section-heading"><h2>Search playback</h2><p>${e(algorithmLabel(selectedAlgorithm))} · ${e(solution?.status || "Waiting for a valid graph")}</p></div><div class="qv-visual-canvas">${graphSVG(draft, frame?.state || null, { markerId: `${workspaceId}-solution`, width: 960, height: 540 })}</div><div class="qv-playback-controls"><button type="button" data-qv-action="play" ${!solution || playback.timer ? "disabled" : ""}>Play</button><button type="button" data-qv-action="pause" ${!playback?.timer ? "disabled" : ""}>Pause</button><button type="button" data-qv-action="jump-previous" ${!solution || playback.index <= 0 ? "disabled" : ""}>Previous event</button><button type="button" data-qv-action="previous" ${!solution || playback.index <= 0 ? "disabled" : ""}>Previous</button><button type="button" data-qv-action="next" ${!solution || playback.index >= playback.steps.length - 1 ? "disabled" : ""}>Next</button><button type="button" data-qv-action="jump-next" ${!solution || playback.index >= playback.steps.length - 1 ? "disabled" : ""}>Next event</button><label class="qv-speed">Speed<input type="range" data-qv-speed min="1" max="20" value="${playback.speed}"><output>${playback.speed} steps/s</output></label><label class="qv-scrub">Recorded step<input type="range" data-qv-scrub min="0" max="${Math.max(0, (solution?.steps.length || 1) - 1)}" value="${playback.index}" ${!solution ? "disabled" : ""}><output>${solution ? `${playback.index + 1} / ${playback.steps.length}` : "No trace"}</output></label></div></div><aside class="qv-notebook"><h3>Decision notebook</h3><span class="qv-event">${e(frame?.event?.replaceAll("-", " ") || "READY TO EXPLORE")}</span><p class="qv-reason" aria-live="${playback?.timer ? "off" : "polite"}">${e(frame?.reason || "A valid graph is needed before the search can start.")}</p><h4>Pseudocode</h4><ol class="qv-pseudocode">${[
      ...pseudocodeFor(selectedAlgorithm),
    ]
      .map(
        (line, index) =>
          `<li class="${frame?.line === index ? "is-current" : ""}">${e(line)}</li>`,
      )
      .join(
        "",
      )}</ol>${frontierHTML(frame)}<div class="qv-current-metrics"><h4>${final ? "Final result" : "Current replay metrics"}</h4><dl><dt>Expanded</dt><dd>${metrics.expanded ?? "Not available"}</dd><dt>Discovered</dt><dd>${metrics.discovered ?? "Not available"}</dd><dt>Max frontier</dt><dd>${metrics.maxFrontier ?? "Not available"}</dd><dt>Path length</dt><dd>${metrics.pathLength ?? (noPath ? "No path" : "Not available")}</dd><dt>Path cost</dt><dd>${metrics.pathCost ?? (noPath ? "No path" : final ? "Not supplied" : "Not available")}</dd></dl></div>${final ? `<section class="qv-final-result"><h4>Computed solution</h4><p>${solution.status === "solved" ? e(solution.output.path.join(" → ")) : solution.status === "no-solution" ? "No path found." : "Search limit reached before a path was proven."}</p><p>Selected order: ${e(solution.output.selectedOrder.join(" → ") || "None")}</p><p>Expanded order: ${e(solution.output.expansionOrder.join(" → ") || "None")}</p><p>Expanded nodes: ${solution.metrics.expanded}</p>${solution.output.pathCost === null ? `<p>Path cost: Not supplied. One or more edge costs are unknown.</p>` : `<p>Path cost: ${solution.output.pathCost}</p>`}${solution.output.warnings?.length ? `<ul>${solution.output.warnings.map((warning) => `<li>${e(warning)}</li>`).join("")}</ul>` : ""}</section>` : ""}</aside></section>`;
  };

  const render = () => {
    if (destroyed) return;
    validation = checked();
    const active = document.activeElement;
    const restoreId =
      active?.id && container.contains(active) ? active.id : null;
    const restoreData =
      active && container.contains(active)
        ? ["qvField", "nodeIndex", "edgeIndex", "nodeKey", "edgeKey"].find(
            (key) => active.dataset?.[key] !== undefined,
          )
        : null;
    const restoreValue = restoreData ? active.dataset[restoreData] : null;
    const tabs = ["upload", "review", "visualize"];
    const content =
      activeTab === "upload"
        ? uploadHTML()
        : activeTab === "review"
          ? reviewHTML()
          : `<div class="qv-visual-content">${visualizationHTML()}</div>`;
    container.innerHTML = `<section class="qv-workspace" data-qv-id="${workspaceId}"><header class="qv-heading"><div><h1>Visualize a question</h1><p>Upload a graph question or enter its graph directly, then inspect how a search algorithm finds a route.</p></div>${selectedAlgorithm ? `<div class="qv-selected-algorithm"><span>Selected algorithm</span><b>${e(algorithmLabel(selectedAlgorithm))}</b><button type="button" data-qv-action="change-algorithm">Change algorithm</button></div>` : ""}</header>${!selectedAlgorithm ? `<section class="qv-algorithm-picker"><h2>Choose an algorithm</h2><p>Choose the search method to use. If an image suggests another method, we’ll point that out and keep your choice.</p><div class="qv-algorithm-cards">${QUESTION_ALGORITHMS.map((algorithm) => `<button type="button" class="qv-algorithm-card" data-qv-algorithm="${algorithm.id}"><span class="qv-algorithm-name">${e(algorithm.label)}</span><span>${e(algorithm.description)}</span><span class="qv-card-action">Select algorithm →</span></button>`).join("")}</div></section>` : `<nav class="qv-tabs" role="tablist" aria-label="Question workflow">${tabs.map((tab) => `<button type="button" id="${workspaceId}-tab-${tab}" role="tab" aria-selected="${activeTab === tab}" aria-controls="${workspaceId}-panel" data-qv-tab="${tab}" tabindex="${activeTab === tab ? 0 : -1}">${tab === "visualize" ? "Visualize" : tab[0].toUpperCase() + tab.slice(1)}</button>`).join("")}</nav><section id="${workspaceId}-panel" class="qv-panel" role="tabpanel" aria-labelledby="${workspaceId}-tab-${activeTab}">${content}<p data-qv-status class="qv-status qv-status-${statusKind}" role="status" aria-live="polite">${e(statusMessage)}</p></section>`}</section>`;
    for (const item of uncertainties) {
      const field = String(item.field || "").toLowerCase();
      const selectors = [];
      if (/question|text/.test(field))
        selectors.push('[data-qv-field="questionText"]');
      if (/directed/.test(field)) selectors.push('[data-qv-field="directed"]');
      if (/start/.test(field)) selectors.push('[data-qv-field="startId"]');
      if (/goal/.test(field)) selectors.push('[data-qv-field="goalId"]');
      if (/heuristic|\.h\b/.test(field))
        selectors.push('[data-node-key="heuristic"]');
      if (/cost|edge/.test(field)) selectors.push('[data-edge-key="cost"]');
      if (/source|from/.test(field)) selectors.push('[data-edge-key="source"]');
      if (/target|to/.test(field)) selectors.push('[data-edge-key="target"]');
      for (const selector of selectors) {
        for (const control of container.querySelectorAll(selector)) {
          control.classList.add("qv-uncertain-field");
          control.title =
            item.message ||
            "Check this extracted value against the question image.";
        }
      }
    }
    if (restoreId)
      container
        .querySelector(`#${CSS.escape(restoreId)}`)
        ?.focus({ preventScroll: true });
    else if (restoreData) {
      const escaped = CSS.escape(restoreValue);
      container
        .querySelector(
          `[data-${restoreData.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${escaped}"]`,
        )
        ?.focus({ preventScroll: true });
    }
  };

  const updatePlaybackView = () => {
    if (destroyed || activeTab !== "visualize") return;
    const host = container.querySelector(".qv-visual-content");
    if (!host) return;
    const fresh = document.createElement("div");
    fresh.innerHTML = visualizationHTML();
    const svg = fresh.querySelector(".qv-visual-canvas");
    const canvas = host.querySelector(".qv-visual-canvas");
    if (svg && canvas) canvas.innerHTML = svg.innerHTML;
    const notebook = fresh.querySelector(".qv-notebook");
    const oldNotebook = host.querySelector(".qv-notebook");
    if (notebook && oldNotebook) oldNotebook.replaceWith(notebook);
    const freshControls = fresh.querySelector(".qv-playback-controls");
    const controls = host.querySelector(".qv-playback-controls");
    if (freshControls && controls) {
      for (const action of [
        "play",
        "pause",
        "previous",
        "next",
        "jump-previous",
        "jump-next",
      ]) {
        const current = controls.querySelector(`[data-qv-action="${action}"]`);
        const next = freshControls.querySelector(
          `[data-qv-action="${action}"]`,
        );
        if (current && next) current.disabled = next.disabled;
      }
      const scrub = controls.querySelector("[data-qv-scrub]");
      const nextScrub = freshControls.querySelector("[data-qv-scrub]");
      const output = scrub?.parentElement.querySelector("output");
      const nextOutput = nextScrub?.parentElement.querySelector("output");
      if (scrub && nextScrub) {
        scrub.max = nextScrub.max;
        scrub.value = nextScrub.value;
        scrub.disabled = nextScrub.disabled;
      }
      if (output && nextOutput) output.textContent = nextOutput.textContent;
    }
  };

  playback = new Playback(updatePlaybackView, (playing) => {
    const play = container.querySelector('[data-qv-action="play"]');
    const pause = container.querySelector('[data-qv-action="pause"]');
    if (play) play.disabled = playing || !solution;
    if (pause) pause.disabled = !playing;
    const reason = container.querySelector(".qv-reason");
    if (reason) reason.setAttribute("aria-live", playing ? "off" : "polite");
  });

  const visualize = () => {
    validation = checked();
    if (!validation.valid) {
      activeTab = "review";
      render();
      container
        .querySelector(".qv-errors")
        ?.scrollIntoView({ block: "nearest" });
      return;
    }
    invalidateSolution();
    activeTab = "visualize";
    const requestId = ++solutionRequestId;
    statusMessage = "Computing a trace in a worker…";
    statusKind = "busy";
    render();
    try {
      solverWorker = new Worker(
        new URL("./question-worker.js", import.meta.url),
        { type: "module" },
      );
      solverWorker.onmessage = ({ data }) => {
        if (
          destroyed ||
          requestId !== solutionRequestId ||
          data.id !== requestId
        )
          return;
        solverWorker?.terminate();
        solverWorker = null;
        if (data.error) {
          activeTab = "review";
          statusMessage = data.error;
          statusKind = "error";
          render();
          return;
        }
        solution = data.result;
        playback.load(solution.steps);
        statusMessage =
          "Search trace ready. Use the controls to follow each recorded decision.";
        statusKind = "success";
        render();
      };
      solverWorker.onerror = (error) => {
        if (destroyed || requestId !== solutionRequestId) return;
        solverWorker?.terminate();
        solverWorker = null;
        activeTab = "review";
        statusMessage =
          error.message || "Search worker failed. Check the graph and retry.";
        statusKind = "error";
        render();
      };
      solverWorker.postMessage({
        id: requestId,
        algorithm: selectedAlgorithm,
        draft,
        options: { trace: true, limit: 5000 },
      });
    } catch (error) {
      activeTab = "review";
      statusMessage = error.message || "Search worker could not start.";
      statusKind = "error";
      render();
    }
  };

  const addNode = () => {
    invalidateSolution();
    const index = draft.nodes.length + 1;
    draft.nodes.push({
      id: `node-${index}`,
      label: `Node ${index}`,
      heuristic: null,
    });
    checked();
    render();
  };

  const addEdge = () => {
    if (draft.nodes.length < 2) return;
    invalidateSolution();
    const [source, target] = draft.nodes;
    draft.edges.push({
      id: `edge-${draft.edges.length + 1}`,
      source: source.id,
      target: target.id,
      cost: null,
    });
    checked();
    render();
  };

  const clickNode = (id) => {
    if (!draft.nodes.some((node) => node.id === id)) return;
    if (endpointMode === "start") draft.startId = id;
    else draft.goalId = id;
    selectedNode = id;
    invalidateSolution();
    checked();
    render();
  };

  const handleAction = (action, trigger) => {
    if (action === "change-algorithm") {
      analysisRequestId += 1;
      analysisController?.abort();
      invalidateSolution();
      selectedAlgorithm = null;
      algorithmConflictDecision = null;
      activeTab = "upload";
      render();
    } else if (action === "manual-entry") manualEntry();
    else if (action === "sample") loadSample();
    else if (action === "analyze") analyzeImage();
    else if (action === "cancel-analysis") {
      analysisRequestId += 1;
      analysisController?.abort();
      analysisController = null;
      statusMessage = "Analysis canceled. Your image is still available.";
      statusKind = "info";
      render();
    } else if (action === "apply-crop") applyCrop();
    else if (action === "remove-image") {
      cancelAnalysis();
      closePreviews();
      uncertainties = [];
      resolvedUncertainties.clear();
      invalidateSolution();
      statusMessage =
        "Image removed. You can continue with manual graph entry.";
      statusKind = "info";
      render();
    } else if (action === "keep-selected-algorithm") {
      algorithmConflictDecision = "keep";
      checked();
      render();
    } else if (action === "resolve-uncertainty") {
      resolvedUncertainties.add(trigger.dataset.index);
      checked();
      render();
    } else if (action === "use-detected-algorithm" && draft.algorithm) {
      algorithmConflictDecision = "detected";
      changeAlgorithm(draft.algorithm);
    } else if (action === "unit-costs") unitCosts();
    else if (action === "zero-heuristics") zeroHeuristics();
    else if (action === "solve") visualize();
    else if (action === "add-node") addNode();
    else if (action === "remove-node") {
      const index = Number(trigger.dataset.index),
        [removed] = draft.nodes.splice(index, 1);
      if (removed) {
        draft.edges = draft.edges.filter(
          (edge) => edge.source !== removed.id && edge.target !== removed.id,
        );
        if (draft.startId === removed.id) draft.startId = null;
        if (draft.goalId === removed.id) draft.goalId = null;
      }
      invalidateSolution();
      checked();
      render();
    } else if (action === "add-edge") addEdge();
    else if (action === "remove-edge") {
      draft.edges.splice(Number(trigger.dataset.index), 1);
      invalidateSolution();
      checked();
      render();
    } else if (action === "endpoint-start") {
      endpointMode = "start";
      render();
    } else if (action === "endpoint-goal") {
      endpointMode = "goal";
      render();
    } else if (action === "play") playback.play();
    else if (action === "pause") {
      playback.pause();
      setStatus("Playback paused.", "info");
    } else if (action === "previous") playback.previous();
    else if (action === "next") playback.next();
    else if (action === "jump-previous") playback.jump(-1);
    else if (action === "jump-next") playback.jump(1);
  };

  const onClick = (event) => {
    const tab = event.target.closest("[data-qv-tab]");
    if (tab) {
      if (tab.dataset.qvTab === "visualize" && !solution) {
        setStatus(
          "Check the graph and choose Visualize solution before opening playback.",
          "info",
        );
        return;
      }
      setTab(tab.dataset.qvTab);
      return;
    }
    const algorithm = event.target.closest("[data-qv-algorithm]");
    if (algorithm) {
      chooseAlgorithm(algorithm.dataset.qvAlgorithm);
      return;
    }
    const node = event.target.closest("[data-qv-node]");
    if (node && activeTab === "review") {
      clickNode(node.dataset.qvNode);
      return;
    }
    const action = event.target.closest("[data-qv-action]");
    if (action) handleAction(action.dataset.qvAction, action);
  };

  const onChange = (event) => {
    const el = event.target;
    if (el.matches("[data-qv-file]")) {
      if (el.files?.[0]) selectImage(el.files[0]);
      return;
    }
    if (el.matches(".qv-file-input")) {
      if (el.files?.[0]) selectImage(el.files[0]);
      return;
    }
    if (
      el.dataset.qvField ||
      el.dataset.nodeIndex !== undefined ||
      el.dataset.edgeIndex !== undefined
    ) {
      updateField(el);
      render();
    }
  };

  const onInput = (event) => {
    const el = event.target;
    if (el.matches("[data-qv-speed]")) {
      playback.setSpeed(Number(el.value));
      const output = el.parentElement.querySelector("output");
      if (output) output.textContent = `${playback.speed} steps/s`;
    }
    if (el.matches("[data-qv-scrub]")) playback.seek(Number(el.value));
    if (el.dataset.qvField === "questionText") {
      draft.questionText = el.value;
      invalidateSolution();
      activeTab === "review" &&
        setStatus(
          "Question text changed. The previous solution was cleared.",
          "info",
        );
    }
  };

  const onDragOver = (event) => {
    if (event.target.closest("[data-qv-dropzone]")) event.preventDefault();
  };
  const onDrop = (event) => {
    const zone = event.target.closest("[data-qv-dropzone]");
    if (!zone) return;
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) selectImage(file);
  };

  const onKeyDown = (event) => {
    const graphNode = event.target.closest?.("[data-qv-node]");
    if (graphNode && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      clickNode(graphNode.dataset.qvNode);
      return;
    }
    if (
      event.target.closest(
        "input,select,textarea,button,a,[contenteditable=true]",
      )
    )
      return;
    if (event.key === " ") {
      event.preventDefault();
      playback.timer ? playback.pause() : playback.play();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      playback.previous();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      playback.next();
    }
  };

  container.addEventListener("click", onClick);
  container.addEventListener("change", onChange);
  container.addEventListener("input", onInput);
  container.addEventListener("dragover", onDragOver);
  container.addEventListener("drop", onDrop);
  container.addEventListener("keydown", onKeyDown);
  render();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      analysisRequestId += 1;
      solutionRequestId += 1;
      analysisController?.abort();
      solverWorker?.terminate();
      playback.reset();
      closePreviews();
      container.removeEventListener("click", onClick);
      container.removeEventListener("change", onChange);
      container.removeEventListener("input", onInput);
      container.removeEventListener("dragover", onDragOver);
      container.removeEventListener("drop", onDrop);
      container.removeEventListener("keydown", onKeyDown);
    },
  };
}
