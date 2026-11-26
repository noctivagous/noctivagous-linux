"""Slice C harness: the device-centre logic — the Secure Boot
four-state check, DKMS pre-flight, rollback target, power
backend naming — proven on fixture devices covering each state.

Prints SLICEC_OK / SLICEC_FAIL <reason>.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import device_centre as dc

HERE = os.path.dirname(os.path.abspath(__file__))
failures = []


def check(cond, what):
    if not cond:
        failures.append(what)


def main():
    data = dc.load_fixture(os.path.join(HERE, "fixtures", "devices.json"))
    kernel = data["current_kernel"]
    devices = {d["id"]: d for d in data["devices"]}

    # Four-state: one device per failing layer.
    status, layer, _ = dc.device_health(devices["gpu-nvidia"], kernel)
    check((status, layer) == ("working", None),
          "nvidia should be working, got %s/%s" % (status, layer))
    status, layer, action = dc.device_health(devices["wifi-rtw"], kernel)
    check((status, layer) == ("blocked", "enrolled"),
          "rtw89 should be blocked at ENROLLED, got %s/%s" % (status, layer))
    check("reboot" in action, "enrolment action must explain the reboot")
    status, layer, _ = dc.device_health(devices["vbox-host"], kernel)
    check((status, layer) == ("blocked", "signed"),
          "vboxdrv should be blocked at SIGNED, got %s/%s" % (status, layer))
    verdict, layer, _ = dc.secure_boot_verdict(
        {"built_for": ["6.7"], "signed": True, "enrolled": True,
         "loaded": False}, kernel)
    check(layer == "built" and "not built" in verdict,
          "stale-kernel module should fail at BUILT: %r" % (verdict,))

    # The unsupported reader is STATED, never omitted (§4).
    status, layer, action = dc.device_health(devices["fingerprint"], kernel)
    check(status == "unsupported" and "libfprint" in action,
          "fingerprint should be stated unsupported: %s %r" % (status, action))

    # DKMS pre-flight: rtw89 does not build for 6.9, so the update
    # waits with the reason — never reboot into a broken pair.
    verdict = dc.dkms_preflight(data["pairs"], data["new_kernel"])
    check(verdict["ok"] is False and verdict["blocked_by"] == ["rtw89"],
          "pre-flight should block on rtw89: %r" % (verdict,))
    check("6.9" in verdict["reason"], "pre-flight reason must name the kernel")
    ok_verdict = dc.dkms_preflight(
        [p for p in data["pairs"] if p["driver"] == "nvidia"], "6.9")
    check(ok_verdict["ok"] is True, "nvidia-only pre-flight should pass")

    # Rollback target: the last pair that booted.
    target = dc.rollback_target(data["pairs"])
    check(target is not None and target["kernel"] == "6.8",
          "rollback target should be the booted 6.8 pair")

    # Power backend: named when single, a conflict when doubled.
    one = dc.power_backend(data["power_in_force"])
    check(one["backend"] == "Power Profiles Daemon" and one["conflict"] is None,
          "single backend should be named: %r" % (one,))
    both = dc.power_backend(["power-profiles-daemon", "tlp"])
    check(both["backend"] is None and both["conflict"] is not None,
          "two backends must read as a conflict: %r" % (both,))

    # View contexts: the four states as words for the NCTXML view.
    ctx = dc.view_contexts(data)
    check(ctx["wifi-rtw"]["Enrolled"] == "NO" and ctx["wifi-rtw"]["Signed"] == "yes",
          "wifi view context wrong: %r" % (ctx["wifi-rtw"],))
    check(ctx["gpu-nvidia"]["Verdict"] == "working",
          "gpu view verdict wrong: %r" % (ctx["gpu-nvidia"],))

    if failures:
        for f in failures:
            print("SLICEC_FAIL", f)
        return 1
    print("SLICEC_OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
