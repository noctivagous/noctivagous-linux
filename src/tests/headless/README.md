# tests/headless — tier 0

The tier-0 checks live inside tools/run-chain.sh (script parsing,
bridge fixture auth over its real protocol, Godot project import and
the shell's --self-test). They are kept in the runner rather than as
separate files so tiers 0 and 1 can never drift apart; this directory
is the slot for standalone headless checks as they appear.
