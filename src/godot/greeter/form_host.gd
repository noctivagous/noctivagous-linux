extends Control
## The greeter's login form, built in GDScript (GDScript-first
## strategy, build log 34): the login CARD — a Panel the Center
## container centres as one object, so what is centred on
## screen is the card itself, status row included; the row is
## reserved (fixed minimum height) so the card never jumps
## when a failure lands in it.
##
## Same contract the NCTXML form host (GreeterForm.cs) kept:
## main.gd owns the greetd-bridge conversation and calls
## set_status / resolve_login / refocus_password /
## ensure_focus here; a submission goes back up through
## form_attempt_login() and stays pending until resolved.
## The NCTXML view + model this replaces live on in
## src/modules/nctxml/examples/ as the baking track's
## reference.
##
## Styling is the TypeScript demo's (demo-de
## styles/nct-desktop.css): panel gradient tones as solids,
## black 1px borders, 6px panel radius, inputs on #141414
## with the blue focus ring (#4fc3f7), the primary button in
## the demo's dark green with bright-green text (#66ff66),
## failures in the demo's red (#e05a4e).

var _user_field: LineEdit
var _pass_field: LineEdit
var _status_label: Label

const COL_TEXT := Color(0.84, 0.84, 0.84)        # #d6d6d6
const COL_MUTED := Color(0.54, 0.54, 0.54)       # status at rest
const COL_ERROR := Color(0.88, 0.35, 0.31)       # #e05a4e
const COL_FOCUS := Color(0.31, 0.76, 0.97)       # #4fc3f7

func _ready() -> void:
	_build_form()
	# A greeter's first field holds focus from the start.
	_user_field.grab_focus.call_deferred()
	print("GREETER_FORM_OK")

func _panel_box(bg: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = bg
	box.border_color = Color(0, 0, 0)
	box.set_border_width_all(1)
	box.set_corner_radius_all(6)
	box.shadow_color = Color(0, 0, 0, 0.6)
	box.shadow_size = 24
	box.shadow_offset = Vector2(0, 10)
	box.anti_aliasing = true
	return box

func _field_box(bg: Color, border: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = bg
	box.border_color = border
	box.set_border_width_all(1)
	box.set_corner_radius_all(4)
	box.content_margin_left = 10
	box.content_margin_right = 10
	return box

func _button_box(bg: Color, border: Color) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = bg
	box.border_color = border
	box.set_border_width_all(1)
	box.set_corner_radius_all(4)
	return box

func _style_field(field: LineEdit) -> void:
	field.custom_minimum_size = Vector2(320, 38)
	field.add_theme_stylebox_override("normal",
		_field_box(Color(0.08, 0.08, 0.08), Color(0, 0, 0)))
	field.add_theme_stylebox_override("focus",
		_field_box(Color(0.08, 0.08, 0.08), COL_FOCUS))
	field.add_theme_stylebox_override("read_only",
		_field_box(Color(0.08, 0.08, 0.08), Color(0, 0, 0)))
	field.add_theme_color_override("font_color", COL_TEXT)
	field.add_theme_color_override("font_placeholder_color",
		Color(0.35, 0.35, 0.35))
	field.add_theme_color_override("caret_color", COL_TEXT)
	field.add_theme_font_size_override("font_size", 14)

func _build_form() -> void:
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)

	var card := PanelContainer.new()
	card.name = "LoginCard"
	card.add_theme_stylebox_override("panel",
		_panel_box(Color(0.09, 0.09, 0.09)))
	center.add_child(card)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 32)
	margin.add_theme_constant_override("margin_right", 32)
	margin.add_theme_constant_override("margin_top", 28)
	margin.add_theme_constant_override("margin_bottom", 28)
	card.add_child(margin)

	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 10)
	margin.add_child(stack)

	var title := Label.new()
	title.name = "TitleLabel"
	title.text = "NOCTIVAGOUS"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color",
		Color(0.95, 0.95, 0.95))
	stack.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "S E S S I O N   L O G I N"
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.add_theme_font_size_override("font_size", 10)
	subtitle.add_theme_color_override("font_color",
		Color(0.45, 0.45, 0.45))
	stack.add_child(subtitle)

	_user_field = LineEdit.new()
	_user_field.name = "UserField"
	_user_field.placeholder_text = "Username"
	_style_field(_user_field)
	_user_field.text_submitted.connect(_on_user_submitted)
	stack.add_child(_user_field)

	_pass_field = LineEdit.new()
	_pass_field.name = "PassField"
	_pass_field.placeholder_text = "Password"
	_pass_field.secret = true
	_style_field(_pass_field)
	_pass_field.text_submitted.connect(_on_pass_submitted)
	stack.add_child(_pass_field)

	var button := Button.new()
	button.name = "LoginButton"
	button.text = "Log In"
	button.custom_minimum_size = Vector2(320, 42)
	button.add_theme_stylebox_override("normal",
		_button_box(Color(0.11, 0.18, 0.10), Color(0, 0, 0)))
	button.add_theme_stylebox_override("hover",
		_button_box(Color(0.17, 0.27, 0.16), Color(0, 0, 0)))
	button.add_theme_stylebox_override("pressed",
		_button_box(Color(0.08, 0.12, 0.07), Color(0, 0, 0)))
	button.add_theme_stylebox_override("focus",
		_button_box(Color(0, 0, 0, 0), COL_FOCUS))
	button.add_theme_color_override("font_color",
		Color(0.4, 1.0, 0.4))
	button.add_theme_color_override("font_hover_color",
		Color(0.62, 1.0, 0.62))
	button.add_theme_font_size_override("font_size", 14)
	button.pressed.connect(_submit)
	stack.add_child(button)

	_status_label = Label.new()
	_status_label.name = "StatusLabel"
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status_label.custom_minimum_size = Vector2(0, 20)
	_status_label.add_theme_font_size_override("font_size", 12)
	_status_label.add_theme_color_override("font_color", COL_MUTED)
	stack.add_child(_status_label)

func _on_user_submitted(_text: String) -> void:
	_pass_field.grab_focus()

func _on_pass_submitted(_text: String) -> void:
	_submit()

func _submit() -> void:
	get_parent().form_attempt_login(_user_field.text, _pass_field.text)

# ---- called from main.gd ----

func set_status(text: String) -> void:
	_status_label.add_theme_color_override("font_color", COL_MUTED)
	_status_label.text = text

func resolve_login(ok: bool, message: String) -> void:
	if not ok:
		_status_label.add_theme_color_override("font_color", COL_ERROR)
		_status_label.text = message

func refocus_password() -> void:
	_pass_field.select_all()
	_pass_field.grab_focus()

func ensure_focus() -> void:
	if get_viewport().gui_get_focus_owner() == null:
		_user_field.grab_focus()
