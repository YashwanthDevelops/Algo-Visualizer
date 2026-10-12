# Actual verification results

Verified 13 October 2026 in the project workspace. No mocked decisions, fabricated performance figures, external dependencies, or paid API calls were used.

## Automated correctness checks

Command: `node --test tests/algorithms.test.js`

Runtime: Node v26.4.0. Final consolidated result: **18 tests, 18 passed, 0 failed, 0 skipped**. Reported duration: **491.246 ms** for that run. Timing will vary by machine and run.

| Check | Actual outcome |
| --- | --- |
| Queue, stack, stable priority ordering | Passed |
| Weighted three-by-five fixture | BFS 4 moves/cost 28; UCS and A* 6 moves/cost 6; all five returned legal adjacent-cell paths |
| Unweighted maze | All five solved; BFS/UCS/A* agreed on optimal length |
| Unreachable, start=goal, limit, invalid endpoints | Distinct outcomes; start=goal cost/length/expansions all zero |
| Immutable snapshots and previous/seek | Input unchanged; earlier snapshots and replayed frames matched exactly |
| N-Queens pair objective, solved, plateau | Correct pair counts; plateau score 2 and 13 evaluations |
| Seeded annealing and worse acceptance | Identical traces for identical seeds; actual accepted worse moves satisfied recorded probability/draw conditions |
| Zero seed | Non-degenerate reproducible stream |
| Strict local-minimum fixture | Score 1; every single-queen neighbor worse; correct stopped status |
| Minimax/alpha-beta and tactical decisions | Root utilities and chosen moves matched under identical ordering; win/block decisions correct |
| All human continuations versus optimal O | No human X win from an empty board |
| Illegal/terminal game positions | Invalid boards rejected; terminal AI loss utility −1 |
| Opening Minimax memory bound | Full 549,946-node search completed with root value 0; bounded trace/tree retained; top-level branches retained |
| Two Sudoku solvers | Valid identical completion; clues preserved; forward-checking events recorded |
| Invalid/impossible/limited Sudoku | Validation error, exhaustive no-solution, and search-limit distinguished |
| Two timetable solvers | All five sessions placed with teacher/group/room constraints and availability; basic preset required actual backtracking |
| Impossible/limited timetable | Exhaustive no-solution distinct from search limit |
| Real comparisons | Five identical deterministic timing runs; 20 paired optimization seeds/starting inputs and genuine timing samples |

## Browser integration

Executed in the Codex in-app browser against the static localhost server. HTTP entry page returned 200. These are exercised browser flows, separate from the Node correctness suite:

| Flow | Observed result |
| --- | --- |
| Navigation and dark responsive shell | All five labs and dashboard rendered; wide and narrow viewports inspected |
| Worker execution and Next | BFS computed in the worker and paused at recorded initialization |
| Next then Previous | Visualization text matched the original recorded frame |
| Slider to final BFS state | 113 expansions, max frontier 13, length 13, cost 93 on the unchanged weighted preset |
| Pathfinding comparison | Five actual rows; UCS/A* cost 19, BFS cost 93; history/chart populated |
| Seeded annealing, board and SVG chart | Solved a four-queen run; recorded 18 accepted worse moves and separate current/best scores in the exercised settings |
| Tic-Tac-Toe opening | Human X in square 1; AI selected square 5; Play AI move placed O there and returned to the human turn |
| Search-tree expansion | Expanded a child and increased visible nodes from 9 to 16; utility/bounds and pruning metrics displayed |
| Sudoku validation | Duplicate preset showed a validation alert before search |
| Teaching Sudoku | All 81 cells filled; 41 attempts, 5 backtracks, 44 domain values removed |
| Feasible timetable | Five visible assigned session blocks and solved outcome |
| Impossible timetable | Displayed NO SOLUTION |
| Dashboard history after navigation/reload | Saved summaries/comparisons remained and the comparison chart rendered |
| Strict local minimum | Displayed LOCAL MINIMUM, score 1, 57 evaluations, one iteration |
| Optimization comparison | Both algorithms used the current board; hill success 0%, annealing 20% for the exercised finite settings; genuine mixed outcomes displayed |
| Dashboard Run comparison | Routed to timetabling and produced two comparison rows |
| Keyboard pathfinding | ArrowRight moved inspection from (5,2) to (5,3); one grid tab stop; g/h/f and parent shown |
| Console errors | No errors in the inspected final browser log |

The only browser automation selector mismatch was resolved by targeting the visible dashboard select's ID; it was not an application error. A verified desktop preview is saved as [playground-preview.jpg](playground-preview.jpg).

## Reproducible report

`node scripts/comparison-report.mjs` completed successfully and wrote real results for pathfinding, optimization, game AI, Sudoku, and timetabling. See [the report](../reports/COMPARISON_REPORT.md) and [raw configurations and measurements](../reports/comparisons.json). Node timings and browser timings use different runtimes and must not be interchanged.

## Known limits

Trace retention is capped (1,800 ordinary events / 12,000 game events plus the final frame), and very large game trees retain only the first 30,000 visited nodes and top two levels. Explicit warnings identify omissions; full computation and metrics continue. The fixed teaching grid, one-slot timetable model, fixed CSP ordering, first-solution Sudoku behavior, local-origin persistence, and finite stochastic budgets are documented in the README. Browser integration was verified in one browser; a cross-browser matrix and exhaustive accessibility audit were not performed.
