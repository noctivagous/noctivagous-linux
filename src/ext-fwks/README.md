# ext-fwks/ — NCT-LIB-EXT-FWKS

Marker: NCT-WL-BRIDGE. Support for hosted frameworks — Godot (first
binding), Processing, openFrameworks, JUCE — through ONE module: a
framework-agnostic bridge core, the style-token schema, bundle and
identity rules, and conformance checks, with one binding per framework
under bindings/. Full spec: demo-de/EXT-FWKS.md. Foundation state: the
Godot binding exists implicitly (godot/ + services/bridge/); the shared
core is extracted here when the second binding lands, not before.
