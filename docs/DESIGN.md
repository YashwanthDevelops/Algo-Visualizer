# Interface design notes

## Direction

The playground is a working study tool, so the visual system gives most of the page to the problem and its decisions. A warm charcoal foundation, paper-colored text, muted supporting text, and a single copper accent keep the interface quiet while making actions and selected states easy to find. Panels and controls use a small, consistent 4 px radius and fine neutral dividers. The dashboard features a real pathfinding map and a compact list of the other labs instead of decorative KPI cards.

## Type

IBM Plex Sans is used for prose, controls, and headings. IBM Plex Mono identifies costs, pseudocode, metrics, and other values students inspect during an experiment. Body text starts at 15 px; labels and table copy use 12–13 px; values and algorithms use the monospaced face. Font files are self-hosted under `assets/fonts`, use `font-display: swap`, and include IBM's SIL Open Font License.

## Color and meaning

| Token | Value | Use |
| --- | --- | --- |
| Background | `#171615` | Page background |
| Surface | `#201f1d` | Panels and working areas |
| Raised | `#292725` | Inputs, secondary controls, and open tree nodes |
| Text | `#eeeae3` | Primary copy and board symbols |
| Muted | `#a8a197` | Supporting copy and labels |
| Copper | `#d49a6a` | Primary action, selection, and chart focus |
| Sage | `#a5b6a1` | Successful or ready state |
| Clay | `#cf8f83` | Invalid input and pruning warnings |

Pathfinding cells carry symbols such as `S`, `G`, `×`, `○`, `·`, and `↗`, in addition to their fills. Board marks and candidate outlines likewise distinguish optimization and game states. Sudoku's thicker 3×3 boundaries express its actual rules. Focus outlines remain visible for keyboard users, and reduced-motion preferences remove interface transitions.

Select menus keep native HTML behavior and use the same inset surface, neutral rule, Plex text, and copper focus outline as other controls. A small CSS chevron replaces the platform-dependent arrow; option colors use the same foreground and surface tokens where browser menus permit styling. Long preset names are shortened so the selected value remains visible in the settings rail.

## Layout behavior

The navigation, problem settings, visualization, decision notebook, playback, and results keep their order on every lab screen. At medium widths the decision notebook moves below the visualization. On narrow screens navigation scrolls horizontally, settings reflow, and wide grids or tables scroll inside their own regions. The page does not load external fonts, images, scripts, or stylesheets.
