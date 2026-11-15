# App-shell key-click regression (Patterns A + B)

Driven-key regression for the shared App-shell key-click latency
fix: the five frame pages whose keydown handlers targeted nodes
through render-scope state (`TreemapApp`, `TreemapCubeApp`,
`SunburstCylinderApp`, `SunburstApp`, `TangledApp`).

## What it proves

Each sequence's keystrokes are dispatched **synchronously
back-to-back inside a single React `act()` block** — no wall-clock
delay and no render between keystrokes. That is the condition
under which the old shells failed:

- **Pattern A** (treemap, treemap cube): a letter targets a node,
  `F` in the same burst met the previous listener, whose `target`
  was still null — the F was swallowed.
- **Pattern B** (sunburst cylinder): the 800 ms label-buffer
  timer was only cleared on the prefix branch, so a timer armed by
  an earlier prefix keystroke could fire after an exact match, an
  `F`, or an `Escape` and target the stale pending node.
- **Pattern B, stale buffer** (sunburst mesa, tangled tree): a
  two-letter label typed in one burst was composed against the
  stale `buffer` state, acting on the wrong node.

Timer sequences use **real timers**: after the burst, the harness
waits out the real 800 ms window (950 ms, inside an async `act`)
and asserts on the settled state. The unpaced claim rests on the
zero delay *between keystrokes*, not on the final wait.

The regression **fails on the pre-fix code** for every (a)/(b)
sequence (9 of 12 checks) and passes 12/12 on the fixed code; the
remaining 3 checks are invariants that pass on both (the
wait-out-the-window targeting and the prefix-Escape settle).

## How it works

`run.mjs` mounts the real App components in jsdom (esbuild bundle;
the five WebGL View components are stubbed by `shims/` — the two
treemap shims re-export the REAL pure label helpers, and every
stub records the props the App passes its View, which is what the
assertions read). Assertions are on App state via those props,
plus readout text where the sequence is about what the user sees.

## Run

```sh
cd demo-de
npm install --no-save jsdom   # jsdom is a harness-only need, not a project dep
node keyfix-regression/run.mjs
node keyfix-regression/smoke.mjs   # renderToString smoke, real views
```

`smoke.mjs` renders all five affected pages plus two unaffected
ones (horizon, definition) to strings with the REAL views and
checks each page's title renders.
