# NCTGraphite Studio tasks

## First priority: NCTGraphite layout widgets for Studio

- [x] Audit the Studio interface and all three reference artifacts against the existing NCTGraphite layout widgets; record missing capabilities and required component APIs in LAYOUT-AUDIT.md.
- [x] Complete the shared stack and grid widgets for Studio's compact, responsive layouts, including sizing, spacing, alignment, wrapping, and grid tracks.
- [x] Finish layout primitives and validation: overlay, absolute scenes, text columns and per-item placement are available; baseline grids and responsive variants remain.
- [x] Complete reusable compositional widgets needed by Studio, including controlled accordions, themeable panels and wells, resizable splitters, and app shell regions.
- [x] Add saved layout modules to Studio, including definition, registration, editing, and instantiation.
- [x] Make layout and compositional widgets themeable and support both compact and comfortable density without imposing Studio's appearance on other apps.
- [x] Build the Studio interface using the public NCTGraphite layout and compositional widgets; address library gaps at their source.
- [x] Test widget behavior, accessibility, responsive layouts, and composition in Studio and other real NCTGraphite applications.
- [x] Evaluate reusable print layout guides for columns, gutters, and margins against the Grid Systems Lab reference.

## App projects and persistence

See [PROJECT-FORMAT.md](PROJECT-FORMAT.md) for the proposed project model.

- [x] Specify and version the project manifest and folder structure, including app logic, assets, themes, and entry points.
- [x] Implement new, open, save, and save-as operations with a storage abstraction for supported hosts.
- [x] Track unsaved changes, provide recovery, and detect external file conflicts.
- [x] Validate projects and implement explicit, non-destructive format migrations; reject unsupported newer versions safely.
- [x] Import the early Studio JSON format into the project model.
- [ ] Define an integration path for existing React apps that preserves files Studio does not understand.
- [x] Test project round trips, migrations, recovery, and conflict handling.

## Builder foundation

- [x] Define a shared NCTGraphite document model and XML format for layout trees.
- [x] Build the XML parser, validator, serializer, and React renderer.
- [x] Generate the component catalog from library metadata and use it in the palette and inspector.
- [x] Add tree reordering, reparenting, duplication, and undo/redo.
- [x] Edit layout properties, including spacing, alignment, sizing, wrapping, and grid tracks.
- [x] Add responsive layout editing and preview sizes.
- [x] Migrate early Studio JSON projects to the shared document format.

## Controls

- [x] Make shared controls themeable and support compact and comfortable densities.
- [x] Add the missing Proshade controls: fields, text areas, checkboxes, tabs, lists, image wells, separators, and progress indicators.
- [x] Add accessible audio controls, including rotary knobs, faders, dual ranges, meters, and displays.
- [x] Validate controls in Studio and other real NCTGraphite applications.

## App building

- [x] Define safe state, binding, command, and app-logic models.
- [x] Add editing and inspection for app logic and bindings.
- [x] Design an AI agent integration that can inspect and modify app documents, such as tool calls.
- [x] Add app preview and export workflows.
- [x] Make the Studio itself themeable using NCTGraphite.

## Quality

- [ ] Add tests for document operations, validation, and persistence.
- [ ] Test keyboard navigation and accessibility across the builder and controls.
- [ ] Verify responsive behavior and visual layout in the browser.

## Proshade builder gaps

Compared with `web-artifacts/Proshade+Gui+Builder+Late/App.tsx`, Studio has a
palette, tree operations, inspector, and preview, but it does not yet provide
Proshade's direct canvas-editing workflow. Keep structural stack/grid layouts
as the default; use coordinate-based manipulation within scene layouts. The
reference includes some illustrative controls, so implement and test their
intended behavior rather than assuming every reference control is functional.

### Canvas editing

- [x] Drag palette items onto a canvas, show a drag preview and a valid drop target, and insert them at the appropriate tree position or into a scene at the drop coordinates; retain a keyboard-accessible insertion path.
- [x] Select and hover objects directly on the canvas with clear bounds and handles, including nested containers, without changing their layout or blocking control interactions in preview mode.
- [x] Move and resize scene items with pointer handles, parent-relative coordinates, zoom-corrected pointer movement, minimum dimensions, and one undo step per gesture.
- [x] Support canvas-based nesting and reparenting with correct coordinates, prevent invalid parent/child relationships and cycles, and retain tree-based alternatives for stack and grid layouts.
- [x] Add canvas zoom controls, percentage readout, fit/reset, and scrolling or panning; keep selection and pointer operations accurate at each zoom. Zoom scales the app window with CSS transforms.
- [x] Add independent grid visibility and snapping controls, configurable spacing, visible guides, and predictable snapping during placement, movement, and resize.
- [x] Add keyboard delete and duplicate shortcuts, focus-safe handling for text inputs, and accessible alternatives for moving and resizing.
- [x] Drag the app window around a large pannable workspace by its header (design mode); pan by dragging the background; workspace position persists across reload.
- [x] Drive the workspace dotted background from the grid spacing/visibility settings.

### Device layouts and inspector

- [x] Provide desktop, tablet, and phone preview presets with actual viewport dimensions, device frames, and a clear active-device indicator; keep fluid and custom-size previews.
- [x] Define shared versus per-device or breakpoint-specific layouts, persist overrides, show which properties are overridden, and allow reverting to inherited values.
- [x] Add a geometry inspector for scene-item position and size with units, validation, and two-way synchronization with canvas manipulation.
- [ ] Implement editable edge constraints/pinning and resizing behavior across viewport sizes, with clear inherited and overridden states; Proshade's pinning controls are illustrative.
- [x] Provide an appearance inspector for the supported widget properties: shared opacity and corner-radius props on sixteen widgets with theme-aware token defaults, editable in the inspector and passed through preview, XML, and the catalog.
- [x] Expand the layers/tree panel with hierarchy, selection, ordering, useful dimensions and object counts; add functional visibility and locking if supported by the document model.
- [x] Store an app-level appearance theme (light/dark/lab) on the document with XML round-trip and an App settings selector; Studio chrome is unaffected.
- [x] Render wireframe and outline modes with unthemed controls via the render-mode switch (editor bar + View menu); the mode persists across reload.
- [x] Remember open panels, device, zoom, grid prefs, AI chat state, workspace position, and render mode across reload.

### Components and workspace

- [x] Close palette gaps for Proshade's slider, toggle, segmented control, icon button, panel/container, and toolbar strip; expose existing library widgets through the document catalog, inspector, and renderer where appropriate.
- [x] Complete property editing and preview behavior for Proshade controls, including tab and list contents, selected values, field placeholders, button styles, and image wells.
- [x] Organize the workspace around a compact palette, canvas, layers and inspector with readable type hierarchy; keep the layout and density themeable instead of imposing the Proshade style on built apps.
- [x] Add a useful canvas status/selection readout and an export inspection flow showing the actual serialized layout; keep runnable app export as a separate task.
- [x] Provide an NCTGraphiteWindow widget (title bar, resizable property with corner handle, edge docking) across the document model, XML, catalog, renderer, palette, and inspector.
- [x] Play the app with live commands (the calculator computes); AI menu with placeholder chat hosted in an NCTGraphiteWindow.
- [x] Style all Studio chrome buttons (Play, module save, edit, remove) with the Studio idiom; app widgets stay on the app theme and wireframe/outline modes.
- [x] Give device presets, palette categories, inspector sections, and toolbar buttons control-like icons.
- [ ] Test the end-to-end workflows: drag, nest, select, edit, resize, undo, device overrides, save/reopen, and keyboard alternatives. Verify visual fidelity and usability separately when browser testing is authorized.

## Follow-up from builder review

- [ ] Implement a runnable app export using the shared renderer, logic runtime, and required assets; the current export button is disabled until this exists.
- [ ] Make design selection wrappers preserve grid-item placement, scene coordinates, overlay layers, and flex sizing; compare Studio preview against the shared renderer.
- [ ] Complete preview interaction for unbound controlled controls, dual ranges, and image wells; support editing typed state defaults and validate binding types and command targets.
- [ ] Include logic edits in undo/redo and handle orphaned bindings when nodes are deleted or duplicated.
- [ ] Support multiple responsive breakpoints and container-based preview widths in both Studio and the runtime renderer; replace the current fixed 768px wide breakpoint.
- [ ] Make project writes transactional or recoverable on I/O failure, and strengthen revision detection beyond file modification time and size.
- [ ] Avoid recursively loading generated directories and large dependencies when opening a project; preserve unknown files and binary assets without requiring them all in memory.
- [ ] Validate project paths and bundle versions, and reject malformed data without silently dropping manifest or logic fields.
- [ ] Add interaction tests covering preview bindings, recovery, Save As, modules, keyboard use, and responsive behavior; visually verify in a browser when requested.

## User workflow and code review follow-up

- [ ] Offer an empty project and selectable starter templates; the current New action always creates the calculator example.
- [ ] Replace Studio's hard-coded calculator command handling with an app-owned, safe logic runtime so unrelated apps can define and run their own commands.
- [ ] Connect the AI chat to an authorized agent and project-editing tools, show proposed changes and errors, and allow the user to review or undo applied edits; the current chat is a placeholder.
- [ ] Provide a complete project-to-running-app workflow, including preview/runtime parity, assets, dependencies, and a runnable export; clearly explain unavailable capabilities in the UI.
- [ ] Validate direct scene manipulation at different zoom levels, nested scene offsets, CSS-unit geometry, responsive overrides, pointer cancellation, and keyboard operation; preserve intended anchors and dimensions.
- [ ] Complete scene drop and reparent workflows for every drop zone, including moving items between nested scenes and preserving or deliberately converting coordinates and breakpoint overrides.
- [ ] Resolve selection and editing rules for locked or hidden descendants, and make all delete, move, duplicate, and drag paths enforce the same rules.
- [ ] Make the advertised device previews provide accurate dimensions and responsive behavior, including runtime scene overrides, nested layouts, and accessible custom viewport sizes.
- [ ] Add accessible control-state editing, including typed state defaults, boolean preview inputs, useful binding validation, and clear feedback when an action cannot be performed.
- [ ] Make save, open, import, recovery, and Save As workflows resilient to cancellation, permission failures, external changes, and multi-file write failures; test with real storage providers.
- [ ] Preserve unknown manifest and logic data without silently dropping it, validate supported versions and project-relative paths throughout every import and save path, and test migration compatibility.
- [ ] Break the remaining large Studio app component into focused workspace, project-session, inspector, and logic-editor components or hooks without changing document behavior.
- [ ] Add automated interaction and accessibility tests for canvas gestures, keyboard shortcuts, menus, project lifecycle, modules, and preview state; verify the visual workflow when browser testing is authorized.
