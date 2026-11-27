extends Node
## nct-window-manager — window records + policy for every window
## (plans/ENVIRONMENT-MANAGER.md §1, §3, §5).
##
## Slice 1 scope: shell-backed windows (a Control subtree per
## window, one CanvasLayer per render layer under `layers_root`).
## Since the WM-hosting slice (build log 30) this manager also
## runs in the SHIPPED shell (godot/shell, vendored copies under
## wm/, drift-checked like the NCTXML library): the launch bar
## is a panel-style record there, and every launched app
## registers an own-process record — app-registry processes and
## compositor backings attach to those same records when they
## land. The record does not change.
##
## The manager owns the registry and the focus. It does not draw
## chrome, route input, or decide security policy: indicators are a
## field on the record that nct-security-manager owns.

const LayerStack := preload("nct-layer-stack/layer_stack.gd")
const Record := preload("window_record.gd")

signal window_registered(id: String)
signal window_unregistered(id: String)
signal window_style_changed(id: String, style: String)
signal focus_changed(id: String)

var records: Dictionary = {}        ## id -> Record
var focused_id: String = ""
var _layer_nodes: Dictionary = {}   ## layer name -> CanvasLayer
var layers_root: Node               ## set by the host before register_window

func _init(p_layers_root: Node = null) -> void:
	layers_root = p_layers_root

## Create the CanvasLayer for every layer in the table, under
## layers_root. Idempotent.
func build_layers() -> void:
	if layers_root == null:
		push_error("NctWindowManager: layers_root not set")
		return
	for layer_name in LayerStack.LAYERS:
		if _layer_nodes.has(layer_name):
			continue
		var cl := CanvasLayer.new()
		cl.name = "Layer_" + layer_name
		cl.layer = LayerStack.canvas_value(layer_name)
		layers_root.add_child(cl)
		_layer_nodes[layer_name] = cl

func layer_node(layer_name: String) -> CanvasLayer:
	return _layer_nodes.get(layer_name)

func has_window(id: String) -> bool:
	return records.has(id)

func get_record(id: String) -> Record:
	return records.get(id)

func window_count() -> int:
	return records.size()

## Register a window: assign its layer from its style (a dialog
## inherits its parent's layer band) and attach its backing under
## that layer's CanvasLayer.
func register_window(rec: Record) -> bool:
	if rec == null or rec.id == "" or records.has(rec.id):
		return false
	if not Record.is_style(rec.style):
		return false
	rec.layer = _resolve_layer(rec)
	records[rec.id] = rec
	_attach(rec)
	window_registered.emit(rec.id)
	return true

func unregister_window(id: String) -> bool:
	var rec = get_record(id)
	if rec == null:
		return false
	if focused_id == id:
		_set_focus("")
	if rec.backing and rec.backing.get_parent():
		rec.backing.get_parent().remove_child(rec.backing)
	records.erase(id)
	window_unregistered.emit(id)
	return true

## THE conversion (§5): a style change on the same record. Same id,
## same app, same backing node instance — only the policy bundle and
## the layer change. Converting away from a focus-taking style drops
## focus the window held.
func set_style(id: String, new_style: String) -> bool:
	var rec = get_record(id)
	if rec == null or not Record.is_style(new_style):
		return false
	if rec.style == new_style:
		return true
	rec.style = new_style
	rec.layer = _resolve_layer(rec)
	_attach(rec)
	if focused_id == id and not rec.takes_focus():
		_set_focus("")
	window_style_changed.emit(id, new_style)
	return true

## Freeze is a flag on any style (§5): the window stays in place,
## takes no input, and is treated as absent by input routing until
## unfrozen. A frozen window cannot hold focus.
func set_frozen(id: String, frozen: bool) -> bool:
	var rec = get_record(id)
	if rec == null:
		return false
	rec.frozen = frozen
	if frozen and focused_id == id:
		_set_focus("")
	return true

## Focus follows the record's policy: frozen, hidden and
## non-focus styles refuse.
func focus_window(id: String) -> bool:
	var rec = get_record(id)
	if rec == null or not rec.takes_focus():
		return false
	_set_focus(id)
	return true

func _set_focus(id: String) -> void:
	if focused_id == id:
		return
	focused_id = id
	focus_changed.emit(id)

func _resolve_layer(rec: Record) -> String:
	if rec.style == "dialog" and rec.parent_id != "":
		var parent := get_record(rec.parent_id)
		if parent:
			return parent.layer
	return LayerStack.default_layer_for_style(rec.style)

func _attach(rec: Record) -> void:
	if rec.backing == null:
		return
	var target := layer_node(rec.layer)
	if target == null:
		return
	if rec.backing.get_parent():
		rec.backing.reparent(target)
	else:
		target.add_child(rec.backing)
	rec.backing.position = rec.geometry.position
	rec.backing.size = rec.geometry.size
