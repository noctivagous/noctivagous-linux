# Bimodal+MouseButtons — Interaction Modality (default)

Status: PLACEHOLDER — definition reserved, design pass owed.
The behaviour itself is already the shipped contract: the
desktop uses key-clicks rather than the mouse, but always
backwards-compatible with mouse clicks (src/README.md).

What it divides: the mouse steers the cursor; the keyboard
activates (key-clicks — F clicks at the cursor, D goes
back — with text mode for typing). AND the mouse buttons
also activate, fully: for anyone who never learns
key-clicks, and for foreign apps that expect ordinary
clicks. Neither path emulates the other; key-click
activation dispatches through the same click handlers as a
mouse click, so the two cannot drift.

Requires: Input Set with keyboard and pointer
(keyboard-mouse; a touchscreen variant via the on-screen
board is reserved — see refs/bimodal, the tablet cursor
arrangement).

Stored as: modes.interaction-modality = bimodal-mouse-buttons
