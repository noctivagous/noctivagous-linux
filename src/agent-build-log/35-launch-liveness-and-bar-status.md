# 35 — Launch liveness: the registry seam fed, relaunch works, the bar shows status

2026-11-27. Branch feat/greeter-look-registry, on f08e0f2.

## The bug (owner-reported, hands-on in the VirtualBox guest)

A Launch Bar button launched its program the FIRST time; after
the program was closed, clicking the button again did nothing.
The owner isolated the pattern; the cause was in our stack, not
the pointer (an earlier QEMU-pointer theory was tested and
withdrawn the same night).

Cause, classed DESIGN + IMPLEMENTATION: the app registry's
`is_running` is bookkeeping — an app enters `_running` at launch
and leaves only through the exit hooks (`mark_process_dead` +
`check_liveness`), which the registry's own docs call "the seam
the session layer will feed". Nothing fed it: nct-launch
detaches and reported no pid, so no component ever learned a
program had exited. The shell's `launch_entry` turned the stale
record into a hard no-op (running → focus existing, never
spawn). First click worked; every later click was dead, whether
the program was open or long closed.

## The fix (the designed seam, fed — not a patch around it)

1. **nct-launch records the spawn**: `<state>/<id>.pid`, two
   lines — the pid and the resolved command. The watcher owns
   staleness from there.
2. **process_watcher.gd** (new, shell project): the session's
   process watcher. Polls once a second; for each
   registered-running app it cross-checks the record: the
   pidfile must belong to the current launch (mtime vs the
   registry's app_launched time, 2s tolerance), the pid must
   exist, and its /proc cmdline must still contain the token
   the recorded command implies (the pid-reuse guard; under
   nct-godot-run the token is the pack's basename, since the
   runner's own name vanishes in the exec). A failed check →
   `mark_process_dead` + `check_liveness()` reaps the app
   (record removed, app_exited announced). A launch younger
   than the 10s grace window is believed while its pid record
   is still being written.
3. **launch_entry revalidates synchronously**: a click on a
   "running" app asks the watcher first; a stale record is
   reaped on the spot and the launch proceeds — no up-to-a-
   second wait after closing a program.
4. **Bar status** (owner's direction: the buttons should show
   what is going on): a 3px strip along each button's bottom
   edge, rendered from the watcher's word — pulsing focus-blue
   while launching, steady primary green while running, gone
   when closed, and a 1.4s fading red flash when a launch never
   comes alive (reaped without ever being confirmed). The bar
   displays the registry's real knowledge, not decoration.

## Three GDScript/procfs facts this slice cost (recorded so they are not re-bought)

- `OS.is_process_running(pid)` only reports on processes the
  engine itself spawned; for the shell's grandchildren (every
  nct-launch program) it returns false and prints a "not a
  child" error. Existence is checked via /proc instead.
- `FileAccess.file_exists` is false for directories — a
  /proc/<pid> existence check needs
  `DirAccess.dir_exists_absolute`.
- /proc files report size 0, so sized reads fail silently:
  `get_buffer` returned a 2-byte fragment ("sh") and
  `get_as_text` returned empty. The cmdline is read byte by
  byte with `get_8()` until EOF. (Also: `"\0"` is not a valid
  GDScript string escape — `String.chr(0)`.)

## Gates

- run-chain **46 passed, 0 failed** — including the new
  "t0 shell liveness relaunch": a `--liveness-test` mode in
  the shell drives the real path (registry + nct-launch +
  watcher) against a sleeper entry supplied via
  NCT_LAUNCH_LIST / NCT_CMD_SLEEPER: launch → confirmed →
  kill → reaped → relaunch confirmed with a NEW pid.
- greeter-ui **8 passed, 0 failed** (unchanged).

## Tier-2 proof (VirtualBox guest, this build's foundation deb)

Foundation deb sha256 `0f59fae63d67704c4bd2f182b5a4312ca7928d6fdb60e94dd9720848cc1051e1`
installed in the nct-test guest; greetd NRestarts=0 after
reboot. The owner's exact pattern, driven by injected keys:

- NCT Hello: launched (pid 1444 recorded; green strip visible
  under its button in the screendump) → Alt+F4 → process gone,
  strip gone → Enter → relaunched, pid 1555, strip back.
- Firefox: launched (pid 1664 recorded) → Alt+F4 → process
  gone → Enter → relaunched, pid 2066, window up.

Screenshots: vbox35-hello1 / hello-closed / hello2 / ff2 in
the rig toolkit (~/workspace/wsl-rig/).

## Notes / limits

- The pidfile is written by nct-launch for every launch,
  including session autostart (the shell's own record is the
  shell's business, unchanged).
- A program that forks and reparents away from its recorded
  pid (daemonizing) would read as exited; none of the four
  launch-list programs does this — Firefox's recorded pid is
  its live parent process, verified above.
- Push awaits the owner's word, as always.
