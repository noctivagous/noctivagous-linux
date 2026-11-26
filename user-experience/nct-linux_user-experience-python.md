nct-linux_user-experience-python

while working on our desktop environment we wanted to provide conveniences for common tasks.  Python is quite popular.  What kinds of apps and convenience system can we provide it on top of what is there, e.g. a package manager app, etc.


The key insight: standalone GUI tools (venvipy, VenvStudio, py-env-studio) already exist for managing environments and packages. What a **DE** provides that they can't is **system-level ambient integration** — the layer between the file manager, terminal, app launcher, notifications, and the Python toolchain.

**What to build (in priority order):**

**1. Python-aware file manager integration**

- Detect project type from `pyproject.toml` / `requirements.txt` / `uv.lock` in a folder. Show a badge or icon variant.
- Context menu on `.py` files: "Run" (in the project's venv), "Run in Terminal", "Create venv here", "Add to requirements"
- Context menu on a project folder: "Sync dependencies" (`uv sync`), "Open in REPL", "Run tests"
- Drag a `.py` file onto a terminal window → runs it in the correct environment
- The file manager knows which venv belongs to which project (scans for `.venv/` directories)

**2. Environment-aware terminal**

- When you `cd` into a project directory (or open a terminal in one), the terminal **auto-activates** the project's venv. No `source .venv/bin/activate` needed.
- The terminal prompt shows the active environment name (like `direnv` does, but DE-native).
- A "Python" tab in the terminal's tab bar showing: active interpreter version, active venv, and a quick "switch environment" dropdown.
- This is the single highest-value convenience. Every Python developer lives in the terminal.

**3. Unified package manager (system + Python)**

The [pacmangr](https://github.com/HeiDumb/pacmangr) model is the right one: one searchable interface that delegates to the appropriate backend. Your version:

- Search across: system packages (apt/dnf/whatever), Python packages (PyPI via `uv`), and your `.pck` apps
- A Python package row shows: name, version, which venv(s) it's installed in, last updated, vulnerability status
- "Install" into a selected venv (or system-wide via `uv pip install --system`)
- "Update all" per venv
- Dependency tree visualization (click a package → see what depends on it)
- Under the hood: calls `uv` (which is now the de facto standard, replacing pip/pyenv/pipx/virtualenv in one Rust binary)

**4. Python REPL / console (built-in app)**

A lightweight interactive Python console as a DE app:

- Multi-session (tabs = different environments)
- IPython/Jupyter kernel support (for rich output: plots, tables, HTML)
- "Send to file" (save a cell to a `.py` file)
- "Run script" (load a file into the console)
- matplotlib/pandas/plotly output rendered inline (this is the Jupyter-lite experience without a browser)
- Launched from: app menu, context menu on `.py` file, or `Ctrl+.` global shortcut

**5. App launcher integration**

- Python CLI tools installed via `uv tool install` (pipx equivalent) appear in the app launcher automatically
- A Python GUI app (PyQt, Tkinter, Toga) can register a `.desktop` file and appears in the launcher with its icon
- "New Python App" in the app launcher → template wizard (CLI, GUI, web, data science) → scaffolds a project with `uv init` + your chosen template

**6. Notification / background services**

- A background daemon that:
  - Watches `uv.lock` / `pyproject.toml` for changes → notifies "Dependencies changed, sync?"
  - Periodically checks installed packages for security vulnerabilities (`uv audit`) → notification with "Update" action
  - Monitors running Python processes → shows in system monitor (CPU, memory, what it's doing)
  - Detects "zombie" venvs (no project, no references) → "Clean up 3 unused environments (2.1 GB)?"

**7. Python version manager (system-level)**

- A settings panel: "Default Python: 3.13" (what `python` resolves to system-wide)
- Per-project override: the file manager's project badge shows "Python 3.12" and clicking it lets you change
- `uv python install 3.12` under the hood, but presented as a GUI dropdown
- The DE's terminal and REPL respect this: system default unless a project overrides

**8. Script shebang handling**

- When the user double-clicks a `.py` file with `#!/usr/bin/env -S uv run --script`, the DE:
  1. Detects the shebang
  2. Finds/creates the right environment
  3. Runs it
  4. Shows output in a terminal window (or a "script output" panel)
- This makes Python scripts as "double-clickable" as shell scripts, without the user knowing about venvs

**What NOT to build:**

- A standalone "Python Package Manager" GUI app (venvipy, VenvStudio, py-env-studio already do this). Instead, integrate the functionality into the file manager, terminal, and settings.
- A Jupyter notebook replacement (JupyterLab is its own app; your DE just launches and window-manages it).
- A Python IDE (VS Code, PyCharm, or Zed are out-of-process apps your DE manages).

**The architectural pattern:**

```
DE Layer (your Godot runtime)
├── File Manager: project detection, context menus, venv awareness
├── Terminal: auto-activation, env indicator, per-tab environment
├── App Launcher: Python tools + GUI apps + "New Python App" wizard
├── Settings: default Python version, venv cleanup, vulnerability policy
├── Notifications: dep changes, vulns, zombie venvs
└── IPC: "run this in that env" messages to terminal/REPL

Python Layer (out-of-process, DE-managed)
├── uv (the single binary: pip + venv + pyenv + pipx + lockfile)
├── Python interpreters (managed by uv)
├── Jupyter kernels (for the REPL app)
├── VS Code / PyCharm / Zed (IDEs, out-of-process)
└── User's Python apps (GUI or CLI)
```

The DE is the **orchestrator**. It doesn't implement Python packaging — it calls `uv` and shows the results in the right place at the right time. The convenience is in the **ambient awareness**: the file manager knows it's a Python project, the terminal knows which env to activate, the launcher knows which tools are available, and notifications tell you when something needs attention. That's the layer no standalone tool can provide.

