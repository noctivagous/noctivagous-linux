# Workstation — Computer Use Mode (default)

Status: PLACEHOLDER — definition reserved, design pass owed.

What it means: a person sits at this machine and works.
The normal desktop; every other Computer Use Mode value is
understood as a set of changes from this one.

Bundle sketch (each line is implemented by the module named):
- session: normal login, lock and logout
- power: sleeps when idle; energy saver + battery behaviour
- network: a client — connects out, advertises nothing
- window: normal windows and workspaces
- notifications: personal, full
- updates (package-coordinator): prompt; install when
  convenient

Stored as: modes.computer-use = workstation
