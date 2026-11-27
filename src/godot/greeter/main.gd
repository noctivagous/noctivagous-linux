extends Control
## NCT Greeter — a Godot app shown before login.
## Talks to nct-greetd-bridge (services/bridge) over TCP 127.0.0.1:7717:
## AUTH <user> <pass> -> OK, then START -> STARTED, then the greeter quits
## and the session it started replaces it.
##
## The login form is GDScript (form_host.gd, the FormHost node):
## a card built in code, styled from the TypeScript demo. (It
## was an NCTXML view hosted by C# until the GDScript-first
## strategy, build log 34; the NCTXML view + model live on in
## src/modules/nctxml/examples/ as the baking track's
## reference.) This script owns the backdrop and the bridge
## conversation; the form calls form_attempt_login() and the
## conversation's outcome is reported back through the FormHost
## (resolve_login / set_status / refocus_password).

var tcp := StreamPeerTCP.new()
var phase := "idle" # idle -> connecting -> auth -> start -> done
var rx := ""
var pending_user := ""
var pending_pass := ""
var auto_mode := false

@onready var form_host: Control = $FormHost

func _ready() -> void:
	_build_bg()
	var args := OS.get_cmdline_user_args()
	if "--self-test" in args or "--auto-login" in args:
		var i := args.find("--self-test")
		if i == -1: i = args.find("--auto-login")
		if i + 2 < args.size():
			auto_mode = true
			pending_user = args[i + 1]
			pending_pass = args[i + 2]
			_connect_and_auth()

const Backdrop := preload("backdrop.gd")

func _build_bg() -> void:
	var bg = Backdrop.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	# The form (FormHost, declared in the scene) paints above it.
	move_child(form_host, get_child_count() - 1)

func _notification(what: int) -> void:
	# Same guard as the shell: if activation cleared the startup
	# grab and nothing holds focus, put it back on the username
	# field (the FormHost owns the fields now).
	if what == NOTIFICATION_WM_WINDOW_FOCUS_IN and form_host:
		form_host.ensure_focus()

## Called by the form's submission (via GreeterForm.AttemptLogin).
## The bridge conversation is async: the submission stays pending
## until _on_line / _fail resolves it through the FormHost.
func form_attempt_login(user: String, passwd: String) -> Dictionary:
	pending_user = user
	pending_pass = passwd
	_connect_and_auth()
	return {"state": "pending"}

func _connect_and_auth() -> void:
	var host := OS.get_environment("NCT_BRIDGE_HOST")
	if host == "": host = "127.0.0.1"
	var port := 7717
	var p := OS.get_environment("NCT_BRIDGE_PORT")
	if p != "": port = int(p)
	form_host.set_status("Connecting…")
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
			form_host.set_status("Starting session…")
			_send("START")
		else:
			_fail(line)
	elif phase == "start":
		if line == "STARTED":
			phase = "done"
			form_host.resolve_login(true, "")
			print("GREETER_LOGIN_OK user=", pending_user)
			if auto_mode:
				print("GREETER_SELFTEST_OK")
			get_tree().quit()
		else:
			_fail(line)

func _fail(why: String) -> void:
	phase = "idle"
	form_host.resolve_login(false, why)
	printerr("GREETER_FAIL: ", why)
	# Back to the password field, contents selected for retyping.
	form_host.refocus_password()
	if auto_mode:
		print("GREETER_SELFTEST_FAIL ", why)
		get_tree().quit(1)
