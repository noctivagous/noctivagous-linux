# Host — Computer Use Mode

Status: PLACEHOLDER — definition reserved, design pass owed.
Research basis: research/diy-self-hosting-audience/ in this
repo (2026-11-26).

What it means: this machine serves other machines and
people — reliably, while nobody is sitting at it. Two roles,
kept distinct: a machine IN Host mode is the server; a
Workstation machine may act as the CONSOLE for a host on
another machine at home without itself changing mode.

Bundle sketch (each line is implemented by the module named):
- power: never sleeps; screen off, services on; lid-close
  keeps serving; Wake-on-LAN where the hardware allows
- session: services survive logout, lock and shell crash —
  and that fact is shown, per service
- network: stable name / address on the LAN; shares and
  services advertised (e.g. jellyfin.local)
- security: every service LAN-only by default; making one
  internet-facing is an explicit per-service ASK, and one
  "What's exposed?" screen lists every public port, tunnel
  and share
- updates (package-coordinator): notify only; reboot in a
  chosen window; snapshot before update
- notifications: service health and Issues rise to the top

Stored as: modes.computer-use = host
