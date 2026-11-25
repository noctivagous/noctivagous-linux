# tools/ — the development harness

- run-chain.sh — tiers 0+1 on any dev machine: parse checks, bridge
  fixture auth, Godot import/self-tests, then the nested chain
  (greeter auto-login → session apps → shell + Firefox + Qt + Hello
  windows, asserted against the compositor's window tree, with a
  screenshot). Results: ../tests/results-local/.
