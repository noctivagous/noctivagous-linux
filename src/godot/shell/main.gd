extends Control
## NCT Shell — the session's first furniture: a bar with a clock and one
## button per launch-list entry. Buttons go through nct-launch; the shell
## contains no program paths (CONVENTIONS.md §10).

var clock_label: Label
var has_focus_owner := false
var first_btn: Button

func _ready() -> void:
	var entries := _read_launch_list()
	_build_ui(entries)
	var args := OS.get_cmdline_user_args()
	if "--self-test" in args:
		for e in entries:
			print("SHELL_ENTRY ", e["id"], " ", e["title"])
		print("SHELL_SELFTEST_OK entries=", entries.size())
		get_tree().quit()

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

func _build_ui(entries: Array) -> void:
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(panel)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	panel.add_child(row)
	var brand := Label.new()
	brand.text = "  NCT"
	row.add_child(brand)
	clock_label = Label.new()
	clock_label.text = ""
	row.add_child(clock_label)
	for e in entries:
		if e["id"] == "shell":
			continue
		var btn := Button.new()
		btn.text = e["title"]
		var id: String = e["id"]
		btn.pressed.connect(func():
			print("SHELL_LAUNCH ", id)
			OS.create_process("nct-launch", [id]))
		row.add_child(btn)
		# The bar is the session's home surface: its first launch
		# button holds keyboard focus from the start, so the session
		# is keyboard-drivable the moment it appears.
		if not has_focus_owner:
			# Deferred: a grab during _ready is dropped before the
			# window owns focus; by the idle frame it sticks.
			btn.grab_focus.call_deferred()
			has_focus_owner = true
			first_btn = btn
	print("SHELL_READY entries=", entries.size())

func _notification(what: int) -> void:
	# Activation can clear a grab made at startup (this window is
	# typically mapped while the greeter still holds the seat, and
	# activated when the greeter quits). When the bar's window gains
	# focus and nothing inside holds it, focus the first button.
	if what == NOTIFICATION_WM_WINDOW_FOCUS_IN and first_btn:
		print("SHELL_FOCUS_IN owner=", get_viewport().gui_get_focus_owner())
		if get_viewport().gui_get_focus_owner() == null:
			first_btn.grab_focus()
			print("SHELL_FOCUS_IN grabbed first button")

func _process(_delta: float) -> void:
	if clock_label:
		clock_label.text = Time.get_time_string_from_system()
