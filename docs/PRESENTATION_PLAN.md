# AlgoAI presentation plan

Status: storyboard and content plan; no slides authored yet.

## Presentation brief

Audience assumption: faculty and students attending a college project review or viva.
Recommended length: 15 main slides, approximately 12–15 minutes including a short demonstration. Technical details and references go in backup slides.

Narrative: learning problem → product and learner workflow → implementation → five labs → question extraction → measured evidence → limitations and conclusion.

Main message: AlgoAI lets students configure AI problems, inspect recorded algorithm decisions, and compare results on the same inputs.

## Visual direction from the supplied reference

Treat the attached montage as a visual reference. Its agency copy, people, revenue figures, and testimonials are not project content.

- Format: widescreen 16:9.
- Approximate palette: deep forest green `#193F35`, warm cream `#F3EFDF`, pale green `#B6D99C`, dark text `#163A30`. These are proposed colors inspired by the image, not measured source values.
- Typography: IBM Plex Sans for headings and body; IBM Plex Mono for code, algorithm labels, and metrics. This connects the deck to the app's existing fonts.
- Scale: titles approximately 36–44 pt, body 22–26 pt, diagram labels at least 18 pt where practical. Large numbers 48–64 pt.
- Composition: generous margins; a short text block and one dominant visual. Alternate cream explanation slides with forest-green feature slides. Use rounded screenshot crops as in the reference.
- App images: retain the app's actual charcoal/copper interface. Surround screenshots with the deck palette; do not recolor evidence or squeeze whole pages into unreadable thumbnails.
- Diagrams: editable labeled flowcharts, trees, grids, and charts. A small consistent legend should identify explored, current, frontier, solution, and pruned states when needed. Reinforce colors with labels or symbols.
- Motion: reveal meaningful algorithm steps or branches in sequence. Avoid decorative transitions. Every slide must also work as a static PDF.
- Footer: discreet slide number. Put detailed evidence sources in speaker notes, with visible short qualifications wherever they affect a result.

## Main slides

### 01 — AlgoAI

**Purpose:** identify the project immediately.

**Slide copy**

- AlgoAI
- Visualizing Foundations of Artificial Intelligence
- Interactive search, optimization, game AI, and constraint solving
- Small credit line: [team members] · [department / institution] · [guide, if required]

**Visual:** forest-green cover with large pale-green title on the left and one oversized crop of the real pathfinding visualization on the right. The route becomes the main graphic. Keep credits secondary.

**Presenter emphasis:** this is an environment for examining how an algorithm reaches its answer.

### 02 — The learning problem

**Purpose:** connect the project to a concrete educational need without making untested claims about learning outcomes.

**Slide copy**

- Pseudocode describes the rules; static examples hide many intermediate decisions.
- A final answer does not show the frontier, rejected choices, or backtracking.
- Project objective: make those decisions inspectable and comparisons repeatable.

**Visual:** cream slide with a simple three-part explanation: pseudocode excerpt → hidden intermediate decisions → final path. Enlarge the middle area and reveal a short recorded decision sequence beneath it. Label this a learning challenge, not a measured student-study finding.

### 03 — Project overview

**Purpose:** show the scope before presenting individual features.

**Slide copy**

- Pathfinding: BFS, DFS, UCS, Greedy, A*
- N-Queens: hill climbing and simulated annealing
- Game AI: Minimax and alpha-beta pruning
- Sudoku and timetabling: backtracking and forward checking
- Shared tools: Question Visualizer, comparisons, and experiment history

**Visual:** a flat branching map. AlgoAI connects to Search, Optimization, Game AI, and Constraint Satisfaction; CSP divides into Sudoku and Timetabling. A thin band beneath the map identifies shared playback and comparison tools. Avoid a dense grid of equal feature cards.

### 04 — Configure, inspect, compare

**Purpose:** explain what a student actually does.

**Slide copy**

1. Configure a problem or select a preset.
2. Run an algorithm to record its decisions.
3. Step forward or backward through states, explanations, and pseudocode.
4. Compare results using copies of the same input.

**Visual:** four horizontal steps above one large screenshot crop. Three small annotations point to the visualization, decision explanation, and playback controls. Sequential reveals can walk through this flow.

**Technical point to say:** changing playback speed does not change the algorithm's decisions. Previous restores a retained state rather than rerunning the search.

### 05 — System architecture

**Purpose:** make the core engineering understandable in one diagram.

**Slide copy**

- Browser interface: problem setup and SVG/HTML views
- Web Worker: validation, algorithm execution, and trace recording
- Recorded states: shared playback, explanations, and metrics
- LocalStorage: saved configurations and result summaries

**Visual:** editable left-to-right diagram:

`Problem input → copied configuration → Web Worker / algorithm engine → recorded states + results → playback / visualization`

Branch result summaries to LocalStorage and comparisons to the dashboard. Separate main-thread and worker regions with light background bands. Keep the optional extraction API for slide 11 so this diagram stays readable.

**Small stack line:** HTML · CSS · JavaScript modules · SVG · Web Workers · LocalStorage. Mention the React/TypeScript dashboard background only in notes or a technical backup slide; the algorithm core uses JavaScript modules.

### 06 — Pathfinding: moves and cost

**Purpose:** demonstrate a meaningful difference between algorithm objectives.

**Slide copy**

- BFS minimizes moves on the grid.
- UCS minimizes accumulated movement cost; A* also uses a heuristic.
- Weighted preset: BFS takes 13 moves at cost 93; UCS and A* take 19 moves at cost 19.

**Visual:** two large views of the same weighted grid: BFS route and A* route. Use matching start/goal positions, visible costly cells, and directly attached move/cost labels. A short reveal traces each route.

**Visible qualification:** unchanged weighted-terrain preset; path cost excludes the start cell. Do not imply that BFS minimizes cost on weighted terrain.

### 07 — N-Queens: escaping a local optimum

**Purpose:** explain the difference between improving every move and sometimes accepting a worse move.

**Slide copy**

- Goal: place N queens with zero attacking pairs.
- Hill climbing can stop at a local minimum or plateau.
- Simulated annealing can accept worse moves according to temperature.

**Visual:** large real chessboard state on the left; actual conflicts-versus-iteration trace on the right. Show current and best conflicts separately. Annotate one genuinely accepted worse move and one hill-climbing stopping point using recorded runs.

**Production rule:** obtain the curves from actual recorded runs, not invented smooth lines. Label each algorithm's run/settings. If a conceptual sketch is used instead, explicitly label it illustrative.

**Presenter qualification:** annealing has a finite budget and does not guarantee a solution. Put the acceptance equation in backup material.

### 08 — Game AI: Minimax and pruning

**Purpose:** make adversarial search and pruning visible.

**Slide copy**

- Minimax chooses a move by evaluating possible replies.
- Alpha-beta skips branches that cannot change the decision.
- Full-depth search preserves the root utility under pruning; the configured move ordering controls ties.

**Visual:** a compact Tic-Tac-Toe position beside an editable depth-two or depth-three tree derived from a real midgame trace. Label MAX/MIN levels, display known utility values, mute pruned branches, and highlight the selected move. Reveal pruning only after the relevant bound is established.

**Production rule:** use a midgame example small enough to show accurately. Do not label a pruned or unvisited node with an invented utility. Reserve the large opening-search comparison numbers for slide 12.

### 09 — Sudoku: reducing candidate values

**Purpose:** show how constraint propagation changes the search.

**Slide copy**

- Empty cells are variables; candidate digits form their domains.
- Row, column, and box constraints restrict assignments.
- Forward checking removes conflicting values from unassigned neighbors.

**Visual:** one large Sudoku board crop. Zoom into a selected empty cell and its peers, showing candidate removal after a valid assignment. Use a small editable sequence: assign → remove candidates → detect an empty domain or continue.

**Presenter emphasis:** forward checking can reject a branch earlier; it is not full arc consistency. Sudoku returns the first valid completion, not a uniqueness proof.

### 10 — Timetabling: a practical CSP

**Purpose:** connect the same search model to a scheduling problem.

**Slide copy**

- Each session needs an allowed time slot and room.
- Teachers, student groups, and rooms cannot be double-booked.
- Availability constraints can make a schedule impossible.

**Visual:** a readable timetable from the current app, with a focused session detail beside it. Show a small conflicting placement and then its valid alternative. Label the teacher, group, room, and time involved. Use the actual configured data; do not imply the default teaching dataset represents a complete institutional scheduler.

**Presenter emphasis:** exhausting the search establishes no solution; reaching a search limit leaves the result unresolved.

### 11 — Question Visualizer

**Purpose:** highlight the project's distinct input workflow and show the review boundary.

**Slide copy**

- Upload a graph-question image, or construct a graph manually.
- Review extracted nodes, edges, costs, and algorithm suggestions.
- Run the reviewed graph locally and inspect the search trace.

**Visual:** a three-stage composition: graph image → editable graph draft → search playback. Add a concise pipeline underneath: `image → server / Gemini extraction → review → local graph worker`. Make the review stage visually prominent.

**Visible status note:** image extraction requires a configured backend. Local live samples were checked; the API backend was not deployed in the recorded verification. Missing costs remain unknown rather than being invented.

**Production rule:** use a project-owned or newly created sample graph question. Existing uploaded-question screenshots must be checked for private or third-party content before presentation use. Manual graph entry is the fallback if extraction is unavailable during the demo.

### 12 — Measured comparisons

**Purpose:** substantiate the algorithm explanations with project-generated evidence.

**Slide copy / chart values**

| Comparison | Baseline | Alternative | Constant condition |
| --- | ---: | ---: | --- |
| Pathfinding: nodes expanded | UCS 142 | A* 69 | Both return path cost 19 on the weighted preset |
| Game AI: nodes evaluated | Minimax 549,946 | Alpha-beta 18,297 | Same full-depth opening position and ordering |
| Sudoku: assignments attempted | Backtracking 81 | Forward checking 41 | Same teaching puzzle and default ordering |

**Visual:** three independent paired horizontal-bar comparisons with direct labels and separate scales. Each pair represents a different metric, so do not combine them on a shared axis or rank algorithms across labs. Use pale green and forest green consistently for the two compared methods.

**Visible source / caveat:** recorded default-preset report, 12 October 2026; counts depend on inputs and settings. These are existing measurements, not new results from preparing the presentation.

**Presenter emphasis:** use operation counts as the main evidence. Tiny runtime differences are noisy. Add a separate backup table if examiners request timing methodology.

### 13 — Testing and verification

**Purpose:** explain what was checked and what the evidence supports.

**Slide copy**

- Algorithm checks: legal outputs, expected optimal costs, constraint validity, and explicit failure states
- Replay checks: immutable snapshots, reproducible seeds, and backward stepping
- Browser checks: playback, navigation, persistence, and narrow-screen layout
- Documented integration run: 38/38 tests passed on 2 November 2026

**Visual:** a clean vertical verification flow with one small example per level: legal path, restored state, browser workflow. Use a large `38/38` as a dated supporting fact, not a current certification badge. Include a small desktop/mobile pair only if the slide remains readable.

**Qualification:** Question Visualizer automation used a mocked response; two separate local live extraction samples were checked. The recorded browser coverage is Chromium, not a full cross-browser or accessibility audit. Refresh verification before making a new current-state claim during deck production.

### 14 — Limitations and next steps

**Purpose:** show realistic boundaries and a credible development direction.

**Slide copy**

| Current boundary | Proposed next step |
| --- | --- |
| Playback traces are capped; large searches can omit intermediate states | More scalable trace storage and inspection |
| History is stored in the current browser; replay traces are not persisted | Exportable replay sessions |
| Timetabling uses a simplified one-slot session model | Durations, capacity, and preference constraints |
| Image extraction needs a configured server and user review | Deploy the API and evaluate extraction on a labeled test set |

**Visual:** a spacious two-column comparison with subtle connecting arrows. Clearly label next steps as proposed work. Use only three rows on the slide if four become crowded; move the remainder to notes.

**Do not list existing features as future work:** optional MRV/degree and least-constraining-value ordering already exist, as do hill-climbing sideways moves and random restarts.

### 15 — Conclusion and demonstration

**Purpose:** close on the project's actual contribution and provide a simple demonstration handoff.

**Slide copy**

- AlgoAI makes algorithm decisions inspectable.
- Five labs share recorded playback and repeatable comparisons.
- Question Visualizer connects graph questions to reviewed, executable inputs.
- Demo / Questions

**Visual:** forest-green closing slide, large pale-green statement, one strong visualization crop, and a discreet link to the deployed static app. A QR code may be added after confirming the target URL during production.

**Suggested demonstration, 60–90 seconds:** open the unchanged weighted pathfinding preset → run BFS → step backward once → compare against A* → point to path cost and nodes expanded. If time permits, open a prepared, reviewed Question Visualizer graph. Keep screenshot fallbacks available.

## Optional backup slides

1. **Algorithm rules:** frontier policies, `f = g + h`, annealing acceptance `exp(-Δ/T)`, alpha-beta cutoff, MRV and LCV. Keep formulas tied to a small example.
2. **Measurement method and complete results:** same inputs, deterministic warm-up and five timing runs, medians, 20 paired optimization seeds, and operation definitions. Include the full report table if needed.
3. **Implementation details:** worker messages, immutable snapshots, trace limits, local persistence, and the optional image-extraction API boundary.
4. **References and credits:** project documentation, algorithm sources already used by the project, visual asset credits, and institution/team details. Add this as a numbered main slide only if the submission format requires it.

## Visual asset checklist for deck production

- Fresh dashboard/overview capture
- Same weighted grid solved by BFS and A*
- N-Queens board plus genuine current/best conflict traces with recorded settings
- Small real Tic-Tac-Toe midgame tree and selected move
- Sudoku candidate-removal state
- Timetable with a clearly explained constraint conflict
- Three Question Visualizer stages using an approved sample question
- Desktop/mobile capture if used on verification slide
- Editable architecture, learning-flow, search-tree, and extraction-pipeline diagrams
- Editable charts using exact operation counts from the recorded comparison report

Existing files under `reports/fieldbook-preview`, `reports/ui-smoke-final`, and `reports/question-visualizer-preview` can help select compositions. They may predate current interface edits, so capture the current app for final evidence. Prefer focused crops over screenshots containing unreadable menus and text.

## Evidence and production notes

Primary project evidence inspected for this plan:

- `PRODUCT.md`: audience, purpose, and product principles
- `README.md`: supported labs, shared controls, metrics, demonstrations, and persistence
- `docs/ARCHITECTURE.md`: modules, worker boundary, snapshots, playback, and storage
- `docs/ALGORITHMS.md`: exact algorithm behavior and optional controls
- `reports/COMPARISON_REPORT.md`: recorded operation counts and measurement conditions
- `docs/TEST_RESULTS.md`: dated verification scope and limitations
- `docs/QUESTION_VISUALIZER.md`: extraction contract, local checks, and deployment status
- Current navigation and lesson code: actual lab names, routes, and teaching flow

Some older README limitation text conflicts with newer feature descriptions and algorithm documentation about MRV/LCV and grid size. Use the current implementation and newer detailed documentation when finalizing the deck; do not copy that older paragraph uncritically.

The user-referenced `RTK.md` was not found in the workspace or checked parent directories. No instructions were inferred from its name.

No new performance measurements, live API checks, or test runs were performed for this planning task. No claims about improved learning outcomes or extraction accuracy are supported by the inspected materials.
