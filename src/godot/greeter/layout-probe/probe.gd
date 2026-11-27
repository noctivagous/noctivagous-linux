extends Control
## Greeter layout probe — the login card's centering, MEASURED.
## Instances the real greeter scene, pins it to a real display
## size (the headless window is 64px, so the scene root is
## pinned the way the fullscreen greeter is sized by its
## compositor), and checks the card's centre against the
## display's centre. Prints GREETER_LAYOUT_OK / _FAIL.
## Run: godot --headless --path src/godot/greeter \
##        res://layout-probe/main.tscn

const DISPLAY := Vector2(1280, 800)
const TOLERANCE := 2.0

func _ready() -> void:
	var main = load("res://main.tscn").instantiate()
	add_child(main)
	main.set_anchors_preset(Control.PRESET_TOP_LEFT)
	main.size = DISPLAY
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().process_frame
	var card = main.find_child("LoginCard", true, false)
	if card == null:
		printerr("GREETER_LAYOUT_FAIL no LoginCard in the greeter scene")
		get_tree().quit(1)
		return
	var rect = card.get_global_rect()
	var centre = rect.get_center()
	var want = DISPLAY / 2.0
	if abs(centre.x - want.x) <= TOLERANCE and abs(centre.y - want.y) <= TOLERANCE:
		print("GREETER_LAYOUT_OK card_centre=", centre, " display_centre=", want)
		get_tree().quit()
	else:
		printerr("GREETER_LAYOUT_FAIL card_centre=", centre,
			" display_centre=", want, " card_rect=", rect)
		get_tree().quit(1)
