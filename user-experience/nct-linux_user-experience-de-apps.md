nct-linux_user-experience-de-apps


> I like things like LabelMaker, SignAndBannerMaker, ColorTheoryLab that make the computer useful.

This is the right instinct. These apps share a pattern that makes them ideal for your DE:

**The pattern: one input → one physical/digital artifact.**

No accounts, no cloud, no "suite." Open, fill in, export. The computer is a *tool*, not a content platform.

**The full category (what to build natively in your app kit):**

| Domain | App | Output |
|---|---|---|
| **Labels** | Label Maker (address, inventory, price, shipping) | Print to label printer (Brother, Dymo, Avery) |
| **Signs** | Sign / Banner Maker | SVG/PDF for vinyl cutter or print shop |
| **Color** | Color Theory Lab (mixing, palette, contrast check) | Recipe (parts by volume), hex/RGB/CMYK |
| **Barcodes** | Barcode / QR Generator | Print-ready image, or batch of labels |
| **Stencils** | Stencil Maker (lettering, shapes) | SVG for CNC/vinyl, or print for hand-cut |
| **Craft** | Cross-stitch / Needlepoint Chart | Print grid, or `.peg` file |
| **Pattern** | Sewing / Quilting Pattern | PDF with seam allowances, or SVG for cutter |
| **CNC / Vinyl** | Cut File Generator (Cricut/Silhouette/SV0) | `.svg` / `.dxf` / `.svs` |
| **Stationery** | Business Card / Envelope / Invitation | Print-ready PDF |
| **Menu** | Menu Designer (restaurant) | Print-ready PDF, multi-page |
| **Certificate** | Certificate / Award Generator | Batch: one template + CSV of names → N PDFs |
| **Carpentry** | Miter / Stair / Board Foot / Lumber Calculator | Cut list, material estimate |
| **Paint** | Paint Calculator (room dimensions → gallons) | Shopping list |
| **Tile** | Tile / Grout Calculator | Material estimate with waste factor |
| **Garden** | Garden Planner (bed layout, spacing, crop rotation) | Print layout, planting calendar |
| **Invoice** | Invoice / Quote Generator (small business) | PDF, email-ready |
| **Unit** | Unit Converter (imperial/metric, trade-specific) | — |
| **Recipe** | Recipe Scaler + Nutrition | Scaled ingredients, per-serving macros |
| **Budget** | Simple Expense / Budget Tracker (local, no cloud) | CSV export, monthly summary |
| **Address** | Local Contact / Address Book | Print mailing list, CSV, vCard |
| **Geometry** | Angle / Roof Pitch / Fence Calculator | Diagram + measurements |
| **Paper craft** | Cake Topper / Cut-Out Shape Generator | SVG for Cricut, or print for hand-cut |
| **Photo** | Photo Book / Layout Planner (page grid, caption) | Print-ready PDF for a service, or home printer |

**Why this category is a strategic fit for your DE:**

1. **Each app is small.** One MXML form + one XForms model + one C# output function. A day or two of work each, not a project.
2. **The XForms stack is perfect.** Input form → validation → calculated output → export. This is literally what XForms was designed for.
3. **Print integration is the killer feature.** Your DE's print system (CUPS/Print Spooler via GDExtension) makes "generate → print" a one-click flow. No "download PDF → open in browser → print."
4. **They fill the gap web apps leave.** The "free online label maker" has ads, a 5-label free tier, a watermark, or requires an account. Your app is local, instant, unlimited, and works offline.
5. **They make the DE feel *finished*.** A user who opens their DE and sees "Label Maker," "Sign Maker," "Color Lab" in the launcher thinks "this is a real product." A user who sees only a file manager and a terminal thinks "this is a distro."

**The architectural pattern for all of them:**

```
app.pck
├── model.xform          ← Input fields + validation + calculations
├── view.mxml            ← The form (drag from palette in the designer)
├── logic.cs             ← Output generation (SVG, PDF, CSV, print job)
├── theme.tres           ← Inherited from DE theme
└── output/              ← Templates for the output (label layout, sign frame, etc.)
```

The **form designer** (your XForms + MXML editor) is the meta-app that makes building these cheap. A developer (or a power user) drags fields onto a canvas, sets the XForms bindings, writes a 50-line C# output function, and ships a `.pck`. That's the "make the computer useful" pipeline.

**The one integration that unlocks the whole category:**

**Print + plotter.** A GDExtension that wraps CUPS (or the system spooler) and exposes:
- "Print this PDF to [printer]"
- "Send this SVG to [plotter/vinyl cutter]" (via the device's USB or network)
- "Batch: print N copies with merged fields from CSV" (mail merge)

That's the IrfanView-level utility that makes the whole category feel native rather than bolted-on.



> The DE should come, installed at setup time, with the kinds of apps that aren't top downloads but you need without asking for it.  Examples include a general purpose image viewer like IrfanView, a general purpose document viewer for PDF, ePub, a general purpose notepad editor, etc., a medium word processor like AbiWord.  We would probably re-theme all of them and make them custom editions.

This is the "utility layer" — the apps that make a DE feel *finished* rather than bare. The right mental model is: **what would ship on a Windows 11 machine out of the box?** (Photos, Notepad, Paint, WordPad, Calculator, Snipping Tool, File Explorer, Terminal, Settings, Task Manager, Control Panel, Media Player, Mail, Calendar, Maps, Cortana, Store.)

**The "IrfanView tier" — ship these natively:**

| Category | App to ship | Why this one |
|---|---|---|
| **Image viewer** | Custom (Godot) or **Nomacs** | IrfanView's role: open any image format, zoom/pan, basic edit (crop, rotate, resize), batch convert, no startup lag. Nomacs is Qt, fast, multi-backend. Or build in your app kit — it's a `TextureRect` in a scrollable window with keyboard shortcuts. |
| **PDF viewer** | **Zathura** (lightweight) or **MuPDF** (via your GDExtension) | Open, navigate, search, annotate, print. Zathura is 2MB, opens instantly. MuPDF gives you the rendering engine if you want it native. |
| **ePub reader** | **Calibre** (heavy, full-featured) or **KOReader** (lighter) | ePub is the gap. Calibre is the full suite (convert, library, sync). KOReader is the reader-only option. For a DE, a lightweight reader that just opens `.epub` files is the right scope. |
| **Notepad** | Custom (Godot) or **Gedit** / **Mousepad** | Single-file text editor. No project features, no LSP, no tabs (or minimal tabs). Open `.txt`, `.md`, `.log`, `.csv`. Find/replace. Line numbers optional. This is the app you open when you need to jot something down. |
| **Medium word processor** | **AbiWord** | The exact right weight. LibreOffice is 500MB and takes 4 seconds to start. AbiWord is 20MB, starts in under a second, handles `.docx`/`.odt`/`.rtf`, has basic styles, tables, images. It's the "WordPad that can actually do Word." |
| **Text editor (power)** | **Kate** or **Geany** | Notepad++ equivalent. Multi-file, syntax highlighting, regex search, terminal panel. Not an IDE, but more than Notepad. |
| **Calculator** | Custom (Godot) or **GCalc** | Scientific + programmer (hex/binary/octal). One window, no bloat. |
| **Archive manager** | **File Roller** or **Ark** | Open `.zip`, `.tar.gz`, `.7z`, `.rar`. Extract, add, test integrity. Right-click from file manager. |
| **Screenshot / screen recording** | Custom (Godot, compositor-level) | Region, window, full screen. OCR on selection. Share to clipboard. This MUST be native — it needs compositor access. |
| **Color picker** | Custom (Godot) | Eyedropper from screen. HEX/RGB/HSL. This is a 100-line app. |
| **System monitor** | **Gnome System Monitor** or **KSysGuard** | CPU, memory, disk, network, processes. Kill process. The "Task Manager." |
| **Clipboard manager** | **Clipboard Manager** (custom or **CopyQ**) | History of copied items. Pin items. Search. This is a panel-integrated feature, not a standalone app. |
| **Disk usage analyzer** | **Baobab** or **Dust** | Visual treemap of disk usage. "Why is my drive full?" |
| **Network monitor** | **Nethogs** or **iftop** (terminal) or custom | Per-process bandwidth. |
| **Terminal** | Custom (Godot) or **Kitty** / **Alacritty** | You already have this in your plan. |
| **Media player** | **VLC** or **MPV** | Play everything. MPV is lighter, VLC is more full-featured. Ship one. |
| **Music player** | **Lollypop** or **Clementine** | Library management, playlists, metadata editing. |
| **Video player** | **MPV** or **VLC** | (Same as above — one player for both.) |
| **Audio recorder** | **Simplescreenrecorder** or **Audacity** | Record system audio, microphone, or both. |
| **PDF/ePub/document converter** | **Calibre** or **Pandoc** (CLI) | Convert between formats. |
| **Password manager** | **KeePassXC** | Local, no cloud. The default. |
| **File transfer** | **LocalSend** | AirDrop equivalent. LAN file transfer. |
| **Settings / System** | Custom (Godot) | You already have this. |
| **Software center** | Custom (Godot) or **Flatseal** + **Discover** | Install/update Flatpaks, AppImages, system packages. |
| **Calendar / Clock** | Custom (Godot) | Panel-integrated. Quick add event. |
| **Mail** | **Thunderbird** (out-of-process) | You don't build mail. You launch it. |
| **Maps / Weather** | Web-based (browser) or custom | Low priority. |

**The "custom edition" / re-theming strategy:**

This is where your DE gets its identity. Three tiers:

**Tier 1: Native (built in your app kit)**

Apps you build from scratch in MXML + C# + Godot. These are the ones that need deep compositor/WM integration:
- Screenshot / screen recording
- Color picker
- Calculator
- Notepad (simple enough to build natively)
- Image viewer (a `TextureRect` + scroll + zoom is trivial in Godot)
- Settings / System
- App launcher
- Notification center
- File manager
- Terminal
- Software center
- Calendar / Clock (panel widget)

These use your SVG 9-slice chrome, your theming system, your layout engine. They *are* the design system.

**Tier 2: Re-themed (existing app, custom skin)**

Apps you take from upstream and apply your theme to. The mechanism depends on the toolkit:

| App | Toolkit | How to re-theme |
|---|---|---|
| AbiWord | GTK2 | GTK2 CSS (limited) or a custom GTK2 theme. AbiWord is GTK2, so your options are constrained. A custom `gtkrc` + icon theme. |
| VLC | Qt5 / GTK | Qt style sheet (QSS) + icon theme. Or the GTK theme. |
| MPV | None (own renderer) | Config file for OSD colors, fonts. Limited theming. |
| Gimp / Krita / Inkscape | GTK / Qt | Toolkit theme. |
| Thunderbird | XUL / GTK | GTK theme + a custom `userChrome.css`. |
| KeePassXC | Qt5 | QSS + icon theme. |
| Calibre | Qt5 | QSS + icon theme. |
| Nomacs | Qt5 | QSS + icon theme. |
| File Roller / Ark | GTK / Qt | Toolkit theme. |

The practical approach: ship a **GTK theme** and a **Qt style** that match your design language. Every GTK and Qt app picks them up automatically via the `GTK_THEME` and `QT_STYLE_OVERRIDE` environment variables (or the XDG settings). You don't fork them — you just provide the theme.

**Tier 3: As-is (out-of-process, unmodified)**

Apps where theming is impractical or unnecessary:
- Firefox, Chrome (own rendering, ignore system themes)
- Steam, games
- VS Code, JetBrains (own theming)
- Blender (own UI)
- JupyterLab (web-based)

These just get your window decorations (title bar, border) from the WM. The content is their own.

**The "custom edition" branding:**

For Tier 2 apps, "custom edition" means:
- Your icon set (replaces the app's default icons in the launcher)
- Your window decorations (title bar, border, buttons)
- Your theme (colors, fonts, spacing) via GTK/Qt theming
- A "branded" About dialog (optional, probably skip this — it's annoying)
- Pre-configured settings (e.g. VLC set to use your DE's media library path, AbiWord set to save in your Documents folder with your default font)

The key principle: **the user shouldn't be able to tell which apps are native and which are re-themed.** The visual language is consistent. A `Button` in your native file manager looks identical to a `Button` in AbiWord. A `Tooltip` in your terminal looks identical to a `Tooltip` in VLC. That's what makes it feel like a *finished product* rather than "a Linux distro with some apps installed."

**What NOT to ship:**

- A full office suite (LibreOffice is an out-of-process app the user installs)
- An IDE (VS Code, out-of-process)
- A browser (Firefox/Chrome, out-of-process)
- A DAW (Ardour, LMMS — too specialized)
- A full photo editor (GIMP — too heavy for "out of the box")
- A video editor (Kdenlive — too specialized)

The rule: **if the user needs it on day one to "use the computer," ship it. If they need it for a specific workflow, let them install it.** The IrfanView test: "I just want to open this image and look at it." That's day-one. "I want to do a 20-layer composite in Photoshop." That's not.




> what are the top apps people use on linux

Here's the landscape, organized by category. The key question for your DE is: which of these are **out-of-process apps your WM manages** vs. which ones you'd **build into the DE itself**?

**The "must support" list (what every Linux user has):**

| Category | Top apps | Your DE's role |
|---|---|---|
| **Browser** | Firefox, Chrome/Chromium, Brave | Launch + window-manage (out-of-process) |
| **Office** | LibreOffice (~90% share), WPS Office, OnlyOffice | Launch + window-manage |
| **Email** | Thunderbird | Launch + window-manage |
| **Media** | VLC, Spotify, Audacious | Launch + window-manage |
| **Image editing** | GIMP, Krita, Inkscape | Launch + window-manage |
| **Video editing** | Kdenlive, DaVinci Resolve, OBS | Launch + window-manage |
| **Audio** | Audacity | Launch + window-manage |
| **Development** | VS Code, Neovim, JetBrains, Zed | Launch + window-manage |
| **Gaming** | Steam (Proton), Heroic | Launch + window-manage |
| **3D / Creative** | Blender (5M+ Flathub downloads) | Launch + window-manage |
| **File transfer** | LocalSend, Syncthing, FileZilla | Launch + window-manage |
| **Security** | KeePassXC, Bitwarden | Launch + window-manage |
| **Phone integration** | KDE Connect | Launch + window-manage |
| **Local AI** | Ollama, ComfyUI, vLLM | Launch + window-manage |
| **Torrent** | qBittorrent | Launch + window-manage |
| **Backup** | Timeshift, rsync | Launch + window-manage |

**What your DE should build natively (not launch externally):**

| Component | Replaces | Why native |
|---|---|---|
| **File manager** | Nautilus, Dolphin, Thunar | Needs deep WM integration (DnD, context menus, window placement) |
| **Terminal** | GNOME Terminal, Konsole, Kitty, Alacritty | Needs focus/input integration, per-tab env awareness |
| **Settings / System** | GNOME Settings, KDE System Settings | Theming, display, network, power — all compositor-level |
| **App launcher** | Alt+F2, KRunner, Rofi | Part of the shell |
| **Notification center** | GNOME Notifications, Plasma Notifications | Overlay layer |
| **Screenshot / Screen recording** | GNOME Screenshot, Spectacle | Needs compositor access for window-region capture |
| **Media key / volume OSD** | — | Overlay layer, compositor-level |
| **Calendar / Clock** | GNOME Calendar, Plasma Calendar | Panel integration |
| **Software center** | GNOME Software, Discover | Package management UI (Flatpak, apt, dnf) |
| **Disk / Storage utility** | GNOME Disks, KDiskManager | System-level access |

**The packaging reality (2026):**

Flatpak won the desktop. The top-downloaded apps on Flathub are: browsers, communication (Discord, Slack, Signal), gaming/Proton tools, and creative apps. Most of the "must support" list above is now a Flatpak or an AppImage. Your DE needs:

- **Flatpak portal integration** — the XDG Desktop Portal is how Flatpak apps request file access, notifications, screenshots, and screen recording. Your DE implements the portal backend.
- **AppImage support** — just a mounted squashfs + a binary. Your app launcher should detect and run them.
- **`.desktop` file handling** — the standard for app registration (icon, name, launch command, categories). Your app launcher reads these.

**The one category where your DE has a real opportunity:**

**Productivity / business apps.** The "quick app" gap. What Linux users currently use:

- LibreOffice (heavy, slow to start, overkill for a form)
- Web apps (Google Docs, Notion, Airtable — require internet, accounts)
- Python scripts (no GUI)
- Joplin / Obsidian (notes, not structured data)

Your **XForms + MXML + C# + form designer** stack fills this gap directly. A business user who needs "a form that collects data, validates it, and generates a report" currently has no good native Linux answer. Your DE ships with a form designer and a runtime that handles the rest. That's a differentiator no other Linux DE has.

**The Steam data point (Oct 2026):**

Linux is at **3.95%** of Steam's user base (up from ~3% a year ago). The top Linux distros for gaming are Arch-based (CachyOS, EndeavourOS) and Fedora KDE. This means your DE needs to handle **game windows** well — borderless fullscreen, per-game resolution, Proton/Wine integration, and ideally a "gaming mode" that hides the panel and disables notifications. KDE's Game Mode is the reference.




