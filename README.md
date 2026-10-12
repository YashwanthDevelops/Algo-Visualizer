# Search & Optimization Playground

A complete, browser-only educational project using HTML5, CSS3, vanilla JavaScript, SVG, Web Workers, and LocalStorage. Five learning areas share recorded playback, a decision notebook, pseudocode highlighting, metrics, and reproducible comparisons. There are no frontend dependencies, network-loaded assets, paid APIs, server-side algorithms, or database.

**Live app:** [YashwanthDevelops.github.io/Algo-Visualizer](https://yashwanthdevelops.github.io/Algo-Visualizer/)

The interface uses a charcoal foundation, restrained copper accents, and self-hosted IBM Plex Sans and IBM Plex Mono fonts. Font files and the SIL Open Font License are included in `assets/fonts`; the page makes no external font requests. See [the design notes](docs/DESIGN.md) for the palette, type scale, and visualization conventions.

## Launch

The app is deployed automatically to GitHub Pages whenever a commit is pushed to `main`. The workflow publishes the browser app, its local assets, and the project documentation. To enable or inspect deployment, open the repository’s **Settings → Pages** and choose **GitHub Actions** as the build and deployment source. Workflow status and deployment links are available in the **Actions** tab.

From this project directory:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Python serves static files only. All computation and storage happen in the browser. An existing static server, VS Code Live Server, or static hosting also works. Do not double-click `index.html`: ES modules and module workers require HTTP. Use a modern browser supporting ES modules, module workers, `structuredClone`, and LocalStorage.

Node.js is optional for development checks and the reproducible report:

```powershell
npm test
node scripts/comparison-report.mjs
```

No `npm install` or build is needed. `npm start` is an alternative launch command when Python is installed. Stop the static server with Ctrl+C.

## Learning areas

| Area | Working features |
| --- | --- |
| Pathfinding | BFS, DFS, Uniform-Cost, Greedy, A*; editable 10×16 map; walls and positive entry costs; start/goal; actual queue/stack/priority frontier; cell g/h/f and parent inspector; paths; weighted, maze, unreachable, blank presets |
| Optimization | N-Queens (N = 4–12); hill climbing and simulated annealing; editable row arrangements; seed, temperature, cooling, iteration limit; candidate decisions; strict minima and plateaus; current/best conflict scores; SVG score chart; accepted worse moves |
| Game AI | Playable Tic-Tac-Toe; either human side; full-depth Minimax; optional alpha-beta checkbox; natural or center-first ordering; expandable MAX/MIN tree with utility, alpha/beta, cutoffs, and bounds; tactical presets |
| Sudoku | Editable standard 9×9 puzzle; teaching and classic presets; invalid and impossible examples; basic backtracking or forward checking; candidates, rejection, assignment, pruning, restoration, and backtracking |
| Timetabling | Five-session teaching dataset; editable JSON; teacher, group, room, and availability constraints; backtracking and forward checking; assigned slot/room view; feasible and impossible presets |
| Dashboard | Real comparisons within each lab; charts selectable by metric; configurations and history; restore complete inputs; JSON export; paired seeded trials and repeated timings |

### Common controls

1. Choose a problem and algorithm. Edit cells, rows, or the dataset while the experiment is ready.
2. **Run** computes a trace in a worker, then plays it. **Next** from the ready state computes the trace and pauses on its initial state.
3. **Pause**, **Next**, **Previous**, and the recorded-decision slider inspect immutable snapshots. Previous never reruns the algorithm or consumes additional random numbers.
4. **Speed** changes playback intervals only. It cannot change decisions, metrics, seeds, or the output.
5. **Reset** cancels an active worker, removes the current in-memory trace, and unlocks settings. The configured problem remains intact.
6. **Compare algorithms** uses copies of the same input. Open Dashboard for comparison charts, saved setups, and history export.

In Tic-Tac-Toe, a human click computes the AI response. Replay the decision or press **Play AI move** to commit it. This allows inspection before the board changes. New game resets the board; Reset only resets decision playback.

Grid symbols supplement colors: `S` start, `G` goal, `×` wall, `○` frontier, `◎` current, `·` expanded, `↗` path. Tab enters the SVG grid at one cell; arrow keys move the inspection focus and Enter/Space applies the chosen brush. Form controls, game squares, and tree disclosures support native keyboard navigation. The interface reflows for narrow screens; large grids and tables scroll inside their panels. Reduced-motion preferences are respected.

## Algorithm rules and metric definitions

See [algorithm explanations](docs/ALGORITHMS.md) and [architecture](docs/ARCHITECTURE.md).

| Metric | Exact meaning |
| --- | --- |
| Nodes expanded | Pathfinding cells whose neighbors were enumerated. Stale priority entries and the goal selected for return do not count. Re-expansion would count another expansion. |
| Cells discovered | Unique cells first reached, including the start; separate from expanded cells. Available in snapshots and JSON. |
| Maximum frontier | Maximum count of distinct valid pending cells, excluding stale priority records and closed cells. |
| Path length / cost | Number of moves; sum of entered-cell costs, excluding the start. Unsuccessful searches report null, not zero. |
| Score evaluations | Actual calls to the N-Queens conflict objective, including initial score evaluation. |
| Iterations | Neighborhood sweeps for hill climbing; proposals for annealing. Includes the sweep detecting a stall. |
| Best conflicts / success | Lowest accepted-state conflict score; success means zero conflicts. Annealing always accepts improving proposals. |
| Nodes evaluated | Game search calls, including the root and terminal nodes. No caching or symmetry reduction. |
| Terminal evaluations / cutoffs / depth | Leaf utilities computed; sibling lists actually cut off; maximum ply reached from the configured position. |
| Assignments attempted | CSP candidate values tried, including rejected candidates. Fixed Sudoku clues do not count as attempted assignments. |
| Backtracks | Accepted CSP assignments undone after failure, including an immediate forward-checking domain wipeout. A rejected unassigned candidate is not a backtrack. |
| Values removed | Cumulative domain values removed from unassigned neighbors by forward checking. Restoration does not decrement this effort counter. Initial unary filtering is not counted. |
| Compute time | Engine duration measured with `performance.now()`. Recorded runs include snapshot copying. Dashboard comparisons disable copying and exclude animation, DOM rendering, worker startup, and message transfer; algorithm bookkeeping remains included. |

Deterministic comparisons use one warm-up followed by five identical timing runs and report medians. Optimization uses 20 consecutive unsigned seeds, identical boards/settings for both algorithms in each trial, and three identical timing repetitions per trial. Choose **Current arrangement** to keep the configured board, or **paired random arrangements** to vary it. Trial timing medians are then summarized across the 20 trials. Report success rates with trial counts; do not rank different labs against each other. Timings vary by device/runtime and are descriptive measurements, not universal performance claims.

## Demonstration scenarios

| Scenario | How to run it | Expected observation |
| --- | --- | --- |
| Cheapest versus shortest | Pathfinding → Weighted terrain → Compare | BFS: 13 moves, cost 93. UCS and A*: 19 moves, cost 19 on the unchanged preset. |
| Unreachable goal | Pathfinding → Unreachable goal | Frontier exhausts and reports no solution; not a search limit. |
| Strict local minimum | Optimization → Strict local minimum → Hill climbing | Score 1; all single-queen neighbors are worse. Hill climbing stops. |
| Plateau | Optimization → Plateau example | N = 4, rows 1,2,4,3; score 2; equal alternatives but no improving move. |
| Accepting a worse move | Annealing; plateau start; seed 101; T = 100; cooling .99; limit 40 | Some worse proposals are accepted. Their probability and seeded draw are recorded; current score can rise while best remains unchanged. |
| Minimax versus pruning | Game AI → Win in one / midgame → Compare | Same root utility and chosen move under the same ordering; alpha-beta evaluates fewer or equal nodes. |
| Forward checking | Sudoku → Teaching puzzle → Compare | Both solve validly. Basic: 81 attempts, 13 backtracks. Forward checking: 41 attempts, 5 backtracks, 44 values removed. |
| Invalid puzzle | Sudoku → Invalid preset → Next | A duplicate clue is rejected before search. |
| Valid clues, impossible puzzle | Sudoku → Valid clues · no solution | No duplicate clues, but exhaustive search establishes no solution. |
| Impossible timetable | Timetabling → Teacher availability · impossible | Ada has three sessions but only two available slots; exhaustive search reports no valid schedule. |
| Search limit | Sudoku or timetable → limit 1 → Next | “Search limit” means unresolved, not impossible. |

Select a preset again before a demonstration if the problem was edited. All outcomes are computed; only problem inputs are presets.

## Persistence and limits

LocalStorage key `so-playground-v1` holds schema version 1, current configurations, seeds, and the latest 50 runs/comparisons/saved setups. History stores inputs and result summaries, never playback traces. Restore loads an input; run again to regenerate a trace. Persistence is specific to the browser and origin, including the server port. Export JSON before clearing history or browser storage. Storage failures are reported and the app continues in memory.

Playback records up to 1,800 events per ordinary lab and 12,000 in Game AI, plus a final state. Larger searches continue to completion; an explicit warning reports omitted events. Previous is exact for retained frames. Game trees retain the first 30,000 visited nodes plus the top two levels; omitted subtrees are labeled, never assigned invented utilities. At most 140 tree nodes and 45 expanded disclosures are visible at once. Use midgame presets for compact complete trees.

The pathfinding grid has a fixed teaching size. CSP variable ordering is fixed (no MRV, AC-3, or uniqueness checking). Sudoku returns the first valid completion. Timetable sessions each occupy one slot, have one teacher and one group, and specify allowed rooms; variable durations, capacity, and soft preferences are outside this version. Annealing has finite limits and cannot guarantee a solution. No Connect Four, accounts, cloud synchronization, or trace persistence.

## Submission material

- [Architecture diagram and module responsibilities](docs/ARCHITECTURE.md)
- [Algorithm explanations and guarantees](docs/ALGORITHMS.md)
- [Generated comparison report](reports/COMPARISON_REPORT.md) and raw JSON
- [Suggested viva questions and answers](docs/VIVA.md)
- [Actual verification results](docs/TEST_RESULTS.md)
- [Development checklist](TASKS.md)

The source is readable ES modules. Development tests use Node's built-in runner; the application does not require Node or a bundler.
