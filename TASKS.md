# Development checklist

- [x] Shared shell, recorded playback, worker execution, storage
- [x] Pathfinding: BFS, DFS, UCS, Greedy, A*
- [x] N-Queens: hill climbing, simulated annealing
- [x] Tic-Tac-Toe: Minimax, alpha-beta, expandable tree
- [x] Sudoku and timetable: backtracking, forward checking
- [x] Dashboard, comparisons, seeded trials, history
- [x] Validated configuration recovery, JSON import merge, and URL-safe share codes
- [x] Adjustable path presets and admissible heuristic choices
- [x] Optional seeded hill-climbing sideways moves and restarts
- [x] Optional CSP MRV/degree and LCV ordering
- [x] Depth-limited Minimax/alpha-beta with bounded heuristic leaf metadata
- [x] CI Node test gate and Chromium Playwright smoke script
- [x] UI integration, responsive smoke check, and smoke screenshots
- [x] Question Visualizer image extraction API, local Node server, and Cloudflare Worker configuration
- [x] Mocked Question Visualizer browser smoke for upload, review, conflict handling, graph worker playback, and mobile layout

Final verification on 2 November 2026: **38/38 Node tests passed**. The standard Playwright smoke passed Run, Next, Previous, navigation, reload/persistence, and mobile overflow checks. The Question Visualizer Playwright smoke passed using a mocked API, including upload, extraction review, search playback, solution invalidation, and missing-key fallback. Desktop, reduced-motion, and mobile screenshots are in `reports/question-visualizer-final/`. Two local live Gemini checks returned normalized drafts; the end-to-end image flow reviewed algorithm ambiguity and ran BFS playback with unknown path cost preserved. No Gemini Worker/API deployment was performed. Earlier test counts and browser measurements remain identified as historical in `docs/TEST_RESULTS.md`.
