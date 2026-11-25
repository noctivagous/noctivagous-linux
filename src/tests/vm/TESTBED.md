# TESTBED — runbook for Muse Code on the Windows rig

You are picking up a foundation built in Muse (tiers 0–1 verified
there). Your job: prove tier 2 in the VirtualBox VM, and fix what the
checks expose — in the repo, never only in the guest.

## Run it

```powershell
cd <clone>\src\vm
vagrant up            # first run provisions; watch for provision errors
vagrant ssh -c "sudo bash /vagrant/src/tests/vm/run-all.sh"
```

No host-side bash is needed on Windows: the scripts run inside the
guest, and `vagrant ssh -c` drives them from PowerShell as above
(host Git's `bash.exe` exists here but is not required). For the
console screenshot, call VBoxManage by its full path, e.g.
`& "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" controlvm
nct-test screenshotpng ..\tests\vm\results\host-console.png`.
Keep the checkout's line endings LF: a CRLF tree is shared verbatim
into the guest and every guest-run shell script breaks on it
(`$'\r': command not found`).

Note on file modes: src/ reached GitHub by snapshot push, which does
not carry executable bits — scripts check out as 644. Everything the
*installed system* executes gets its mode back from the debs
(build-deb.sh chmods nct-* and *.sh to 755), so greetd's command and
the session scripts are fine once provisioned. Only tree-direct
scripts are affected; run them via `bash <path>` as above (or
`chmod +x` them in your clone — a mode-only commit from a real git
client would settle it for good).

Or `bash vm-test.sh` from Git Bash in src/vm, or on a bash-less
Windows host `.\vm-test.ps1` from PowerShell in src/vm (both also grab
a host-side console screenshot; `vm-test.ps1 [-Checks "03 09"]` runs
only those checks). Results land in the guest's /tmp/nct-results/ and,
when /vagrant is mounted, in src/tests/vm/results/: summary.txt (one
line per check), a log per failing check, screenshots.

## The fix loop

1. Read summary.txt. For each FAIL, read its log before touching anything.
   Rendering evidence lives with the sessions: the greeter's
   /tmp/nct-greeter-state/cage.log and the user's
   ~/.local/state/nct/session.log carry one `ladder: attempt` line per
   rendering configuration tried (ASSUMPTION A14), and the rung that
   stayed up is remembered in ~/.local/state/nct/render-rung (the
   greeter's copy is under /var/lib/nct-greeter).
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
