extends Control
## The NCT desktop backdrop, drawn — the TypeScript demo's
## wallpaper (demo-de, styles/nct-desktop.css .wall) carried
## into the Godot environment: a near-black gradient field, a
## faint 44px grid, corner registration marks, a coordinates
## readout bottom-left and the NCT mark bottom-right at 3%
## alpha. Shared by the greeter and the shell (a twin copy
## lives in each project; Godot projects cannot share files).
## Colours are the demo's tokens: base #1c1c1c -> #0a0a0a,
## grid rgba(255,255,255,.028), marks rgba(255,255,255,.22),
## readout rgba(255,255,255,.28).

## Height of the furniture above the backdrop (the shell's
## launch bar); the top registration marks sit below it.
var top_inset := 14.0

var _base_tex: GradientTexture2D
var _glow_tex: GradientTexture2D

func _ready() -> void:
	mouse_filter = MOUSE_FILTER_IGNORE
	var grad := Gradient.new()
	grad.set_color(0, Color(0.11, 0.11, 0.11))
	grad.set_color(1, Color(0.04, 0.04, 0.04))
	_base_tex = GradientTexture2D.new()
	_base_tex.gradient = grad
	_base_tex.fill_from = Vector2(0.15, 0.0)
	_base_tex.fill_to = Vector2(0.45, 1.0)
	_base_tex.width = 512
	_base_tex.height = 512
	var glow := Gradient.new()
	glow.set_color(0, Color(0.17, 0.17, 0.17, 0.85))
	glow.set_color(1, Color(0.17, 0.17, 0.17, 0.0))
	_glow_tex = GradientTexture2D.new()
	_glow_tex.gradient = glow
	_glow_tex.fill = GradientTexture2D.FILL_RADIAL
	_glow_tex.fill_from = Vector2(0.5, 0.5)
	_glow_tex.fill_to = Vector2(1.0, 1.0)
	_glow_tex.width = 512
	_glow_tex.height = 512
	var mark := Label.new()
	mark.text = "NCT"
	mark.add_theme_font_size_override("font_size", 190)
	mark.add_theme_color_override("font_color", Color(1, 1, 1, 0.032))
	mark.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	mark.position = Vector2(-330, -215)
	mark.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(mark)
	var coords := Label.new()
	coords.name = "CoordsLabel"
	coords.text = "NCT/OS — FLAT SPACE\nSEAT0 — LAYER 00"
	coords.add_theme_font_size_override("font_size", 10)
	coords.add_theme_color_override("font_color", Color(1, 1, 1, 0.28))
	coords.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	coords.position = Vector2(18, -64)
	coords.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(coords)
	resized.connect(queue_redraw)

func _draw() -> void:
	var rect := Rect2(Vector2.ZERO, size)
	draw_texture_rect(_base_tex, rect, false)
	# The demo's top-right light pool.
	var glow_rect := Rect2(size.x * 0.35, -size.y * 0.35,
		size.x * 0.85, size.y * 0.85)
	draw_texture_rect(_glow_tex, glow_rect, false)
	# 44px grid, masked by nothing — at 2.8% alpha it reads as
	# texture, the way the demo's masked version does at rest.
	var grid_col := Color(1, 1, 1, 0.028)
	var x := 44.0
	while x < size.x:
		draw_line(Vector2(x, 0), Vector2(x, size.y), grid_col, 1.0)
		x += 44.0
	var y := 44.0
	while y < size.y:
		draw_line(Vector2(0, y), Vector2(size.x, y), grid_col, 1.0)
		y += 44.0
	# Registration marks: 18px L-corners, demo alpha .22.
	var mc := Color(1, 1, 1, 0.22)
	var m := 14.0
	var arm := 18.0
	var top := top_inset
	var bot := size.y - 56.0
	draw_line(Vector2(m, top), Vector2(m + arm, top), mc, 1.0)
	draw_line(Vector2(m, top), Vector2(m, top + arm), mc, 1.0)
	draw_line(Vector2(size.x - m - arm, top), Vector2(size.x - m, top), mc, 1.0)
	draw_line(Vector2(size.x - m, top), Vector2(size.x - m, top + arm), mc, 1.0)
	draw_line(Vector2(m, bot), Vector2(m + arm, bot), mc, 1.0)
	draw_line(Vector2(m, bot - arm), Vector2(m, bot), mc, 1.0)
	draw_line(Vector2(size.x - m - arm, bot), Vector2(size.x - m, bot), mc, 1.0)
	draw_line(Vector2(size.x - m, bot - arm), Vector2(size.x - m, bot), mc, 1.0)
