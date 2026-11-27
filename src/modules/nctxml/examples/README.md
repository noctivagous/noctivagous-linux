# examples — production NCTXML documents, kept as reference

These documents ran in production until the GDScript-first
strategy (build log 34) rebuilt their surfaces in GDScript:

- `login.nctxml` over `login.nctform` — the greeter's login
  card (E3; the card design the GDScript form_host.gd keeps).
- `bar.nctxml` — the shell's launch bar (E4).

They are the baking track's reference: when the interpreter
bakes into an app, these are the documents it must render
identically.
