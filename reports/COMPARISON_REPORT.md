# Actual comparison report

Generated: 2026-10-12T18:37:30.469Z. Runtime: Node v26.4.0, win32/x64. Browser timings will differ. Inputs are the unchanged default presets; raw configurations, per-run measurements, seeds, starting boards, and timing repetitions are in [comparisons.json](comparisons.json). No animation or rendering was included.

Deterministic algorithms: one warm-up and five timing runs. Optimization: the same configured arrangement for both algorithms, 20 consecutive seeds starting at 42, three timing repetitions per trial; trial timing medians and operation counts are summarized using medians. Success rates apply to this finite trial set, not all N-Queens inputs.

## pathfinding

| Algorithm | Outcome | Nodes expanded | Max frontier | Path length | Path cost | Compute time |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Breadth-first search | solved | 113 | 13 | 13 | 93 | 0.58 ms |
| Depth-first search | solved | 130 | 62 | 23 | 23 | 1.29 ms |
| Uniform-cost search | solved | 142 | 15 | 19 | 19 | 0.88 ms |
| Greedy best-first | solved | 13 | 26 | 13 | 93 | 0.21 ms |
| A* search | solved | 69 | 36 | 19 | 19 | 0.72 ms |

## optimization

| Algorithm | Outcome | Score evaluations | Iterations | Current conflicts | Best conflicts | Worse moves accepted | Compute time | Success |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Hill climbing | plateau | 225 | 4 | 1 | 1 | 0 | 0.06 ms | 0% (20 trials) |
| Simulated annealing | mixed | 301 | 300 | 1 | 1 | 30.5 | 0.15 ms | 30% (20 trials) |

## game

| Algorithm | Outcome | Nodes evaluated | Terminal scores | Cutoffs | Search depth | Compute time |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Minimax | solved | 549946 | 255168 | 0 | 9 | 124.35 ms |
| Alpha-beta pruning | solved | 18297 | 7330 | 4237 | 9 | 4.06 ms |

## sudoku

| Algorithm | Outcome | Assignments tried | Backtracks | Values removed | Assigned | Compute time |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Backtracking | solved | 81 | 13 | 0 | 81 | 1.63 ms |
| Forward checking | solved | 41 | 5 | 44 | 81 | 1.32 ms |

## timetable

| Algorithm | Outcome | Assignments tried | Backtracks | Values removed | Assigned | Compute time |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Backtracking | solved | 21 | 3 | 0 | 5 | 0.10 ms |
| Forward checking | solved | 7 | 2 | 13 | 5 | 0.09 ms |

## Interpretation

The weighted grid distinguishes minimum moves from minimum cost. Compare UCS and A* cost before comparing their expansion counts. N-Queens success is sensitive to seed, arrangement, temperature, cooling, and iteration budget. Game pruning preserves the root utility; savings depend on move ordering. Forward checking spends work filtering domains to reduce candidate attempts and backtracks; short timing differences are noisy. A failed/limited algorithm is not a performance winner merely because it stopped quickly.

Timing values include shared algorithm bookkeeping, but exclude trace copying. Tiny durations are sensitive to JIT warm-up, garbage collection, and timer resolution. Counts and correctness are stronger evidence for a university report than small timing differences.
