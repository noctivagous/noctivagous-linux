# Layout coverage matrix

This matrix maps the requested layout families and the three reference
artifacts to public NCTGraphite APIs. “Available” means there is an API for the
basic scenario; it does not claim every editor feature, theme, interaction, or
responsive variation is finished. See TASKS.md for follow-up work.

| Scenario | NCTGraphite API | Status and limits |
| --- | --- | --- |
| Vertical and horizontal flow, spacing, alignment, wrapping | `NCTGraphiteStack` | Available; baseline alignment and CSS sizing via `style`. Responsive variants need host composition or CSS. |
| Flex growth, shrinkage and basis for individual children | `NCTGraphiteLayoutItem` inside `NCTGraphiteStack` | Available; children are wrapped in a layout item. |
| Rows, columns, gutters, implicit tracks and item placement | `NCTGraphiteGrid` and `NCTGraphiteLayoutItem` | Available, including named areas and one viewport breakpoint. More breakpoints and container queries remain. |
| Flowing text through print-style columns | `NCTGraphiteColumns` | Available using CSS multicolumn; print guides and baseline-grid snapping are separate unfinished work. |
| Overlap with natural content sizing | `NCTGraphiteOverlay` | Available; layers participate in grid sizing, in document paint order. |
| Absolute coordinates and anchored edges | `NCTGraphiteScene` and `NCTGraphiteSceneItem` | Available; the scene needs an explicit size or in-flow content. Dragging, resizing and device-specific overrides are not yet editor features. |
| Compound layouts and nested regions | Nest stacks, grids, scenes, panels and accordions; `NCTGraphiteLayoutShell` composes header, body and footer | Basic composition available. A resizable splitter and a fully themeable panel/well system are missing. |
| Reusable layout modules | Compose reusable React components from public NCTGraphite APIs | Available in code. Studio cannot yet define, register, edit, or instantiate saved modules. |
| Compact vs comfortable applications | CSS variables, component props and host styles | Partial. Studio's preview changes density; a shared density and theme contract is still needed. |
| Responsive shell and sidebars | `NCTGraphiteLayoutShell`, `NCTGraphiteGrid`, existing `NCTGraphiteAppShell` and `NCTGraphiteStage` | Basic viewport breakpoint available. Existing shell/stage variants include lab-specific assumptions; a general responsive and resizable shell needs validation. |
| Collapsible inspector and toolbar | `NCTGraphiteAccordion`, `NCTGraphiteToolbar` | Basic native disclosure and toolbar grouping available. Controlled accordion state and coordinated groups remain. |
| Baseline rhythm across a document | Stack baseline alignment, `NCTGraphiteBaseline` | Available: the guide paints per-line rules and layers in `NCTGraphiteOverlay`. Magnetic snapping stays host/editor behavior; typography controls remain. |
| Print grid guides, marginalia and page constraints | Grid plus host styling, `NCTGraphiteColumnGuides` | Partial. Column/gutter guides available with a documented print-page recipe (`components/README.md`); the marginalia rail is a grid track in that recipe. Print pagination and page constraints still need dedicated design. |
| Audio fader banks and button matrices | Stack and grid for arrangement | Layout available; specialized controls and accessible interactions remain separate work. |

## Reference mapping

- **Grid Systems Lab Print:** stacks, wrapping flow, grid, overlay, flowing
  columns, baseline rules and column/gutter guides have primitives plus a
  print-page recipe. Marginalia is a grid track in that recipe; pagination and
  page constraints are still open.
- **Proshade GUI Builder:** nested shell, scene, grid, stacks and accordion
  cover the principal arrangement patterns. Interactive editor operations,
  splitters, device overrides and many controls remain open.
- **Pro Audio Control Lab:** stacks and grids cover basic control arrangements;
  faders, knobs, meters and their interaction semantics remain open.

The primitives are intentionally unstyled or accept host styling, so the same
layout does not force Studio's compact appearance on other applications. Static
render tests exercise the basic contracts; browser, keyboard, real application,
and multi-viewport verification are still needed before declaring coverage
complete.
