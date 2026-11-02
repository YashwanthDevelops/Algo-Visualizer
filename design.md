# Design — Search & Optimization Playground

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

Map editing supports 5–40 rows and columns, a scrollable zoom control, keyboard cell navigation, and pointer drag painting. Repeated paint strokes persist once when the pointer is released. Import and share use configuration validation before saving or applying data.

## Responsive behavior

Validate at 320, 375, 414, 768, and desktop widths. Root pages do not scroll horizontally. Wide grids, trees, charts, and comparison tables scroll inside their regions. Labels remain visible beside icons. Form controls and touch actions use at least 44 px height. The decision notebook stacks below the visualization when a second column would compress the problem.

## Project history

The interface builds on baseline commit `df7c4a74e2deed12f87c70383f035d06e52e122c`, which contains the earlier project UI. The redesigned workbench and Question Visualizer are part of this project update; the baseline remains available by checking out that commit.

## Question visualizer

The dashboard includes a direct entry to the question workspace. Students select one of five named search algorithms, then upload a JPG, PNG, or WEBP question image or enter a graph manually. Image analysis is an explicit server request; an unavailable endpoint keeps the manual path open. The original image and browser-created crop remain separate. Extracted edges, direction, start/goal, node labels, heuristics, and costs are reviewed before solving. Uncertain fields and a detected algorithm conflict require an explicit student decision before the worker runs.

The review editor shows the graph alongside editable fields and keeps unknown costs and heuristics unknown until the student chooses a stated assumption. The visualization uses the selected local worker, with algorithm-specific pseudocode, a frontier explanation, step controls, event jumps, and final results withheld until the last recorded frame. Playback patches the graph and notebook while preserving control focus. Changes to the draft invalidate the trace. Workspace transitions remain short and color-focused; reduced-motion preferences remove motion while retaining immediate state feedback.
