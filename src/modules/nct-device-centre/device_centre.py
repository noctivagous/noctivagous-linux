"""nct-device-centre — drivers and laptop frictions, built in
(plans/SYSTEM-INTERFACE.md §4).

The device tree with, per device: what it is, whether it works,
WHICH LAYER is failing if not, and the action for that layer.

Slice C scope (§6): the Secure Boot four-state check, DKMS
pre-flight, and power-backend naming.

The four states are separate because they fail separately:
a kernel module can be BUILT for this kernel, SIGNED with a
machine key, ENROLLED in the MOK list, and LOADED — and Secure
Boot blocks it at the first state that does not hold. Showing
"driver doesn't work" for all four is the failure this centre
exists to replace.
"""

import json

STATE_ORDER = ("built", "signed", "enrolled", "loaded")
STATE_ACTION = {
    "built": "Build the module for this kernel (DKMS does this on install).",
    "signed": "Sign the module with the machine owner key.",
    "enrolled": "Enrol the key: the wizard explains the one-time "
                "reboot screens BEFORE you reboot.",
    "loaded": "Load the module (modprobe) — it is built, signed "
              "and enrolled, so Secure Boot will accept it.",
}


def four_state(module, kernel):
    """The four checkable states of a module for one kernel."""
    return {
        "built": kernel in module.get("built_for", []),
        "signed": bool(module.get("signed")),
        "enrolled": bool(module.get("enrolled")),
        "loaded": bool(module.get("loaded")),
    }


def first_failing(state):
    """The first state in the chain that does not hold, or None."""
    for name in STATE_ORDER:
        if not state[name]:
            return name
    return None


def secure_boot_verdict(module, kernel):
    """(verdict, failing_layer, action) in plain language."""
    state = four_state(module, kernel)
    failing = first_failing(state)
    if failing is None:
        return "working", None, ""
    verdict = {"built": "not built for this kernel",
               "signed": "built but not signed",
               "enrolled": "built and signed, key not enrolled",
               "loaded": "ready but not loaded"}[failing]
    return verdict, failing, STATE_ACTION[failing]


def device_health(device, kernel):
    """(status, layer, action) for one device."""
    if device.get("supported") is False:
        return ("unsupported", "support",
                "This exact device is not supported by %s; "
                "no driver will make it work." % device.get("support_source", "the system"))
    module = device.get("module")
    if module is None:
        return ("working", None, "")
    verdict, layer, action = secure_boot_verdict(module, kernel)
    if layer is None:
        return ("working", None, "")
    return ("blocked", layer, action)


def dkms_preflight(pairs, new_kernel):
    """Before a kernel update is allowed to reboot: every
    kernel<->driver pair must build for the new kernel. If a
    build fails, the update WAITS with the reason shown — the
    machine never reboots into a known-broken pair (§4)."""
    failures = []
    for pair in pairs:
        if new_kernel not in pair.get("builds_for", []):
            failures.append(pair)
    if failures:
        names = ", ".join("%s %s" % (p["driver"], p["version"])
                          for p in failures)
        return {"ok": False,
                "reason": "%s does not build for kernel %s; "
                          "the update waits until it does." % (names, new_kernel),
                "blocked_by": [p["driver"] for p in failures]}
    return {"ok": True, "reason": "all drivers build for kernel %s" % new_kernel,
            "blocked_by": []}


def rollback_target(pairs):
    """Driver Rollback = return to the last pair that booted."""
    booted = [p for p in pairs if p.get("booted_ok")]
    if not booted:
        return None
    return max(booted, key=lambda p: p.get("boot_seq", 0))


def power_backend(in_force):
    """Name the power backend in force (§4). Two at once is a
    conflict — an Issue, not a silent no-op."""
    names = {"power-profiles-daemon": "Power Profiles Daemon",
             "tlp": "TLP", "tuned": "TuneD"}
    pretty = [names.get(b, b) for b in in_force]
    if len(in_force) > 1:
        return {"backend": None, "conflict": pretty,
                "statement": "Both %s are managing power; their "
                             "settings fight and neither fully applies."
                             % " and ".join(pretty)}
    if len(in_force) == 1:
        return {"backend": pretty[0], "conflict": None,
                "statement": "Power is managed by %s." % pretty[0]}
    return {"backend": None, "conflict": None,
            "statement": "No power-profile backend is running."}


def load_fixture(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def view_contexts(data):
    """Per-device contexts for the NCTXML device view: the four
    states as words, plus the verdict in plain language."""
    kernel = data["current_kernel"]
    out = {}
    for device in data["devices"]:
        module = device.get("module")
        if module is None:
            continue
        state = four_state(module, kernel)
        verdict, _layer, _action = secure_boot_verdict(module, kernel)
        ctx = {"DeviceName": device["name"], "Verdict": verdict}
        for name in STATE_ORDER:
            ctx[name.capitalize()] = "yes" if state[name] else "NO"
        out[device["id"]] = ctx
    return out


def main(argv):
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixture", required=True)
    ap.add_argument("--contexts-out")
    args = ap.parse_args(argv)
    data = load_fixture(args.fixture)
    if args.contexts_out:
        with open(args.contexts_out, "w", encoding="utf-8") as f:
            json.dump(view_contexts(data), f, indent=1, sort_keys=True)
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main(sys.argv[1:]))
