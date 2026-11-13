# GIT-SUBMODULE-INSTRUCTIONS.md

NCTGraphite is consumed as a **git submodule** (currently inside
`grid-paint-labs/` at `grid-paint-labs/NCTGraphite/`). The superproject does
not contain library code — it records a single commit SHA (a gitlink) pointing
at this repository. That split dictates the order of every commit and pull.

## Push order: submodule first, then the consuming project

1. Inside the submodule checkout (`grid-paint-labs/NCTGraphite/`):
   `git add` the library files, commit, push. The submodule commit must be
   public first.
2. Then in the consuming project (`grid-paint-labs/`): commit the gitlink
   change (the new submodule SHA) and push.

Reversing this order points the superproject at a submodule commit nobody
else can fetch, and every fresh clone breaks.

With two changed layers, that is two `git add -u` + commit pairs per change,
submodule first.

## Pull order: project first, then the submodule

1. In the consuming project: pull.
2. Then `git submodule update --init --recursive` to move the checked-out
   `NCTGraphite/` to the SHA the superproject records.

Pulling the submodule directly to its newest commit without updating the
superproject leaves the two out of agreement; the next superproject commit
should then record the SHA you actually tested against.

## Which checkout to edit

The standalone `NCTGraphite/` checkout and the `grid-paint-labs/NCTGraphite/`
submodule checkout are separate clones. Changes only ship to consumers from
the submodule copy — make (or sync) edits there first.
