# 01 — Architecture and rig decisions (2026-11-25)

**Asked:** plan the foundation of the real desktop environment:
Godot-based, hosting external programs, organised by a neat filetree
with consistent conventions; build in Muse up to the point needing
a local VM; the owner has a spare Windows machine with Muse Code
and can install VirtualBox there.

**Decided (owner, 'rec' — all recommendations accepted):**
- Layout: layered src/ (core / godot / ext-fwks / services /
  keyclicks) + src/system/ installed overlay + src/distro/ + src/vm/.
  A flat src/ was explicitly rejected.
- ARCHITECTURE.md and CONVENTIONS.md live in src/ (owner's placement).
- Rig: Vagrant + VBoxManage + SSH (NAT 2222→22) as the control spine
  on the Windows box; the VirtualBox MCP server only as a possible
  later add-on, vetted first.
- First slice: the smallest end-to-end spine — greeter → login →
  session → pre-set programs launch (Firefox, a Qt app, one own app).
  Prove the whole chain; reach no particular desktop feature, because
  the desktop itself is still being designed in demo-de.
- The owner added: build as long as needed to get it running here,
  then they take it in Muse Code — with a test bed it can run
  and debug against. Guesses are allowed if they are labelled and
  checkable (that became CONVENTIONS.md §11 and ASSUMPTIONS.md).

**Evidence:** the decisions are recorded in MEMORY and in the commit
messages of 5347b97. Research grounding (VBoxManage's full CLI,
headless + SSH pattern, the MCP server's existence and limits) is in
the conversation of 2026-11-25 and summarised in VM-RIG.md.
