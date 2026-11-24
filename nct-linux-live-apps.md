> if I ship LibGodot as part of the system, a tscn + pck file won't be executable from a file navigator?

Correct — a `.pck` file is **not executable**. It's a data archive. Godot explicitly does not register a file handler for `.pck` files (this was confirmed in their GodLoader malware statement). So double-clicking one in a file manager does nothing.

What you'd need is a **thin launcher binary** that links LibGodot and registers as the `.pck` file association. The Arch Linux community already has a pattern for this:

```sh
#!/bin/sh
exec /usr/lib/godot/godot-runner --main-pack "$1"
```

Your distro package layout would be:

| Path | Content |
|---|---|
| `/usr/lib/godot/libgodot.so` | The engine library |
| `/usr/bin/godot-runner` | Tiny C++ binary linking LibGodot, calls `Main::setup()` + `Main::iteration()` |
| `/usr/share/applications/godot-pck.desktop` | MIME handler for `application/x-godot-pck` |

Then double-clicking a `.pck` in your file manager invokes `godot-runner /path/to/game.pck`, which boots the engine and loads the pack.

This is **exactly** the XULRunner model: you ship `libxul.so` as a system library, but you still need a host binary (Firefox, SeaMonkey, whatever) that links it and registers as the handler. The library alone never makes a data file "executable" — the launcher is what bridges the file manager's "Open With" to the library's API.

A bare `.tscn` file is even less useful here — it's a single scene, not a project. You'd need the full `.pck` (which contains `project.godot`, the main scene reference, all scripts, and assets) to be a self-contained runnable unit.

> can godot-runner execute a project.godot?

Yes. The standard Godot binary already supports this via `--path`:

```sh
godot --path /home/user/MyGame
```

It reads `project.godot` from that directory, resolves the main scene, loads all resources from disk, and runs. A LibGodot-based `godot-runner` would do the same — set the project path, call `Main::setup()`, and the engine handles the rest.

So your distro could register **both** file associations:

| File | MIME | Handler invocation |
|---|---|---|
| `.pck` | `application/x-godot-pck` | `godot-runner --main-pack "$1"` |
| `project.godot` | `application/x-godot-project` | `godot-runner --path "$(dirname "$1")"` |

The `project.godot` path is essentially "run from source" — the engine reads `.tscn`, `.gd`, textures, etc. directly from the filesystem. It's how the editor's **Run** button works internally. No PCK, no export step, no compilation.

**Caveats for a distro context:**

- **First run is slower** — the engine parses text `.tscn` files and compiles GDScript to bytecode on the fly (caches it in `.godot/` for subsequent runs). A PCK with pre-compiled `.scn` + bytecode loads faster.
- **You need the full project tree** on disk — all scenes, scripts, assets, `icon.png`, everything referenced in `project.godot`. A bare `project.godot` without its siblings won't work.
- **The `.godot/` cache directory** gets created next to the project (bytecode cache, imported textures). You'd want to make sure the user has write permission there, or the runner sets `--user-dir` to a writable location.
- **No code signing / sandboxing** — the engine loads and executes GDScript from arbitrary disk paths. If you're building a distro, you'd want to think about whether that's acceptable or whether you want to restrict execution to a specific directory.

So the model is: **PCK = "installed app"**, **project.godot directory = "run from source"**. Both are valid, both need the thin launcher to be file-manager-launchable.


> what about unreal engine files? anything similar there?


UE runs natively on Linux — the editor binary is `Engine/Binaries/Linux/UnrealEditor` and packaged games produce an ELF binary + shell script in `Binaries/Linux/`. My `.exe` usage was just Windows-habit leaking in.

Corrected for your distro context:

```
MyGame/
├── MyGame.sh                  ← shell wrapper (sets env, invokes ELF)
├── Binaries/
│   └── Linux/
│       └── MyGame-Linux-Shipping   ← the actual ELF binary
├── Config/
├── Content/Paks/
│   ├── MyGame-WindowsNoEditor.pak  ← (or .utoc/.ucas for IoStore)
│   └── MyGame-WindowsNoEditor.utoc
└── ...
```

And the "run from source" equivalent:

```sh
/usr/lib/ue5/Engine/Binaries/Linux/UnrealEditor "/path/to/MyProject/MyProject.uproject" -game
```

So the distro file-association wrapper would be:

```sh
#!/bin/sh
exec /usr/lib/ue5/Engine/Binaries/Linux/UnrealEditor "$1" -game
```

The rest of the analysis holds — it's still a directory, not a single file, and you need the full ~40 GB engine to do it.


> I am making a Linux distro.  the goal is to make it so that project files can launch into apps, much like how .SWF launched into interactive apps.  I am going to support that natively in the distro and desktop environment.  That way someone can make an app and just ship the project files, optionally a binary.  It will allow downloads to file system from AI interfaces that execute.  So you know what I am going for here.

The file manager is the entry point — it's not "open Godot, then load a project." It's "I see project.godot in my file browser, I double-click it, and the app runs." The engine is invisible to the user.

Got it. The file manager is the entry point — it's not "open Godot, then load a project." It's "I see `project.godot` in my file browser, I double-click it, and the app runs." The engine is invisible to the user.

That means the DE's file manager needs to:

1. **Recognize the file** — MIME type or extension match → show an engine-specific icon (Godot logo, UE logo, whatever)
2. **Resolve the runtime** — look up which system package provides the launcher for that engine
3. **Invoke it** — exec the thin runner with the correct arguments, in a sandbox

The user never sees "Godot" or "Unreal" in the UI. They just see their app's icon (from `project.godot`'s `config/icon` or the `.uproject`'s metadata) and click it. Same mental model as double-clicking a `.swf` in the Flash era, except the runtime is already installed as a system package.

The practical implication for your DE: the file manager's "Open With" logic becomes a **registry** rather than a hardcoded list. Each engine's package ships a small manifest:

```ini
# /usr/share/applications/godot-project.desktop
[Project]
Name=Godot Project
Match=project.godot
Runner=/usr/bin/godot-runner
Args=--path {dir}
Icon=godot-project
Sandbox=strict
```

Your file manager reads all `/usr/share/applications/*.desktop` files with a `[Project]` section, builds the registry, and uses it for icon display + launch. Adding engine support = installing a package. No DE code changes.

That's the whole trick. The file manager stays generic; the engines register themselves.



> You understand our goal though which is to make a flexible desktop environment for making executable situations out of project files.  
So what else should we support since uproject is too big?

Several engines fit the model cleanly. The key criteria: **single small binary** + **project file/directory the runtime loads directly** + **no mandatory build step**.

| Engine | Entry file | Runtime binary | Size | Notes |
|---|---|---|---|---|
| **Godot** | `project.godot` | `godot` / export template | ~50 MB | Already covered |
| **LÖVE** | `main.lua` (or `.love` = ZIP) | `love` | ~15 MB | Perfect fit. `love /path/to/dir` or `love game.love`. No build step. |
| **PICO-8** | `.p8` (single file) | `pico8` | ~10 MB | `pico8 -run game.p8`. Single-file "cart" = ideal unit. |
| **Defold** | `game.project` | `dmengine` | ~20 MB | `dmengine /path/to/game.projectc`. Requires a build step (Bob) to compile assets to `.collectionc` — so it's "run from built source," not raw source. |
| **Ren'Py** | `game/` directory (`.rpy` files) | `renpy.sh` | ~100 MB (Python) | `renpy.sh /path/to/project run`. Visual novel engine. Self-contained, no build step. |

**The `.love` file is especially interesting for your model.** It's literally a ZIP archive with `main.lua` at the root — structurally identical to Godot's `.pck`. You could register `application/x-love-game` and the handler is just:

```sh
exec /usr/bin/love "$1"
```

Same one-liner as your Godot `.pck` handler.

**What doesn't fit (and why):**

- **Unity** — same problem as UE. The "runtime" is the editor or a platform-specific player binary that's tightly coupled to the build. No lightweight "run from source" mode.
- **GDevelop / Construct** — export to HTML5 or native binaries. The "project" isn't runnable without the editor's export pipeline.
- **GameMaker** — proprietary, exports to platform binaries. No open runtime.
- **Electron / Tauri** — the "project" is a web app + config. You *could* argue `package.json` is the entry file and `electron` is the runtime, but it's ~200 MB and the "app" is really just HTML/CSS/JS in a browser shell. Already works via the browser.
- **WASM** — `wasmtime` is a good lightweight runtime (~50 MB), and a `.wasm` file is a clean single-file unit. `wasmtime run app.wasm` is your handler. Worth considering for non-game use cases.

**My recommendation for your base distro:**

Ship **Godot + LÖVE + PICO-8** as the core "project launchable" runtimes. Together they cover 2D games, creative coding, and single-file cartridges. Add **Ren'Py** and **Defold** as optional packages. Skip UE/Unity entirely — they're structurally incompatible with the model.

The registry pattern you already have handles it: each engine's package drops a `[Project]` desktop file into `/usr/share/applications/`, and the file manager picks it up. No DE code changes to add the next engine.


> Would we ship a Tauri WebView with our distro so that the Electron / Tauri apps can just ship as HTML/CSS/JS packs?


Yes — and **Tauri already works this way by design.** On Linux, Tauri v2 doesn't bundle a browser; it links against the system's `libwebkit2gtk-4.1`. The `.deb`/`.rpm` it produces declares WebKitGTK as a dependency and lets the system supply it. That's exactly your model.

**What you ship as a base package:**

```
libwebkit2gtk-4.1   (~76 MB, shared by all webview apps)
```

**What a Tauri app ships:**

```
MyApp/
├── MyApp              ← tiny ELF (3–15 MB, just Rust glue + IPC)
├── dist/              ← HTML/CSS/JS (the actual "app")
└── MyApp.desktop      ← your launcher manifest
```

The ELF is so small because it's just the window/IPC/tray layer — the rendering engine is the system library. A minimal Tauri app is **~600 KB**. Typical real-world app: **3–15 MB**. Compare to Electron's 100–200 MB per app (each one bundles its own Chromium).

**For Electron, the answer is no.** Electron is monolithic — Chromium + Node.js are compiled into the binary. You can't make an Electron app use the system WebKitGTK. Electron apps either ship their full runtime or get rewritten as Tauri. There's no "decouple the browser" path.

**The further question: can you ship *just* the HTML/CSS/JS with no binary at all?**

You could build a **web app runner** into your DE:

```sh
#!/bin/sh
# /usr/bin/webapp-runner
# Reads a manifest, opens a WebKitGTK window, loads local HTML
exec /usr/lib/webkit-gtk-runner --manifest "$(dirname "$1")/app.json"
```

Where `app.json` is:

```json
{
  "name": "MyApp",
  "entry": "dist/index.html",
  "window": { "width": 1024, "height": 768, "title": "MyApp" },
  "capabilities": ["filesystem:read", "notifications"]
}
```

This is essentially a **PWA runner** — like Chrome OS's "Install as app" but as a system-level file manager action. It works for pure frontend apps. What you lose is the Rust backend (custom IPC commands, system tray, native file dialogs, etc.) — anything that requires Tauri's `#[tauri::command]` infrastructure.

**Practical recommendation for your distro:**

| Tier | What you ship | What the app ships | Use case |
|---|---|---|---|
| **Full Tauri** | `libwebkit2gtk-4.1` | Small ELF + `dist/` | Apps with native backend (file access, tray, IPC) |
| **Web app** | `libwebkit2gtk-4.1` + `webapp-runner` | `app.json` + `dist/` | Pure frontend apps (dashboards, viewers, tools) |
| **Electron** | *(nothing)* | Full 100–200 MB bundle | Legacy/compat only; no system integration |

The second tier is the one that makes your "AI writes files to disk, they become executable" loop work for web apps with zero compiled binary. The AI outputs `app.json` + `dist/`, the file manager sees `app.json`, double-click → `webapp-runner` → done. No Rust toolchain, no build step, no binary.

Tauri 3.0 alpha (released Sept 2026) actually makes this cleaner — it splits the webview runtime into a separate crate (`tauri-runtime-wry`), so the "system webview" boundary is more explicit in the architecture. Your distro would just need to track which `webkit2gtk-sys` version the current Tauri release links against (currently 4.1, potentially 4.2 in the future).


> if we had a godot runner setup preconfigured in theory, with our own themes, we could develop a lot of apps quickly.

Yes. You're essentially turning Godot into a **desktop app framework** the way people use Electron, but with a 50 MB runtime instead of 150 MB, and with the dev loop being:

```
Write .tscn + .gd → drop in project dir → double-click → app runs
```

No build step, no bundler, no `npm install`. The AI writes files, the file manager launches them.

**The theme angle is the key unlock.** Godot's `Theme` resource controls every widget (buttons, panels, labels, scrollbars, fonts, colors). If your distro ships a default theme as a system resource:

```
/usr/share/themes/myde-theme.tres
```

...and your `godot-runner` injects it (via a `--theme` flag or a system-level `project.godot` override), every Godot app automatically matches your DE's visual language. The developer writes logic and layout; the theming is free.

**What this is good for:**

- Interactive tools (color pickers, audio visualizers, file managers, config editors)
- Dashboards and monitoring UIs
- Creative/educational apps
- Small games (obviously)
- Prototypes that ship as production (no "build" gap)

**What it's not great for:**

- Heavy text editing (no proper text engine)
- Complex data grids / spreadsheets
- Anything needing a mature browser engine (rich text, PDF rendering)

For those, your `webapp-runner` tier fills the gap.

**The practical setup in your distro would be:**

```
/usr/share/godot/
├── default_theme.tres       ← your DE's visual language
├── default_project.godot    ← base settings (window size, DPI, input)
└── runners/
    └── godot-runner         ← links libgodot, injects theme, sandboxes
```

A developer (or AI) creates:

```
~/Projects/MyTool/
├── project.godot            ← inherits system defaults, sets main scene
├── main.tscn
├── main.gd
└── assets/
```

Double-click `project.godot` in the file manager → themed, sandboxed, running app. That's the whole loop. No IDE required (though Godot's editor is available if they want it).

> We have the ability to provide text engines, data grids, etc. to Godot.

Exactly. That's the move that makes Godot a viable **general-purpose desktop app framework** rather than just a game engine. You'd ship these as system-level GDExtensions:

```
/usr/lib/godot/extensions/
├── libtext-editor.so        ← proper text engine (syntax highlighting, undo, search)
├── libdata-grid.so          ← sortable/filterable table widget
├── libchart.so              ← plotly-like or custom
├── libpdf.so                ← PDF rendering
└── librich-text.so          ← rich text / markdown
```

Each one is a C++ GDExtension that registers new node types. Any project that uses them gets them automatically because the runner sets `extension_path` to the system directory. The developer's `project.godot` doesn't need to declare a dependency — it's just there, like a system library.

**Why this is powerful for your model:**

- The AI generates a `.tscn` that references `TextEdit2` or `DataGrid` nodes — no extra setup
- The file manager double-clicks `project.godn` → runner loads system extensions → app runs
- You control the extension versions at the distro level (one update fixes all apps)
- Developers can still override locally if they need a newer/different version

**The architecture boundary:**

| Layer | Who ships it | Update cadence |
|---|---|---|
| `libgodot.so` | Your distro (base) | Distro release cycle |
| System GDExtensions (text, grid, etc.) | Your distro (base or optional) | Distro release cycle |
| Default theme | Your distro (base) | DE release cycle |
| The app itself (`project.godot` + scenes + scripts) | Developer / AI | Per-app |

This is structurally identical to how a web platform works: the browser engine + DOM/CSS APIs are the "system extensions," and the app is just HTML/JS on top. You're building a **native equivalent of the web platform** where the "browser" is Godot, the "DOM" is the scene tree, and the "JS" is GDScript.

The one thing to watch: GDExtension ABI stability. Godot has been careful about this since 4.0 (the `compatibility` field in `gdextension.cfg`), but if you're shipping system extensions that must work with *any* user project, you need to pin the engine version or ensure forward compatibility. In practice, since you control both the engine package and the extension packages in your distro, this is just a co-installation constraint — same as any shared library.

> does libgodot link against GTK ?

**No.** Godot does not link against GTK. Core developer `bruvzg` stated this explicitly in a proposal discussion:

> "Godot do not use GTK, and adding it as a dependency just for the title bar is not acceptable."

Godot's Linux dependencies are:

- **Windowing:** X11 (xcb, Xcursor, Xinerama, Xi, XRandR) + Wayland (since 4.0)
- **Rendering:** Vulkan (primary) or OpenGL/Mesa
- **Audio:** ALSA / PulseAudio
- **Text:** FreeType
- **Misc:** OpenSSL, zlib, libdecor (for CSD title bars on Wayland)

No GTK, no GLib, no Pango, no Cairo. Godot implements its own input handling, window management, and rendering pipeline directly against the OS APIs.

**This is good for your distro.** It means `libgodot.so` has a lean dependency tree that doesn't conflict with your DE's own GTK stack. You won't get version conflicts between "the GTK Godot uses" and "the GTK your file manager uses" because there isn't one.

The one place GTK *does* appear is in **optional GDExtensions** like `godot-wry` (a webview widget that wraps WebKitGTK). If you ship that as a system extension, *that* `.so` links against `libwebkit2gtk-4.1` → `libgtk-4`. But the core engine itself is GTK-free.

> You were talking about MIME types and how we would make our File Navigator natively support these project files.  How would we do this (a MIME registry of our own for the DE)?  And how would LOVE2D fit into it?  A person who uses our distro and makes LOVE2D games would be able to natively launch games and other apps made with it, quite easily, even from the zip potentially.


You'd build on the **freedesktop Shared MIME-info spec** — it's already the standard mechanism, and your DE's file manager can consume it directly without inventing a parallel system. Each engine package ships two things:

**1. A MIME type definition** (XML in `/usr/share/mime/packages/`):

```xml
<?xml version="1.0"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-love-game">
    <comment>LÖVE Game</comment>
    <glob pattern="*.love" weight="100"/>
    <magic priority="80">
      <match type="string" value="PK" offset="0"/>
    </magic>
    <icon name="love-game"/>
  </mime-type>
</mime-info>
```

**2. A `.desktop` file** declaring the handler:

```ini
[Desktop Entry]
Name=LÖVE Game
Exec=love %U
MimeType=application/x-love-game
Icon=love-game
Type=Application
```

After install, `update-mime-database /usr/share/mime` rebuilds the cache. Your file manager queries the database: "what type is `SuperGame.love`?" → `application/x-love-game` → "what handles that?" → `love %U`. Double-click → `love /path/to/SuperGame.love`. Done.

**Why LÖVE is the cleanest fit for "launch from zip":**

A `.love` file *is* a ZIP with `main.lua` at the root. The `love` binary reads it directly — no extraction step, no temp directory. The file manager shows it as a single app icon (not a zip archive), and the handler is literally:

```sh
exec /usr/bin/love "$1"
```

That's the entire integration. ~15 MB runtime, single-file distribution, no build step. The user (or AI) drops a `.love` file on disk, the file manager picks up the MIME type, double-click runs it.

**The directory case (harder):**

A LÖVE project on disk is just a folder containing `main.lua`. The freedesktop MIME system doesn't natively express "directory containing file X." Your DE would need a custom rule in the file manager's type-resolution logic:

```rust
// Pseudocode for your file manager's type resolver
fn resolve_type(path: &Path) -> Option<MimeType> {
    // 1. Try standard MIME database (glob + magic)
    if let Some(t) = mime_db.type_by_name_and_content(path) {
        return Some(t);
    }
    // 2. Custom "project directory" rules
    if path.is_dir() {
        if path.join("main.lua").exists() {
            return Some("application/x-love-project");
        }
        if path.join("project.godot").exists() {
            return Some("application/x-godot-project");
        }
    }
    None
}
```

This is where you diverge from stock freedesktop behavior. Your file manager's type resolver has a **second pass** for "project directories" — directories that *contain* a known entry file. The file manager renders them as app icons (like macOS renders `.app` bundles), not as plain folders.

**The full registry for your base distro:**

| MIME type | Match rule | Handler | Runtime size |
|---|---|---|---|
| `application/x-love-game` | `*.love` (glob) | `love %U` | ~15 MB |
| `application/x-love-project` | dir containing `main.lua` | `love %U` | (same) |
| `application/x-godot-project` | dir containing `project.godot` | `godot-runner --path %U` | ~50 MB |
| `application/x-godot-pack` | `*.pck` (glob) | `godot-runner --main-pack %U` | (same) |
| `application/x-pico8-cart` | `*.p8` (glob) | `pico8 -run %U` | ~10 MB |
| `application/x-webapp` | dir containing `app.json` | `webapp-runner %U` | ~76 MB (WebKit) |

Each row is one package. The file manager's code is generic — it just reads the MIME database + your project-directory rules. Adding the next engine = shipping a new package with an XML + a `.desktop` file + (optionally) a new entry in the project-directory rule table.

**The "from the zip" angle specifically:**

The `.love` case is special because the *distribution unit* and the *executable unit* are the same file. No extraction, no install, no "put it in the right directory." The AI generates a `.love` file (it's just a ZIP — trivially constructible), writes it to `~/Downloads/`, and the file manager immediately shows it as a runnable app. The user double-clicks and it runs. That's the Flash `.swf` model, exactly, but with a 15 MB runtime instead of a 50 MB plugin, and with a proper sandbox story.

For Godot, the equivalent "single file" is the `.pck` — same story. For the webapp tier, the equivalent would be a ZIP containing `app.json` + `dist/` — you could register `application/x-webapp-pack` with a magic rule (ZIP containing `app.json` at root) and the handler extracts to a temp dir and invokes `webapp-runner`. Slightly less clean than LÖVE because the runner can't read from the zip directly, but still one double-click.


> How do we sandbox LÖVE games for security?

The critical problem: LÖVE uses **LuaJIT**, which exposes **FFI** — a game can call *any* C function in the process. That means `io.open`, `os.execute`, and `ffi.C.system("rm -rf ~")` are all available to any `.love` file by default. The LÖVE devs have discussed disabling `io`/`os` by default but never shipped it. Lua-level sandboxing (`setfenv`) is explicitly **not a security boundary** against FFI.

So the sandbox has to be at the **OS level**, wrapping the `love` binary:

**Your `love-runner` wrapper:**

```c
// Pseudocode for the launcher
void launch(const char *love_file) {
    // 1. Create namespaces (via bubblewrap or direct clone())
    //    - PID: isolated process tree
    //    - Mount: read-only rootfs, game dir bind-mounted rw
    //    - Network: none (or loopback only)
    //    - User: uid mapped to unprivileged range

    // 2. Apply cgroup v2 limits
    //    - memory.max = 512M
    //    - cpu.max = 50% (or 100%)
    //    - pids.max = 10

    // 3. Apply seccomp BPF filter
    //    - Block: ptrace, mount, umount2, bpf, init_module,
    //             io_uring_setup, socket(AF_INET), etc.
    //    - Allow: read, write, mmap, openat (restricted),
    //             futex, clock_gettime, etc.

    // 4. (Optional) Landlock filesystem allowlist
    //    - Read: /usr/lib/love/*, /usr/share/fonts/*
    //    - Write: game_dir/, ~/.local/share/LOVE/<game>/

    // 5. exec /usr/bin/love <game.love>
}
```

**The practical stack for your distro:**

| Layer | Tool | What it blocks |
|---|---|---|
| Filesystem | **Landlock** (kernel 5.13+) or mount namespace | Game can only read/write its own dir + save dir. FFI `open()` calls outside that range get `EACCES`. |
| Syscalls | **seccomp BPF** (via libseccomp) | `ptrace`, `mount`, `init_module`, `socket`, `bpf`, `io_uring` — the FFI escape hatches to the kernel |
| Resources | **cgroup v2** | Memory bomb, fork bomb, CPU hog |
| Network | **Network namespace** (no interfaces) | No exfiltration, no C2 |
| Process | **PID namespace** | Can't see or signal other processes |

**Landlock is the key addition here** (kernel 5.13+, stable since 6.x). It's a filesystem access-control LSM that's much simpler than AppArmor/SELinux for this use case:

```c
// In the wrapper, before exec:
struct landlock_ruleset_attr attr = LANDLOCK_RULESET_attr;
int ruleset_fd = syscall(SYS_landlock_create_ruleset, &attr, sizeof(attr));

// Read: /usr/lib/love (engine .so files)
// Read: game directory
// Write: game directory + save directory
// Everything else: denied

// Apply to current thread:
syscall(SYS_landlock_restrict_self, ruleset_fd, 0);
```

This means even if a game uses `ffi.C.open("/etc/passwd", "r")`, the kernel denies it. The FFI can still *call* the C function, but the syscall returns `EACCES`. That's the boundary that makes FFI harmless.

**The complete sandbox profile for a LÖVE game:**

```
Sandbox:
  filesystem:
    read:  [game_dir, /usr/lib/love, /usr/share/fonts, /usr/share/icons]
    write: [game_dir, save_dir]
  network: none
  syscalls: deny [ptrace, mount, bpf, init_module, io_uring, socket, 
                  unshare, setns, reboot, kexec_load]
  resources:
    memory: 512MB
    cpu: 100%
    pids: 10
  capabilities: none
```

**What the user sees:**

The `.desktop` file for the LÖVE handler becomes:

```ini
[Desktop Entry]
Name=LÖVE Game
Exec=/usr/bin/love-runner %U
MimeType=application/x-love-game
```

And `love-runner` is a ~50 KB C binary that sets up the sandbox and execs `love`. The user never sees any of this. Double-click → sandboxed game.

**The "trusted" escape hatch:**

For developers running their own games during development, you'd want a "Run without sandbox" option (right-click → "Run as developer") that skips the wrapper and calls `love` directly. Same pattern as Flatpak's `flatpak run --filesystem=host`. The file manager shows a small shield icon on sandboxed apps; right-click menu offers "Run unsandboxed" for the user's own projects.

**Why not just use Flatpak?**

Flatpak gives you all of the above, but it adds a 200 MB+ runtime, a portal system, and a store. For your model (AI drops a `.love` file on disk, it runs immediately), the overhead is wrong. Your native wrapper is ~50 KB of C code, no daemon, no portal round-trips. The game just runs.



> What about Apache Royale?  Should our system bother to support it as live apps?

[...] The audience is tiny — people who wrote Flex apps in 2008–2015 and want to keep using AS3. That's a shrinking, aging demographic. The "AI writes Royale apps to disk" use case is essentially zero.
[...] Royale is a compiler, not a runtime. Its output is a web app. Your webapp-runner already handles it. Ship the compiler as an optional dev package if you want; don't build any special file-manager or MIME integration for it.



> Flex apps were pretty flexible and we're trying to capture that with our live apps system but we want to make sure we use current systems like Godot or Love2D which are game oriented but could double as a desktop app foundation if we give them some extensions

The Flex analogy is apt, and it clarifies where to invest:

**What made Flex flexible wasn't the rendering engine — it was the component library.** Flex's power was `DataGrid`, `Form`, `Chart`, `Accordion`, `Tree`, `TabNavigator` — a rich set of composable, data-bound widgets on top of a display list. The Flash Player was just the VM. Your model is the same: the engine is the VM, and your system GDExtensions/Lua modules are the component library.

**Where the mapping is strongest:**

| Flex | Your system |
|---|---|
| Flash Player (VM) | `libgodot.so` / `love` binary |
| MXML (declarative layout) | `.tscn` (declarative scene tree) |
| ActionScript (logic) | GDScript / Lua |
| Flex components (DataGrid, Form, Chart) | System GDExtensions / Lua modules |
| `mx:DataGrid` in a `.mxml` file | `DataGrid` node in a `.tscn` file |
| Flex compiler (`.mxml` → `.swf`) | *(none — runs from source)* |

The last row is where you're strictly better. Flex required a compile step. Your model doesn't.

**Godot is the stronger foundation for this, and here's why:**

- **Scene tree = display list.** Hierarchical composition with parent/child relationships, z-ordering, and transform inheritance. This maps directly to how UI frameworks structure widgets.
- **Built-in input, animation, and signal system.** You don't need to build event dispatch from scratch — it's already there.
- **Control node class hierarchy.** `Control` → `Container` → `VBoxContainer`, `HBoxContainer`, `GridContainer`, `ScrollContainer`, etc. You already have layout managers. Your extensions add the *content* widgets (DataGrid, RichTextEditor, Chart) on top.
- **Theme system.** One `.tres` file restyles every widget. Your DE theme applies globally.
- **GPU rendering.** 60fps for free. Flex/Flash was CPU-bound for complex layouts.

**LÖVE is the weaker fit for this specific goal:**

- **No scene tree.** It's a flat canvas with immediate-mode drawing. You'd build your own widget hierarchy, layout engine, and event dispatch from scratch in Lua.
- **No built-in input focus management.** You have to track which "widget" has keyboard focus yourself.
- **No animation system.** You'd write your own tweening.
- **No theming.** Every widget is drawn by hand.

LÖVE is great for games and creative coding. As a *desktop app foundation*, you're reinventing 70% of what Godot already provides. Use it for the lightweight tier (small tools, creative apps, single-file `.love` distribution), but make **Godot the primary "app framework" tier**.

**The practical implication for your extension roadmap:**

Invest in Godot GDExtensions first, in this order:

1. **DataGrid** — sortable, filterable, virtualized table. This alone unlocks 80% of "desktop app" use cases (CRUD tools, config editors, data viewers).
2. **RichTextEditor** — syntax highlighting, multi-cursor, search/replace. Unlocks editor tools.
3. **Form / PropertyGrid** — label + input pairs, validation, dynamic layout. Unlocks settings panels and wizards.
4. **Chart** — line, bar, pie. Unlocks dashboards.
5. **PDF viewer** — unlocks document tools.

Each one is a C++ GDExtension that registers new node types. They're system-level, versioned with your distro, and available to every Godot project automatically.

**The "Flex moment" for your distro** is when an AI can write:

```
# main.tscn
[Node type="DataGrid" name="Customers"]
columns = ["Name", "Email", "Balance"]
data_source = "res://data/customers.json"

[Node type="Button" name="Export"]
text = "Export to CSV"
pressed = @on_export
```

...and double-clicking `project.godot` in the file manager gives you a working, themed, sandboxed data grid app. No compiler, no build step, no 150 MB Electron bundle. That's the Flex promise, but with a 50 MB runtime and a 15 MB runtime for the lightweight tier.


> Speaking of MIME types, we have a goal in our system, our File Navigator, to distinguish between different types of opening a document/file in an application.  One is View and it will launch a viewer.    Another is Edit and it will launch an Editor.  Another is Execute and it will execute (the folder, the script, the file).  The user can add different Open categories.  By default there will be View > in Web Browser in the list.  MIME types can have then, in our registry, different Open destinations.  That's because sometimes someone wants to View a video file and that is different than Edit a file, which is different than Edit into New MIME Type Project which would be "Take this video file and make a new video project with it in the time line", a kind of sequence to the Open command.

This is a clean design. You're essentially replacing the flat "Open With → app" model with a **typed action list per MIME type**, where each action is (category, target, optional follow-up). The sequenced part ("open into new project") is the novel piece — it's not just "launch app X with file Y" but "launch app X, create new project, import Y into it."

**The registry schema:**

Each MIME type gets an ordered list of open actions. Your file manager's right-click menu (or double-click default) renders this list grouped by category:

```json
// /usr/share/open-actions/application-x-mpeg4.json
{
  "mime": "video/mp4",
  "actions": [
    {
      "id": "view",
      "category": "view",
      "label": "Play",
      "exec": "mpv %U",
      "default": true
    },
    {
      "id": "edit",
      "category": "edit",
      "label": "Edit in Kdenlive",
      "exec": "kdenlive %U"
    },
    {
      "id": "edit-into-project",
      "category": "edit",
      "label": "New Video Project",
      "exec": "kdenlive --new-project --import %U"
    },
    {
      "id": "execute",
      "category": "execute",
      "label": "Execute",
      "exec": "null",
      "disabled": true
    }
  ]
}
```

The `disabled` flag means the file manager greys it out for types where it doesn't make sense (a video can't be "executed" as a project).

**Built-in categories:**

| Category | Meaning | Default for media files | Default for project files |
|---|---|---|---|
| `view` | Passive consumption (play, render, display) | Video player, image viewer, PDF reader | *(usually absent)* |
| `edit` | Modify in place | Text editor, video editor, image editor | Engine editor |
| `execute` | Run as an app | *(usually absent)* | `godot-runner`, `love`, etc. |
| `custom` | User-defined | — | — |

Double-click behavior = the action marked `"default": true`. Right-click / long-press = full list grouped by category.

**The sequenced-open problem, formalized:**

"New Video Project" isn't just `kdenlive file.mp4`. It's:

1. `kdenlive --create-project` → creates `~/Videos/NewProject/`
2. Import `file.mp4` into the project's media bin / timeline
3. Open the project in the editor

Your registry needs to express this as a **single action** with a structured `exec` that the target app understands. Two approaches:

**Option A: Convention-based (simpler, app-side)**

The app defines a CLI flag that means "create new project and import this file":

```json
{
  "id": "edit-into-project",
  "category": "edit",
  "label": "New Video Project",
  "exec": "kdenlive --new-with %U"
}
```

The app is responsible for interpreting `--new-with`. Your file manager just passes the file path. This is what Kdenlive already does (`kdenlive file.mp4` opens a new project with that clip on the timeline).

**Option B: Structured action (more powerful, DE-side)**

For cases where the "open into" logic is non-trivial (multiple steps, user prompts, template selection), you express it as a mini-sequence:

```json
{
  "id": "edit-into-project",
  "category": "edit",
  "label": "New Video Project",
  "sequence": [
    { "action": "create", "type": "application/x-kdenlive-project", "template": "default" },
    { "action": "import", "source": "%U", "target": "timeline" },
    { "action": "open", "app": "kdenlive" }
  ]
}
```

Your file manager (or a small `open-action-runner` daemon) executes the sequence: creates the project directory from a template, copies/links the source file into the expected location, then launches the editor. This is more powerful but requires a template system.

**I'd recommend starting with Option A** — it's simpler, puts the intelligence in the app (which knows its own project structure), and covers 90% of cases. The `--new-with` / `--import-into-new` convention is trivial for any app to implement. You only need Option B for exotic cases where the DE itself must orchestrate multi-step creation.

**How this extends the freedesktop `.desktop` system:**

You don't replace it. The `.desktop` files still declare `MimeType=` and `Exec=`. Your open-actions JSON files are a **superset layer** that the file manager reads *on top of* the standard MIME database. The `.desktop` file says "this app handles this MIME type." Your JSON says "here are the *kinds* of opening, in what order, with what labels."

```
/usr/share/mime/packages/          ← standard freedesktop (glob/magic → MIME type)
/usr/share/open-actions/           ← your layer (MIME type → typed action list)
~/.config/open-actions/            ← user overrides / custom categories
```

**The "Edit into New MIME Type Project" as a general pattern:**

This is really a **transformation action**: `source_type → target_type`. The file manager could have a generic rule:

> If an action's label matches "New {TargetType} Project" and the target type has a registered project runner, the DE can synthesize the action even if the app doesn't explicitly declare it.

So if `application/x-kdenlive-project` is registered with a runner, and `video/mp4` is a known media type, your file manager can auto-generate the "New Video Project" action without Kdenlive shipping it explicitly. The template for the new project comes from:

```
/usr/share/project-templates/kdenlive/
├── project.kdenlive
├── profiles/
└── README.md
```

The DE copies the template, drops the source file in the expected slot, and launches. The app never knew the file manager was doing this — it just opens a project that already has the clip in it.

**User-defined categories:**

The user adds a new category (say "Annotate") in their DE settings. It appears as a new group in the right-click menu. They assign actions to it:

```json
// ~/.config/open-actions/custom.json
{
  "categories": [
    { "id": "annotate", "label": "Annotate", "icon": "tag" }
  ],
  "actions": {
    "video/mp4": [
      { "id": "annotate-mpv", "category": "annotate", "label": "Add subtitles", "exec": "mpv --sub-visibility=%U" }
    ]
  }
}
```

The file manager merges user actions with system actions, user categories with built-in ones, and renders the combined list.

**The concrete UX for a `.mp4` file in your File Navigator:**

Double-click → plays in mpv (the `default` action in the `view` category).

Right-click → "Open" submenu:

```
▶ Play                          [view]
✎ Edit in Kdenlive              [edit]
＋ New Video Project             [edit]     ← sequenced
⚙ Execute                        [execute]  (greyed out)
🏷 Add subtitles                 [annotate] ← user-defined
```

That's the whole model. The file manager is a generic dispatcher; the intelligence is in the per-MIME JSON files (system + user) and in the apps' CLI conventions.


> We then have another feature, which is Data Routing. We realized that the Clipboard is actually an intermediate store for data routing between applications.  So we could have Data Route > Send to Focused Object (in Open App) in the right-click menu in the web browser and it would paste the text into the open word processor text area that has focus.  Then you skip a step because you know where you want it to go.  Additionally, the open apps would list, when queried, what open route ports they have.

This is a clean reframe. You're demoting the clipboard from "the mechanism" to "one possible hop in a routing path." The clipboard becomes a *broadcast* channel (any app can read it), while Data Route is a *unicast* channel (targeted, one-to-one).

**The "port" abstraction:**

Each running app exposes a **route port registry** to the DE. A port is:

```json
{
  "id": "editor.body",
  "app": "my-word-processor",
  "label": "Document Body",
  "accepts": ["text/plain", "text/html", "image/png"],
  "focused": true,
  "description": "Main text area"
}
```

The DE queries the focused app (via D-Bus, or a lightweight local socket) for its current port list. The `"focused": true` flag is what makes "Send to Focused Object" work — the DE doesn't need to know *which* widget has focus, the app reports it.

**The right-click menu becomes dynamic:**

```
Data Route:
  → Send to Focused Object (Document Body, Word Processor)   [text]
  → Send to "Notes" tab (Word Processor)                     [text]
  → Send to "Image Slot" (Presentation App)                  [image]
  → Copy to Clipboard (fallback)
```

The list is populated by querying all running apps' port registries, filtered by what the selected data's MIME type matches against each port's `accepts` field. The focused port is always first.

**Why this is better than the clipboard for the "I know where it goes" case:**

| | Clipboard | Data Route |
|---|---|---|
| Steps | Select → Copy → Switch window → Click target → Paste | Select → Right-click → "Send to Focused" |
| Target | Implicit (wherever you paste) | Explicit (named port) |
| Data format | Whatever the source app put on it | Negotiated (DE can convert) |
| Race condition | Another app can steal the clipboard mid-step | No intermediate state |
| Works across sessions | No (clipboard is per-session) | Yes (if routed via a daemon) |

**The D-Bus / AT-SPI2 angle:**

You don't need to invent a new IPC protocol. **AT-SPI2** (the Linux accessibility bus) already exposes focused widgets, their roles, and their text content via D-Bus. Your "port registry" is essentially a *superset* of what AT-SPI2 already reports, with two additions:

1. **`accepts`** — what MIME types this port will ingest (AT-SPI2 doesn't declare this)
2. **`action: ingest`** — a method call that pushes data *into* the port (AT-SPI2 is read-oriented; you're adding a write path)

You could implement this as an **AT-SPI2 extension interface** — apps that support Data Route implement an additional D-Bus interface alongside their standard accessibility tree. The DE's file manager / browser already talks to AT-SPI2 for accessibility, so the plumbing is there. You're just adding a `SendData(mime_type, payload)` method to the focused object's interface.

**For apps that don't implement the port registry:**

The fallback is the clipboard path (which still works). But you could also have a **generic fallback port** that the DE synthesizes for any app:

```json
{
  "id": "focused-clipboard-paste",
  "app": "any",
  "label": "Paste into focused element",
  "accepts": ["*"],
  "focused": true,
  "mechanism": "xdotool type / AT-SPI2 text insertion"
}
```

This uses the existing accessibility "insert text at caret" API to simulate a paste into whatever has focus. Cruder, but works for any AT-SPI2-compliant app without it implementing your new interface.

**The "open apps list their ports" part:**

A system tray or panel element that shows running apps and their available ports:

```
Running:
  Word Processor
    ● Document Body (focused)     text, html
    ○ Footer                       text
  Presentation App
    ○ Slide 3, Image Slot          image
    ○ Slide 3, Title               text
  Terminal
    ● Shell Input (focused)        text
```

This is the "route map" — the user can see where data can go without having to right-click first. It's also the natural place to show the "Send to Focused" target before the user commits, reducing misclicks.

**The AI angle (which is your whole point):**

When an AI agent is executing and wants to "put this text into the document," it doesn't need to simulate keystrokes or manipulate the clipboard. It queries the port registry, finds the focused text port, and calls `SendData("text/plain", payload)`. One IPC call. No window switching, no focus management, no race conditions. The AI's "hands" are the route ports.


