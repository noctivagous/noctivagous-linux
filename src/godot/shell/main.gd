extends Control
## NCT Shell — the session's first furniture: the launch bar.
## The bar itself is NCTXML (E4): bar.nctxml, hosted by
## ShellBar.cs (the BarHost node), one Repeat-generated button
## per launch-list entry. This script owns the launch list and
## the launching: buttons go through nct-launch; the shell
## contains no program paths (CONVENTIONS.md §10).
##
## The window manager is hosted here (build log 30): the bar
## is a panel-style Window record seated on the Top layer, and
## every launch registers an own-process record. Processes
## belong to the app registry and backings to the compositor
## link (plans/ENVIRONMENT-MANAGER.md §1, §3) — the records are
## created here; those attachments land on the same records
## later, and the record does not change.

const WinMgr := preload("wm/window_manager.gd")
const Record := preload("wm/window_record.gd")
const LayerStack := preload("wm/nct-layer-stack/layer_stack.gd")

@onready var bar_host: Control = $BarHost

var wm  ## the hosted window manager (wm/window_manager.gd)
var _launch_seq: int = 0  ## makes each launch record id unique

func _ready() -> void:
	var entries := _read_launch_list()
	print("SHELL_READY entries=", entries.size())
	_setup_window_manager()
	var args := OS.get_cmdline_user_args()
	if "--self-test" in args:
		for e in entries:
			print("SHELL_ENTRY ", e["id"], " ", e["title"])
		print("SHELL_SELFTEST_OK entries=", entries.size())
		_wm_self_test()
		get_tree().quit()

## Build the layer stack (one CanvasLayer per layer in the
## fixed table, under this shell) and register the launch bar:
## a panel-style record — no chrome, takes no focus, Top layer —
## whose backing is the bar document's root.
func _setup_window_manager() -> void:
	wm = WinMgr.new(self)
	add_child(wm)
	wm.build_layers()
	var bar_rec := Record.new("launch-bar", "panel")
	bar_rec.origin = "shell"
	bar_rec.kind_link = "shell"
	bar_rec.title = "Launch bar"
	bar_rec.backing = bar_host.get_bar_root()
	bar_rec.geometry = Rect2(Vector2.ZERO, get_viewport_rect().size)
	wm.register_window(bar_rec)

func _list_path() -> String:
	var env := OS.get_environment("NCT_LAUNCH_LIST")
	if env != "":
		return env
	return ProjectSettings.globalize_path("res://") + "../../core/session/launch-list.tsv"

func _read_launch_list() -> Array:
	var out: Array = []
	var f := FileAccess.open(_list_path(), FileAccess.READ)
	if f == null:
		printerr("SHELL: cannot open launch list at ", _list_path())
		return out
	while not f.eof_reached():
		var line := f.get_line()
		if line.begins_with("#") or line.strip_edges() == "":
			continue
		var cols := line.split("\t")
		if cols.size() >= 3:
			out.append({"id": cols[0], "title": cols[1], "key": cols[2]})
	return out

## The BarHost builds its Repeat items from these.
func get_launch_entries() -> Array:
	return _read_launch_list()

func _title_for(id: String) -> String:
	for e in _read_launch_list():
		if e["id"] == id:
			return e["title"]
	return id

## A bar button was pressed (ShellBar.LaunchItem). The launch
## registers its Window record first: origin own-process, no
## backing — nct-launch detaches, so there is no pid to track
## here, and the surface that would be this record's backing
## is the compositor's to attach when the link lands.
func launch_entry(id: String) -> void:
	print("SHELL_LAUNCH ", id)
	_register_launch(id)
	OS.create_process("nct-launch", [id])

func _register_launch(id: String) -> String:
	_launch_seq += 1
	var rec_id := "app-%s-%d" % [id, _launch_seq]
	var rec := Record.new(rec_id, "normal")
	rec.origin = "own-process"
	rec.app_id = id
	rec.title = _title_for(id)
	wm.register_window(rec)
	return rec_id

## --self-test only: the hosted window manager, proven from
## the live scene tree (layer nodes present, the bar's backing
## MEASURED under the Top CanvasLayer), not from the data.
func _wm_self_test() -> void:
	var fails: Array[String] = []
	for layer_name in LayerStack.LAYERS:
		if wm.layer_node(layer_name) == null:
			fails.append("missing layer " + layer_name)
	var bar = wm.get_record("launch-bar")
	if bar == null:
		fails.append("no launch-bar record")
	else:
		if bar.style != "panel":
			fails.append("bar style is " + bar.style)
		if bar.layer != "Top":
			fails.append("bar layer is " + bar.layer)
		if bar.backing == null or bar.backing.get_parent() != wm.layer_node("Top"):
			fails.append("bar backing is not seated in the Top layer")
		if bar.takes_focus():
			fails.append("a panel-style bar must not take focus")
	var rec = wm.get_record(_register_launch("self-test-app"))
	if rec == null:
		fails.append("launch record missing")
	else:
		if rec.origin != "own-process":
			fails.append("launch origin is " + rec.origin)
		if rec.app_id != "self-test-app":
			fails.append("launch app_id is " + rec.app_id)
		if rec.backing != null:
			fails.append("an own-process record has no backing yet")
	if fails.is_empty():
		print("SHELL_WM_OK records=", wm.window_count())
	else:
		for f in fails:
			printerr("SHELL_WM_FAIL ", f)

func _notification(what: int) -> void:
	# Activation can clear a grab made at startup (this window is
	# typically mapped while the greeter still holds the seat, and
	# activated when the greeter quits). When the bar's window
	# gains focus and nothing inside holds it, the BarHost puts
	# focus back on the first button.
	if what == NOTIFICATION_WM_WINDOW_FOCUS_IN and bar_host:
		bar_host.ensure_focus()
