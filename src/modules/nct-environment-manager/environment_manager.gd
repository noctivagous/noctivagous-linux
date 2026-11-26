extends Node
## nct-environment-manager — the root (plans/ENVIRONMENT-MANAGER.md §1).
##
## It coordinates; it does not implement. Its own state is only the
## module registry and the bus. Slice 1 scope: the registry, and a
## bus that is deliberately a log — modules register and can be
## looked up; announcements are recorded so tests can see who said
## what. A real message bus replaces the log when a second consumer
## arrives, behind this same interface.

var _modules: Dictionary = {}       ## name -> Node
var bus_log: Array[Dictionary] = [] ## {topic, payload, from}

func register_module(module_name: String, module_node: Node) -> bool:
	if module_name == "" or module_node == null:
		return false
	_modules[module_name] = module_node
	announce("module.registered", module_name, "nct-environment-manager")
	return true

func get_module(module_name: String) -> Node:
	return _modules.get(module_name)

func has_module(module_name: String) -> bool:
	return _modules.has(module_name)

func module_names() -> Array:
	return _modules.keys()

## The bus, skeleton form: an announcement is appended to the log.
func announce(topic: String, payload: Variant, from: String) -> void:
	bus_log.append({"topic": topic, "payload": payload, "from": from})
