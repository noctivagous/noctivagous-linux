# Kiosk — Computer Use Mode

Status: PLACEHOLDER — definition reserved, design pass owed.

What it means: this machine does one public-facing job —
a museum or shop exhibit, a library catalogue terminal, a
check-in screen, a wall dashboard, a till.

Bundle sketch (each line is implemented by the module named):
- session: auto-login; auto-launch of the one app; no
  ordinary session behind it
- window: one app, fullscreen; no launcher, no window
  switching; dashboard widgets are a style of window and a
  kiosk app is the extreme case of that policy
- input (input-router / keyboard): restricted to what the
  one app needs; leaving Kiosk requires admin authentication
- power: screen on a schedule; no sleep during open hours
- updates (package-coordinator): maintenance window only,
  then return unattended to the app
- notifications: none personal; failures go to the admin
  (via nct-system-watch), not to the public screen — a
  repeated failure shows a plain "needs attention" screen
- failure behaviour: a watchdog restarts the one app

Stored as: modes.computer-use = kiosk
