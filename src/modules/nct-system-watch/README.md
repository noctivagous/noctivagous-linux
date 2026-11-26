# nct-system-watch

What the system is telling us — failures triaged into standing Issues, each with a way out.

Owns:
- triage of failed units, crashes (coredump), disk health, DKMS / driver state
- the Attention inbox: Issues are standing, never toast-only, never suppressed after one showing
- every Issue carries a Fix wizard, a fix link, or a Report bundle

Hosting / language: Service outside Godot — it must survive the shell failing, so it cannot live in the shell.

Status: SLICE B BUILT (2026-11-26, agent-build-log/20) —
system_watch.py: triage of failed units and coredumps into
standing Issues (dedupe by cause, living journal-slice
evidence, Fix/Open/Report actions, severity-ordered Attention
inbox, JSON persistence, dismissal with reason). Later sources
(SMART, DKMS, firmware) join the same feed. Plan:
src/plans/SYSTEM-INTERFACE.md §3, §6.

BREADTH (2026-11-26, agent-build-log/24): crash Issues now
arrive from the bridge's crashes domain (the hand-fed event
shape is retired), and the Attention inbox has its surface:
inbox_contexts() publishes the bar text and per-Issue contexts;
views/attention-bar.nctxml (a shell-kind bar item, seated in
the Top layer) and views/attention-pane.nctxml render them.
inbox_snapshot.py is the seam: bridge fixtures -> watch ->
contexts JSON -> shell rendering.
