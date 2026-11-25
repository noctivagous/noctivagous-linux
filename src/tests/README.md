# tests/ — the test bed

- headless/ — tier-0 checks (also run by tools/run-chain.sh).
- vm/ — tier-2: the VirtualBox test bed. TESTBED.md is the runbook
  Muse Code follows on the Windows rig; ASSUMPTIONS.md is the
  register of guesses this foundation makes, each tied to the check
  that proves or kills it; run-all.sh runs every check in the guest
  and writes results/ (one line per check + logs + screenshots).
- results-local/ — output of tools/run-chain.sh on a dev machine
  (gitignored).

Rule: a check that fails is a finding. Fix the repo, never just the
guest, and record the outcome in ../VM-RIG.md's log.
