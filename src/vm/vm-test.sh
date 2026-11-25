#!/bin/bash
# vm-test.sh — host-side driver (Git Bash / WSL / Linux host):
# bring the VM up, run the in-guest test bed, pull the results back.
set -eu
cd "$(dirname "$0")"
vagrant up
vagrant ssh -c "sudo SRC=/vagrant/src /vagrant/src/tests/vm/run-all.sh" || true
mkdir -p ../tests/vm/results
vagrant ssh -c "cat /tmp/nct-results/summary.txt" || true
echo "Results are in the guest at /tmp/nct-results and mirrored into src/tests/vm/results/ by run-all.sh when /vagrant is mounted."
# Host-side screenshot of the VM console (works headless):
vagrant ssh -c "true" >/dev/null 2>&1 || true
VB=$(command -v VBoxManage || echo "/c/Program Files/Oracle/VirtualBox/VBoxManage.exe")
if [ -x "$VB" ] || command -v VBoxManage >/dev/null; then
  "$VB" controlvm nct-test screenshotpng ../tests/vm/results/host-console.png || true
  echo "Host console screenshot: src/tests/vm/results/host-console.png (if the VM was running)"
fi
