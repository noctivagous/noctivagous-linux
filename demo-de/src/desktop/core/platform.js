/* NCT-WL-KIT — Platform Configuration (user, 2026-11-25).
 *
 * People arrive at this environment from somewhere: Mac OS,
 * or a PC running Windows or a regular Linux. The platform
 * profile records where they came from, and everything that
 * should feel familiar follows from it:
 *
 *   Mac origin  — the COMMAND key is emphasised: Command is
 *                 the primary modifier, shortcuts are written
 *                 with ⌘, and the keyboard layout is the Mac
 *                 layout.
 *   PC origin   — PC keyboard layouts are used (Windows or
 *                 Linux flavour): Control is the primary
 *                 modifier, and the platform key is the
 *                 Windows key / Super.
 *
 * The chosen origin lives in settings.platform.origin
 * ("mac" | "windows" | "linux" | null — null until chosen,
 * in the Setup Wizard's Platform step or in Settings →
 * Environment → Platform Configuration, which share this
 * module and the same picker).
 *
 * FOUNDATION ONLY: keyboard shortcuts are NOT wired to this
 * yet. What exists is the profile, its storage, and the
 * naming/formatting helpers (primaryModifier, formatShortcut)
 * the shortcut system will consult when it is wired — so the
 * wiring later is a lookup, not a redesign.
 */

export const PLATFORM_PROFILES = {
  mac: {
    id: "mac",
    name: "Mac OS",
    family: "mac",
    blurb: "You are coming from macOS. The Command key is emphasised.",
    primaryModifier: { name: "Command", symbol: "⌘", eventKey: "Meta" },
    platformKey: { name: "Command", symbol: "⌘" },
    keyboardLayout: "mac",
    keyboardLayoutName: "Mac keyboard layout",
  },
  windows: {
    id: "windows",
    name: "Windows (PC)",
    family: "pc",
    blurb: "You are coming from Windows on a PC. PC keyboard layouts are used.",
    primaryModifier: { name: "Control", symbol: "Ctrl", eventKey: "Control" },
    platformKey: { name: "Windows key", symbol: "⊞" },
    keyboardLayout: "pc-windows",
    keyboardLayoutName: "PC keyboard layout (Windows)",
  },
  linux: {
    id: "linux",
    name: "Linux (PC)",
    family: "pc",
    blurb: "You are coming from a regular Linux on a PC. PC keyboard layouts are used.",
    primaryModifier: { name: "Control", symbol: "Ctrl", eventKey: "Control" },
    platformKey: { name: "Super", symbol: "Super" },
    keyboardLayout: "pc-linux",
    keyboardLayoutName: "PC keyboard layout (Linux)",
  },
};

export const PLATFORM_ORDER = ["mac", "windows", "linux"];

/* Before a choice exists the environment behaves as a PC
 * Linux — it is one — but `origin` stays null so the Setup
 * Wizard still knows to ask. */
export const FALLBACK_PLATFORM_ID = "linux";

export function platformProfile(settings) {
  const origin = settings && settings.platform ? settings.platform.origin : null;
  return PLATFORM_PROFILES[origin] || PLATFORM_PROFILES[FALLBACK_PLATFORM_ID];
}

export function platformChosen(settings) {
  return !!(settings && settings.platform && PLATFORM_PROFILES[settings.platform.origin]);
}

/* The modifier a shortcut written for "primary" means under
 * this profile — Command on Mac origin, Control on PC. */
export function primaryModifier(settings) {
  return platformProfile(settings).primaryModifier;
}

/* Format a shortcut spec ("primary+shift+t") the way the
 * user's platform writes it: "⌘+Shift+T" for Mac origin,
 * "Ctrl+Shift+T" for PC origin. The future shortcut wiring
 * displays bindings through this and matches events through
 * primaryModifier().eventKey. */
export function formatShortcut(settings, spec) {
  const mod = primaryModifier(settings);
  return spec
    .split("+")
    .map((part) => {
      const p = part.trim().toLowerCase();
      if (p === "primary") return mod.symbol;
      if (p === "shift") return "Shift";
      if (p === "alt" || p === "option") return mod.symbol === "⌘" ? "⌥" : "Alt";
      if (p.length === 1) return p.toUpperCase();
      return part.trim();
    })
    .join("+");
}
