# Design — AlgoAI

## Navigation and route lifecycle

The universal navbar is the only site navigation. Lab routes retain their original hashes, including `#optimization` for N-Queens. Dashboard comparison/history destinations use `#dashboard?section=compare` and `#dashboard?section=history`. Reference and Guide are in-app document readers at `#reference` and `#guide`; related project documentation uses allowlisted `#guide?doc=…` routes. Markdown content is escaped before rendering. All document requests are canceled when leaving the route.

Navigation suppresses playback callbacks throughout outgoing-page cleanup, playback reset, and destination mounting. The mounted page is synchronized after that transaction finishes, so callbacks never mix a destination algorithm with an outgoing DOM. Shared configuration parameters are consumed once and the URL is aligned with the imported lab. Repeating a current navbar link returns to the page start; the Question Visualizer returns to Upload while retaining its image and draft. Active links match full dashboard section routes, on desktop and mobile. Unknown routes return to the dashboard with a clear notification.

## Approved Pathfinding redesign

Pathfinding content is scaled to 120%, independently of the navbar and dashboard. The map separates terrain from traversal: faint grid lines, solid walls, outlined frontier cells, quiet explored fills, stable weighted-cost labels, and a single continuous route polyline derived from the active trace. Only S/G and terrain costs remain as cell text. The toolbar switches Edit map, Advanced settings, and Run details into the fixed right panel; Explanation restores the study view. Comparisons use a bounded native dialog with internal scrolling, and keyboard shortcuts use an anchored popover. Tool navigation preserves document height. Rendering guards against duplicate change events caused by removing a focused field so map editing stays open during configuration changes.

The study panels stay mounted across ready, worker loading, playback, pause, reset, and completion. Desktop space is divided 65/35 with stable 600px panels; small screens use a 440px graph panel above the 600px explanation panel. The graph viewport fits its SVG inside the panel, while zoom scrolls internally. A loading overlay replaces no study content. Five permanent pseudocode rows use 28px spacing, and reserved explanation slots prevent reflow. `pathfinding-renderer.js` commits graph state, active code line, explanation, and counters from one recorded event and only updates changed values. Pathfinding opts into animation-frame playback without changing the other labs' timer behavior. Cell transitions shorten with playback speed and stop for manual stepping and reduced motion. `study-select.js` keeps native configuration selects as the source of truth behind keyboard-accessible comboboxes styled like the shared navbar menus. `scripts/pathfinding-layout-check.mjs` verifies stable geometry, exact frame synchronization, loading, pause/resume, and completion at 1, 5, and 30 steps per second against real engine traces.

Pathfinding now follows the approved compact dashboard visual language: Aeonik headings, Inter controls, a #101010 background, white primary actions, and muted graphite borders. Its side navigation and breadcrumb bar are hidden for this route. A compact setup row leads to the map and a concise decision notebook; playback stays below the map. Editing, advanced search settings, algorithm steps, comparisons, full metrics, and keyboard help use disclosures. Saved setups, sharing, validated map editing, workers, and recorded playback retain their existing behavior. `pathfinding.css` is scoped to `.pf-page` and `body.is-pathfinding`; the other learning pages retain their current layouts. Fill and border transitions communicate search progress, and reduced-motion preferences remove those transitions. The implementation uses HTML, CSS, and live SVG, with no generated mockup images in the interface.

This is the shared visual system for the dashboard and five learning labs. Extend the system rather than inventing a separate theme for each problem.

## Direction

Audience: university students studying search and constraint solving. The job is to configure a real problem, inspect recorded decisions, and compare algorithm work. Tone: technical and composed. Genre: modern-minimal, adapted to an educational workbench.

App pages follow the Workbench family: compact heading, settings rail, dominant problem visualization, adjacent decision notebook, playback below the visualization, and measured results. The dashboard uses a working problem index, with a real map preview and a compact list of the other problems. No decorative metrics or illustrations.

## Theme and typography

The local redesign uses graphite surfaces, chalk text, and a desaturated olive accent, following the user's request to replace the copper palette. `tokens.css` contains the complete OKLCH palette, named spacing scale, type roles, and easings. `hallmark.css` imports it and refines the existing interface. `styles.css` is retained as the original base layer.

Display and body: self-hosted IBM Plex Sans at 400–600. Data, pseudocode, and costs: self-hosted IBM Plex Mono. The wordmark is monospaced; headings are upright, moderately sized, and aligned with their content. Font families are selected through named tokens. Data illustrations consume the same color tokens as the surrounding interface.

The accent marks primary actions, active navigation, focus, and meaningful search states. Supporting copy is warm gray with readable contrast. Errors and successful outcomes always retain text or symbols.

## Spacing and controls

Use the 4-point scale in `tokens.css`. Navigation uses a labeled side rail on desktop and a six-link grid on small screens. A single inline footer carries the project guide. Controls have a consistent 6 px radius, visible focus rings, and plain action labels. Surfaces use 8 px corners and neutral hairlines; no side accent borders or glow effects.

## Motion

No page or scroll reveals, parallax, or ambient animation. Button presses use a 1 px transform for 120 ms with the named `--ease-out`. Algorithm playback is functional and independent of CSS motion. Changed grid cells receive short fill and stroke transitions, and active notebook lines use a quiet color change. Reduced-motion preferences remove press movement while keeping brief color feedback.

## Learning and comparison

Each lab pairs a prediction prompt with a real recorded checkpoint, the engine's final outcome, and an explanation tied to the current trace. Replay metrics and complete-run metrics are labeled separately so the full computation is not mistaken for a single selected step. Capped traces mark the omitted event gap.

Visual comparisons use the same input and record two independent algorithm traces. A normalized progress slider advances each trace by its own step index and shows each side's event and step counts. Benchmark charts describe the meaning of each selected metric instead of assuming every lower value is better.

Map editing supports 5–40 rows and columns, a scrollable zoom control, keyboard cell navigation, and editing one cell per click or keyboard activation. Hovering and dragging do not paint cells. Import and share use configuration validation before saving or applying data.

## Responsive behavior

Validate at 320, 375, 414, 768, and desktop widths. Root pages do not scroll horizontally. Wide grids, trees, charts, and comparison tables scroll inside their regions. Labels remain visible beside icons. Form controls and touch actions use at least 44 px height. The decision notebook stacks below the visualization when a second column would compress the problem.

## Project history

The interface builds on baseline commit `df7c4a74e2deed12f87c70383f035d06e52e122c`, which contains the earlier project UI. The redesigned workbench and Question Visualizer are part of this project update; the baseline remains available by checking out that commit.

## Question visualizer

The dashboard includes a direct entry to the question workspace. Students select one of five named search algorithms, then upload a JPG, PNG, or WEBP question image or enter a graph manually. Image analysis is an explicit server request; an unavailable endpoint keeps the manual path open. The original image and browser-created crop remain separate. Extracted edges, direction, start/goal, node labels, heuristics, and costs are reviewed before solving. Uncertain fields and a detected algorithm conflict require an explicit student decision before the worker runs.

The review editor shows the graph alongside editable fields and keeps unknown costs and heuristics unknown until the student chooses a stated assumption. The visualization uses the selected local worker, with algorithm-specific pseudocode, a frontier explanation, step controls, event jumps, and final results withheld until the last recorded frame. Playback patches the graph and notebook while preserving control focus. Changes to the draft invalidate the trace. Workspace transitions remain short and color-focused; reduced-motion preferences remove motion while retaining immediate state feedback.


## Approved dashboard replacement — November 2026

The user approved faithful recreation of the classic SkyDive homepage at https://www.skydive.com/?home=classic for the dashboard. This overrides the preceding dashboard visual direction. The labs retain their existing workbench design, with the shared top navigation added and existing sidebar retained.

Dashboard: near-black #101010, white #f5f5f5, cards #202020; locally hosted Aeonik headings and Inter body. Keep the reference portrait orbit and scroll introduction, computer/memory composition adapted to real comparisons and history, eight template cards adapted to five labs plus Question Visualizer/comparisons/history, mountain CTA and large footer wordmark. No phone, integration, collaboration, or testimonial scenes. Hero is about studying Foundations of Artificial Intelligence and uses the action “Visualize questions”.

All new dashboard styles are scoped to .sd-dashboard; navigation uses separate classes. Native browser motion is cleaned up on route changes. Original asset origins are documented in assets/skydive/SOURCES.md.

## Approved study pages — November 2026

Pathfinding and N-Queens use the shared top navbar without the old sidebar or breadcrumb. Content is scaled to 120%; the navbar remains at its normal scale. Locally hosted Aeonik and Inter, graphite surfaces, restrained green state accents, rounded controls, and the shared dropdown listbox define the study interface. Button presses change surface color and inset shading without moving vertically.

N-Queens uses a 65/35 desktop split, fixed study panel heights, a square SVG chessboard with equal cells, and classical vector queen pieces. The responsive board preserves its aspect ratio; the notebook stacks below it on small screens. Loading overlays retain the mounted board. Playback updates queens, proposed moves, pseudocode, explanations, charts, and metrics from a single recorded frame. Only accepted adjacent playback moves animate; stepping, seeking, restarts, and reduced motion snap to the exact state.

Board editing, algorithm-specific advanced settings, candidates, and run details occupy the fixed notebook panel. Comparisons open in a dedicated rounded dialog. Hill climbing exposes sideways moves and restarts; simulated annealing exposes temperature, cooling, acceptance probability, and seeded draws. Full metrics distinguish the selected replay step from the complete engine outcome. N-Queens board sizes remain 4–12, matching the existing engine and saved-data validator. Algorithm implementations, storage format, shared URLs, and routes remain unchanged.
