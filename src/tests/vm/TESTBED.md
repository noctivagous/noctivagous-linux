# TESTBED — runbook for Muse Code on the Windows rig

You are picking up a foundation built in Muse (tiers 0–1 verified
there). Your job: prove tier 2 in the VirtualBox VM, and fix what the
checks expose — in the repo, never only in the guest.

## Run it

```powershell
cd <clone>\src\vm
vagrant up            # first run provisions; watch for provision errors
vagrant ssh -c "sudo /vagrant/src/tests/vm/run-all.sh"
```

Or `bash vm-test.sh` from Git Bash in src/vm (also grabs a host-side
console screenshot). Results land in the guest's /tmp/nct-results/ and,
when /vagrant is mounted, in src/tests/vm/results/: summary.txt (one
line per check), a log per failing check, screenshots.

## The fix loop

1. Read summary.txt. For each FAIL, read its log before touching anything.
2. Form the cause: provision gap, config shape, protocol detail, or a
   wrong assumption. Check ASSUMPTIONS.md — the failing check names the
   assumption it settles.
3. Fix in the repo (src/vm/provision.sh, src/system/, src/core/,
   src/services/, src/godot/). The guest is disposable:
   `vagrant provision` for provision changes, `vagrant destroy -f &&
   vagrant up` when you need a clean proof, `vagrant snapshot save`
   before risky experiments.
4. Re-run the failing check alone: run-all.sh takes check numbers,
   e.g. `run-all.sh 04`.
5. When a check passes, update ASSUMPTIONS.md (status + evidence) and
   add a line to ../VM-RIG.md's log. Commit locally with the fix; the
   owner handles pushes.

## Rules

- Do not weaken a check to make it pass. If a check is wrong, say why in
  ASSUMPTIONS.md and change the check and the assumption together.
- Do not judge graphics performance in the VM (VM-RIG.md).
- The test password (nct / nct-test-2026) is VM-only by design.
- If greetd will not start at all, the fallback debugging path is the
  nested one: `vagrant ssh` and run tools/run-chain.sh in the guest —
  it re-proves tiers 0–1 there and separates "foundation broken" from
  "VM/greetd layer broken".
