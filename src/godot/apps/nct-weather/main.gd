extends Control
## NCT Weather — GOES viewer, first consumer of nct-weather-bridge
## (src/services/nct-weather-bridge/, owned by nct-geo-services).
## The app contains no meteorology: it asks the bridge for PNG
## frames + JSON times/metadata and displays them. Bridge URL from
## NCT_WEATHER_BRIDGE_URL, default http://127.0.0.1:8765.
##
## Self-test: NCT_WEATHER_SELFTEST=1 (and NCT_WEATHER_SHOT=path to
## save a viewport PNG) loads the newest frame, prints
## NCT_WEATHER_FRAME_OK <w>x<h> provider=... stale=..., then quits.

const DATASETS := [
	"sat.goes-east.geocolor",
	"sat.goes-west.geocolor",
	"sat.goes-east.ir-clean",
	"sat.goes-west.ir-clean",
	"sat.goes-east.vis",
	"sat.goes-west.vis",
	"sat.himawari.geocolor",
	"sat.himawari.ir-clean",
	"sat.viirs-noaa20.truecolor",
]
const FRAME_COUNT := 8

var bridge := "http://127.0.0.1:8765"
var dataset := "sat.goes-east.geocolor"
var times: Array = []          # ISO strings, newest first
var frames: Dictionary = {}    # time -> Texture2D
var metas: Dictionary = {}     # time -> Dictionary (frame.json)
var current := 0               # index into times (display order: oldest..newest via reverse)
var playing := true
var selftest := false

var http: HTTPRequest
var queue: Array = []          # [{kind, url, time}]
var busy := false

var map_rect: TextureRect
var status_label: Label
var time_label: Label
var slider: HSlider
var play_btn: Button
var timer: Timer

func _ready() -> void:
	var env_url := OS.get_environment("NCT_WEATHER_BRIDGE_URL")
	if env_url != "":
		bridge = env_url
	selftest = OS.get_environment("NCT_WEATHER_SELFTEST") == "1"
	_build_ui()
	http = HTTPRequest.new()
	http.timeout = 120.0
	add_child(http)
	http.request_completed.connect(_on_request_completed)
	timer = Timer.new()
	timer.wait_time = 0.7
	timer.timeout.connect(_advance)
	add_child(timer)
	_load_dataset(dataset)
	print("NCT_WEATHER_READY bridge=", bridge)

func _build_ui() -> void:
	var bg := ColorRect.new()
	bg.color = Color(0.07, 0.08, 0.10)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(vbox)

	var bar := HBoxContainer.new()
	vbox.add_child(bar)
	var picker := OptionButton.new()
	for d in DATASETS:
		picker.add_item(d)
	picker.item_selected.connect(func(i: int) -> void: _load_dataset(DATASETS[i]))
	bar.add_child(picker)
	play_btn = Button.new()
	play_btn.text = "Pause"
	play_btn.pressed.connect(_toggle_play)
	bar.add_child(play_btn)
	status_label = Label.new()
	status_label.text = "connecting to nct-weather-bridge…"
	bar.add_child(status_label)

	map_rect = TextureRect.new()
	map_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	map_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	map_rect.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(map_rect)

	var bottom := HBoxContainer.new()
	vbox.add_child(bottom)
	slider = HSlider.new()
	slider.min_value = 0
	slider.max_value = 0
	slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slider.value_changed.connect(func(v: float) -> void: _show_frame(int(v)))
	bottom.add_child(slider)
	time_label = Label.new()
	time_label.text = "—"
	bottom.add_child(time_label)

func _load_dataset(id: String) -> void:
	dataset = id
	times.clear()
	frames.clear()
	metas.clear()
	timer.stop()
	status_label.text = "loading times for " + id + "…"
	_enqueue("times", bridge + "/v1/datasets/" + id + "/times?limit=" + str(FRAME_COUNT), "")

func _enqueue(kind: String, url: String, t: String) -> void:
	queue.append({"kind": kind, "url": url, "time": t})
	_pump()

func _pump() -> void:
	if busy or queue.is_empty():
		return
	busy = true
	var job: Dictionary = queue.pop_front()
	http.set_meta("job", job)
	var err := http.request(job["url"])
	if err != OK:
		busy = false
		status_label.text = "request failed to start: " + str(err)
		_pump()

func _on_request_completed(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	busy = false
	var job: Dictionary = http.get_meta("job")
	if result != HTTPRequest.RESULT_SUCCESS or code != 200:
		status_label.text = "bridge error for " + str(job["kind"]) + ": HTTP " + str(code) + " — is nct-weather-bridge running?"
		_pump()
		return
	match job["kind"]:
		"times":
			var parsed = JSON.parse_string(body.get_string_from_utf8())
			if parsed is Dictionary:
				times.clear()
				for entry in parsed.get("times", []):
					times.append(entry["time"])
				times.reverse()  # display oldest -> newest
				slider.max_value = max(0, times.size() - 1)
				for t in times:
					_enqueue("meta", bridge + "/v1/datasets/" + dataset + "/frame.json?time=" + t.uri_encode(), t)
					_enqueue("frame", bridge + "/v1/datasets/" + dataset + "/frame?time=" + t.uri_encode(), t)
				status_label.text = "loading " + str(times.size()) + " frames…"
		"meta":
			var parsed = JSON.parse_string(body.get_string_from_utf8())
			if parsed is Dictionary:
				metas[job["time"]] = parsed
		"frame":
			var img := Image.new()
			if img.load_png_from_buffer(body) == OK:
				frames[job["time"]] = ImageTexture.create_from_image(img)
				if frames.size() == 1:
					_show_frame(times.size() - 1)
				slider.max_value = max(0, times.size() - 1)
				status_label.text = "loaded " + str(frames.size()) + "/" + str(times.size()) + " frames"
				if frames.size() == times.size() and not times.is_empty():
					_show_frame(times.size() - 1)
					if playing:
						timer.start()
					if selftest:
						_selftest_finish()
			else:
				status_label.text = "frame was not a PNG"
	_pump()

func _show_frame(idx: int) -> void:
	if times.is_empty():
		return
	current = clampi(idx, 0, times.size() - 1)
	var t: String = times[current]
	if frames.has(t):
		map_rect.texture = frames[t]
	slider.value = current
	var meta: Dictionary = metas.get(t, {})
	time_label.text = t
	if meta.has("provider"):
		status_label.text = str(meta.get("provider")) + " · stale " + str(int(meta.get("stale_seconds", 0))) + "s · " + str(meta.get("title", dataset))

func _advance() -> void:
	if times.size() > 1:
		_show_frame((current + 1) % times.size())

func _toggle_play() -> void:
	playing = not playing
	play_btn.text = "Pause" if playing else "Play"
	if playing:
		timer.start()
	else:
		timer.stop()

func _selftest_finish() -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	var tex: Texture2D = map_rect.texture
	var meta: Dictionary = metas.get(times[times.size() - 1], {})
	print("NCT_WEATHER_FRAME_OK ", tex.get_width(), "x", tex.get_height(),
		" provider=", str(meta.get("provider", "?")),
		" stale=", str(int(meta.get("stale_seconds", 0))),
		" frames=", frames.size())
	var shot := OS.get_environment("NCT_WEATHER_SHOT")
	if shot != "":
		var img := get_viewport().get_texture().get_image()
		img.save_png(shot)
		print("NCT_WEATHER_SHOT_SAVED ", shot)
	get_tree().quit()
