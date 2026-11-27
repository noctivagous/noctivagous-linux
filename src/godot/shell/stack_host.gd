extends Control
## The WindowTransformer stack (build log 36): the region
## where shaded foreign windows live as titlebar items.
##
## The demo's semantics (demo-de core/windows.js): a stacked
## window renders nowhere; its record keeps its identity, and
## the stack is a list — click an item to restore its window,
## the item's × closes the window without leaving the stack.
## Foreign windows are the compositor's surfaces, so the
## shell cannot hide or raise them itself: it speaks to
## nct-wl-bridge (services/bridge), which holds the
## wlr-foreign-toplevel binding against labwc and does the
## minimizing / activating / closing. Shading a window is
## the bridge minimizing it at our request and marking it
## stacked; the stack the user sees is drawn here, from the
## bridge's feed.
##
## Protocol (one line each way, TCP 127.0.0.1:7718):
##   LIST            -> TOP lines, then END
##   RESTORE <id>    -> OK | FAIL <why>
##   CLOSE <id>      -> OK | FAIL <why>
## TOP <id> <app_id> <activated> <minimized> <stacked> <title>
##
## The feed is polled once a second — the same cadence the
## process watcher keeps for liveness (build log 35). This
## node never blocks the desktop: it ignores mouse input
## itself and only its panel takes any.

## The row set changed (build log 37): main.gd rewires the
## furniture focus chain whenever this fires.
signal rows_changed

const COL_TEXT := Color(0.73, 0.73, 0.73)        # #bababa
const COL_FOCUS := Color(0.31, 0.76, 0.97)       # #4fc3f7
const POLL_S := 1.0

var _panel: PanelContainer
var _rows: VBoxContainer
var _tcp := StreamPeerTCP.new()
var _connected := false
var _rx := ""
var _poll_left := 0.0
var _retry_left := 0.0
var _pending: Array = []        ## TOP dicts of the LIST in flight
var _tops: Array = []           ## last committed TOP dicts
var _signature := ""
var last_reply := ""

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build_panel()
	_try_connect()

func _port() -> int:
	var env := OS.get_environment("NCT_WL_BRIDGE_PORT")
	if env != "":
		return int(env)
	return 7718

func _try_connect() -> void:
	_tcp = StreamPeerTCP.new()
	_tcp.connect_to_host("127.0.0.1", _port())

func _box(bg: Color, border: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = bg
	box.border_color = border
	box.set_border_width_all(1)
	box.set_corner_radius_all(4)
	return box

func _build_panel() -> void:
	_panel = PanelContainer.new()
	_panel.name = "StackPanel"
	_panel.set_anchor(SIDE_LEFT, 1.0)
	_panel.set_anchor(SIDE_RIGHT, 1.0)
	_panel.set_anchor(SIDE_TOP, 0.0)
	_panel.set_anchor(SIDE_BOTTOM, 0.0)
	_panel.offset_left = -320
	_panel.offset_right = -8
	_panel.offset_top = 56
	_panel.offset_bottom = 56
	_panel.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_panel.grow_vertical = Control.GROW_DIRECTION_END
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.07, 0.07, 0.07)
	box.border_color = Color(0, 0, 0)
	box.set_border_width_all(1)
	box.set_corner_radius_all(4)
	_panel.add_theme_stylebox_override("panel", box)
	_panel.visible = false
	add_child(_panel)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 6)
	margin.add_theme_constant_override("margin_right", 6)
	margin.add_theme_constant_override("margin_top", 6)
	margin.add_theme_constant_override("margin_bottom", 6)
	_panel.add_child(margin)
	_rows = VBoxContainer.new()
	_rows.add_theme_constant_override("separation", 4)
	margin.add_child(_rows)

func _process(delta: float) -> void:
	_tcp.poll()
	var st := _tcp.get_status()
	if st == StreamPeerTCP.STATUS_CONNECTED:
		if not _connected:
			_connected = true
			_poll_left = 0.0
		_drain()
		_poll_left -= delta
		if _poll_left <= 0.0:
			_poll_left = POLL_S
			_send("LIST")
	elif st == StreamPeerTCP.STATUS_ERROR or st == StreamPeerTCP.STATUS_NONE:
		_connected = false
		_retry_left -= delta
		if _retry_left <= 0.0:
			_retry_left = 2.0
			_try_connect()

func _send(line: String) -> void:
	if _tcp.get_status() == StreamPeerTCP.STATUS_CONNECTED:
		_tcp.put_data((line + "\n").to_utf8_buffer())

func _drain() -> void:
	var avail := _tcp.get_available_bytes()
	if avail > 0:
		var res := _tcp.get_data(avail)
		if res[0] == OK:
			_rx += (res[1] as PackedByteArray).get_string_from_utf8()
	while _rx.find("\n") >= 0:
		var idx := _rx.find("\n")
		var line := _rx.substr(0, idx).strip_edges()
		_rx = _rx.substr(idx + 1)
		if line != "":
			_handle_line(line)

func _handle_line(line: String) -> void:
	if line.begins_with("TOP "):
		var parts := line.split(" ", true, 6)
		if parts.size() >= 6:
			_pending.append({
				"id": parts[1], "app_id": parts[2],
				"activated": parts[3] == "1",
				"minimized": parts[4] == "1",
				"stacked": parts[5] == "1",
				"title": parts[6] if parts.size() > 6 else "",
			})
	elif line == "END":
		_tops = _pending
		_pending = []
		_refresh()
	elif line.begins_with("OK") or line.begins_with("FAIL"):
		last_reply = line
		if line.begins_with("FAIL"):
			printerr("STACK_BRIDGE ", line)

## The stacked subset, in the bridge's (arrival) order.
func stacked() -> Array:
	var out: Array = []
	for t in _tops:
		if t["stacked"]:
			out.append(t)
	return out

func stacked_count() -> int:
	return stacked().size()

func bridge_connected() -> bool:
	return _connected

## The panel itself, for the window manager's furniture
## record (build log 37): main.gd seats it in the Top layer
## beside the bar's root, the way the bar is seated — the
## stack is Top-layer furniture, and seating it anywhere
## else puts its buttons in a different canvas, which the
## engine's focus chain will not cross.
func get_panel_root() -> PanelContainer:
	return _panel

func send_restore(id: String) -> void:
	_send("RESTORE " + id)

func send_close(id: String) -> void:
	_send("CLOSE " + id)

func _refresh() -> void:
	var items := stacked()
	var sig := ""
	for t in items:
		sig += str(t["id"]) + "|" + str(t["title"]) + ";"
	if sig == _signature:
		return
	_signature = sig
	for c in _rows.get_children():
		_rows.remove_child(c)
		c.queue_free()
	for t in items:
		_rows.add_child(_make_row(t))
	_panel.visible = not items.is_empty()
	rows_changed.emit()

func _make_row(t: Dictionary) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 4)
	var title := str(t["title"])
	if title == "":
		title = str(t["app_id"])
	var b := Button.new()
	b.text = title
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.custom_minimum_size = Vector2(0, 28)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.add_theme_stylebox_override("normal",
		_box(Color(0.11, 0.11, 0.11), Color(0, 0, 0)))
	b.add_theme_stylebox_override("hover",
		_box(Color(0.19, 0.19, 0.19), Color(0, 0, 0)))
	b.add_theme_stylebox_override("pressed",
		_box(Color(0.06, 0.06, 0.06), Color(0, 0, 0)))
	b.add_theme_stylebox_override("focus",
		_box(Color(0, 0, 0, 0), COL_FOCUS))
	b.add_theme_color_override("font_color", COL_TEXT)
	b.add_theme_color_override("font_hover_color", Color(1, 1, 1))
	b.add_theme_font_size_override("font_size", 12)
	b.pressed.connect(_on_item_pressed.bind(str(t["id"])))
	row.add_child(b)
	var x := Button.new()
	x.text = "×"
	x.custom_minimum_size = Vector2(28, 28)
	x.add_theme_stylebox_override("normal",
		_box(Color(0.11, 0.11, 0.11), Color(0, 0, 0)))
	x.add_theme_stylebox_override("hover",
		_box(Color(0.19, 0.19, 0.19), Color(0, 0, 0)))
	x.add_theme_stylebox_override("pressed",
		_box(Color(0.06, 0.06, 0.06), Color(0, 0, 0)))
	x.add_theme_stylebox_override("focus",
		_box(Color(0, 0, 0, 0), COL_FOCUS))
	x.add_theme_color_override("font_color", COL_TEXT)
	x.add_theme_color_override("font_hover_color", Color(1, 1, 1))
	x.add_theme_font_size_override("font_size", 12)
	x.pressed.connect(_on_close_pressed.bind(str(t["id"])))
	row.add_child(x)
	return row

func _on_item_pressed(id: String) -> void:
	send_restore(id)

func _on_close_pressed(id: String) -> void:
	send_close(id)
