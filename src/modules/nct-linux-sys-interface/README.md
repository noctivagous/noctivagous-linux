# nct-linux-sys-interface

The bridge to the Linux system — the sole channel between the desktop and everything underneath it.

Owns:
- subscriptions to systemd, the journal, logind, UPower, NetworkManager, udisks2, BlueZ, bolt, PackageKit, fwupd (subscribe, don't poll)
- one live system object tree that panels and centres render as views
- privileged actions, performed by the daemon half under polkit — the shell's say-so is never enough

Hosting / language: Split: daemon half as a system/user service (service stack, bridge pattern); thin GDScript client in the shell.

Status: SLICE A BUILT (2026-11-26, agent-build-log/19) —
system_tree.py (the live object tree), sources.py (fixture
source + the Gio/GDBus systemd source, which reports its
availability honestly), sys_interface.py (the bridge: ingest,
desktop-terms republication, failed-unit derivation), the
fixture feed, and the Services/Logs NCTXML views with their
render harness. Proven against the fixture feed; a live
systemd is a rig proof, owed. Plan:
src/plans/SYSTEM-INTERFACE.md §1, §6.

BREADTH (2026-11-26, agent-build-log/24): the crashes domain
(systemd-coredump) joins the tree at /crashes/<id> and is
republished on the bus in the exact shape nct-system-watch
consumes — the bridge is the crash feed now. A third view
(views/crashes-pane.nctxml) renders the domain from a snapshot.
CoredumpSource reports its availability honestly (coredumpctl).
Remaining domains per §1: session/power, network, devices,
packages, firmware, authority.
