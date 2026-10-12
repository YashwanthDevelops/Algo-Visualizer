# Algorithm explanations

## Pathfinding

Neighbors are north, east, south, west. DFS pushes in reverse to visit north first. Traversable entry costs are positive; zero represents a wall. Priority ties use insertion order. Walls cannot replace endpoints in the editor.

| Method | Frontier and decision | Guarantee on this finite grid |
| --- | --- | --- |
| BFS | FIFO queue; oldest discovered cell | Fewest moves; cheapest only with uniform entry costs |
| DFS | LIFO stack; deepest available branch | Finds reachable goals with duplicate suppression; no shortest/cheapest guarantee |
| UCS | Min-heap by accumulated `g` | Lowest total entry cost |
| Greedy | Min-heap by estimated remaining `h` | Finds reachable goals on this finite duplicate-suppressed graph; no cost guarantee |
| A* | Min-heap by `f = g + h` | Lowest total cost with the configured consistent heuristic |

`h = (|row−goalRow| + |column−goalColumn|) × minimumTraversableEntryCost` is a lower bound because each move changes Manhattan distance by at most one. It also satisfies consistency across every legal edge. UCS/A* maintain best costs, update cheaper paths and parents, ignore stale heap entries, and check the goal after selection. Reopening cheaper states is supported. Admissibility alone requires appropriate reopening for general graph search; do not claim optimality with arbitrary heuristic/closed-set handling. [Berkeley informed search](https://inst.eecs.berkeley.edu/~cs188/textbook/search/informed.html)

## N-Queens

The arrangement is a row array indexed by column. Queens attack if their rows match or their row difference equals their column difference. Count each unordered pair once; score zero is solved.

Hill climbing enumerates all `N(N−1)` single-column moves, takes the first best strictly improving move in column/row order, and stops when none improves. Equal-score alternatives are a plateau; all-worse neighbors indicate a strict local minimum. There are no hidden restarts or sideways moves.

Annealing proposes one uniformly indexed neighbor using Xorshift32. Improvements and equal scores are accepted. A worsening score by Δ is accepted when a seeded draw is below `exp(−Δ/T)`; then temperature is multiplied by cooling. Iteration and temperature limits are explicit, and current/best arrangements are separate. A finite run is not guaranteed to find a solution. [Berkeley local search](https://inst.eecs.berkeley.edu/~cs188/textbook/search/local.html)

Xorshift32 uses unsigned 32-bit seeds. Seed zero maps to a fixed nonzero state to avoid its absorbing-zero stream. Random queen arrangements use the same documented generator. Comparison logs contain every trial seed and actual starting arrangement.

## Tic-Tac-Toe

X moves first. The AI is MAX; its opponent is MIN. Full-depth utility is +1 for an AI win, −1 for a loss, and 0 for a draw. MAX backs up the greatest child score; MIN backs up the least. Equal optimal moves use the configured ordering. Legal-state validation checks move counts and winning combinations.

Alpha-beta propagates α (MAX's established lower bound) and β (MIN's established upper bound), skipping remaining siblings when α ≥ β. Root utility matches ordinary Minimax. Cutoff values are labeled lower/upper bounds, and pruned leaves have no invented terminal score. Move ordering changes the amount saved. There is no depth heuristic, transposition cache, or symmetry shortcut in this version. [Berkeley Minimax](https://inst.eecs.berkeley.edu/~cs188/textbook/games/minimax.html)

## Constraint satisfaction

Both models use fixed variable order and ordered domain values to isolate the effect of filtering. Initial domains respect immutable constraints. Backtracking tries a value, rejects conflicts with existing assignments, recursively completes the rest, and undoes failed assignments.

Forward checking additionally removes values from unassigned related variables that conflict with the new assignment. Empty domains fail immediately. Each failed branch restores its previous domains exactly; cumulative pruning work stays counted. Forward checking is not AC-3 and does not enforce full arc consistency. [Berkeley filtering](https://inst.eecs.berkeley.edu/~cs188/textbook/csp/filtering.html)

For Sudoku, variables are empty cells and domains are allowed digits 1–9. Peers share a row, column, or box. Fixed duplicate clues are invalid input; a duplicate-free puzzle can still be impossible. The first valid completion is returned.

For timetabling, each session is a variable and values are allowed `(slot, room)` pairs. Initial domains enforce teacher/room availability and allowed rooms. Simultaneous sessions cannot share a teacher, student group, or room. Success requires every session scheduled; partial placements are never reported as success.

Exhaustive `no-solution` establishes infeasibility. `search-limit` means unresolved. Optimization `local-minimum`, `plateau`, and finite-run limits do not prove the mathematical problem unsatisfiable.
