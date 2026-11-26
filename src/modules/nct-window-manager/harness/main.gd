extends Control
## Slice 1 harness — fake windows of every style, driven through the
## real window manager + layer stack, with every claim MEASURED from
## the live scene tree (canvas layer values, parenting, instance
## identity), not asserted from the data alone.
##
## Run: godot --headless --path src/modules -- --self-test
## Prints SLICE1_SELFTEST_OK and quits 0, or SLICE1_SELFTEST_FAIL
## <reason> and quits 1.

const EnvMgr := preload("res://nct-environment-manager/environment_manager.gd")
const WinMgr := preload("res://nct-window-manager/window_manager.gd")
const Record := preload("res://nct-window-manager/window_record.gd")
const LayerStack := preload("res://nct-window-manager/nct-layer-stack/layer_stack.gd")

var env_mgr
var wm
var failures: Array[String] = []

func _ready() -> void:
	env_mgr = EnvMgr.new()
	add_child(env_mgr)
	wm = WinMgr.new(self)
	add_child(wm)
	wm.build_layers()
	env_mgr.register_module("nct-window-manager", wm)

	var args = OS.get_cmdline_user_args()
	if "--self-test" in args:
		_run_tests()
		if failures.is_empty():
			print("SLICE1_SELFTEST_OK windows=", wm.window_count(),
				" layers=", LayerStack.LAYERS.size())
			get_tree().quit(0)
		else:
			for f in failures:
				printerr("SLICE1_SELFTEST_FAIL ", f)
			get_tree().quit(1)

func _check(cond: bool, what: String) -> void:
	if not cond:
		failures.append(what)

func _fake_window(id: String, style: String, parent_id: String = ""):
	var panel = PanelContainer.new()
	panel.name = "Fake_" + id
	var label = Label.new()
	label.text = id + " (" + style + ")"
	panel.add_child(label)
	var rec = Record.new(id, style)
	rec.backing = panel
	rec.title = id
	rec.parent_id = parent_id
	rec.geometry = Rect2(100, 100, 320, 200)  # all overlap: layers are what separate them
	return rec

func _canvas_value_of(rec) -> int:
	var p = rec.backing.get_parent()
	if p is CanvasLayer:
		return (p as CanvasLayer).layer
	return -999

func _run_tests() -> void:
	# --- one fake window per style -----------------------------------
	var normal = _fake_window("win-normal", "normal")
	var dash = _fake_window("win-dash", "dashboard")
	var panel = _fake_window("win-panel", "panel")
	var dialog = _fake_window("win-dialog", "dialog", "win-normal")
	var popup = _fake_window("win-popup", "popup")
	var osd = _fake_window("win-osd", "osd")
	for rec in [normal, dash, panel, dialog, popup, osd]:
		_check(wm.register_window(rec), "register failed: " + rec.id)
	_check(wm.window_count() == 6, "expected 6 windows")

	# --- layers: the table, measured from the CanvasLayer nodes ------
	_check(wm.layer_node("Lock") != null, "Lock layer node missing")
	var prev = 9999
	for layer_name in LayerStack.LAYERS:
		var node = wm.layer_node(layer_name)
		_check(node != null, "layer node missing: " + layer_name)
		if node:
			_check(node.layer < prev, "canvas values not decreasing at " + layer_name)
			prev = node.layer

	# --- style → layer assignment (§5), read back from the records ---
	_check(normal.layer == "Workspace", "normal not in Workspace: " + normal.layer)
	_check(dash.layer == "Desktop", "dashboard not in Desktop: " + dash.layer)
	_check(panel.layer == "Top", "panel not in Top: " + panel.layer)
	_check(popup.layer == "Popup", "popup not in Popup: " + popup.layer)
	_check(osd.layer == "Overlay-OSD", "osd not in Overlay-OSD: " + osd.layer)
	_check(dialog.layer == normal.layer, "dialog not in parent's band: " + dialog.layer)

	# --- stacking, measured: OSD above panel above popup above
	#     normal above dashboard --------------------------------------
	_check(_canvas_value_of(osd) > _canvas_value_of(panel), "osd not above panel")
	_check(_canvas_value_of(panel) > _canvas_value_of(popup), "panel not above popup")
	_check(_canvas_value_of(popup) > _canvas_value_of(normal), "popup not above normal")
	_check(_canvas_value_of(normal) > _canvas_value_of(dash), "normal not above dashboard")

	# --- backing geometry was applied --------------------------------
	_check(normal.backing.size == Vector2(320, 200), "backing size not applied")

	# --- focus policy (§5) --------------------------------------------
	_check(wm.focus_window("win-normal"), "normal refused focus")
	_check(wm.focused_id == "win-normal", "focus not on normal")
	_check(not wm.focus_window("win-dash"), "dashboard took focus")
	_check(not wm.focus_window("win-panel"), "panel took focus")
	_check(not wm.focus_window("win-osd"), "osd took focus")
	_check(wm.focused_id == "win-normal", "focus moved by a refused focus")

	# --- conversion: normal → dashboard, same record, same backing ---
	var backing_before = normal.backing
	var id_before = normal.id
	_check(wm.set_style("win-normal", "dashboard"), "conversion refused")
	_check(normal.id == id_before, "conversion changed the id")
	_check(normal.backing == backing_before, "conversion replaced the backing")
	_check(normal.style == "dashboard", "style not dashboard after conversion")
	_check(normal.layer == "Desktop", "layer not Desktop after conversion")
	_check(normal.backing.get_parent() == wm.layer_node("Desktop"),
		"backing not reparented to Desktop layer")
	_check(wm.focused_id == "", "converted window kept focus")
	_check(not normal.takes_focus(), "converted window still takes focus")
	print("SLICE1_MEASURE converted canvas=", _canvas_value_of(normal),
		" (was ", LayerStack.canvas_value("Workspace"), ")")

	# --- freeze: a flag on any style ----------------------------------
	var app2 = _fake_window("win-app2", "normal")
	_check(wm.register_window(app2), "register app2 failed")
	_check(wm.focus_window("win-app2"), "app2 refused focus")
	_check(wm.set_frozen("win-app2", true), "freeze refused")
	_check(app2.frozen and not app2.takes_input(), "frozen window still takes input")
	_check(wm.focused_id == "", "frozen window kept focus")
	_check(wm.has_window("win-app2"), "frozen window left the registry")
	_check(wm.set_frozen("win-app2", false), "unfreeze refused")
	_check(wm.focus_window("win-app2"), "unfrozen window refused focus")

	# --- the root: registry + bus --------------------------------------
	_check(env_mgr.get_module("nct-window-manager") == wm, "root cannot find window manager")
	var saw_registration = false
	for entry in env_mgr.bus_log:
		if entry["topic"] == "module.registered" and entry["payload"] == "nct-window-manager":
			saw_registration = true
	_check(saw_registration, "registration not announced on the bus")
