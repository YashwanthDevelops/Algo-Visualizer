import { solveGraph } from "./question-graph.js";

self.onmessage = ({ data }) => {
  try {
    if (!data || typeof data !== "object")
      throw Error("Invalid graph worker request.");
    const result = solveGraph(data.algorithm, data.draft, data.options ?? {});
    self.postMessage({ id: data.id, result });
  } catch (error) {
    self.postMessage({
      id: data?.id,
      error: error?.message ?? "Graph search failed.",
    });
  }
};
