extends Node
## nct-app-registry — programs, as distinct from windows
## (plans/ENVIRONMENT-MANAGER.md §1, §6).
##
## Owns: the manifest registry, launch, lifecycle, crash
## detection, single-instance. An app owns 0..n windows; the
## window manager owns the windows. The registry does NOT place
## windows (§6): it hands the window manager a Window record with
## the manifest's requested style and lets placement policy be
## the manager's.
##
## Launch kinds:
## - "pck": a Model 2 app — its own engine process on the pinned
##   runtime, started by the foundation chain's launcher
##   (src/core/session/nct-godot-run). The registry records the
##   exact command; process liveness is tracked in the process
##   table the session layer maintains.
## - "foreign": a Qt/GTK/… program, started by its own command.
## - "nctxml": an NCTXML app document. Packaged apps ship as
##   .pck like the rest; in the shell's own hosting (and in this
##   slice's harness) the host renders the document and hands
##   the registry the backing, the way an app process hands the
##   compositor a surface.
##
## Slice 3 scope: the registry + lifecycle against the window
## manager, with the process table as the liveness source. Real
## process spawning stays the foundation chain's, already proven
## at tier 1; check_liveness() is the crash-detection seam the
## session layer will feed.

const Record := preload("../nct-window-manager/window_record.gd")

signal app_launched(app_id: String, window_id: String)
signal app_exited(app_id: String, window_id: String, reason: String)

const KINDS: Array[String] = ["pck", "foreign", "nctxml"]
const ORIGIN_FOR_KIND := {
	"pck": "own-process",
	"foreign": "foreign",
	"nctxml": "own-process",
}

var _manifests: Dictionary = {}  ## app_id -> manifest Dictionary
var _running: Dictionary = {}    ## app_id -> {window_id, alive, command}
var _counter: int = 0
var _wm = null                   ## the window manager (set by the host)
var _env = null                  ## the environment manager (bus), optional

## Whether launch() substitutes a placeholder surface when the
## caller supplies no backing. Hosts that render app surfaces
## in-process (the modules harness, an in-shell NCTXML hosting)
## keep the default. A host whose apps live in their own
## processes under a compositor (the shipped shell, Model 2)
## sets this false: the record is registered WITHOUT a backing
## and the surface attaches to it when the compositor link
## lands — the shell must never draw a fake window for a real
## external program.
var placeholder_backings: bool = true

func set_window_manager(wm) -> void:
	_wm = wm

func set_environment(env) -> void:
	_env = env

# ------------------------------------------------------------------
# Manifests
# ------------------------------------------------------------------

## A manifest: {id, name, kind, entry, single_instance (default
## true), requested_style (default "normal")}. Entry is the .pck
## path for "pck", the command for "foreign", the document path
## for "nctxml".
func register_manifest(m: Dictionary) -> bool:
	var id := str(m.get("id", ""))
	if id == "" or _manifests.has(id):
		return false
	if str(m.get("kind", "")) not in KINDS:
		return false
	if str(m.get("entry", "")) == "":
		return false
	_manifests[id] = m
	return true

func has_app(app_id: String) -> bool:
	return _manifests.has(app_id)

func manifest(app_id: String) -> Dictionary:
	return _manifests.get(app_id, {})

func app_ids() -> Array:
	return _manifests.keys()

# ------------------------------------------------------------------
# Launch + lifecycle
# ------------------------------------------------------------------

## The command the foundation chain runs for this app, or [] when
## the app is hosted (nctxml in the shell's hosting).
func launch_command(app_id: String) -> Array:
	var m := manifest(app_id)
	match str(m.get("kind", "")):
		"pck":
			return ["nct-godot-run", str(m["entry"])]
		"foreign":
			return [str(m["entry"])]
		_:
			return []

## Launch an app. Returns the window id, or "" if the app is
## unknown. A single-instance app that is already running returns
## its existing window (and focuses it) — never a second window.
## `backing` is the app's surface, supplied by its process/host;
## when null the registry substitutes a named placeholder (the
## record is what this slice proves; surfaces attach to it).
func launch(app_id: String, backing: Control = null) -> String:
	var m := manifest(app_id)
	if m.is_empty() or _wm == null:
		return ""
	if bool(m.get("single_instance", true)) and _running.has(app_id):
		var existing := str(_running[app_id]["window_id"])
		_wm.focus_window(existing)
		return existing
	_counter += 1
	var window_id := "%s-win-%d" % [app_id, _counter]
	if backing == null and placeholder_backings:
		backing = _placeholder(app_id, m)
	var rec = Record.new(window_id, str(m.get("requested_style", "normal")))
	rec.origin = ORIGIN_FOR_KIND[str(m["kind"])]
	rec.backing = backing
	rec.app_id = app_id
	rec.kind_link = "app" if str(m["kind"]) == "nctxml" else ""
	rec.title = str(m.get("name", app_id))
	rec.geometry = Rect2(120, 90, 480, 320)
	if not _wm.register_window(rec):
		return ""
	_running[app_id] = {
		"window_id": window_id,
		"alive": true,
		"command": launch_command(app_id),
	}
	if _env:
		_env.announce("app.launched", app_id, "nct-app-registry")
	app_launched.emit(app_id, window_id)
	return window_id

func is_running(app_id: String) -> bool:
	return _running.has(app_id)

func running_window(app_id: String) -> String:
	if _running.has(app_id):
		return str(_running[app_id]["window_id"])
	return ""

func running_apps() -> Array:
	return _running.keys()

## A clean close: the app's window leaves the registry of
## windows, and the app leaves the running set.
func close_app(app_id: String) -> bool:
	if not _running.has(app_id):
		return false
	var window_id := str(_running[app_id]["window_id"])
	_wm.unregister_window(window_id)
	_running.erase(app_id)
	if _env:
		_env.announce("app.exited", app_id, "nct-app-registry")
	app_exited.emit(app_id, window_id, "closed")
	return true

## The process table's word: this app's process is gone. (In the
## session, the process watcher writes this; here it is the seam.)
func mark_process_dead(app_id: String) -> void:
	if _running.has(app_id):
		_running[app_id]["alive"] = false

## Crash detection: any running app whose process is dead loses
## its window, leaves the running set, and is announced on the
## bus as app.crashed — the single Issue path (§8) starts there.
## Returns the crashed app ids.
func check_liveness() -> Array:
	var crashed: Array = []
	for app_id in _running.keys():
		if not bool(_running[app_id]["alive"]):
			crashed.append(app_id)
	for app_id in crashed:
		var window_id := str(_running[app_id]["window_id"])
		_wm.unregister_window(window_id)
		_running.erase(app_id)
		if _env:
			_env.announce("app.crashed", app_id, "nct-app-registry")
		app_exited.emit(app_id, window_id, "crashed")
	return crashed

func _placeholder(app_id: String, m: Dictionary) -> Control:
	var panel := PanelContainer.new()
	panel.name = "Surface_" + app_id
	var label := Label.new()
	label.text = "%s (%s surface)" % [str(m.get("name", app_id)),
		ORIGIN_FOR_KIND[str(m["kind"])]]
	panel.add_child(label)
	return panel
