/**
 * flat-web.js — the WEB frame's captured pages.
 *
 * The web enters this environment the DETACH way (the Carry → Detach →
 * Native ladder from the UI Space slice-15 design): a page is taken
 * apart and rebuilt as the environment's own furniture — its text as
 * reading matter, its LINKS AS SUBNODES that wear labels and are
 * followed with F, exactly like every other addressable thing here.
 * These three pages are captured ahead of time as data (a deployed
 * static site cannot load the live web); the live version rides the
 * local bridge driving the user's own browser, as Mission Desk does.
 *
 * A page: { id, url, title, blocks: [{ t: "h"|"p", text }],
 *           links: [{ to, text }] } — `to` is another page's id.
 */

export const WEB_PAGES = [
  {
    id: "start",
    url: "flat://start",
    title: "Start — the captured web",
    blocks: [
      { t: "h", text: "The web, detached" },
      { t: "p", text: "This page was taken apart and rebuilt as furniture of the environment. Its links wear labels like everything else here: type a link's letters to target it, F follows it, D comes back — the browser's back button is the frame's own back, because in this paradigm there was never a second navigation system to bolt on." },
      { t: "p", text: "Three pages are captured in this build, the reading this machine actually does: the Arch installation guide, the rsync man page behind the nightly backup, and a kernel article. The address bar above takes their addresses (try flat://arch, or the full URL). The live web itself arrives through the local bridge in a later slice — the same pattern Mission Desk uses to drive the user's own browser." },
    ],
    links: [
      { to: "arch", text: "Arch Wiki — Installation guide" },
      { to: "rsync", text: "rsync(1) — the man page" },
      { to: "lwn", text: "LWN — Rust in the kernel, three years on" },
    ],
  },
  {
    id: "arch",
    url: "https://wiki.archlinux.org/title/Installation_guide",
    title: "Arch Wiki — Installation guide",
    blocks: [
      { t: "h", text: "Installation guide" },
      { t: "p", text: "This document is a guide for installing Arch Linux using the live system booted from an installation medium made from an official installation image. The installation medium provides accessibility features which are described on the page Install Arch Linux with accessibility options. For alternative means of installation, see Category:Installation process." },
      { t: "p", text: "Before you begin: verify the image signature, confirm the system is booted in UEFI mode, connect to the internet, and update the system clock. Partition the disks with fdisk or parted — the guide's examples use a root partition, an EFI system partition, and swap." },
      { t: "p", text: "Install the essential packages with pacstrap (base, the kernel, and firmware), generate an fstab, chroot into the new system, set the timezone and locale, configure the network, install a boot loader, reboot — and the machine is yours. The checklist in DOCUMENTS follows this order." },
    ],
    links: [
      { to: "rsync", text: "rsync(1) — the man page (for the backup step)" },
      { to: "start", text: "Back to Start" },
    ],
  },
  {
    id: "rsync",
    url: "https://man7.org/linux/man-pages/man1/rsync.1.html",
    title: "rsync(1) — man page",
    blocks: [
      { t: "h", text: "rsync — a fast, versatile, remote (and local) file-copying tool" },
      { t: "p", text: "rsync copies files either to or from a remote host, or locally on the current host (it does not support copying files both to and from a remote host). It is famous for its delta-transfer algorithm, which reduces the amount of data sent over the network by sending only the differences between the source files and the existing files in the destination." },
      { t: "p", text: "The nightly job on this machine runs: rsync -aAX --delete --link-dest=<yesterday> /home/ /var/backups/noct-pc/<today>/ — archive mode, hard-linked against yesterday's snapshot so each night costs only the changed files. MAIL carries its report each morning." },
      { t: "p", text: "Options the runbook relies on: -a (archive: recursive, preserves permissions, times, symlinks), -X (extended attributes), --link-dest (hard-link unchanged files against a previous copy), --exclude for /var/cache and other rebuildable trees." },
    ],
    links: [
      { to: "arch", text: "Arch Wiki — Installation guide" },
      { to: "start", text: "Back to Start" },
    ],
  },
  {
    id: "lwn",
    url: "https://lwn.net/Articles/984763/",
    title: "LWN — Rust in the kernel, three years on",
    blocks: [
      { t: "h", text: "Rust in the kernel, three years on" },
      { t: "p", text: "Three years after the first Rust code landed in the mainline kernel, the experiment has settled into something more mundane and more interesting: a second language with a growing set of subsystems, a maintainers' summit that argues about tooling instead of existence, and a steady trickle of drivers written the new way." },
      { t: "p", text: "The remaining friction is not technical but generational — documentation habits, review bandwidth, and the long tail of architectures the Rust toolchain does not yet reach. None of it has stopped the merges; all of it shapes their pace." },
      { t: "p", text: "For a workstation on 6.12, the practical upshot is small but real: two of the drivers this machine loads daily are now Rust, and the sky has not fallen." },
    ],
    links: [
      { to: "start", text: "Back to Start" },
    ],
  },
];

export const webPageById = (id) => WEB_PAGES.find((p) => p.id === id) || WEB_PAGES[0];

/** Resolve typed address text to a captured page, or null. */
export function resolveWebAddress(text) {
  const q = String(text || "").trim().toLowerCase();
  if (!q) return null;
  return (
    WEB_PAGES.find((p) => p.url.toLowerCase() === q) ||
    WEB_PAGES.find((p) => p.id === q) ||
    WEB_PAGES.find((p) => p.title.toLowerCase().includes(q)) ||
    null
  );
}
