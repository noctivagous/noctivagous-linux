extends Control
## NCT Greeter — a Godot app shown before login.
## Talks to nct-greetd-bridge (services/bridge) over TCP 127.0.0.1:7717:
## AUTH <user> <pass> -> OK, then START -> STARTED, then the greeter quits
## and the session it started replaces it. UI is built in code so the
## scene file stays a two-node stub that is easy to diff and repair.

var tcp := StreamPeerTCP.new()
var phase := "idle" # idle -> connecting -> auth -> start -> done
var rx := ""
var user_edit: LineEdit
var pass_edit: LineEdit
var status_label: Label
var pending_user := ""
var pending_pass := ""
var auto_mode := false

func _ready() -> void:
	_build_ui()
	var args := OS.get_cmdline_user_args()
	var host := OS.get_environment("NCT_BRIDGE_HOST")
	var port := OS.get_environment("NCT_BRIDGE_PORT")
	if host != "": tcp = StreamPeerTCP.new() # host/port read in _connect()
	if port != "": pass # (kept simple: defaults below, env overrides in _connect)
	if "--self-test" in args or "--auto-login" in args:
		var i := args.find("--self-test")
		if i == -1: i = args.find("--auto-login")
		if i + 2 < args.size():
			auto_mode = true
			pending_user = args[i + 1]
			pending_pass = args[i + 2]
			_connect_and_auth()

func _build_ui() -> void:
	var bg := ColorRect.new()
	bg.color = Color(0.07, 0.07, 0.08)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var center := VBoxContainer.new()
	center.set_anchors_preset(Control.PRESET_CENTER)
	center.alignment = BoxContainer.ALIGNMENT_CENTER
	center.add_theme_constant_override("separation", 10)
	add_child(center)
	var title := Label.new()
	title.text = "NOCTIVAGOUS"
	title.add_theme_font_size_override("font_size", 34)
	center.add_child(title)
	user_edit = LineEdit.new()
	user_edit.placeholder_text = "Username"
	user_edit.custom_minimum_size = Vector2(280, 36)
	center.add_child(user_edit)
	pass_edit = LineEdit.new()
	pass_edit.placeholder_text = "Password"
	pass_edit.secret = true
	pass_edit.custom_minimum_size = Vector2(280, 36)
	pass_edit.text_submitted.connect(func(_t): _on_login_pressed())
	center.add_child(pass_edit)
	var btn := Button.new()
	btn.text = "Log In"
	btn.custom_minimum_size = Vector2(280, 40)
	btn.pressed.connect(_on_login_pressed)
	center.add_child(btn)
	status_label = Label.new()
	status_label.text = ""
	center.add_child(status_label)
	# A greeter's first field holds focus from the start, like every
	# real greeter — the user just types. Deferred: a grab during
	# _ready is dropped before the window owns focus.
	user_edit.grab_focus.call_deferred()

func _notification(what: int) -> void:
	# Same guard as the shell: if activation cleared the startup
	# grab and nothing holds focus, put it back on the username field.
	if what == NOTIFICATION_WM_WINDOW_FOCUS_IN and user_edit:
		if get_viewport().gui_get_focus_owner() == null:
			user_edit.grab_focus()

func _on_login_pressed() -> void:
	pending_user = user_edit.text
	pending_pass = pass_edit.text
	_connect_and_auth()

func _connect_and_auth() -> void:
	var host := OS.get_environment("NCT_BRIDGE_HOST")
	if host == "": host = "127.0.0.1"
	var port := 7717
	var p := OS.get_environment("NCT_BRIDGE_PORT")
	if p != "": port = int(p)
	status_label.text = "Connecting…"
	if tcp.get_status() == StreamPeerTCP.STATUS_CONNECTED:
		# Retry after a failed attempt: the bridge holds one connection
		# for the whole conversation, so reuse it.
		phase = "auth"
		_send("AUTH %s %s" % [pending_user, pending_pass])
		return
	var err := tcp.connect_to_host(host, port)
	if err != OK:
		_fail("cannot reach the auth bridge (err %d)" % err)
		return
	phase = "connecting"

func _process(_delta: float) -> void:
	if phase == "idle" or phase == "done":
		return
	tcp.poll()
	var st := tcp.get_status()
	if phase == "connecting" and st == StreamPeerTCP.STATUS_CONNECTED:
		phase = "auth"
		_send("AUTH %s %s" % [pending_user, pending_pass])
	elif st == StreamPeerTCP.STATUS_ERROR or st == StreamPeerTCP.STATUS_NONE:
		_fail("bridge connection lost")
		return
	if st == StreamPeerTCP.STATUS_CONNECTED:
		var n := tcp.get_available_bytes()
		if n > 0:
			rx += tcp.get_utf8_string(n)
			while rx.contains("\n"):
				var idx := rx.find("\n")
				var line := rx.substr(0, idx).strip_edges()
				rx = rx.substr(idx + 1)
				_on_line(line)

func _send(text: String) -> void:
	tcp.put_data((text + "\n").to_utf8_buffer())

func _on_line(line: String) -> void:
	if phase == "auth":
		if line == "OK":
			phase = "start"
			status_label.text = "Starting session…"
			_send("START")
		else:
			_fail(line)
	elif phase == "start":
		if line == "STARTED":
			phase = "done"
			print("GREETER_LOGIN_OK user=", pending_user)
			if auto_mode:
				print("GREETER_SELFTEST_OK")
			get_tree().quit()
		else:
			_fail(line)

func _fail(why: String) -> void:
	phase = "idle"
	status_label.text = why
	printerr("GREETER_FAIL: ", why)
	# Back to the password field, contents selected for retyping.
	pass_edit.select_all()
	pass_edit.grab_focus()
	if auto_mode:
		print("GREETER_SELFTEST_FAIL ", why)
		get_tree().quit(1)
