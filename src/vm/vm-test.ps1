# vm-test.ps1 — Windows host driver for the NCT VM test bed.
# PowerShell equivalent of vm-test.sh (no host bash needed): brings the
# VM up, streams the in-guest test bed to this console, then prints the
# summary and grabs a host-side console screenshot.
# Usage:  .\vm-test.ps1 [-Checks "03 09"] [-NoScreenshot]
# (If scripts are blocked: powershell -ExecutionPolicy Bypass -File .\vm-test.ps1)
param(
  [string]$Checks = "",
  [switch]$NoScreenshot
)
Set-Location $PSScriptRoot

vagrant up
if ($LASTEXITCODE -ne 0) { throw "vagrant up failed with exit code $LASTEXITCODE" }

$guestCmd = "sudo bash /vagrant/src/tests/vm/run-all.sh"
if ($Checks -ne "") { $guestCmd += " $Checks" }
vagrant ssh -c $guestCmd
$bedCode = $LASTEXITCODE

Write-Output "--- summary from guest ---"
vagrant ssh -c "cat /tmp/nct-results/summary.txt"
Write-Output "Results also mirror into src/tests/vm/results/ via the shared folder."

if (-not $NoScreenshot) {
  $vb = "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
  if (Test-Path $vb) {
    & $vb controlvm nct-test screenshotpng ..\tests\vm\results\host-console.png
    Write-Output "Host console screenshot: src/tests/vm/results/host-console.png"
  } else {
    Write-Output "VBoxManage not found at $vb; skipping screenshot."
  }
}

exit $bedCode
