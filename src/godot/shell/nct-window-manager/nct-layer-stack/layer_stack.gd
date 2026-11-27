extends RefCounted
## nct-layer-stack — the render-layer list (plans/ENVIRONMENT-MANAGER.md §4).
##
## The list is FIXED, top → bottom. A window's layer is assigned from
## its style and state; nothing renders outside a layer. In the shell,
## one CanvasLayer per layer, with CanvasLayer.layer values following
## the list order, so the order a user sees is the order this table
## states. For foreign surfaces the compositor's stacking is driven
## from the same table (later work; the table is the single source).

## Layer names, top → bottom. Do not reorder: §4 freezes this list.
const LAYERS: Array[String] = [
	"Lock",
	"Switcher",
	"Overlay-OSD",
	"Overlay",
	"Menu",
	"Top",
	"Popup",
	"Workspace-Top",
	"Workspace",
	"Workspace-Bottom",
	"Desktop",
	"Background",
]

## Default layer for a window style (plans §5). Dialog is absent on
## purpose: a dialog lives in its parent's layer band, above the
## parent — the window manager resolves it from the parent record.
const STYLE_DEFAULT_LAYER := {
	"normal": "Workspace",
	"dashboard": "Desktop",
	"panel": "Top",
	"popup": "Popup",
	"osd": "Overlay-OSD",
}

static func is_layer(name: String) -> bool:
	return name in LAYERS

## Position in the list: 0 = topmost (Lock). Lower = higher up.
static func layer_position(name: String) -> int:
	return LAYERS.find(name)

## CanvasLayer.layer value for a layer name: topmost layer gets the
## highest value, spaced by 10 so a band can hold ordered members.
static func canvas_value(name: String) -> int:
	var pos := layer_position(name)
	if pos < 0:
		return 0
	return (LAYERS.size() - pos) * 10

## True if layer `a` renders above layer `b`.
static func is_above(a: String, b: String) -> bool:
	return layer_position(a) < layer_position(b)

static func default_layer_for_style(style: String) -> String:
	return STYLE_DEFAULT_LAYER.get(style, "Workspace")
