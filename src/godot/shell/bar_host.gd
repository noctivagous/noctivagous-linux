extends Control
## The launch bar, built in GDScript (GDScript-first strategy,
## build log 34): a 48px bar across the top of the screen —
## the NCT wordmark plate, one button per launch-list entry,
## and the clock at the right. Launching stays in main.gd
## (registry + nct-launch; no program paths here either).
## The bar's first button holds keyboard focus from the
## start — the session is keyboard-drivable the moment it
## appears (mouse clicks and key activation run through the
## same pressed signal: bimodal, per the house rule).
##
## Same contract the NCTXML bar host (ShellBar.cs) kept:
## main.gd reads get_bar_root() for the window manager's
## panel record and calls ensure_focus() from its focus
## guard. The NCTXML view this replaces lives on in
## src/modules/nctxml/examples/.
##
## Styling is the TypeScript demo's (demo-de
## styles/nct-desktop.css): the dock strip's near-black
## gradient as a solid, black borders, 4px control radius,
## buttons on the button gradient tones, the wordmark in
## the primary green, the clock in mono style.

var _bar_root: PanelContainer
var _first_button: Button
var _buttons: Array[Button] = []
var _clock_label: Label
var _date_label: Label
var _last_second := ""
var _indicators: Dictionary = {}  ## app id -> status ColorRect
var _status: Dictionary = {}      ## app id -> launching/running/idle
var _flash_until: Dictionary = {} ## app id -> msec the failure flash ends

const COL_TEXT := Color(0.73, 0.73, 0.73)        # #bababa
const COL_FOCUS := Color(0.31, 0.76, 0.97)       # #4fc3f7
const COL_GREEN := Color(0.4, 1.0, 0.4)          # #66ff66
const COL_RED := Color(0.88, 0.35, 0.31)         # #e05a4e
const FLASH_MS := 1400

func _ready() -> void:
	_build_bar()
	# The session's first button holds focus from the start.
	if _first_button:
		_first_button.grab_focus.call_deferred()

func _box(bg: Color, border: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = bg
	box.border_color = border
	box.set_border_width_all(1)
	box.set_corner_radius_all(4)
	return box

func _build_bar() -> void:
	_bar_root = PanelContainer.new()
	_bar_root.name = "BarRoot"
	_bar_root.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_bar_root.custom_minimum_size = Vector2(0, 48)
	var bar_box := StyleBoxFlat.new()
	bar_box.bg_color = Color(0.07, 0.07, 0.07)
	bar_box.border_color = Color(0, 0, 0)
	bar_box.border_width_bottom = 1
	_bar_root.add_theme_stylebox_override("panel", bar_box)
	add_child(_bar_root)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 8)
	margin.add_theme_constant_override("margin_right", 8)
	margin.add_theme_constant_override("margin_top", 5)
	margin.add_theme_constant_override("margin_bottom", 5)
	_bar_root.add_child(margin)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	margin.add_child(row)

	# The wordmark plate (the demo's start button, shrunk to
	# a mark): dark green plate, bright green letters.
	var plate := PanelContainer.new()
	plate.add_theme_stylebox_override("panel",
		_box(Color(0.10, 0.16, 0.10), Color(0, 0, 0)))
	row.add_child(plate)
	var plate_margin := MarginContainer.new()
	plate_margin.add_theme_constant_override("margin_left", 12)
	plate_margin.add_theme_constant_override("margin_right", 12)
	plate_margin.add_theme_constant_override("margin_top", 6)
	plate_margin.add_theme_constant_override("margin_bottom", 6)
	plate.add_child(plate_margin)
	var wordmark := Label.new()
	wordmark.text = "NCT"
	wordmark.add_theme_font_size_override("font_size", 13)
	wordmark.add_theme_color_override("font_color", COL_GREEN)
	plate_margin.add_child(wordmark)

	for e in get_parent().get_launch_entries():
		if e["id"] == "shell":
			continue
		var b := Button.new()
		b.text = e["title"]
		b.custom_minimum_size = Vector2(0, 36)
		b.add_theme_stylebox_override("normal",
			_box(Color(0.11, 0.11, 0.11), Color(0, 0, 0)))
		b.add_theme_stylebox_override("hover",
			_box(Color(0.19, 0.19, 0.19), Color(0, 0, 0)))
		b.add_theme_stylebox_override("pressed",
			_box(Color(0.06, 0.06, 0.06), Color(0, 0, 0)))
		b.add_theme_stylebox_override("focus",
			_box(Color(0, 0, 0, 0), COL_FOCUS))
		b.add_theme_color_override("font_color", COL_TEXT)
		b.add_theme_color_override("font_hover_color",
			Color(1, 1, 1))
		b.add_theme_font_size_override("font_size", 12)
		b.pressed.connect(_on_entry_pressed.bind(e["id"]))
		# The status strip: a 3px indicator along the button's
		# bottom edge — pulsing blue while the program is
		# launching, steady green while it runs, a red flash
		# when a launch never comes alive (build log 35). It
		# renders the watcher's word, driven by set_app_status.
		var ind := ColorRect.new()
		ind.name = "StatusStrip"
		ind.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
		ind.offset_top = -3
		ind.offset_bottom = 0
		ind.mouse_filter = Control.MOUSE_FILTER_IGNORE
		ind.visible = false
		b.add_child(ind)
		_indicators[e["id"]] = ind
		_status[e["id"]] = "idle"
		row.add_child(b)
		_buttons.append(b)
		if _first_button == null:
			_first_button = b

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(spacer)

	var clock_box := VBoxContainer.new()
	clock_box.add_theme_constant_override("separation", 0)
	row.add_child(clock_box)
	_clock_label = Label.new()
	_clock_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_clock_label.add_theme_font_size_override("font_size", 13)
	_clock_label.add_theme_color_override("font_color",
		Color(0.8, 0.8, 0.8))
	clock_box.add_child(_clock_label)
	_date_label = Label.new()
	_date_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_date_label.add_theme_font_size_override("font_size", 9)
	_date_label.add_theme_color_override("font_color",
		Color(0.45, 0.45, 0.45))
	clock_box.add_child(_date_label)
	_update_clock()

func _process(_delta: float) -> void:
	var t := Time.get_time_string_from_system()
	if t != _last_second:
		_last_second = t
		_update_clock()
	_update_indicators()

## Render every button's status strip from the stored state:
## the failure flash (fading red) outranks the app status;
## launching pulses on the focus blue, running holds the
## primary green, idle hides the strip.
func _update_indicators() -> void:
	var now := Time.get_ticks_msec()
	for app_id in _indicators:
		var ind: ColorRect = _indicators[app_id]
		if now < int(_flash_until.get(app_id, 0)):
			var left := float(int(_flash_until[app_id]) - now) \
				/ float(FLASH_MS)
			ind.visible = true
			ind.color = Color(COL_RED, clampf(left, 0.0, 1.0))
			continue
		match str(_status.get(app_id, "idle")):
			"launching":
				ind.visible = true
				var pulse := 0.5 + 0.5 * sin(float(now) / 180.0)
				ind.color = Color(COL_FOCUS, 0.3 + 0.7 * pulse)
			"running":
				ind.visible = true
				ind.color = Color(COL_GREEN, 0.9)
			_:
				ind.visible = false

func _update_clock() -> void:
	if _clock_label == null:
		return
	_clock_label.text = Time.get_time_string_from_system()
	var d := Time.get_date_dict_from_system()
	const DAYS := ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
	const MONTHS := ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
		"JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
	_date_label.text = "%s %02d %s %d" % [
		DAYS[int(d["weekday"])], int(d["day"]),
		MONTHS[int(d["month"]) - 1], int(d["year"])]

func _on_entry_pressed(id: String) -> void:
	get_parent().launch_entry(id)

# ---- called from main.gd ----

## The bar's backing for its Window record: main.gd hands
## this root to the window manager, which seats it on the
## Top layer (the manager reparents it out of this host).
func get_bar_root() -> Control:
	return _bar_root

## How many launch buttons the bar built — main.gd's
## self-test checks it against the launch list, so a bar
## that silently failed to build can no longer pass.
func button_count() -> int:
	return _buttons.size()

func ensure_focus() -> void:
	if get_viewport().gui_get_focus_owner() == null and _first_button:
		_first_button.grab_focus()

## The watcher's word on one app, via main.gd: "launching"
## (spawned, not yet confirmed), "running" (pid confirmed),
## "idle" (not running). Stored; _process renders it.
func set_app_status(app_id: String, status: String) -> void:
	_status[app_id] = status

## A launch that never came alive: flash the app's strip red.
func flash_failed(app_id: String) -> void:
	_flash_until[app_id] = Time.get_ticks_msec() + FLASH_MS
