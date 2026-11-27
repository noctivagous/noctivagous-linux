extends Control
## NCT Shell — the session's first furniture: the launch bar.
## The bar is GDScript (bar_host.gd, the BarHost node): one
## button per launch-list entry, built in code and styled
## from the TypeScript demo. (It was an NCTXML document
## hosted by C# until the GDScript-first strategy, build
## log 34; the NCTXML view lives on in
## src/modules/nctxml/examples/.) This script owns the
## backdrop, the launch list and the launching: buttons go
## through the registry and nct-launch; the shell contains
## no program paths (CONVENTIONS.md §10).
##
## Two modules are hosted here, on the seam plans §1 rule 2
## draws: the WINDOW MANAGER owns the windows (build log 30 —
## the bar is a panel-style record on the Top layer), and the
## APP REGISTRY owns the programs (build log 32): every launch
## goes through the registry, which hands the manager the
## record (origin from the app kind, no backing — the surface
## is the compositor's to attach) and keeps the lifecycle.
## Single-instance lives there too: relaunching a running app
## focuses its window instead of spawning a second process.
## Spawning itself stays the foundation chain's (nct-launch,
## detached). Since build log 35 the seam is fed: nct-launch
## records the spawned pid, and the process watcher
## (process_watcher.gd) polls it into the registry's
## mark_process_dead / check_liveness — a closed program
## leaves the running set, so its button launches it again.
## The watcher also drives the bar's per-app status display.

const WinMgr := preload("nct-window-manager/window_manager.gd")
const Record := preload("nct-window-manager/window_record.gd")
const LayerStack := preload("nct-window-manager/nct-layer-stack/layer_stack.gd")
const AppRegistry := preload("nct-app-registry/app_registry.gd")
const ProcessWatcher := preload("process_watcher.gd")

@onready var bar_host: Control = $BarHost
@onready var stack_host: Control = $StackHost

var wm  ## the hosted window manager (nct-window-manager)
var registry  ## the hosted app registry (nct-app-registry)
var watcher  ## the process watcher feeding the liveness seam

const Backdrop := preload("backdrop.gd")

func _ready() -> void:
	_build_backdrop()
	var entries := _read_launch_list()
	print("SHELL_READY entries=", entries.size())
	_setup_window_manager()
	_setup_registry(entries)
	_setup_watcher()
	stack_host.rows_changed.connect(_rewire_focus)
	_rewire_focus()
	var args := OS.get_cmdline_user_args()
	if "--liveness-test" in args:
		_liveness_test()
	if "--stack-test" in args:
		_stack_test()
	if "--self-test" in args:
		for e in entries:
			print("SHELL_ENTRY ", e["id"], " ", e["title"])
		print("SHELL_SELFTEST_OK entries=", entries.size())
		_bar_self_test(entries)
		_wm_self_test()
		_registry_self_test(entries)
		get_tree().quit()

## The desktop backdrop, on a CanvasLayer below every window
## layer the manager builds: the demo's wallpaper (backdrop.gd).
## Its top registration marks sit below the launch bar.
func _build_backdrop() -> void:
	var layer := CanvasLayer.new()
	layer.layer = -100
	add_child(layer)
	var bg = Backdrop.new()
	bg.top_inset = 62.0
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(bg)

## --self-test only: the bar itself, proven present — the
## check whose absence let a shipped shell pass its self-test
## with the bar's C# half missing (build log 33). The bar
## root must exist and carry one button per launchable entry.
func _bar_self_test(entries: Array) -> void:
	var want := 0
	for e in entries:
		if e["id"] != "shell":
			want += 1
	if bar_host.get_bar_root() != null and bar_host.button_count() == want:
		print("SHELL_BAR_OK buttons=", bar_host.button_count())
	else:
		printerr("SHELL_BAR_FAIL root=", bar_host.get_bar_root(),
			" buttons=", bar_host.button_count(), " want=", want)

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
	# A panel's geometry is its strip: the full width, the
	# bar's own height. (Full-viewport geometry was harmless
	# while the bar's root was a transparent panel; a styled
	# bar seated at that size would stretch to fill it.)
	bar_rec.geometry = Rect2(Vector2.ZERO,
		Vector2(get_viewport_rect().size.x, 48))
	wm.register_window(bar_rec)
	# The WindowTransformer stack is Top-layer furniture too
	# (build log 37): its panel is seated in the same layer
	# as the bar's root. In the default canvas its buttons
	# formed a focus island — the engine's focus chain does
	# not cross canvas boundaries, so Tab cycled the bar
	# alone and the stack was keyboard-unreachable.
	var stack_rec := Record.new("stack-region", "panel")
	stack_rec.origin = "shell"
	stack_rec.kind_link = "shell"
	stack_rec.title = "Window stack"
	stack_rec.backing = stack_host.get_panel_root()
	stack_rec.geometry = Rect2(
		Vector2(get_viewport_rect().size.x - 320, 56),
		Vector2(312, 0))
	wm.register_window(stack_rec)

## The registry: one manifest per launch-list entry (the shell
## itself is furniture, not a launchable app). Record-only
## hosting — placeholder backings off, because these programs
## run in their own processes under the compositor.
func _setup_registry(entries: Array) -> void:
	registry = AppRegistry.new()
	add_child(registry)
	registry.set_window_manager(wm)
	registry.placeholder_backings = false
	for e in entries:
		if e["id"] == "shell":
			continue
		registry.register_manifest(_manifest_for(e))

## The manifest for one launch-list entry. The entry strings
## are the registry's record of how the app launches
## (launch_command derives from them); the live resolution —
## fallbacks, overrides — stays nct-resolve-cmd's, and the
## starting stays nct-launch's.
func _manifest_for(e: Dictionary) -> Dictionary:
	var kind := "foreign"
	var entry := str(e["key"])
	match str(e["key"]):
		"hello":
			kind = "pck"
			entry = "/usr/lib/nct/godot/apps/nct-hello.pck"
		"firefox":
			entry = "firefox-esr"
		"qt":
			entry = "qterminal"
		"terminal":
			entry = "foot"
	return {"id": e["id"], "name": e["title"], "kind": kind,
		"entry": entry, "single_instance": true}

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

## The process watcher: feeds the registry's liveness seam
## from nct-launch's pid records, and carries the per-app
## status to the bar's indicators.
func _setup_watcher() -> void:
	watcher = ProcessWatcher.new()
	add_child(watcher)
	watcher.status_changed.connect(_on_app_status)
	watcher.launch_failed.connect(_on_launch_failed)
	watcher.start(registry)

func _on_app_status(app_id: String, status: String) -> void:
	bar_host.set_app_status(app_id, status)

func _on_launch_failed(app_id: String) -> void:
	bar_host.flash_failed(app_id)

## A bar button was pressed (ShellBar.LaunchItem). The launch
## goes through the registry: it registers the Window record
## and tracks the lifecycle; the shell then starts the program
## through the foundation chain. A running single-instance app
## is focused, never respawned — but the registry's word alone
## is bookkeeping, so the watcher revalidates the process
## first: an app whose program has closed is reaped on the
## spot and launched fresh (build log 35).
func launch_entry(id: String) -> void:
	print("SHELL_LAUNCH ", id)
	if registry.is_running(id):
		if watcher.revalidate(id):
			registry.launch(id)
			return
		registry.check_liveness()
	if registry.launch(id) == "":
		printerr("SHELL: no manifest for launch id ", id)
		return
	OS.create_process("nct-launch", [id])

## --liveness-test only: the full launch path against the
## "sleeper" entry the chain supplies (NCT_LAUNCH_LIST +
## NCT_CMD_SLEEPER=/bin/sleep 60): launch through nct-launch,
## watch the watcher confirm the pid, kill the program, watch
## the reap, relaunch and confirm a NEW pid — the user's
## open, close, reopen pattern, proven headless.
func _liveness_test() -> void:
	var id := "sleeper"
	launch_entry(id)
	var spawned := await _wait_until(
		func(): return watcher.is_confirmed(id), 8.0)
	if not spawned:
		printerr("LIVENESS_FAIL spawn never confirmed")
		get_tree().quit(1)
		return
	var pid1: int = watcher.pid_of(id)
	print("LIVENESS_SPAWN_OK pid=", pid1)
	OS.kill(pid1)
	var reaped := await _wait_until(
		func(): return not registry.is_running(id), 6.0)
	if not reaped:
		printerr("LIVENESS_FAIL dead app never reaped")
		get_tree().quit(1)
		return
	print("LIVENESS_REAP_OK")
	launch_entry(id)
	var relaunched := await _wait_until(
		func(): return watcher.is_confirmed(id) \
			and watcher.pid_of(id) != pid1, 8.0)
	if not relaunched:
		printerr("LIVENESS_FAIL relaunch never confirmed")
		get_tree().quit(1)
		return
	print("LIVENESS_RELAUNCH_OK pid=", watcher.pid_of(id))
	OS.kill(watcher.pid_of(id))
	print("LIVENESS_TEST_OK")
	get_tree().quit()

## --stack-test only: the WindowTransformer stack against the
## wl-bridge (the chain supplies its fixture backend): the
## stacked items arrive in the feed, and restoring the first
## one takes it back out of the stack (build log 36).
func _stack_test() -> void:
	var want := 1
	var env := OS.get_environment("NCT_STACK_TEST_WANT")
	if env != "":
		want = int(env)
	var seen := await _wait_until(
		func(): return stack_host.stacked_count() >= want, 12.0)
	if not seen:
		printerr("STACK_FAIL stacked items never arrived")
		get_tree().quit(1)
		return
	var items: Array = stack_host.stacked()
	for t in items:
		print("STACK_ITEM ", t["id"], " ", t["title"])
	# Keyboard legs (build log 37): the stack row must be IN
	# the focus chain that starts at the bar, and activating
	# it with ui_accept — the Enter key's action — must
	# restore its window out of the stack. This is the user's
	# keyboard path, driven headlessly.
	var bar_buttons: Array = []
	_collect_buttons(bar_host.get_bar_root(), bar_buttons)
	var stack_buttons: Array = []
	_collect_buttons(stack_host.get_panel_root(), stack_buttons)
	if bar_buttons.is_empty() or stack_buttons.is_empty():
		printerr("STACK_FAIL no buttons to walk")
		get_tree().quit(1)
		return
	var visited: Array = []
	var cur: Control = bar_buttons[0]
	for i in 16:
		var nxt: Control = cur.find_next_valid_focus()
		if nxt == null or nxt == bar_buttons[0]:
			break
		visited.append(nxt)
		cur = nxt
	var in_chain := false
	for b in stack_buttons:
		if visited.has(b):
			in_chain = true
	if not in_chain:
		printerr("STACK_FAIL stack row is not in the bar's focus chain")
		get_tree().quit(1)
		return
	print("STACK_FOCUS_OK chain=", visited.size() + 1)
	var row_button: Control = stack_buttons[0]
	row_button.grab_focus()
	await get_tree().process_frame
	var press := InputEventAction.new()
	press.action = "ui_accept"
	press.pressed = true
	get_viewport().push_input(press)
	await get_tree().process_frame
	var release := InputEventAction.new()
	release.action = "ui_accept"
	release.pressed = false
	get_viewport().push_input(release)
	var restored := await _wait_until(
		func(): return stack_host.stacked_count() == want - 1, 8.0)
	if not restored:
		printerr("STACK_FAIL keyboard restore never left the stack")
		get_tree().quit(1)
		return
	print("STACK_RESTORE_OK id=", str(items[0]["id"]))
	print("STACK_TEST_OK")
	get_tree().quit()

## The furniture focus chain (build log 37): the engine's
## automatic chain keeps each Control-rooted island under a
## CanvasLayer separate — measured in the guest and
## headlessly: the bar cycled alone and the stack's rows
## cycled alone, both seated in the same Top layer. So the
## chain is wired explicitly — bar buttons, then stack
## rows, as one cycle — and rewired whenever the stack's
## rows change. focus_next / focus_previous are the
## engine's own override for exactly this.
func _rewire_focus() -> void:
	var chain: Array = []
	_collect_buttons(bar_host.get_bar_root(), chain)
	_collect_buttons(stack_host.get_panel_root(), chain)
	if chain.is_empty():
		return
	for i in chain.size():
		var b: Control = chain[i]
		b.focus_next = b.get_path_to(chain[(i + 1) % chain.size()])
		b.focus_previous = b.get_path_to(
			chain[(i - 1 + chain.size()) % chain.size()])
	# A row that held focus can vanish (restored, closed).
	# If the shell window is focused and nothing holds focus
	# now, put it back on the first bar button.
	if get_window().has_focus() \
			and get_viewport().gui_get_focus_owner() == null:
		(chain[0] as Control).grab_focus.call_deferred()

func _collect_buttons(n: Node, out: Array) -> void:
	for c in n.get_children():
		if c is Button:
			out.append(c)
		_collect_buttons(c, out)

func _wait_until(cond: Callable, timeout: float) -> bool:
	var waited := 0.0
	while waited < timeout:
		if bool(cond.call()):
			return true
		await get_tree().create_timer(0.25).timeout
		waited += 0.25
	return bool(cond.call())

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
	var stack = wm.get_record("stack-region")
	if stack == null:
		fails.append("no stack-region record")
	else:
		if stack.layer != "Top":
			fails.append("stack layer is " + stack.layer)
		if stack.backing == null or stack.backing.get_parent() != wm.layer_node("Top"):
			fails.append("stack backing is not seated in the Top layer")
	var rec := Record.new("app-self-test-1", "normal")
	rec.origin = "own-process"
	rec.app_id = "self-test-app"
	rec.title = "Self Test App"
	wm.register_window(rec)
	var got = wm.get_record("app-self-test-1")
	if got == null:
		fails.append("launch record missing")
	else:
		if got.origin != "own-process":
			fails.append("launch origin is " + got.origin)
		if got.app_id != "self-test-app":
			fails.append("launch app_id is " + got.app_id)
		if got.backing != null:
			fails.append("an own-process record has no backing yet")
	if fails.is_empty():
		print("SHELL_WM_OK records=", wm.window_count())
	else:
		for f in fails:
			printerr("SHELL_WM_FAIL ", f)

## --self-test only: the hosted registry, proven against the
## real launch list — manifests for every entry but the shell,
## a launch that registers a backing-less own-process record,
## single-instance returning the same window, and the crash
## seam (marked dead -> liveness removes the record). The
## self-test drives the registry directly; nothing spawns.
func _registry_self_test(entries: Array) -> void:
	var fails: Array[String] = []
	var want := 0
	for e in entries:
		if e["id"] != "shell":
			want += 1
	if registry.app_ids().size() != want:
		fails.append("manifests=%d want %d" % [registry.app_ids().size(), want])
	var wid: String = registry.launch("hello")
	if wid == "":
		fails.append("hello launch produced no window")
	else:
		var rec = wm.get_record(wid)
		if rec == null:
			fails.append("hello window has no record")
		else:
			if rec.app_id != "hello":
				fails.append("hello record app_id is " + rec.app_id)
			if rec.origin != "own-process":
				fails.append("hello record origin is " + rec.origin)
			if rec.backing != null:
				fails.append("hello record has a backing (record-only hosting)")
		var before: int = wm.window_count()
		if registry.launch("hello") != wid:
			fails.append("single-instance returned a different window")
		if wm.window_count() != before:
			fails.append("single-instance added a window")
		registry.mark_process_dead("hello")
		var crashed: Array = registry.check_liveness()
		if crashed != ["hello"]:
			fails.append("liveness reported " + str(crashed))
		if wm.get_record(wid) != null:
			fails.append("crashed app's record stayed registered")
		if registry.is_running("hello"):
			fails.append("crashed app stayed in the running set")
	if fails.is_empty():
		print("SHELL_REGISTRY_OK manifests=", registry.app_ids().size())
	else:
		for f in fails:
			printerr("SHELL_REGISTRY_FAIL ", f)

func _notification(what: int) -> void:
	# Activation can clear a grab made at startup (this window is
	# typically mapped while the greeter still holds the seat, and
	# activated when the greeter quits). When the bar's window
	# gains focus and nothing inside holds it, the BarHost puts
	# focus back on the first button.
	if what == NOTIFICATION_WM_WINDOW_FOCUS_IN and bar_host:
		bar_host.ensure_focus()
