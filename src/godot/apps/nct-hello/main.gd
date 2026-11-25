extends Control
## NCT Hello — our own app, present only to prove that a Godot app of
## ours launches inside the session like any other citizen.

func _ready() -> void:
	var bg := ColorRect.new()
	bg.color = Color(0.10, 0.10, 0.12)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var label := Label.new()
	label.text = "NCT HELLO"
	label.add_theme_font_size_override("font_size", 28)
	label.set_anchors_preset(Control.PRESET_CENTER)
	add_child(label)
	print("NCT_HELLO_READY")
