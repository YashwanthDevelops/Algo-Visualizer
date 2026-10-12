# Suggested viva questions and answers

1. **Why does BFS sometimes return a more expensive path?** It orders by discovery depth, not weighted cost. On the weighted preset it minimizes moves while UCS minimizes the sum of terrain entry costs.
2. **How do UCS, Greedy, and A* differ?** Their priority keys are g, h, and g+h respectively; the heap implementation is shared.
3. **Why is the Manhattan heuristic suitable here?** Four-direction moves can change Manhattan distance by at most one. Multiplying by minimum entry cost gives a consistent lower bound.
4. **Why stop A* when the goal is selected, rather than discovered?** Discovery may use a more expensive path. Priority selection after relaxation establishes the optimal goal cost under the configured conditions.
5. **Why retain best costs and ignore stale heap entries?** A cell can be discovered through an expensive route before a cheaper one. Old queue records must not be expanded as current best paths.
6. **What exactly is an expanded node?** A selected cell whose successors were enumerated. Discovery and goal selection are counted differently.
7. **Why can hill climbing stall with conflicts remaining?** Its permitted neighbors can offer no improvement. A plateau has equal alternatives; a strict local minimum has only worse alternatives.
8. **How can annealing escape?** A worse proposal may be accepted with exp(−Δ/T). Larger T increases that probability; cooling reduces it. A finite schedule still has no success guarantee.
9. **Why display current and best scores separately?** Annealing can temporarily worsen the current arrangement while preserving a previously better one.
10. **What does a seed reproduce?** The PRNG sequence, proposals, acceptance draws, and starting arrangements for identical settings. Timing measurements need not reproduce exactly.
11. **Why is Minimax unbeatable in Tic-Tac-Toe?** It searches to terminal states and chooses the best worst-case utility. Perfect play guarantees at least a draw from the empty position.
12. **Does pruning change the answer?** Alpha-beta preserves root utility while skipping irrelevant siblings. Ordering can change which equal optimal move is selected and how many nodes are avoided.
13. **Why label a cutoff value as a bound?** Skipping children can leave a non-root node without its exact Minimax utility, even though the root result remains correct.
14. **How is forward checking different from backtracking?** It deletes invalid choices from unassigned neighbors after every accepted assignment, detecting empty domains before deeper recursion.
15. **Why must domains be restored?** A removal belongs to one branch's assumptions. Keeping it after undoing that branch would incorrectly exclude valid solutions.
16. **Can valid Sudoku clues still have no solution?** Yes. Avoiding immediate duplicates does not guarantee all constraints can be jointly completed.
17. **What is a timetable variable and domain?** A required session; its available, allowed slot/room combinations. Teachers, rooms, and groups impose pairwise overlap constraints.
18. **Why distinguish no solution from a search limit?** Only exhaustive failure or a proved empty initial domain establishes infeasibility. A bound can stop before a valid solution is reached.
19. **How does backward playback work?** The controller indexes independent recorded snapshots. It neither reverses mutations nor reruns random decisions.
20. **How are comparisons fair?** Algorithms receive copies of identical inputs and settings. Deterministic timings repeat the same experiment; optimization uses paired boards/seeds and repeated timing runs per trial. Animation is excluded.
21. **Why use Web Workers?** Computation stays off the UI thread. Reset can terminate a worker; generation IDs prevent stale results affecting a new experiment.
22. **Why not compare BFS node counts with Sudoku attempts?** They measure different operations on different problems. Dashboard comparisons stay within a lab.
23. **Why LocalStorage rather than a database?** The project is browser-only and stores modest configurations and summaries. Large traces remain in memory; storage is local to an origin.
24. **What are the main limitations?** Fixed grid size, bounded retained traces/tree views, fixed CSP ordering, first Sudoku solution only, simple one-slot scheduling, and finite stochastic search budgets.
