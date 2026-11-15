/**
 * flat-data.js — the machine Flat Space is a window onto.
 *
 * All of the environment's content is mock computer data, realistic
 * for a Linux workstation: a home directory and system tree with
 * plausible files and sizes (KiB), mail from the machine's own
 * daemons and from people, chat channels, documents, media files,
 * and the terminal's view of the same tree. One dataset, every
 * frame reading from it — FILES and SUNBURST draw the tree, MAIL
 * reads the folders, TERMINAL's ls walks the same root.
 *
 * Tree shape: { name, value?, children? } — leaves carry value
 * (KiB); branch values are summed by the layout modules.
 */

export const FS_TREE = {
  name: "/",
  children: [
    { name: "home", children: [
      { name: "noct", children: [
        { name: "Documents", children: [
          { name: "install-checklist.md", value: 6 },
          { name: "work-notes.md", value: 14 },
          { name: "meeting-notes-2026-11-12.md", value: 9 },
          { name: "invoices", children: [
            { name: "2026-11-electric.pdf", value: 212 },
            { name: "2026-10-hosting.pdf", value: 148 },
            { name: "taxes-2025.pdf", value: 1480 },
          ] },
          { name: "backup-checklist.txt", value: 3 },
        ] },
        { name: "Projects", children: [
          { name: "noctivagous-linux", children: [
            { name: "demo-de", value: 48200 },
            { name: "refs", value: 940 },
            { name: "README.md", value: 12 },
          ] },
          { name: "strokecore", children: [
            { name: "src", value: 1240 },
            { name: "docs", value: 380 },
            { name: "specimens", value: 2600 },
          ] },
          { name: "nibglider", children: [
            { name: "src", value: 3100 },
            { name: "docs", value: 640 },
          ] },
          { name: "hanjian-reader", children: [
            { name: "src", value: 1800 },
            { name: "assets", value: 12400 },
          ] },
          { name: "keypilot", children: [
            { name: "extension", value: 860 },
            { name: "layouts", value: 96 },
          ] },
        ] },
        { name: "Pictures", children: [
          { name: "screenshots", children: [
            { name: "flat-space-home.png", value: 842 },
            { name: "ui-space-slice15.png", value: 1170 },
            { name: "treemap-cube.png", value: 655 },
          ] },
          { name: "photos", children: [
            { name: "desk-setup.jpg", value: 3400 },
            { name: "whiteboard-nov.jpg", value: 2900 },
            { name: "workshop.jpg", value: 4100 },
          ] },
        ] },
        { name: "Music", children: [
          { name: "Boards of Canada", children: [
            { name: "01 Roygbiv.flac", value: 8400 },
            { name: "02 Wildlife Analysis.flac", value: 3900 },
          ] },
          { name: "Aphex Twin", children: [
            { name: "01 Xtal.flac", value: 12100 },
            { name: "02 Tha.flac", value: 16800 },
          ] },
          { name: "loose", children: [
            { name: "focus-mix-03.mp3", value: 9400 },
          ] },
        ] },
        { name: "Videos", children: [
          { name: "screencasts", children: [
            { name: "ui-space-slice15-demo.mp4", value: 86400 },
            { name: "terminal-session.cast.mp4", value: 22100 },
          ] },
          { name: "call — mara, 2026-11-12.mp4", value: 148000 },
        ] },
        { name: "Downloads", children: [
          { name: "fwupd-1.9.27.cab", value: 28600 },
          { name: "kitty-0.44.tar.gz", value: 5400 },
          { name: "invoice-2291.pdf", value: 96 },
        ] },
        { name: ".config", children: [
          { name: "nvim", value: 420 },
          { name: "kitty", value: 64 },
          { name: "gtk-3.0", value: 18 },
        ] },
      ] },
    ] },
    { name: "usr", children: [
      { name: "bin", value: 412000 },
      { name: "lib", value: 2860000 },
      { name: "share", value: 1740000 },
      { name: "local", value: 96000 },
    ] },
    { name: "var", children: [
      { name: "log", children: [
        { name: "journal", value: 524288 },
        { name: "apt", value: 18400 },
        { name: "nginx", value: 9200 },
        { name: "kern.log", value: 6400 },
      ] },
      { name: "cache", value: 812000 },
      { name: "backups", value: 1250000 },
      { name: "tmp", value: 24000 },
    ] },
    { name: "etc", children: [
      { name: "ssh", value: 42 },
      { name: "systemd", value: 310 },
      { name: "nginx", value: 24 },
      { name: "fstab", value: 1 },
      { name: "hostname", value: 1 },
    ] },
    { name: "opt", children: [
      { name: "google", value: 684000 },
      { name: "zoom", value: 412000 },
    ] },
    { name: "boot", children: [
      { name: "vmlinuz-6.12.9", value: 13200 },
      { name: "initramfs-6.12.9.img", value: 68400 },
      { name: "grub", value: 8400 },
    ] },
    { name: "tmp", value: 18400 },
  ],
};

/* ---------------- MAIL ---------------- */

export const FOLDERS = [
  { id: "inbox", name: "Inbox" },
  { id: "sent", name: "Sent" },
  { id: "drafts", name: "Drafts" },
  { id: "trash", name: "Trash" },
];

export const MAIL_SEED = [
  { id: "m1", folder: "inbox", from: "backup@noct-pc", subject: "Nightly backup completed — 14.2 GB in 11 min", when: "06:12", body: "rsync finished without errors.\n\nSent: 14.2 GB in 3,812 files (212 changed)\nTarget: /var/backups/noct-pc/2026-11-14\nNext run: tonight 03:30. The journal snapshot is included; /var/cache is excluded as configured." },
  { id: "m2", folder: "inbox", from: "apt@noct-pc", subject: "3 packages can be upgraded", when: "06:40", body: "The following packages have newer versions available:\n\nlinux-image-6.12.9 → 6.12.11 (security)\nfwupd 1.9.26 → 1.9.27\nkitty 0.43 → 0.44\n\nRun SOFTWARE in the environment, or: sudo apt upgrade" },
  { id: "m3", folder: "inbox", from: "s.rivera@example.net", subject: "Re: demo-de review — notes from Thursday", when: "yesterday", body: "Walked through the 2D environment build this morning. The bulletin board reads instantly now that every frame is on it, and the flow graph is the first settings page I've seen that is also a map.\n\nOne ask: the terminal should answer `open` for every frame by name, not just id. Otherwise — ship it.\n\n— S." },
  { id: "m4", folder: "inbox", from: "ci@builds.example", subject: "[noctivagous-linux] demo-de build passed on main", when: "yesterday", body: "Commit 84d48ae built clean: vite production build, 25 files changed.\n\nflat-keys 69/69 · flat-graph 245 · driven 60/60\nDeploy: Vercel production updated." },
  { id: "m5", folder: "inbox", from: "mara@studio.example", subject: "Fonts for the banner job — files attached", when: "2d ago", body: "Attaching the two cuts we talked about: the Speedball-style caps for the headline and a text face for the body. The ductus notes are in the second file — the nib angle changes are marked per letter.\n\nLicence is clear for print and web.\n\n— Mara" },
  { id: "m6", folder: "sent", from: "you", subject: "Re: demo-de review — notes from Thursday", when: "yesterday", body: "Thanks — the `open` by name point is fair, it lands with the navigation pass. The flow graph pulling double duty as map and index is the idea I'm most sure of in the whole build.\n\n— noct" },
  { id: "m7", folder: "drafts", from: "you", subject: "Draft: winter travel — trains", when: "draft", body: "Out: Thursday evening, arrive Friday morning. Back: Sunday. Check the sleeper prices before they move, and whether the station hotel still does late check-in…" },
  { id: "m8", folder: "trash", from: "deals@promo.example", subject: "FINAL NOTICE: your invoice (not a real invoice)", when: "9d ago", body: "Flagged by the filter as a phish and moved here. Nothing in it was followed." },
];

/* ---------------- CHAT ---------------- */

export const THREADS_SEED = [
  {
    id: "ops", name: "OPS CHANNEL", who: "relay",
    msgs: [
      { from: "relay", text: "03:30 backup window opened" },
      { from: "relay", text: "rsync /home → /var/backups: 212 files changed" },
      { from: "you", text: "ack — anything fail?" },
      { from: "relay", text: "clean. journal snapshot included, next run tomorrow 03:30" },
    ],
    replies: ["Relay: noted.", "Relay copies that.", "Relay: on it — watching the queue.", "Relay: logged."],
  },
  {
    id: "general", name: "#GENERAL", who: "mara",
    msgs: [
      { from: "mara", text: "morning — the new build is up on the demo link" },
      { from: "kenji", text: "the flow view sold it for me. it's a settings page that's also a map" },
      { from: "you", text: "that's the intent — the graph is the index" },
    ],
    replies: ["ha — exactly", "did the terminal land too?", "morning! checking it now"],
  },
  {
    id: "dev", name: "#DEV", who: "kenji",
    msgs: [
      { from: "kenji", text: "pushed the layout fix — chips no longer cover panel titles" },
      { from: "you", text: "saw it. driven suite is green again" },
      { from: "kenji", text: "next: the nav graph. F should click everything or the model leaks" },
    ],
    replies: ["agreed — D too, it has to go back everywhere", "there's a test for that now", "ship it when the suite's green"],
  },
];

/* ---------------- DOCUMENTS ---------------- */

export const DOCS_SEED = [
  { id: "install", title: "Fresh install checklist", body: "Base system first, then the desktop. Update the mirror list, install the kernel headers, and reboot once before touching the graphics stack. Add the user to the video and input groups. Only then clone the environment repos and initialise the submodules." },
  { id: "review-notes", title: "demo-de review notes", body: "Thursday's walkthrough, condensed.\n\nThe board is the home truth: if a frame isn't on it, it doesn't exist yet. The flow graph is both map and index. Key-clicks hold up — F clicks, D goes back, Esc unwinds — provided the mode (nav vs text) is always visible and always escapable.\n\nOpen questions: free windows on the board; whether the dolly should remember per-frame zoom." },
  { id: "runbook", title: "Backup & restore runbook", body: "Nightly: rsync /home and /etc to /var/backups, journal snapshot first. Weekly: verify one restore into /tmp/restore-check and diff the tree. Monthly: copy the month folder off-machine.\n\nRestore order: base system, then /etc, then home. Never restore .cache." },
];

/* ---------------- MEDIA ---------------- */

export const MEDIA_ITEMS = [
  { id: "slice15-demo", title: "ui-space-slice15-demo.mp4", kind: "CLIP", dur: 94 },
  { id: "terminal-cast", title: "terminal-session.cast.mp4", kind: "CLIP", dur: 47 },
  { id: "call-mara", title: "call — mara, 2026-11-12.ogg", kind: "TRACK", dur: 623 },
  { id: "focus-mix", title: "focus-mix-03.mp3", kind: "TRACK", dur: 1520 },
  { id: "desk-photo", title: "desk-setup-2026-11.jpg", kind: "STILL", dur: 12 },
  { id: "whiteboard", title: "whiteboard-nov.jpg", kind: "STILL", dur: 12 },
];
