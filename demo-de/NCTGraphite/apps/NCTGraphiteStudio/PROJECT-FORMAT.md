# App projects: save and open design

This is a proposed direction, not an implemented file format. NCTGraphite Studio
is an app builder: a project needs to contain app logic, assets, and configuration
as well as UI layouts.

## Project structure

Use a project folder whose source files are authoritative. Studio and an AI
agent can inspect and edit those files; the app can also be built outside Studio.
A possible structure is:

```text
MyApp/
  nctgraphite.project.json   # project identity, format version, entry points, dependencies
  views/                     # NCTGraphite XML layouts
  logic/                     # state, commands, bindings, and app code
  assets/
  themes/
```

The v1 manifest schema is implemented in `src/project.ts`: `nctgraphite.project.json`
with format `"nctgraphite-project"`, integer `version` (currently `1`), `name`,
`entry` (default `views/main.nctgraphite.xml`), `views`, `themes`, and
`dependencies`. Manifest and layout-XML versions are independent. Preserve
ordinary source files and existing project structure when integrating an
existing application: views Studio does not edit and files it does not
understand round-trip byte-identical. Generated output and caches are not the
source of truth. Secrets should remain outside project files and version control.

## Save and open

- **New** creates a project from a template. **Open** selects a project folder
  and checks its manifest, referenced files, and dependencies before editing.
- **Save** writes changed files to the current project; **Save As** creates an
  independent project copy. Track dirty state and warn before discarding edits.
- Keep undo/redo in the editing session and provide crash recovery separately
  from an intentional save. Avoid overwriting external changes silently: detect
  conflicts and let the user review them.
- Version the manifest and document formats. Validate on load, migrate supported
  older versions explicitly, and preserve the original when migration is needed.
  Report unsupported newer versions without rewriting them.
- Abstract storage from the project model. A local desktop or server host can
  work with folders directly; a browser host needs an appropriate file-access
  capability or an import/export fallback. Do not assume all browsers can write
  directly to an arbitrary folder.
- Git can provide history and collaboration but is optional. Local editing and
  saving must not require a remote account or repository.

## Existing applications

Studio-created projects open through their manifest. Existing React applications
need an explicit integration or import path: discover the app's structure,
identify which files Studio understands, and leave other files intact. Do not
assume arbitrary JSX can be converted into an editable layout tree or safely
round-tripped. An AI agent may help edit ordinary source, with changes visible
and reviewable alongside Studio-managed documents.

## Relationship to current formats

The `*.nctgraphite.xml` dialect describes UI trees and is implemented in
`packages/nctgraphite/src/xml`. The early single-file `.nctgraphite.json`
download remains as an export and import path, alongside the project-bundle
export for hosts without folder access. The existing `.nctgdoc.json` format is
an application document for drawing and layers; it is not the Studio app
project format. Apps built in Studio may use that document format for their
own user data where appropriate.
