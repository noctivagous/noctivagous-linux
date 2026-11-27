extends Control
## NCT Shell — the session's first furniture: the launch bar.
## The bar itself is NCTXML now (E4): bar.nctxml, hosted by
## ShellBar.cs (the BarHost node), one Repeat-generated button
## per launch-list entry. This script owns the launch list and
## the launching: buttons go through nct-launch; the shell
## contains no program paths (CONVENTIONS.md §10).

@onready var bar_host: Control = $BarHost

func _ready() -> void:
	var entries := _read_launch_list()
	print("SHELL_READY entries=", entries.size())
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

## The BarHost builds its Repeat items from these.
func get_launch_entries() -> Array:
	return _read_launch_list()

## A bar button was pressed (ShellBar.LaunchItem).
func launch_entry(id: String) -> void:
	print("SHELL_LAUNCH ", id)
	OS.create_process("nct-launch", [id])

func _notification(what: int) -> void:
	# Activation can clear a grab made at startup (this window is
	# typically mapped while the greeter still holds the seat, and
	# activated when the greeter quits). When the bar's window
	# gains focus and nothing inside holds it, the BarHost puts
	# focus back on the first button.
	if what == NOTIFICATION_WM_WINDOW_FOCUS_IN and bar_host:
		bar_host.ensure_focus()
