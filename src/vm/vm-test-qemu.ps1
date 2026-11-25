# vm-test-qemu.ps1 — Windows host driver for the NCT QEMU rig.
# Boots the BUILT distro image (tools/build-image.sh output) under QEMU
# for Windows — WHPX acceleration when the Windows Hypervisor Platform
# is enabled, TCG emulation otherwise — with a virtio-gpu display, the
# serial console captured to a log, and SSH forwarded to host port 2222.
# This rig tests the image itself (the distro artifact); the VirtualBox
# rig (vm-test.ps1) tests the provisioned guest. See
# src/tests/vm/TESTBED-QEMU.md for the full runbook.
#
# Usage:
#   .\vm-test-qemu.ps1                 boot the image (window opens)
#   .\vm-test-qemu.ps1 -Reset          discard changes, boot pristine
#   .\vm-test-qemu.ps1 -Checks "03 09" boot headless, run test-bed
#                                      checks over SSH, print summary
#   .\vm-test-qemu.ps1 -Stop           stop a VM started with -Checks
# (If scripts are blocked: powershell -ExecutionPolicy Bypass -File .\vm-test-qemu.ps1)
param(
  [string]$ImageDir = "$PSScriptRoot\qemu-image",
  [string]$Checks = "",
  [switch]$Reset,
  [switch]$Stop,
  [int]$MemoryMB = 2048
)
$ErrorActionPreference = "Stop"

$qemu = (Get-Command qemu-system-x86_64.exe -ErrorAction SilentlyContinue).Source
if (-not $qemu) {
  # Weil installer default, then MSYS2 environments (ucrt64/mingw64/usr)
  # — qemu.org lists both routes; the MSYS2 one is never on PATH.
  foreach ($candidate in @(
    "C:\Program Files\qemu\qemu-system-x86_64.exe",
    "C:\msys64\ucrt64\bin\qemu-system-x86_64.exe",
    "C:\msys64\mingw64\bin\qemu-system-x86_64.exe",
    "C:\msys64\usr\bin\qemu-system-x86_64.exe")) {
    if (Test-Path $candidate) { $qemu = $candidate; break }
  }
}
if (-not $qemu) { throw "qemu-system-x86_64.exe not found — install QEMU for Windows (TESTBED-QEMU.md)." }

$pidFile = Join-Path $ImageDir "qemu.pid"
$serialLog = Join-Path $ImageDir "qemu-serial.log"
$runImg = Join-Path $ImageDir "nct-test-run.img"

if ($Stop) {
  if (Test-Path $pidFile) {
    $qpid = Get-Content $pidFile
    Stop-Process -Id $qpid -Force -ErrorAction SilentlyContinue
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    Write-Output "Stopped QEMU (pid $qpid)."
  } else { Write-Output "No pid file — nothing recorded as running." }
  exit 0
}

$pristine = Join-Path $ImageDir "nct-test.img"
foreach ($f in @($pristine, (Join-Path $ImageDir "vmlinuz"), (Join-Path $ImageDir "initrd.img"))) {
  if (-not (Test-Path $f)) { throw "Missing $f — copy the built image files into $ImageDir (TESTBED-QEMU.md)." }
}
if ($Reset -or -not (Test-Path $runImg)) {
  Copy-Item $pristine $runImg -Force
  Write-Output "Run image refreshed from pristine."
}

# NOTE: Start-Process -ArgumentList joins array elements with bare
# spaces, so every value that can contain spaces MUST carry its own
# embedded quotes or QEMU sees fragments (the -append kernel command
# line always has spaces; Windows paths often do). Without them QEMU
# exits immediately with an option error.
$qemuArgs = @(
  "-m", "$MemoryMB", "-smp", "2", "-machine", "q35",
  "-kernel", "`"$(Join-Path $ImageDir 'vmlinuz')`"",
  "-initrd", "`"$(Join-Path $ImageDir 'initrd.img')`"",
  # ip=dhcp: the kernel brings the virtio NIC up itself (the image ships
  # no DHCP client yet — see A11). Without it the guest has no address
  # and the hostfwd has nothing behind it: SSH resets at key exchange
  # while everything else (serial, greeter) looks healthy.
  "-append", '"root=/dev/vda rw console=ttyS0 systemd.unit=graphical.target ip=dhcp"',
  "-drive", "`"file=$runImg,format=raw,if=virtio`"",
  "-device", "virtio-gpu-pci",
  "-netdev", "user,id=n0,hostfwd=tcp::2222-:22",
  "-device", "virtio-net-pci,netdev=n0",
  "-serial", "`"file:$serialLog`""
)
if ($Checks -ne "") { $qemuArgs += @("-display", "none") }

function Start-Qemu([string]$accel) {
  $args = @("-accel", $accel) + $qemuArgs
  if ($Checks -ne "") {
    $p = Start-Process $qemu -ArgumentList $args -PassThru -WindowStyle Hidden
  } else {
    $p = Start-Process $qemu -ArgumentList $args -PassThru
  }
  return $p
}

# WHPX first; if QEMU dies within a few seconds the accelerator is the
# usual cause (feature disabled) — fall back to TCG and say so.
$proc = Start-Qemu "whpx,kernel-irqchip=off"
Start-Sleep -Seconds 4
if ($proc.HasExited) {
  Write-Output "WHPX start failed (exit $($proc.ExitCode)) — falling back to TCG emulation (slower)."
  $proc = Start-Qemu "tcg"
  Start-Sleep -Seconds 4
  if ($proc.HasExited) { throw "QEMU exited immediately under TCG too (exit $($proc.ExitCode)). Serial log: $serialLog" }
} else {
  Write-Output "QEMU running with WHPX acceleration (pid $($proc.Id))."
}
$proc.Id | Out-File $pidFile

if ($Checks -eq "") {
  Write-Output "Greeter is in the QEMU window. SSH: ssh -p 2222 nct@127.0.0.1 (password login; TESTBED-QEMU.md for key setup)."
  Write-Output "Serial log: $serialLog"
  exit 0
}

# Checks mode: wait for SSH, run the test bed inside the guest, report.
$key = Join-Path $env:USERPROFILE ".ssh\nct-qemu"
if (-not (Test-Path $key)) { throw "No SSH key at $key — do the one-time key setup in TESTBED-QEMU.md first." }
$sshOpts = @("-p", "2222", "-i", $key, "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=NUL", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5")
# Gate SSH attempts on the serial log: hammering sshd while the guest
# is still booting stacks up unauthenticated connections server-side
# until MaxStartups shedding kicks in — then EVERY later handshake,
# good ones included, gets dropped or reset. That self-inflicted
# brownout only clears after LoginGraceTime with no new attempts, so:
# no SSH before the guest reports graphical.target on serial, and a
# gentle cadence afterwards.
Write-Output "Waiting for boot to complete (serial log) ..."
$booted = $false
foreach ($i in 1..120) {
  if ((Test-Path $serialLog) -and (Select-String -Path $serialLog -Pattern 'Reached target graphical.target' -Quiet)) { $booted = $true; break }
  Start-Sleep -Seconds 5
}
if (-not $booted) { throw "Guest never reached graphical.target — see the serial log: $serialLog" }
Write-Output "Waiting for SSH on 127.0.0.1:2222 ..."
$up = $false
# NOTE: $ErrorActionPreference is Stop, so a refused connection is a
# terminating error, not a quiet nonzero exit — catch it and retry.
foreach ($i in 1..20) {
  try {
    & ssh @sshOpts nct@127.0.0.1 "true" 2>$null
    if ($LASTEXITCODE -eq 0) { $up = $true; break }
  } catch { }
  Start-Sleep -Seconds 10
}
if (-not $up) { throw "SSH never came up — see the serial log: $serialLog" }

$guestCmd = "sudo bash /usr/lib/nct/tests/vm/run-all.sh"
if ($Checks -ne "") { $guestCmd += " $Checks" }
& ssh @sshOpts nct@127.0.0.1 $guestCmd
$bedCode = $LASTEXITCODE
Write-Output "--- summary from guest ---"
& ssh @sshOpts nct@127.0.0.1 "cat /tmp/nct-results/summary.txt"
Write-Output "VM left running (pid $($proc.Id)); stop it with .\vm-test-qemu.ps1 -Stop"
exit $bedCode
