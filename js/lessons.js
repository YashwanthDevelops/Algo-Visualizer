import { escapeHTML as e } from "./core.js";

const predictions = {
  pathfinding:
    "Will this method minimize moves, total terrain cost, or neither?",
  optimization:
    "Is the current board a local minimum, plateau, or still improvable?",
  game: "Which move protects the AI, and can the search prove the result?",
  sudoku:
    "Which candidate values survive row, column, and box constraints?",
  timetable: "Which session has the tightest set of valid placements?",
};

export function lessonHTML(lab, result, frame) {
  const observed = result
    ? `<p class="lesson-result"><b>Observed:</b> ${e(result.status)}${
        lab === "pathfinding" && result.output?.pathCost != null
          ? ` · path cost ${result.output.pathCost}`
          : ""
      }${
        lab === "optimization" && result.output?.score != null
          ? ` · ${result.output.score} conflicts`
          : ""
      }${
        lab === "game" && result.status === "evaluated"
          ? " · heuristic estimate; the game result is not proven"
          : ""
      }</p>`
    : '<p class="lesson-result">Run or step through the algorithm to see the measured outcome here.</p>';

  return `<details class="lesson">
    <summary>Guided lesson</summary>
    <div>
      <p><b>1 · Predict</b> ${predictions[lab]}</p>
      <p><b>2 · Apply</b> Change the example or settings, then take one step at a time.</p>
      <p><b>3 · Checkpoints</b> <span>${e(frame?.event?.replaceAll("-", " ") || "No decisions recorded yet")}</span></p>
      ${observed}
      <p><b>4 · Explain</b> ${e(frame?.reason || "Each checkpoint is derived from the active algorithm trace.")}</p>
    </div>
  </details>`;
}
