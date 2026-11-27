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


> Let's talk about another aspect. Where are the points where, instead of text streaming down, we can map activity to categories in a graphical overlay.

Good question — this is the gap between "Plymouth shows a spinner" and "Plymouth shows you *what's happening, grouped by category*." Here are the concrete hook points where the raw text stream carries enough structure to be mapped to a graphical overlay:

## 1. Kernel initcalls (dmesg stream)

The kernel prints one line per initcall: `[    0.412] sd 0:0:0:0: [sda] ...`. Each line has a **subsystem prefix** (the first token before the colon: `sd`, `usb`, `drm`, `pci`, `scsi`, `net`, etc.) and a **monotonic timestamp**.

**Categorization axes:**
- **Subsystem** (block, net, DRM, USB, PCI, input, crypto, …)
- **Phase** (early initcalls → late initcalls → module init)
- **Status** (success, deferred, failed — visible from the message text)

**Hook point:** The kernel's `initcall_debug` boot parameter makes every initcall visible with timing. A userspace process (or a kernel-side mechanism like `trace_printk` → a ring buffer) could feed a categorized progress model. In practice, this data only becomes readable once `/proc` or `/sys` is up, so it's really a **post-hoc** source unless you use `ftrace`/`perf` from the initramfs.

**What exists:** `bootgraph` (Intel's `pm-graph` tool) already parses dmesg and renders an HTML timeline of initcalls. But it's a post-boot analysis tool, not a live overlay.

## 2. Initramfs / dracut or mkinitcpio scripts

These print structured progress messages like:
```
Determining device...
Activating swap...
Mounting /sysroot...
Starting systemd...
```

**Categorization axes:**
- **Storage** (device detection, LUKS, LVM, md, filesystem mount)
- **Network** (DHCP, NFS, iSCSI)
- **System** (udev, tmpfs, proc/sys mounts)

**Hook point:** The initramfs init script (e.g., dracut's `/init` or mkinitcpio's `/init`) is where you control the output. You could emit **structured events** (JSON lines, or a custom protocol over a socket) instead of plain text, and have a Plymouth theme or a custom overlay consume them.

**What exists:** Plymouth's `plymouth --show-splash` and `plymouth --hide-splash` are the only "events" the initramfs can send to the splash. There's no API for "storage: 2/5 done" or "network: waiting for DHCP." This is the biggest gap.

## 3. systemd unit activation (the main event)

Once systemd takes over as PID 1, it has a **rich, structured event model**:

| Data source | What it gives you |
|---|---|
| **Journal (`/dev/log`)** | Every unit state change, with structured fields: `_SYSTEMD_UNIT`, `PRIORITY`, `SYSLOG_IDENTIFIER`, `MESSAGE_ID`. This is the real-time stream. |
| **`systemctl` D-Bus API** | `org.freedesktop.systemd1.Manager` exposes `UnitActiveState`, `JobState`, `LoadState` per unit. You can subscribe to `UnitNew` and `UnitRemoved` signals. |
| **`systemd-analyze` data** | Post-hoc: `blame`, `critical-chain`, `plot`. The data is in the journal, so a live tool could reconstruct it incrementally. |
| **Targets as milestones** | `sysinit.target` → `basic.target` → `multi-user.target` → `graphical.target`. Each target reaching "active" is a natural **phase boundary** for a categorized overlay. |

**Categorization axes:**
- **Target phase** (sysinit → basic → multi-user → graphical)
- **Unit type** (service, mount, device, socket, timer, path)
- **Subsystem** (block, network, display, input, security, …) — derivable from unit name or `SyslogIdentifier`
- **State** (activating, active, failed, waiting)
- **Critical path** (from `critical-chain` logic — which units are actually gating the target)

**Hook point:** A D-Bus client (or a journal reader) running in the early userspace could maintain a live model: "12/34 services active, 3 failed, 1 on critical path (NetworkManager), current target: basic.target." This is exactly what `systemd-analyze plot` renders as SVG, but **post-hoc and offline**. The data is all there in real-time; nobody has built the live graphical consumer.

**What exists today:**
- `systemd-analyze plot` — SVG, post-boot only
- `journalctl -f` — raw text stream, no categorization
- `systemd-bootchart` — collects CPU/disk/process data during boot, renders SVG after. Closest to a "live overlay" but it's a monitoring tool, not a boot splash.
- **Nothing** that renders a categorized, real-time graphical boot progress overlay on the local display.

## 4. udev events

`udev` emits a structured event for every device add/remove/change, with `SUBSYSTEM`, `DEVTYPE`, `ACTION`, `DEVPATH`. A udev monitor (`udevadm monitor`) gives you a real-time stream.

**Categorization axes:**
- **Subsystem** (block, net, input, sound, drm, …)
- **Action** (add, remove, change)
- **Device type** (disk, interface, keyboard, …)

**Hook point:** A udev monitor in the initramfs or early userspace could feed a "devices detected" category into the overlay. This is especially useful for the "waiting for disk" phase — instead of a spinner, you'd see "Block: 2/3 disks present."

## 5. Network readiness

`NetworkManager` or `systemd-networkd` expose readiness state via D-Bus:
- `org.freedesktop.NetworkManager` → `Connectivity` property (none, portals, limited, full)
- `org.freedesktop.network1` → per-link operational state (off, up, degraded, carrier, routable)

**Categorization:** "Network: carrier → DHCP → DNS → routable" as a sub-progress bar.

## What a "categorized overlay" would look like

The design space is essentially:

```
┌─────────────────────────────────────────────────┐
│  [Phase: sysinit]  ████████████░░░░  78%        │
│                                                   │
│  Storage    ●●●○○  3/5 devices                   │
│  Network    ●○○○○  carrier                       │
│  Display    ●●●●●  DRM ready                     │
│  Security   ●●●●●  LSM loaded                    │
│  Services   ●●●●●●●●○○○○  8/15 active           │
│                                                   │
│  Critical: NetworkManager (2.3s)                  │
│  Failed:   bluetooth.service                     │
└─────────────────────────────────────────────────┘
```

**The missing pieces to build this:**

1. **A structured event protocol from initramfs → userspace.** Today, the initramfs can only send `--show-splash` / `--hide-splash` to Plymouth. You'd need a richer IPC (D-Bus over a socket, or a custom protocol over `/dev/log`) to send categorized progress.

2. **A Plymouth theme (or replacement) that renders categories.** Plymouth's script theme language supports progress bars and labels, but it's designed for a single 0–100% scalar. A multi-category layout would need either a major theme extension or a new overlay system (e.g., a small Wayland compositor running on the KMS/DRM output before the main session).

3. **A live journal/D-Bus consumer.** The systemd side has all the data. You need a lightweight process that reads the journal (or subscribes to D-Bus signals), maintains a categorized model, and pushes it to the overlay. `systemd-bootchart` does something similar but for performance metrics, not for user-facing progress.

4. **A "phase boundary" signal.** Target activation (`basic.target`, `multi-user.target`) is the natural phase transition. `systemd` already emits these; the overlay just needs to listen.

**The short version:** the structured data exists at every layer (kernel initcalls, udev events, systemd unit states, network readiness). The gap is that **no component in the boot path renders a categorized, real-time graphical overlay**. Plymouth is the right place architecturally (it already owns the console and the display), but its API is a single progress scalar, not a categorized event stream. Building this would mean extending Plymouth's IPC protocol and writing a theme (or a replacement overlay) that consumes structured events from the journal, udev, and D-Bus.


> How do we implement a real-time D-Bus client for Plymouth?

Good news and a correction: Plymouth's IPC is **not D-Bus**. It's a custom binary protocol over a **Unix abstract socket** at `\0/org/freedesktop/plymouthd`. The protocol is a single-character command code followed by an optional length-prefixed argument. Here's the full picture and three implementation paths, from least to most invasive.

## The existing protocol (what you're working with)

From `src/ply-boot-protocol.h`:

| Code | Command | Argument |
|---|---|---|
| `P` | ping | none |
| `U` | update | unit name (string) |
| `u` | system-update | progress (int 0–100) |
| `S` | system-initialized | none |
| `C` | change-mode | mode string |
| `M` / `m` | show / hide message | text string |
| `$` / `H` | show / hide splash | none |
| `A` / `a` | pause / unpause progress | none |
| `*` / `c` / `W` | password / cached / question | prompt string |
| `K` / `L` | watch / unwatch keystrokes | none |
| `R` | new root | path |
| `Q` | quit | retain flag |
| `D` / `r` | deactivate / reactivate | none |

**systemd already uses this.** In `src/shared/plymouth-util.c`, systemd connects to the abstract socket and sends `U` + unit name for every unit state change, and `u` + progress percentage for `system-update`. The `plymouth` CLI client does the same thing. So the plumbing exists — it's just that the protocol only carries a **flat unit name** and a **single progress scalar**, not categorized events.

## Path 1: Categorize client-side in the script theme (no Plymouth changes)

The least invasive approach. systemd already sends `U` + unit name for every unit activation. The script theme's `Plymouth.SetUpdateStatusFunction` callback receives that string. You can parse and categorize it **inside the theme script**:

```javascript
// mytheme.script
// Category map: prefix → display name
var categories = {
    "network":    "Network",
    "storage":    "Storage",
    "display":    "Display",
    "security":   "Security",
    "input":      "Input",
    "sound":      "Audio",
    "system":     "System"
};

var category_progress = {};
var category_total = { network: 0, storage: 0, display: 0, security: 0, input: 0, sound: 0, system: 0 };

fun categorize(unit_name) {
    // Derive category from unit name heuristics
    if (unit_name contains "Network" || unit_name contains "networkd" ||
        unit_name contains "wpa_supplicant" || unit_name contains "dhcpcd")
        return "network";
    if (unit_name contains "mount-" || unit_name contains "crypttab" ||
        unit_name contains "lvm" || unit_name contains "md" ||
        unit_name contains "dm-" || unit_name contains "scsi" ||
        unit_name contains "ata" || unit_name contains "nvme")
        return "storage";
    if (unit_name contains "display" || unit_name contains "gdm" ||
        unit_name contains "sddm" || unit_name contains "lightdm" ||
        unit_name contains "drm" || unit_name contains "kms")
        return "display";
    if (unit_name contains "audit" || unit_name contains "apparmor" ||
        unit_name contains "selinux" || unit_name contains "systemd-coredump")
        return "security";
    if (unit_name contains "keyboard" || unit_name contains "mouse" ||
        unit_name contains "input" || unit_name contains "bluetooth")
        return "input";
    if (unit_name contains "pulse" || unit_name contains "pipewire" ||
        unit_name contains "sound" || unit_name contains "alsa")
        return "sound";
    return "system";
}

fun update_callback(status_string) {
    // status_string is the unit name systemd sent via 'U'
    var cat = categorize(status_string);
    category_progress[cat] = (category_progress[cat] or 0) + 1;
    // Redraw the category bar for `cat`
    redraw_category_bar(cat);
}

Plymouth.SetUpdateStatusFunction(update_callback);
```

**Limitations:** The script language is limited (no file I/O, no sockets, no JSON parsing). You can't get the unit's *state* (active/failed/activating) — only that systemd sent an update for it. You can't get the critical-path info. But you get a live "which subsystems are being touched" view with zero changes to Plymouth or systemd.

## Path 2: Extend the Plymouth socket protocol (moderate changes)

Add new command codes to `ply-boot-protocol.h` and handle them in `ply-boot-server.c`. This lets you send **structured, categorized events** from any process (a custom agent, a modified systemd, an initramfs script) to `plymouthd`.

**Protocol extension** — add to `ply-boot-protocol.h`:

```c
/* New: categorized progress event */
/* Argument format: "category|progress|total|status\0"
 *   category: short string (e.g. "storage", "network")
 *   progress: integer
 *   total:    integer
 *   status:   "active" | "failed" | "waiting" | "activating"
 */
#define PLY_BOOT_PROTOCOL_REQUEST_TYPE_CATEGORY_UPDATE "N"

/* New: phase transition (target reached) */
/* Argument: target name (e.g. "basic.target") */
#define PLY_BOOT_PROTOCOL_REQUEST_TYPE_PHASE "T"
```

**Server-side handler** in `ply-boot-server.c`:

```c
static void ply_boot_server_on_category_update(
    ply_boot_server_t *server,
    const char *category,
    int progress,
    int total,
    const char *status)
{
    /* Forward to the splash plugin's new callback */
    if (server->category_update_handler)
        server->category_update_handler(
            server->user_data, category, progress, total, status);
}
```

**The splash plugin (script theme)** gets a new callback:

```javascript
// In the script theme engine (C side), expose:
//   Plymouth.SetCategoryUpdateFunction(callback)
//   callback(category, progress, total, status)

fun category_callback(category, progress, total, status) {
    // Update the visual bar for `category`
    // `progress`/`total` gives you "3/5 devices"
    // `status` tells you if something failed
    update_category_bar(category, progress, total, status);
}
Plymouth.SetCategoryUpdateFunction(category_callback);
```

**The sender** — a small daemon or a systemd unit that reads the journal and emits categorized events:

```c
/* plymouth-categorize-agent.c */
/* Connects to the plymouthd abstract socket and sends N commands */

#include <sys/socket.h>
#include <sys/un.h>
#include <string.h>
#include <stdio.h>

static int connect_plymouth(void) {
    int fd = socket(AF_UNIX, SOCK_STREAM, 0);
    struct sockaddr_un addr = {0};
    addr.sun_family = AF_UNIX;
    /* Abstract socket: leading NUL, no filesystem path */
    const char *path = "\0/org/freedesktop/plymouthd";
    memcpy(addr.sun_path, path, 28);
    if (connect(fd, (struct sockaddr *)&addr,
                offsetof(struct sockaddr_un, sun_path) + 27) < 0)
        return -1;
    return fd;
}

static void send_category_update(int fd, const char *category,
                                  int progress, int total,
                                  const char *status) {
    char buf[256];
    int len = snprintf(buf, sizeof(buf), "%s|%d|%d|%s",
                       category, progress, total, status);
    char pkt[260];
    pkt[0] = 'N';          /* command code */
    pkt[1] = 1;            /* has argument flag */
    /* 4-byte big-endian length */
    pkt[2] = (len >> 24) & 0xff;
    pkt[3] = (len >> 16) & 0xff;
    pkt[4] = (len >> 8)  & 0xff;
    pkt[5] = len & 0xff;
    memcpy(pkt + 6, buf, len);
    write(fd, pkt, 6 + len);
}
```

**The categorization agent** itself is a journal reader:

```c
/* Pseudocode for the agent's main loop */
sd_journal *j;
sd_journal_open(&j, SD_JOURNAL_LOCAL_ONLY);
sd_journal_seek_head(j);

while ((entry = sd_journal_next(j)) > 0) {
    const char *unit, *state;
    sd_journal_get_data(j, "_SYSTEMD_UNIT", &unit, &len);
    sd_journal_get_data(j, "MESSAGE_ID", &mid, &len);

    /* Match on MESSAGE_ID for unit state changes */
    /* _SYSTEMD_UNIT=foo.service, state=active/failed/activating */

    const char *category = categorize_unit(unit_name);
    int progress = get_category_progress(category);
    int total    = get_category_total(category);
    send_category_update(ply_fd, category, progress, total, state);
}
```

This agent runs as a **static systemd service** ordered before `basic.target`, so it's active during the critical boot window.

## Path 3: Replace the splash plugin entirely (most powerful)

Write a custom splash plugin (a shared object loaded by `plymouthd`) that:

1. Opens its own **D-Bus connection** to the system bus (or reads the journal directly via `sd-journal`)
2. Subscribes to `org.freedesktop.systemd1.Manager` signals (`UnitNew`, `UnitRemoved`, `JobNew`, `JobRemoved`)
3. Maintains a live categorized model
4. Renders the overlay directly using the `ply_renderer_t` API (the same abstraction the built-in themes use)

This is the most work but gives you full D-Bus access, real unit states, critical-path computation, and a rendering loop independent of the script language's limitations. The plugin API is in `src/libply-splash-core/ply-splash.h`:

```c
/* The splash plugin vtable you'd implement */
typedef struct _ply_splash_vtable {
    void (*load)(ply_splash_t *splash);
    void (*unload)(ply_splash_t *splash);
    void (*show_splash)(ply_splash_t *splash);
    void (*hide_splash)(ply_splash_t *splash);
    void (*update)(ply_splash_t *splash, const char *unit);
    void (*system_update)(ply_splash_t *splash, int progress);
    /* ... plus: set_boot_progress, set_root_mounted,
       display_password, display_message, etc. */
} ply_splash_vtable_t;
```

You'd add your own `category_update` and `phase_transition` callbacks to this vtable, and the plugin's `load()` function would spawn a D-Bus listener thread.

## Summary: which path to choose

| Path | Effort | What you get |
|---|---|---|
| **1. Script theme heuristics** | 1–2 days | Live subsystem categorization from unit names. No states, no critical path. Zero changes to Plymouth/systemd. |
| **2. Protocol extension + agent** | 1–2 weeks | Structured categorized events with progress/total/status. Requires patching `ply-boot-protocol.h`, `ply-boot-server.c`, and the script theme engine. Agent is a standalone service. |
| **3. Custom splash plugin** | 1–2 months | Full D-Bus/journal access, real unit states, critical path, arbitrary rendering. Most flexible but most code. |

**Pragmatic recommendation:** Start with **Path 1** to validate the UX (does the user actually find categorized progress useful?). If yes, invest in **Path 2** for the production-quality version. Path 3 is only worth it if you need features the script language fundamentally can't do (e.g., smooth animated transitions between categories, or rendering that goes beyond sprites).


> A followup question asked if systemd could be patched to send structured protocol extensions.  Why would someone do that?

Several concrete reasons, all rooted in the fact that a separate agent is a **lossy, delayed, and ordering-fragile** proxy for the event source:

**1. Zero-latency, zero-loss delivery**

A journal reader (even one using `sd_journal_open` + `sd_journal_wait`) polls or waits on a file descriptor. During fast boots (1–3 s total), the agent may not have opened the journal before the first interesting events fire. systemd sending directly from its own state-machine transition means the socket write happens **synchronously inside the same code path** that changes the unit's state — no gap, no reordering, no missed entries during journal rotation.

**2. Access to totals and critical path**

This is the big one. A journal reader sees events *as they happen* but doesn't know the **denominator**. "Storage: 3/5" requires knowing there are 5 storage units total. systemd knows this at unit-load time (it has the full dependency graph in memory). It can also compute the **critical path** (which single unit is gating the target) — that's `systemd-analyze critical-chain` logic, which lives *inside* systemd. A journal reader would have to reconstruct the dependency graph from `Requires=`/`Wants=`/`After=` fields, which is possible but brittle and redundant.

**3. Eliminates the chicken-and-egg**

The agent itself is a systemd unit. It can't send categorized events until *it* is active. But the most interesting events (early device units, LUKS unlock, root mount) happen **before** a normal service would start. If you order the agent `Before=basic.target`, it's a static binary that must be in the initramfs — now you're patching the initramfs *and* systemd. If you patch systemd, events flow from the **very first** unit activation (the `systemd-udevd.service` early in `sysinit.target`).

**4. Categorization at load time, not event time**

If the category mapping is a systemd-internal table (or a drop-in config file parsed at unit-load), the hot path is a hash lookup + a 6-byte socket write. A separate agent doing string-matching on unit names per event is slower and duplicates the logic that systemd already has (it knows each unit's `SyslogIdentifier`, `Documentation=`, `PartOf=`, etc.).

**5. Fewer failure modes**

One fewer daemon that can crash, be OOM-killed, or fail to start. During a boot where the system is already stressed (cold cache, slow disk), an extra process is a real risk. The socket write is fire-and-forget — if Plymouth isn't listening, systemd just drops the event (same as it does today for the `U` command).

**The counter-argument (why people avoid it):**

- **Upstream resistance.** systemd's maintainers are conservative about the Plymouth protocol. The `U`/`u` commands were added with a specific, minimal purpose. A "categorized progress" extension is a feature request, not a bug fix — it'll sit in the tracker for years.
- **Coupling.** It bakes a display-layer concern into PID 1. If Plymouth is replaced (some distros are experimenting with `systemd-bootchart`-style overlays or Wayland-based boot UIs), the protocol extension is stranded.
- **The agent path is "good enough" for the 95% case.** If you accept that totals are approximate (count units as they arrive, estimate the total from the unit list at agent start) and that the first ~200 ms of events are missed, a journal-reading agent gets you 90% of the UX for a fraction of the political cost.

**In practice:** the people who'd patch systemd are the ones building a **distro-specific boot experience** where the splash is a brand differentiator (think: a vendor's appliance, a kiosk distro, or a security-hardened image where the boot UI is part of the threat model). For a general-purpose distro, the agent approach is the pragmatic 80/20.


> Does this approach impact kernel boot performance?

Short answer: **negligible**, but the details differ by path.

## The baseline cost you're already paying

Plymouth's *actual* performance impact is not the socket protocol or the daemon — it's that it **forces early GPU driver initialization (KMS)** to have a framebuffer to draw on. The systemd project's own optimization guide notes:

> "Plymouth is generally quite fast, but currently still forces settling device enumerations for graphics cards, which is slow."

The `plymouth-quit-wait.service` showing up as the top entry in `systemd-analyze blame` (17–50 s) is a **measurement artifact** — it runs for the entire boot duration waiting for the display manager to signal quit. It doesn't *gate* boot completion. Manual stopwatch tests consistently show the real cost is **1–3 seconds** (mostly the GPU driver settling), not the 20–50 s that `systemd-analyze` reports.

The daemon itself is tiny: ~1.6 MB peak memory, ~6 ms CPU time for the quit-wait service.

## Impact by path

| Path | Additional cost | Why |
|---|---|---|
| **Script theme (Path 1)** | **Zero** | Runs inside `plymouthd`, which is already loaded and rendering. String matching on unit names is nanoseconds. No new process, no new I/O. |
| **Patched systemd (Path 2)** | **~0** | The socket write is the *same code path* systemd already uses for the `U` command. You're adding ~40 bytes to an existing 6-byte write and a hash-table lookup for categorization. Sub-microsecond per event. The categorization table is parsed once at unit-load, not per-event. |
| **Separate agent (Path 3)** | **Small but real** | One extra process (~2–5 MB RSS), a journal open (involves reading the journal header + seeking), and per-event read/parse/write. On a fast NVMe system: <100 ms total. On a slow spinning disk with a cold cache: could add 200–500 ms to the agent's *own* startup, but it's not on the critical path (it's `Before=basic.target`, not `WantedBy=basic.target`). |

## The one thing that *could* matter

**Rendering complexity.** A single spinner vs. a multi-category overlay with 6 progress bars, labels, and a critical-path indicator. On modern iGPUs or dGPUs this is irrelevant (the framebuffer is composited at 60 Hz regardless). On **cirrus** (QEMU's default VGA) or **S3** (older AMD) with no hardware acceleration, the script theme's redraw loop could add visible CPU load. In practice, the script theme only redraws on event (not at 60 Hz), so even on weak hardware the cost is a few milliseconds per update.

## What actually dominates

For context, here's where the real time goes on a typical boot:

| Phase | Typical time |
|---|---|
| Kernel + initrd | 1–3 s |
| GPU driver KMS settle (Plymouth's real cost) | 1–3 s |
| systemd unit activation | 2–10 s |
| `plymouth-quit-wait` (not real, just a timer) | = total boot time |

Adding a 40-byte socket write per unit event (Path 2) is in the same noise band as the kernel's own `printk` calls. You would need a high-resolution timer and a controlled environment to measure the difference.

**Bottom line:** the structured protocol extensions add no measurable boot-time cost. The 1–3 s that Plymouth *does* cost comes from forcing KMS early, and that cost exists regardless of what the splash renders.


> we are indeed "building a distro-specific boot experience"

Good — that unlocks the full architecture question. Here's what "building a distro-specific boot experience" actually means in practice, given what exists today and what you'd need to own.

## The landscape (what you're competing against / borrowing from)

A few projects validate the approach and give you starting points:

- **bootvine** (Codeberg, Rust/ratatui) — the closest existing thing to what we designed. A live TUI tree of pending systemd units on the console, with a timeline of slow units, LUKS passphrase handling, and failure display. Text-based (not graphical), but it proves the categorized-overlay concept works and has a working systemd D-Bus/journal reader.
- **aarambh** (C, UEFI) — a full graphical UEFI boot manager that replaces GRUB/systemd-boot with animated themes and seamless handoff into Plymouth. Solves the "what does the user see between firmware and kernel" problem.
- **plymouth-slint** (Rust) — a Plymouth splash engine that renders Slint UI files. If you want modern rendering (shaders, animations, layout) without writing a C splash plugin from scratch, this is the path.
- **singularity-boot-splash** — a toolkit-less KMS boot splash that bypasses Plymouth entirely. Proof that a minimal custom renderer on DRM is viable.
- **Pop!_OS and CachyOS** both maintain Plymouth forks with distro-specific patches. Precedent for owning the splash as a first-party package.

## The architecture you're building

```
┌─────────────────────────────────────────────────────────────────────┐
│  FIRMWARE LAYER                                                     │
│  OVMF (UEFI)  ──►  aarambh / GRUB / systemd-boot  (branded menu)   │
│  SeaBIOS      ──►  bootsplash image (brand logo)                    │
├─────────────────────────────────────────────────────────────────────┤
│  KERNEL + INITRAMFS                                                 │
│  KMS early  ──►  Plymouth (or replacement) owns the DRM output      │
│  initramfs  ──►  LUKS prompt, storage, network (categorized)        │
├─────────────────────────────────────────────────────────────────────┤
│  SYSTEMD (PID 1)                                                    │
│  unit state machine  ──►  structured events → Plymouth socket       │
│  (patched)                category|progress|total|status            │
├─────────────────────────────────────────────────────────────────────┤
│  RENDERING LAYER                                                    │
│  Plymouth script theme (simple)                                     │
│  Plymouth custom plugin (C, full control)                           │
│  plymouth-slint (Slint UI, modern)                                  │
│  Custom KMS renderer (no Plymouth dependency)                       │
└─────────────────────────────────────────────────────────────────────┘
```

## What you own (the distro-specific pieces)

| Component | Strategy | Effort |
|---|---|---|
| **Firmware image** | Ship OVMF as default. Include a branded `OVMF_VARS.fd` with your logo as the UEFI boot splash. For SeaBIOS (legacy fallback), a BMP bootsplash. | Low — asset + firmware packaging |
| **Bootloader** | Fork or configure GRUB with a branded theme (`GRUB_THEME`). Or adopt **aarambh** for a full graphical UEFI menu. Or systemd-boot with a custom `loader.conf` + `splash` passthrough. | Medium — theming or integration |
| **Plymouth** | Fork it (as Pop!_OS does). Add the protocol extensions (`N` for category update, `T` for phase). Ship as your distro's `plymouth` package. | Medium — C patches, well-bounded |
| **systemd** | Fork it. Add the categorization table (unit → category mapping as a config file) and the socket write in the unit state transition path. Ship as your distro's `systemd` package. | High — PID 1 changes, needs careful review |
| **Splash theme** | A script theme (fastest) or a Slint-based theme via `plymouth-slint` (most flexible). Or a custom C plugin if you need pixel-level control. | Medium — UI design + scripting or C |
| **Categorization config** | A drop-in file (e.g. `/etc/boot-experience/categories.conf`) mapping unit name patterns → categories. Shipped by default, user-overridable. | Low — just a config file |
| **Initramfs hook** | Your distro's dracut/mkinitcpio hook that ensures Plymouth starts before `crypt`, after `systemd`/`udev`. Standard, but you control the ordering. | Low |

## The systemd patch (the hard part)

This is the piece that makes it "distro-specific" in the meaningful sense. Concretely:

1. **Add a categorization table.** At unit-load time, systemd resolves each unit's category from a config file (or `SyslogIdentifier`/`PartOf=` as a fallback). Store it in the `Unit` struct as a small enum or string pointer.

2. **Emit the event on state transition.** In `manager_dispatch_unit_job` (or wherever `unit_set_state` is called), after the existing `U` + unit name write to the Plymouth socket, append the category, progress, total, and status. The total is the count of units in that category that are in the current target's dependency closure — computable at target-activation time.

3. **Phase boundaries.** When a target reaches `active`, send a `T` + target name. This is the "phase transition" signal.

4. **Critical path.** When a unit is the longest-running active unit on the critical chain to the current target, mark it. This is the existing `critical-chain` logic, just exposed per-event instead of post-hoc.

**Upstream risk:** this will never go upstream. You're maintaining a systemd fork. The mitigation is to keep the patch **small and isolated** — ideally a single new file (`src/core/plymouth-categorize.c`) called from one existing function, so rebase cost against upstream systemd is a single hunk per release.

## The test matrix

This is where distro-specific boot experiences die. You need to test the **full matrix**:

| Axis | Values |
|---|---|
| Firmware | SeaBIOS (legacy), OVMF (UEFI), OVMF + Secure Boot, CSM on UEFI hardware |
| GPU | Intel iGPU, AMD (amdgpu), NVIDIA (proprietary + `nvidia-drm.modeset=1`), virtio-gpu, cirrus (no KMS) |
| Storage | Direct (no LUKS), LUKS, LVM, md RAID, NFS root, iSCSI |
| Network | None, DHCP, static, NetworkManager, systemd-networkd |
| Display | Single monitor, multi-monitor, headless (no output), iKVM |
| Boot path | Normal, recovery mode, A/B (dual firmware mode), fast boot (timeout=0) |
| Failure | Unit fails mid-boot, Plymouth crashes, GPU driver fails to load, initramfs hangs |
| Performance | Cold cache (first boot after install), warm cache, slow disk (HDD), fast NVMe |

**Minimum viable test set** (what you can't skip):
- OVMF + Intel + LUKS + single monitor (the happy path)
- SeaBIOS + NVIDIA + no LUKS + headless (the worst case for graphics)
- OVMF + virtio-gpu + NFS root (the VM case)
- Any firmware + any GPU + Plymouth disabled (the escape hatch must always work)

## Packaging / distribution concerns

- **The splash must be in the initramfs.** This means your Plymouth fork (or replacement) must be buildable as a static binary that fits in the initramfs. A Slint-based renderer might be too large; a script theme + stock Plymouth is ~2 MB.
- **The systemd fork must be the distro's `systemd` package.** You can't ship a separate "boot-experience" package that patches PID 1 at runtime. The categorization code must be compiled into systemd itself.
- **Fallback is mandatory.** If the GPU driver fails, if Plymouth crashes, if the initramfs is corrupt — the system must still boot to a text console. Your packaging must ensure that `plymouth.enable=0` + removing `splash` from the kernel cmdline always works, and that the categorization code in systemd is a no-op when the Plymouth socket isn't connected.
- **Rebase cost.** You're forking two major projects (Plymouth, systemd). Budget for a rebase per upstream release. The Plymouth fork is cheap (small codebase). The systemd fork is expensive — keep the patch surface minimal.

## Suggested build order

1. **Week 1–2:** Branded script theme (Path 1 from earlier). No Plymouth or systemd changes. Validate the UX with heuristics-based categorization. Ship it.
2. **Week 3–4:** Fork Plymouth, add the `N`/`T` protocol codes. Write the custom theme that consumes them. Ship the Plymouth fork.
3. **Month 2:** Fork systemd, add the categorization + socket write. This is the long pole — needs careful review and testing.
4. **Month 3:** OVMF branding, bootloader theming, full test matrix, packaging, documentation.
5. **Ongoing:** Rebase against upstream Plymouth/systemd each release. Monitor for upstream changes to the Plymouth protocol or systemd's unit state machine.

**The key insight:** you don't need to build all of this at once. The script theme (step 1) is shippable in a week and gives you 70% of the perceived value. The systemd patch (step 3) is what makes it *correct* (real totals, real states, critical path) but it's also what makes it *yours* — the thing that can't be replicated by a user installing a theme package.


> Why would we not fork or utilize an existing project that does this?

The short answer: **none of them do the full stack**, and each solves a different slice of the problem. Here's why "just adopt X" doesn't work for any single project:

## Scope mismatch — each project is a different layer

| Project | What it does | What it *doesn't* do |
|---|---|---|
| **bootvine** (v0.1.5, very active) | Live TUI tree of systemd jobs on a **dedicated VT**. Replaces scrolling text with a readable tree. LUKS prompt, failure display, shutdown tracking. | It's **text-based** (ratatui), not a graphical framebuffer overlay. It doesn't touch Plymouth, KMS, or DRM. It can't render on the same output as the firmware splash. No categorized progress bars. |
| **aarambh** | Graphical **UEFI boot manager** (replaces GRUB/systemd-boot). Animated themes, seamless handoff into Plymouth. | It's the **pre-kernel** layer only. Once the kernel starts, it's done. No categorized overlay during systemd boot. x86_64 UEFI only — no legacy BIOS, no ARM. |
| **plymouth-slint** | A Plymouth splash **engine** that renders `.slint` UI files. Modern rendering (layout, animation, shaders) without writing a C plugin. | It's a **renderer**, not an event model. It consumes the same flat `U`/`u` protocol as stock Plymouth. No categorized events, no totals, no critical path. You'd still need the systemd patch + protocol extension. |
| **Pop!_OS / CachyOS Plymouth forks** | Distro-branded themes, minor patches. | No protocol extension, no categorized events. They're cosmetic, not architectural. |

## The specific reasons not to just fork one

**1. bootvine is the wrong abstraction.**
It's a TUI that *replaces* the console. Your goal is a graphical overlay *on the framebuffer* (DRM/KMS), which is a fundamentally different rendering target. You can't port bootvine's ratatui code to a Plymouth splash plugin — the input model (VT cell grid) and output model (DRM framebuffer) are incompatible. What you *could* borrow is its **D-Bus/journal reading logic** (the Rust code that subscribes to `org.freedesktop.systemd1.Manager` signals and maintains the unit tree). That's a useful reference implementation, but it's a component, not a project you'd ship.

**2. aarambh is the wrong layer.**
It solves "what does the user see between firmware and kernel." Your problem is "what does the user see *during* systemd boot." You could *use* aarambh as your bootloader (it's well-designed and handles the Plymouth handoff cleanly), but it doesn't help with the categorized overlay. It's a complementary piece, not a replacement for your architecture.

**3. plymouth-slint is the right rendering layer but not the event model.**
This is the one you'd actually want to **adopt** (not fork). It gives you modern rendering (Slint layout, animation, theming) on top of Plymouth's existing DRM/KMS infrastructure. Your categorized overlay would be a `.slint` file with progress bars per category, fed by the extended protocol. You don't need to fork it — you just need the protocol extension on the Plymouth *daemon* side (the `N`/`T` commands) and a Slint theme that binds to the new properties. The question is whether plymouth-slint's property interface is extensible enough to accept arbitrary category data, or whether you'd need to patch it to add `category_progress`, `category_total`, `category_status` as new bindable properties.

**4. The systemd patch is the thing that's genuinely new.**
No existing project patches systemd to emit categorized events with totals and critical path. This is the core differentiator and the thing that makes the experience *correct* (real denominators, real states) rather than *approximate* (heuristics, missed early events). You can't get this from any existing project.

## The pragmatic answer: a hybrid

You don't fork or build from scratch. You **compose**:

| Layer | Source | Your work |
|---|---|---|
| UEFI boot manager | **aarambh** (adopt as-is or lightly theme) | Brand assets, integration with your distro's installer |
| Rendering engine | **plymouth-slint** (adopt, possibly patch for new properties) | A `.slint` theme file for your categorized overlay |
| Event protocol | **Your Plymouth fork** (add `N`/`T` commands) | ~200 lines of C in `ply-boot-protocol.h` + `ply-boot-server.c` |
| Event source | **Your systemd fork** (categorization + socket write) | ~300 lines of C, one new file, one call site |
| Categorization logic | **Informed by bootvine's D-Bus subscription code** | A config file + hash table, not a full TUI |
| Fallback | Stock Plymouth script theme | No work — it's already there |

The reason you can't just "use bootvine" or "use aarambh" is that **the value is in the integration** — the systemd patch that makes the data correct, the protocol extension that makes it structured, and the Slint theme that makes it look like *your* distro. Each existing project is a useful component in the stack, but the glue is what you're building.

One more consideration: **bootvine is 3 weeks old** (first release Oct 30, 2026; v0.1.5 Nov 23). It's in Arch/CachyOS/NixOS but has no track record of surviving a systemd release cycle. It's a great *reference implementation* for the D-Bus subscription logic, but building your distro's boot experience on a 3-week-old project as a hard dependency is risky. The systemd patch is your moat — it's the piece that takes months to get right and that no upstream project is going to provide.




## Staged Rollout

Each stage is independently shippable and gates the next.

---

### Stage 0 — Baseline & Telemetry (Week 1)

**Scope:** No new UI. Instrument what you have.

- Ship a stock Plymouth theme with your logo (cosmetic only).
- Enable `initcall_debug` in a debug kernel build; collect `systemd-analyze blame` and `critical-chain` data from 20–50 real user boots.
- Build the test matrix harness (automated boot captures across firmware/GPU/storage combos) even if you only run 2–3 configs.

**Deliverable:** A performance baseline (p50/p95 boot time per config) and a dependency graph of what actually gates your target users' boot.

**Gate to proceed:** You know which 5–10 units dominate the critical path for your target hardware. You have a reproducible test environment.


> We could approach this in stages instead of immediately doing full boot screen control.  Outline what the stages would be.

---

### Stage 1 — Branded Script Theme (Week 2–3)

**Scope:** Path 1 from earlier. Heuristics-based categorization in a Plymouth script theme. No daemon changes, no systemd changes.

- Write the `.script` theme with 4–6 category bars.
- Categorize by unit-name substring matching (the table from the earlier answer).
- Ship as a `plymouth-theme-yourdistro` package. Users select it with `plymouth-set-default-theme`.
- Add `--show-splash` / `--hide-splash` calls in your initramfs hook (if not already present).

**Deliverable:** A shippable theme package. Users see "Storage 3/5, Network carrier, Display ready" during boot.

**Gate to proceed:** You have user feedback (even internal) confirming the categorized view is *legible and useful* vs. a spinner. If it's not, stop here and iterate on the UI before investing further.

---

### Stage 2 — Protocol Extension + External Agent (Month 2)

**Scope:** Path 2. The structured protocol, but sourced by a **separate agent** (not a systemd patch yet).

- Fork Plymouth. Add `N` (category update) and `T` (phase transition) to `ply-boot-protocol.h` and `ply-boot-server.c`.
- Expose `Plymouth.SetCategoryUpdateFunction` and `Plymouth.SetPhaseFunction` in the script theme engine (or in plymouth-slint if you adopt it).
- Write the agent: a small C or Rust binary that opens the journal, subscribes to D-Bus `UnitNew`/`JobNew` signals, maintains per-category counters, and writes `N`/`T` to the Plymouth socket.
- Ship the agent as a `static` systemd service, `Before=basic.target`, `After=systemd-udevd.service`.
- Update the theme to consume `N`/`T` instead of (or in addition to) the `U` heuristic.

**Deliverable:** Real unit states (active/failed/activating), real phase boundaries, and progress totals that are *approximately* correct (agent counts units as they arrive; total is estimated from the unit list at agent start).

**Gate to proceed:** The agent's event stream is complete enough that the overlay is *correct* for >90% of units. You've measured the latency gap (agent startup vs. first event) and it's <200 ms on your target hardware. If the gap is too large, you need the systemd patch (Stage 3).

---

### Stage 3 — Systemd Patch (Month 3–4)

**Scope:** The categorization moves into PID 1. The agent is retired.

- Fork systemd. Add `src/core/boot-experience.c` (~300 lines): categorization table load, per-category counters, critical-path tracking.
- One call site in the unit state transition path: after the existing `U` write, append the `N` payload (category, progress, total, status).
- One call site at target activation: send `T` + target name.
- The categorization table is a config file (`/etc/boot-experience/categories.conf`), parsed once at startup.
- Keep the patch to **one new file + two hunks** in existing code. Rebase cost per upstream release: trivial.
- The agent from Stage 2 becomes a no-op (or is removed) — systemd is now the sole event source.

**Deliverable:** Zero-latency, zero-loss categorized events with correct totals and critical path. The overlay is *correct*, not approximate.

**Gate to proceed:** You've run the full test matrix (firmware × GPU × storage × failure modes) and the systemd patch introduces no regressions. Boot time delta vs. unpatched systemd is <50 ms (should be ~0).

---

### Stage 4 — Full Stack Integration (Month 4–5)

**Scope:** The pre-kernel and post-kernel layers are unified under one visual identity.

- **Bootloader:** Adopt aarambh (or theme GRUB/systemd-boot). Branded menu, animated logo, seamless handoff to Plymouth (matching resolution, no flicker).
- **Firmware:** Branded OVMF_VARS.fd (UEFI splash). SeaBIOS bootsplash BMP for legacy.
- **Plymouth → display manager handoff:** The categorized overlay transitions smoothly into the login screen (same resolution, same color profile, no black frame).
- **Failure UX:** If a unit fails, the overlay shows it (red indicator + unit name) *and* the system still reaches a usable state (text console, recovery shell).
- **Headless fallback:** If no DRM output is detected, the entire graphical stack is a no-op. Text console is unaffected.

**Deliverable:** A complete, branded boot experience from power-on to login, across all supported hardware configs.

**Gate to proceed:** Full test matrix passes. The experience is consistent across firmware, GPU, and storage configurations.

---

### Stage 5 — Ongoing Maintenance

**Recurring tasks:**

| Task | Cadence |
|---|---|
| Rebase Plymouth fork against upstream | Per upstream release (~yearly) |
| Rebase systemd fork against upstream | Per stable release (~quarterly) |
| Update categorization table | Per distro release (new units added) |
| Run full test matrix | Per RC candidate |
| Monitor bootvine / plymouth-slint / aarambh for upstreamable improvements | Monthly |

---

### What each stage buys you (and the cost of stopping)

| Stop at | You have | You don't have |
|---|---|---|
| **Stage 1** | Branded, categorized splash. Shippable in 3 weeks. | Real states, real totals, critical path. Pre-kernel branding. |
| **Stage 2** | Structured events, real states. ~90% correct. | Zero-latency delivery. Correct denominators. |
| **Stage 3** | Correct, complete event stream. Your moat. | Pre-kernel branding. Unified visual identity. |
| **Stage 4** | The full experience. | — |

**The key property of this sequence:** every stage is a *complete, shippable product*. You never have a half-working boot screen in a release. If you run out of time or budget at any stage, the previous stage is your release.



> why plymouth instead of GRUB modification?

Because GRUB can't do the job. The constraint is **when** and **what**:

**GRUB runs before the kernel.** It has no access to:
- systemd (doesn't exist yet)
- D-Bus (no bus, no PID 1)
- the journal (no filesystem)
- unit state, dependency graph, or critical path

The data your categorized overlay needs — "Storage 3/5 active, NetworkManager on critical path, 2.3s" — **doesn't exist until the kernel is running and systemd is PID 1.** GRUB is a bootloader. Its job ends at `boot`.

**What GRUB *can* do** (and what you'd get if you tried):
- A static image or animation (a logo, a spinner)
- A boot menu with a themed background
- A countdown timer

That's it. GRUB's execution environment is a few MB of RAM, a limited instruction set (its own bytecode), and a framebuffer in whatever mode it set. It can't subscribe to events, parse a dependency graph, or render a dynamic multi-category progress view. You'd be writing a mini-OS in GRUB's bytecode to do what a 200-line C program does trivially in userspace.

**The division of labor is inherent:**

| Layer | Time window | Data available | Role |
|---|---|---|---|
| **GRUB / aarambh** | Firmware → kernel entry | Static (boot entries, logo) | "Pick a boot entry" |
| **Plymouth** | Kernel init → display manager | systemd units, D-Bus, journal, KMS/DRM | "Show what's happening" |

Plymouth is the first component that has **both** a display (KMS framebuffer) **and** access to the system's runtime state (via the socket protocol, the journal, D-Bus). That's why it's the right layer.

The one exception: if your "categorized overlay" were just a **static progress animation** (a pre-baked sequence of category icons lighting up on a timer, with no real data), you *could* do it in GRUB. But that's a fake — it doesn't reflect actual boot progress. The whole point of the architecture we've been discussing is that the overlay is **driven by real events**, which only exist post-kernel.


> If we shipped it on USB sticks, we would want to customize GRUB, right?

Yes, and the USB case has a few specifics that make GRUB customization more important than the disk-install case:

**Why it matters more on USB:**

- **The GRUB menu IS the product demo.** On a disk install, the user already chose your distro. On a USB stick, the GRUB screen is the first thing a prospective user sees — it's the 30-second pitch. A stock GRUB menu (black background, white text, "Ubuntu" or whatever) undermines the brand you've built in Plymouth.
- **The boot entries are different.** You need "Try Live," "Install," possibly "Persistent Install," and "Recovery." Each has a different kernel cmdline (`live`, `persistence`, `single`, etc.). This is more complex than a standard installed-system menu.
- **Device detection is unstable.** The USB stick might be `/dev/sdb` on one machine and `/dev/sdc` on another. GRUB must use `search --label` or `search --fs-uuid` rather than hardcoded paths. If you ship a custom `grub.cfg` template, you need to handle this correctly or the stick won't boot on half the machines you test it on.

**What you'd actually customize:**

| Piece | Why |
|---|---|
| **Theme** (`GRUB_THEME`) | Brand logo, background, font. This is the visible part. |
| **`grub.cfg` template** | Live-specific entries (Try/Install/Persistent), correct `search` commands for USB, `live` and `persistence` kernel params. |
| **`GRUB_GFXMODE`** | Must match what Plymouth will use, or you get a mode-switch flicker at the GRUB→kernel boundary. On USB sticks with varied hardware (different GPUs in different test machines), this is where things break. |
| **Timeout** | Shorter than installed (5 s vs. 30 s). A USB user who's evaluating wants to boot fast; a long timeout feels like a broken stick. |
| **`GRUB_TIMEOUT_STYLE=hidden`** | Optional. If you only ship one entry ("Try Live"), skip the menu entirely and auto-boot. Saves 5 s. |

**What you *don't* do in GRUB for USB:**

- You don't put the categorized overlay here (same reasoning as before — no systemd, no data).
- You don't try to make GRUB "smart" about the hardware. Keep it to a static theme + a fixed set of entries. The intelligence lives in the kernel cmdline and the live initrd.

**The handoff chain on USB:**

```
Firmware (UEFI/BIOS) → GRUB (branded menu, 5 s) → kernel + live initrd
  → Plymouth (categorized overlay from your fork) → live session autologon
```

The GRUB→Plymouth transition is the one you need to make seamless (matching `GRUB_GFXMODE` to the KMS mode, `GRUB_GFXPAYLOAD_LINUX=keep`). On a USB stick, that flicker is more noticeable because the user is watching the whole boot sequence as a "demo" rather than just waiting for their system to come up.

**Practical note:** if you're using **aarambh** as your UEFI bootloader (from the Stage 4 plan), it replaces GRUB for the UEFI path and handles the live-boot entries natively. GRUB would then only be the **legacy/CSM fallback** for the USB stick. That simplifies things — you theme aarambh for the primary path and keep a minimal GRUB config for the fallback.


