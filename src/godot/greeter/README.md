# godot/greeter — the greeter

A Godot project. Fullscreen under cage (VM, via core/session/
nct-greeter-session) or any compositor. Login flow: AUTH then START
against nct-greetd-bridge on 127.0.0.1:7717 (env NCT_BRIDGE_HOST/PORT).
Automation: `-- --auto-login <user> <password>` performs the same flow
unattended and prints GREETER_SELFTEST_OK / GREETER_SELFTEST_FAIL.
The UI is built in code so main.tscn stays a stub: main.gd owns the
backdrop (backdrop.gd, the demo's wallpaper drawn) and the bridge
conversation; form_host.gd builds the login card. GDScript throughout
(build log 34) — the project ships as a .pck on the shared runtime.
