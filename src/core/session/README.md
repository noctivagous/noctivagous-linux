# core/session — the chain's glue

Marker: NCT-WL-COMPOSITOR (session scripts) — they handle surfaces and
processes, never app internals.

| File | Role |
|---|---|
| nct-greeter-session | greetd's greeter session: bridge + greeter under a single-app compositor |
| nct-session | the user session: compositor + autostart |
| nct-session-apps | inside a live compositor: shell, then autostart entries |
| nct-launch <id> | the one launcher; shell buttons and autostart both use it |
| nct-resolve-cmd <key> | the one place program paths/fallbacks/overrides live |
| nct-godot-run <dir> | run a Godot project on the pinned runtime |
| launch-list.tsv | the one list of startable programs (id, title, key, autostart) |

State and logs: $NCT_STATE_DIR (default ~/.local/state/nct/).
