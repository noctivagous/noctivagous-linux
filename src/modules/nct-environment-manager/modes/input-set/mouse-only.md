# Mouse Only — Input Set

Status: PLACEHOLDER — definition reserved, design pass owed.

What it declares: a pointing device is present and NO
keyboard may be assumed. Everything must be reachable by
pointing: no keyboard shortcuts as the only path to any
function, and text entry goes through the on-screen
keyboard. This is also an accessibility configuration, not
only a hardware one — nct-accessibility-manager carries a
slice of it.

Constraint: only the Conventional modality is available
under this set — there is no keyboard to be bimodal with.

Stored as: modes.input-set = mouse-only
