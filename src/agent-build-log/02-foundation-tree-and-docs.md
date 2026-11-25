# 02 — The src/ tree and its documents (2026-11-25)

**Done:** created the src/ tree in a dedicated worktree
(~/workspace/noctivagous-linux-foundation, branch feat/foundation-src,
cut from origin/main 42a6887) and wrote:
- ARCHITECTURE.md — layers, the hosting rule, the chain piece by
  piece, the three test tiers, what is deliberately absent.
- CONVENTIONS.md — 13 rules: src-authored vs system-landed, one
  directory per subsystem with a README stating its layer, four-file
  rule for libraries/resources, pins not binaries, one list one
  launcher, guesses labelled, one entry point per test tier.
- foundation-overview.html — the three kinds of work (core / Godot
  system layer / distro plumbing), the tree, the chain, the tiers,
  as one readable page.
- VM-RIG.md — the rig as a living file (setup, agent workflow,
  verified facts, log).
- A README.md in every subsystem directory stating what it is, its
  marker (NCT-WL-* / NCT-LIB-EXT-*), and who may depend on it.

**Not done:** the kit beyond tokens.json; keyclicks beyond a README
recording the rules its port must keep; ext-core-utils is an empty,
deliberate slot.
