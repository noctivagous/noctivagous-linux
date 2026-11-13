# NCTGraphite Studio

NCTGraphite Studio is an early tree-based app builder. It consumes the public
`@nct/nctgraphite` API and uses NCTGraphite layout components for the live
preview. Run `npm install` from the repository root, then
`npm run dev --workspace @nct/nctgraphite-studio`. Use
`npm run build --workspace @nct/nctgraphite-studio` to type-check and build,
and `npm run test --workspace @nct/nctgraphite-studio` to run the layout tests.

Select a container in the tree or preview, then add components from the palette.
Edit the selected label in the inspector. Use New, Open, Save, and Save As to
work with versioned project folders (`nctgraphite.project.json` plus
`views/*.nctgraphite.xml`); on hosts without folder access, Open and Save fall
back to project-bundle export and import. Single-file JSON and XML export
remain for sharing one layout. Compact and comfortable preview densities
are independent of the Studio interface. Selecting a leaf before adding a
component adds it to the root. Deleting a container also deletes its children.

Application logic, agent integration, and the app preview/export workflows
still need to be built. The project-folder format is specified in
[PROJECT-FORMAT.md](PROJECT-FORMAT.md). Implementation priorities are in
[TASKS.md](TASKS.md).

## Reference inventory and next library gaps

- Grid Systems Lab: vertical and horizontal stacks, wrapping flow, grid,
  overlay/Z-stack, baseline layout, and print-oriented column and margin guides.
  Stack and grid exist; stack supports wrapping. Overlay and baseline alignment are available; baseline grids and print guides
  still need reusable APIs. See [LAYOUT-AUDIT.md](LAYOUT-AUDIT.md).
- Proshade GUI Builder: buttons, icon buttons, segmented controls, sliders,
  knobs, toggles, text fields, text areas, checkboxes, panels, tabs, toolbars,
  lists, image wells, separators, progress indicators, and collapsible inspector
  sections. Several controls exist, but their lab-specific styles need a
  themeable, density-aware treatment. Accordion is now available in the library.
- Pro Audio Control Lab: faders, rotary and bipolar knobs, dual ranges,
  switches, button matrices, meters and displays. These require accessible,
  keyboard-operable shared controls and domain-appropriate value semantics.

The palette deliberately exposes only the implemented tree types. Future
components should be introduced with reusable APIs and metadata, and validated
in the Studio and other real applications.
