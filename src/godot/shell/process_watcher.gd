extends Node
## The session's process watcher — the feeder for the app
## registry's liveness seam. The registry has always had the
## hooks (mark_process_dead + check_liveness, "the seam the
## session layer will feed"); until this watcher existed,
## nothing fed them, so a launched app stayed "running" in
## the registry forever and its bar button could never launch
## it again after it closed (build log 35).
##
## nct-launch records each spawn in the state dir as
## <id>.pid (line 1: pid, line 2: the resolved command). Once
## a second this watcher checks every registered-running app:
## the pid must exist AND its /proc cmdline must still match
## the recorded command (a bare pid can be recycled by an
## unrelated process). A failed check marks the app dead and
## check_liveness() reaps it — window record removed, running
## set cleared, app_exited announced — so the next click
## spawns it fresh.
##
## A launch is believed while it is young: the grace window
## covers the gap between the registry creating the record
## and nct-launch writing the pid record, and a stale pid
## record from a previous run is never trusted against a new
## launch.
##
## The same facts drive the bar's per-app status
## (status_changed: launching / running / idle) and the
## launch_failed signal for a spawn that never came alive —
## the bar shows the registry's real knowledge, not
## decoration.

signal status_changed(app_id: String, status: String)
signal launch_failed(app_id: String)

const GRACE_SEC := 10.0

var _registry = null
var _state_dir := ""
var _timer: Timer
var _launched_at: Dictionary = {}  ## app_id -> unix time of the launch
var _confirmed: Dictionary = {}    ## app_id -> pid seen alive and matching
var _status: Dictionary = {}       ## app_id -> last emitted status

func _ready() -> void:
	_state_dir = _resolve_state_dir()
	_timer = Timer.new()
	_timer.wait_time = 1.0
	_timer.timeout.connect(_on_tick)
	add_child(_timer)

## Connect to the registry and start polling. Called by
## main.gd once the registry is hosted.
func start(registry) -> void:
	_registry = registry
	_registry.app_launched.connect(_on_app_launched)
	_registry.app_exited.connect(_on_app_exited)
	_timer.start()

func state_dir() -> String:
	return _state_dir

## The pid nct-launch recorded for this app, or 0 when there
## is no current record.
func pid_of(app_id: String) -> int:
	var path := _pid_path(app_id)
	if not FileAccess.file_exists(path):
		return 0
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return 0
	return f.get_line().strip_edges().to_int()

## Whether this app's pid has been seen alive and matching.
func is_confirmed(app_id: String) -> bool:
	return bool(_confirmed.get(app_id, false))

## Check one app now (the per-second tick checks them all;
## main.gd calls this synchronously on a click, so a program
## closed a moment ago can still be relaunched at once).
## Returns true when the app is confirmed alive — or young
## enough to still be believed — and reaps it otherwise.
func revalidate(app_id: String) -> bool:
	if _registry == null or not _registry.is_running(app_id):
		return false
	if _pid_alive(app_id):
		_confirmed[app_id] = true
		_emit_status(app_id, "running")
		return true
	var age := Time.get_unix_time_from_system() \
		- float(_launched_at.get(app_id, 0.0))
	if not is_confirmed(app_id) and age < GRACE_SEC:
		return true
	_registry.mark_process_dead(app_id)
	return false

func _resolve_state_dir() -> String:
	var env := OS.get_environment("NCT_STATE_DIR")
	if env != "":
		return env
	return OS.get_environment("HOME") + "/.local/state/nct"

func _pid_path(app_id: String) -> String:
	return _state_dir + "/" + app_id + ".pid"

func _on_app_launched(app_id: String, _window_id: String) -> void:
	_launched_at[app_id] = Time.get_unix_time_from_system()
	_confirmed[app_id] = false
	_emit_status(app_id, "launching")

func _on_app_exited(app_id: String, _window_id: String,
		reason: String) -> void:
	if reason == "crashed" and not is_confirmed(app_id):
		launch_failed.emit(app_id)
	_launched_at.erase(app_id)
	_confirmed.erase(app_id)
	_emit_status(app_id, "idle")

func _on_tick() -> void:
	if _registry == null:
		return
	for app_id in _registry.running_apps():
		revalidate(app_id)
	_registry.check_liveness()
	for app_id in _registry.running_apps():
		_emit_status(app_id,
			"running" if is_confirmed(app_id) else "launching")

func _emit_status(app_id: String, status: String) -> void:
	if str(_status.get(app_id, "")) != status:
		_status[app_id] = status
		status_changed.emit(app_id, status)

## The pid record's word, cross-checked: the file must belong
## to the current launch (not a previous run's leftover), the
## pid must be alive, and its /proc cmdline must contain the
## token the recorded command implies — the pid-reuse guard.
func _pid_alive(app_id: String) -> bool:
	var path := _pid_path(app_id)
	if not FileAccess.file_exists(path):
		return false
	var launched := float(_launched_at.get(app_id, 0.0))
	if launched > 0.0 \
			and FileAccess.get_modified_time(path) < int(launched) - 2:
		return false
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return false
	var pid := f.get_line().strip_edges().to_int()
	var cmd := f.get_line().strip_edges()
	# Existence is checked in /proc, not with
	# OS.is_process_running: that only reports on processes
	# the engine itself spawned, and nct-launch's programs
	# are the shell's grandchildren, not its children.
	if pid <= 0 or not DirAccess.dir_exists_absolute("/proc/%d" % pid):
		return false
	var token := _cmdline_token(cmd)
	if token == "":
		return true
	var cf := FileAccess.open("/proc/%d/cmdline" % pid, FileAccess.READ)
	if cf == null:
		return false
	# Byte at a time: /proc files report a size of zero, so
	# Godot's sized reads (get_buffer, get_as_text) return
	# nothing or a fragment — the cmdline must be pulled
	# from the stream itself.
	var raw := ""
	while not cf.eof_reached() and raw.length() < 4096:
		var b := cf.get_8()
		raw += " " if b == 0 else String.chr(b)
	return raw.contains(token)

## The distinctive word a command's process carries in its
## cmdline: the program's basename — except under
## nct-godot-run, whose own name vanishes in the exec, where
## the pack's basename rides the engine's cmdline instead.
func _cmdline_token(cmd: String) -> String:
	var words := cmd.split(" ", false)
	if words.is_empty():
		return ""
	if words[0].get_file() == "nct-godot-run" and words.size() > 1:
		return words[1].get_file()
	return words[0].get_file()
