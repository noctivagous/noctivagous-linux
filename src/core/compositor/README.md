# core/compositor — the compositor slot

Marker: NCT-WL-COMPOSITOR. Layer: NCT-LIB-EXT-CORE.
May depend only on surface-level facts — never on the kit contract.

FOUNDATION STATE: the compositor here is **labwc**, a wlroots-based
stand-in, chosen because it is small, window-based, and packaged in
Debian. It is a binding in the compositor slot, not the NCT compositor:
when the real compositor lands it replaces labwc in this directory and
nothing above this layer changes. Any external compositor considered
for this slot (e.g. Umbriel, audited 2026-11-27) is invisible plumbing
only, under the Noctalia rule in src/POSITIONING.md: nothing visible
or identity-bearing is taken from another desktop project. Automated tests may substitute sway
(NCT_COMPOSITOR=sway) because swaymsg exposes a window tree to assert
against; both are wlroots, and the session scripts treat them alike.
