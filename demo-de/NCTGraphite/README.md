# NCTGraphite

NCTGraphite is to be a shared React component library, tag language, and GUI-builder
home for NCT web applications.

## Editorial Section

Software development and programming involved planning the code base and
utilizing existing frameworks, most often provided by the operating system
vendor, so that the same resources weren't unnecessarily remade.  It was
necessity or at least minimum efficiency.  Without trying, it amounted to
schematics for the code base for a person to follow.  Now with AI, the models
are not instructed to follow or generate such schematics for the code bases first, nor
do they need to make use of established software frameworks.  They're generating heaps 
of custom code for applications, writing buttons and window code from scratch for
each application, in a different way custom for that app, and it is producing an
unrecognized mess.  A causal factor is that there is little overlap between
application software developers and the field of AI, so the AI companies don't know 
see the seriousness of this and they don't know how to deal with it except make bigger 
and more advanced models that sort through code even more strongly.

What we're seeing are a lot of novice software development mistakes like this
made at an advanced level of code generation by AI companies with advanced
research.  Even if the AI generates the code, the code still needs to follow a
blueprint or a plan.  It should have schematics, and be normal, not just
accomplish the thing by spinning custom code for every project.  That it
doesn't, and people are not trying to adhere to this, is what results in "slop."
 In a lot of ways there is a mentality at the AI companies that they can throw
out all of the old practices and rules of software development, focus on the
models exclusively, and run forward with results as the measurement of success
rather than how it is made being seen as important too.  However, this has been
a problem in the web development community too, for a decade and a half, with
the embrace of JavaScript for computer programs, a programming language that
doesn't have typed variables.  The web programming makes up the majority of
activity and so these problems won't be discussed.  

A software engineer with genuine standards from the past will have a problem
with TypeScript's features never being officially incorporated into JavaScript
and TypeScript always being made out of JavaScript and widely adopted.  It's
unnecessary to do that and it is a standard that shouldn't be crossed for very
long.  TypeScript would be a temporary fix before people all agree that its
features are put into JavaScript.  Never would it be acceptable that TypeScript
comes out with new versions incompatible with the past and other things that
lack standards.  None of this is controversial to someone who wrote apps in 2011
and earlier.  The growing mess is self-evident.


## Purpose

When web applications, including React JS applications, are made with AI
assistance, the AI builds custom UI code from scratch each time without referencing a
stable framework. The resulting GUI and code are idiomatic, for each application,
which is chaotic and inefficient. It is costly in many ways. Later changes force the AI to excavate that
application's own conventions instead of working within a familiar software
framework structure that has references and practices. An experimental 
`noct-code-appkit` project began as an answer to this problem, but it never became 
a stable framework.

NCTGraphite is the stable-framework followup that will combine its efforts and
XML-driven app files from other projects into a single location. Its goal is to
give AI-assisted development a reusable vocabulary of components, layouts, themes, bindings, and XML
documents.  In the process, it may be the case that the AI constructs apps more
rapidly since the underlying components are modular and AI-first.  
Generation starts from that framework rather than from a blank page,
and later changes stay inside it as well.

NCTGraphite exists so that `nct-project-manager`, `nibglider`, noctappcode, and
future NCT applications stop paying this from-scratch UI cost on every project. Common layout
primitives, controls, themes, bindings, and XML documents will live here once.
The NCTGraphite framework will be made by having Noctivagous projects, web applications 
and contribute generally useful additions back through the same repository while
they are built out.

## Goal

The goal is a complete NCTGraphite app kit for mobile and desktop applications:

- A coherent set of GUI components.
- Underlying layout components comparable to layout primitives such as
  StackPanel (Windows WPF).
- AI-ready XML tag-based logic components for application behavior, usable
  consistently across applications.
- A tag language in the tradition of MXML, FXML, XAML, and XUL, so most of an
  app can be expressed declaratively in tags.
- A GUI builder studio that is maintained alongside changes.
- Documents that NCTGraphite Studio and AI-assisted workflows can read, check,
  generate, edit, and round-trip through a visual builder.
- A kit that grows contextually while real applications are being built, rather
  than as an isolated speculative framework.
- Future: Studio-resident AI assistance capable of rearranging GUI designs directly by
  swapping validated NCTGraphite tags.
  


Every public tag is an `NCTGraphite…` component in both JSX and XML. The same
component vocabulary therefore works for hand-written code, generated code, XML
documents, validation, builder editing, and runtime rendering.

### Component levels

NCTGraphite will have different component levels, built in order.

The first level is individual reusable components: GUI controls, layout
primitives, themes, bindings, and AI-ready XML tag-based logic components.
These are the stable vocabulary used consistently across applications, so AI
and developers can piece applications together quickly.

A later level—not the first stage—is common application subkits, setups, and
scenarios. Examples include Preferences, Settings, login and authentication,
application shells, and a generic dashboard or data monitor. Whereas frameworks
such as XAML or XUL primarily supply individual components, these NCTGraphite
subkits would preassemble GUI controls, logic components, data models, and
controllers for recurring scenarios. Applications would then snap together
more easily from finished scenarios, rather than assembling every behavior
from individual parts.

Subkits should be built only after the first-level vocabulary, bindings,
settings flow, and validation are stable. They remain subject to the same
rule: enter NCTGraphite when real applications need them, not as speculative
framework work.

## Benefits

NCTGraphite is intended to make applications:

- Faster to build by reusing proven UI instead of regenerating custom screens.
- More consistent across applications and screens.
- More themeable through shared tokens rather than scattered styles.
- Easier to adjust after creation, because UI is structured XML and metadata,
  not an opaque hodgepodge of one-off code.
- Easier to change directly in NCTGraphite Studio, so routine GUI revisions do
  not all have to travel through text prompts.
- More accessible to AI-assisted construction, because generation assembles a
  closed, validated NCTGraphite tag vocabulary instead of inventing new markup.
- Faster to piece together when XML tag-based logic components are AI-ready and
  used consistently across applications.
- More predictable to modify by prompt when prompts are still appropriate,
  because the AI works within the same framework structure rather than digging
  through application-specific conventions.
- Better suited to both mobile and desktop through shared layout primitives,
  density handling, and theme tokens.

The project name is always shown in full as NCTGraphite. Library packages,
components, hooks, providers, themes, files, and XML tags all carry the full
`NCTGraphite` prefix. The shortened suffix form is never used on its own.

## AI-assisted development and codebase traversal

NCTGraphite is designed so AI agents can navigate it by contract and query,
rather than by reading the entire repository.

The human-authored surface stays small: predictable names and locations, typed
props, a short purpose statement, metadata, and examples. Broader maps are
generated from those sources: the component registry, tag catalog, dependency
direction, valid bindings, validation rules, and executable examples. Generated
material must be fresh enough to trust, so stale generated artifacts should
fail CI rather than silently drift.

Agents should use progressive disclosure:

- Query one component, binding, error, or dependent when it is needed.
- Do not load the whole catalog, architecture, or history by default.
- Prefer validation feedback and specific errors over exhaustive prior reading.
- Keep framework knowledge in tools and generated contracts, not in long
  mandatory documentation that every agent must internalize.

The repository therefore favors compact generated contracts, structured
queries, deterministic validation, and stable names over verbose per-component
essays or duplicated schemas.

## What lives here

Planned repository layout:

```text
NCTGraphite/
  packages/
    nctgraphite/
      src/
        components/
        theme/
        xml/
        bindings/
      package.json
  apps/
    NCTGraphiteStudio/
  examples/
```

- `packages/nctgraphite/` is the distributable React library:
  layout primitives, controls, themes, XML parsing/validation, bindings,
  scopes, and the `NCTGraphiteView` renderer.
- `apps/NCTGraphiteStudio/` is the GUI builder. It consumes the published-style
  library API exactly like an external application would.
- `examples/` holds minimal integration examples for each consuming application.

Representative tags include `NCTGraphiteStack`, `NCTGraphiteField`,
`NCTGraphiteView`, and `NCTGraphiteScope`.

## How applications use it

Each consuming application includes the complete NCTGraphite Git repository as
a git submodule, normally at:

```text
<application>/NCTGraphite/
```

The application then depends on the library through an npm workspace path rather
than a downloaded package. That workspace configuration belongs in the consuming
application's `package.json`, not in this repository:

```json
{
  "workspaces": [
    "NCTGraphite"
  ],
  "dependencies": {
    "@nct/nctgraphite": "*"
  }
}
```

During installation, npm creates the normal workspace symlink automatically:

```text
<application>/node_modules/@nct/nctgraphite
  -> <application>/NCTGraphite/packages/nctgraphite
```

The checked-out `<application>/NCTGraphite/` submodule itself is a real Git
repository checkout, not a symlink. Do not replace it with a hand-made
filesystem symlink, and do not hand-create links inside `node_modules`; the
only supported symlink is the one npm generates from the workspace dependency.

Applications therefore import NCTGraphite as ordinary source code:

```tsx
import {
  NCTGraphiteStack,
  NCTGraphitePanel,
  NCTGraphiteField
} from "@nct/nctgraphite";
```

XML documents resolve those same components through `NCTGraphiteView`:

```tsx
import { NCTGraphiteView } from "@nct/nctgraphite";

return (
  <NCTGraphiteView
    document={settingsDocument}
    scope={settingsScope}
  />
);
```

Do not hand-create symlinks inside `node_modules`. The workspace dependency is
the supported symlink mechanism. A manually linked package can behave
differently from a clean install and is harder for other developers and CI to
reproduce.

## How NCTGraphite is built up

NCTGraphite grows contextually from real application work:

1. Build a feature in a consuming application.
2. When a UI element proves generally useful — ideally when a second project
   needs it, or its roadmap already names the same need — extract or redesign
   it as an `NCTGraphite…` component.
3. Add its metadata, theme tokens, tests, XML validation rules, and examples.
4. Commit and push that library change in the NCTGraphite repository.
5. Update the consuming application to the new NCTGraphite submodule commit
   and remove the application-local duplicate.
6. Let every other application upgrade on its own schedule by moving its own
   submodule pointer forward.

The consuming application records an exact NCTGraphite commit. One application's
library upgrade therefore cannot silently change another application's UI.

Normal local workflow:

```bash
git clone --recurse-submodules <application-repo>
npm install
npm run dev
```

After changing the checked-out `NCTGraphite` submodule, verify the library
itself, commit the library change, then commit the application with the updated
submodule pointer.

This also applies when the library is edited from inside a consuming checkout,
such as `nibglider/NCTGraphite/`: commit and push the nested NCTGraphite
repository first, then commit the outer application repository to record the
updated submodule pointer. A commit in the outer application alone records the
pointer, not the library file changes.

## Contribution rules

- A component enters NCTGraphite when two applications need it, or when one
  application needs it now and another application's roadmap already names the
  same need. Application-specific UI stays in its application.
- New components must use NCTGraphite design tokens and metadata.
- Public names must retain the complete `NCTGraphite` prefix.
- Application domain types, drawing-engine types, and task-domain types do not
  belong in the library. Hosts adapt through `NCTGraphiteBindingScope`.
- Changes should update tests, generated catalog entries, XML validation, and
  the affected application call sites.

## Status

This repository is being established as the Phase 0 unification target:
shared theme, layout primitives, duplicated controls, settings-window patterns,
then the XML and binding core, followed by selective mining of the older
experimental NoctCode components.
