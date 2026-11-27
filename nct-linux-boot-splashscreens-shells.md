nct-linux-boot-splashscreens-shells

> On linux distros, during boot and in a fullscreen shell, it is rather bare.  Is there a way to get graphics-capable shells at early stages of boot and in guest shells?

There are a few distinct layers where you can get graphics beyond bare text:

**During early boot (before the desktop loads):**

- **KMS (Kernel Mode Setting)** is the core mechanism. Modern distros load the GPU driver in the initramfs, so the framebuffer is live almost immediately. The console then runs on **fbcon** (framebuffer console) — a high-resolution, full-color text console rather than VGA text mode. This is already the default on most current distros; you can verify with `cat /sys/class/vtconsole/vtcon0/name` (should say `fbcon`).
- **Plymouth** sits on top of the framebuffer and shows a graphical splash/progress UI during the boot sequence. Install it (`plymouth` package), set a theme, and add `splash` to your kernel cmdline.
- **GRUB graphics mode**: set `GRUB_GFXMODE=1920x1080x32` and `GRUB_GFXPAYLOAD_LINUX=keep` in `/etc/default/grub`, then regenerate the config. This keeps the graphical mode from GRUB through into the kernel.

**In guest (VM) shells:**

- Install a minimal display server + window manager (e.g., `xorg` + `openbox`, or `weston` + `sway` for Wayland). Launch with `startx` (X) or run the compositor directly (Wayland). No full DE needed.
- For **headless** VMs, expose the console via **VNC** or **SPICE** (`qemu-system-x86_64 ... -vnc :0` or `-spice port=5900`) so you get a graphical session over the network.
- Make sure the guest has the right virtual GPU driver loaded (`virtio-gpu`, `qxl`, `vboxvideo`, etc.) — without it you're stuck at the basic text console.

The short answer: **KMS + fbcon** already gives you a graphics-capable console from very early boot on any modern distro. For a true graphical shell (windows, compositing), you need a display server running, which in a VM guest is as simple as a minimal X/Wayland session.


> So what about the SeaBIOS screen on QEMU?

The SeaBIOS screen is the one thing you can't really "make graphical" in the full sense — it's a 16-bit real-mode POST — but you have a few options:

**1. Graphical bootsplash (built into SeaBIOS)**

SeaBIOS supports a JPEG or BMP splash image that replaces the text POST output. The image must exactly match an available VGA mode (640×480, 1024×768, etc.):

```bash
qemu-system-x86_64 \
  -boot menu=on,splash=/path/to/bootsplash.jpg,splash-time=5000 \
  ...
```

`splash-time` is in milliseconds. The image is only visible while the boot menu is waiting, so you need `menu=on`. This is the closest you'll get to a "graphical" SeaBIOS screen.

**2. Suppress it entirely**

If you just want to skip the text POST and boot menu:

```bash
qemu-system-x86_64 -boot menu=off ...
```

Or set the SeaBIOS runtime config file `etc/show-boot-menu` to `0` (via the SeaBIOS filesystem / fw_cfg). With only one boot device, SeaBIOS can also be configured to auto-skip the menu (`show-boot-menu=2`).

**3. Replace SeaBIOS with OVMF (UEFI)**

The most impactful option. OVMF gives you a proper UEFI boot experience — a graphical boot manager, UEFI shell, and (with the right drivers) a much faster path to the kernel:

```bash
qemu-system-x86_64 \
  -drive if=pflash,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE.fd \
  -drive if=pflash,format=raw,file=OVMF_VARS.fd \
  ...
```

This eliminates the SeaBIOS screen entirely. The UEFI firmware's own boot screen is minimal (a brief logo or just a black screen before handoff), and the OS bootloader (GRUB, systemd-boot, etc.) takes over in graphics mode almost immediately.

**TL;DR:** For a quick win, use the `-boot splash=` option. For a proper fix, switch to OVMF and let your OS bootloader (GRUB with `GRUB_GFXMODE`) handle the early-boot graphics.


> What other BIOS and boot splash scenarios should we account for in our Linux distro?

Beyond the SeaBIOS/OVMF split already covered, here's the full matrix a distro needs to handle:

## Firmware & Boot Path

| Scenario | Splash implications |
|---|---|
| **Legacy BIOS (SeaBIOS)** | 16-bit VGA, no framebuffer before KMS. SeaBIOS bootsplash only shows during boot-menu wait. Plymouth falls back to text until the GPU driver loads. |
| **UEFI (OVMF / vendor firmware)** | UEFI GOP framebuffer is available from firmware handoff. Plymouth can use **SimpleDRM** to draw on it immediately — no flicker, no text fallback. |
| **CSM / Legacy Boot on UEFI hardware** | Behaves like legacy BIOS (no UEFI framebuffer). Distro must detect `/sys/firmware/efi` absence and fall back gracefully. |
| **Secure Boot** | Requires a signed bootloader chain (shim → GRUB/systemd-boot). Plymouth and its themes must be signed or loaded after MOK enrollment. Unsigned initramfs hooks can break the splash. |
| **Fast Boot / UEFI timeout = 0** | OVMF skips its front page entirely. The distro's bootloader is the first thing the user sees — GRUB/systemd-boot splash becomes the *only* pre-kernel graphics. |

## Bootloader Layer

- **GRUB**: `GRUB_GFXMODE` + `GRUB_GFXPAYLOAD_LINUX=keep` carries the mode into the kernel. Theme via `GRUB_THEME`. Must match the resolution Plymouth will use or you get a visible mode-switch flicker.
- **systemd-boot**: Uses its own `bootctl`-managed entries. No built-in graphical theme (text-only menu), but passes `splash` through to the kernel for Plymouth. The `console-mode max` setting in `loader.conf` helps.
- **EFI stub (kernel direct)**: Skips the bootloader entirely. The kernel's EFI stub sets up the framebuffer; Plymouth takes over from there. No GRUB theme to worry about, but also no boot menu.

## KMS / GPU Driver Timing

This is where most real-world breakage happens:

- **Intel**: KMS loads early, framebuffer is stable from the start. Simplest case.
- **AMD**: `amdgpu` KMS is also early but some cards have a brief mode-switch when the full driver takes over from the firmware/EFI framebuffer. Plymouth's SimpleDRM handles this; fbcon does not.
- **NVIDIA (proprietary)**: KMS is **off by default**. Without `nvidia-drm.modeset=1` on the kernel cmdline, there is no framebuffer until the X/Wayland session starts — Plymouth shows text fallback the entire time. This is the #1 "why is my splash broken" report.
- **Resolution change mid-boot**: The firmware framebuffer (e.g., 1024×768 from VirtualBox EFI) may differ from what the GPU driver sets (e.g., 1280×800). Plymouth must re-layout on resolution change, or the splash looks stretched/broken.

## Initramfs / Encrypted Root

- **LUKS / dm-crypt**: The root filesystem isn't available until the user enters a passphrase. Plymouth must run **inside the initramfs** (via the `plymouth` hook in mkinitcpio/dracut) to show a graphical password prompt. Without it, the user gets a bare text prompt on a black screen.
- **Network root (NFS, iSCSI)**: Same problem, but the wait is longer (network discovery). A splash with a spinner/progress indicator matters more here.

## Display / Output Scenarios

- **Multi-monitor**: Which output does the splash go to? KMS picks a default; Plymouth follows it. Headless servers with no monitor connected may have no framebuffer at all.
- **Headless / iKVM**: No local display. Plymouth and GRUB graphics are irrelevant. The "splash" is whatever the IPMI/iLO/iDRAC remote console shows. Distro should not assume a local display exists.
- **VM guest**: The virtual GPU (virtio-gpu, qxl, cirrus, vboxvideo) determines what's possible. Cirrus is VGA-only (no KMS, no Plymouth graphics). Virtio-gpu and QXL support KMS and work fine. The firmware (SeaBIOS vs OVMF) changes whether a framebuffer exists before the kernel loads.

## Edge Cases Worth Handling

- **Plymouth failure / fallback**: If Plymouth crashes or the theme is corrupt, the distro should fall back to text without hanging. `plymouth.enable=0` on the kernel cmdline is the escape hatch.
- **`quiet` vs `splash` interaction**: `quiet` suppresses kernel log messages; `splash` enables Plymouth. They're independent — a distro should offer "verbose + splash" (Plymouth with `Esc` to reveal logs) as a debug option.
- **Recovery / rescue mode**: Booting from a rescue image or single-user mode. The distro should still show *something* (even just a text logo) so the user knows the system is alive, not hung.
- **Firmware setup entry from OS**: `systemctl reboot --firmware-setup` (UEFI only). On legacy BIOS this is impossible from the OS — the distro should document the hardware key (Del/F2) and not promise a software path.
- **A/B or dual-boot with different firmware modes**: One entry in UEFI mode, one in CSM/legacy. Each path has different framebuffer availability and different bootloader (GRUB-EFI vs GRUB-PC or ISOLINUX). The distro's installer must set up the correct bootloader for each path.

**The short version:** the two axes that matter most are **firmware type** (BIOS vs UEFI, which determines whether a framebuffer exists before the kernel) and **GPU driver** (Intel/AMD vs NVIDIA, which determines when KMS becomes available). Everything else — bootloader choice, LUKS, VM vs bare metal, headless — is a variation on those two.


