extends RefCounted
## One Window record (plans/ENVIRONMENT-MANAGER.md §3) — one per
## window, whatever its origin. Focus, stacking, geometry, workspace,
## session save/restore and security indicators all attach to this
## record, never to the backing node directly.
##
## The record is data. The window manager (window_manager.gd) applies
## policy to it; the layer stack assigns its layer.

# Style policy bundles (plans §5): chrome / takes_focus / placement.
# Layer comes from nct-layer-stack (a dialog's layer follows its
# parent, so it is resolved by the manager, not stated here).
const STYLE_POLICY := {
	"normal":    {"chrome": "full",        "takes_focus": true,  "placement": "free"},
	"dashboard": {"chrome": "none",        "takes_focus": false, "placement": "pinned"},
	"panel":     {"chrome": "none",        "takes_focus": false, "placement": "edge-docked"},
	"dialog":    {"chrome": "minimal",     "takes_focus": true,  "placement": "parent-relative"},
	"popup":     {"chrome": "none",        "takes_focus": false, "placement": "transient"},
	"osd":       {"chrome": "none",        "takes_focus": false, "placement": "transient"},
}
const STYLES: Array[String] = ["normal", "dashboard", "panel", "dialog", "popup", "osd"]
const ORIGINS: Array[String] = ["shell", "own-process", "foreign"]
const STATES: Array[String] = ["normal", "hidden", "shaded", "minimised"]

var id: String               ## stable for the window's life; survives style conversion
var origin: String = "shell" ## shell / own-process (.pck) / foreign (Wayland)
var backing: Control         ## the Control subtree in the shell (shell-backed windows)
var app_id: String = ""      ## app-registry id, or "" (pure shell furniture)
var kind_link: String = ""   ## the NCTXML kind that produced it, if any
var style: String = "normal" ## the policy bundle (see STYLE_POLICY)
var layer: String = "Workspace" ## current render layer, set via nct-layer-stack
var geometry: Rect2 = Rect2(0, 0, 320, 200) ## rect, per output (single output in the skeleton)
var maximised: bool = false
var fullscreen: bool = false
var workspace: int = 0       ## owning workspace
var state: String = "normal" ## normal / hidden / shaded / minimised
var frozen: bool = false     ## a flag on ANY style (§5): in place, no input, absent to routing
var indicators: String = "I0" ## security indicator state (owned by nct-security-manager)
var title: String = ""
var parent_id: String = ""   ## dialogs: the window they are tied to

func _init(p_id: String, p_style: String = "normal") -> void:
	id = p_id
	style = p_style

static func is_style(name: String) -> bool:
	return name in STYLES

func policy() -> Dictionary:
	return STYLE_POLICY[style]

func chrome() -> String:
	return policy()["chrome"]

func placement() -> String:
	return policy()["placement"]

## Focus is a policy question answered from the record: the style
## must allow it, and a frozen or hidden window takes no input.
func takes_focus() -> bool:
	if frozen or state == "hidden":
		return false
	return bool(policy()["takes_focus"])

func takes_input() -> bool:
	if frozen or state == "hidden":
		return false
	return true
