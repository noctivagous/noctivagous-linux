# ext-fwks/bindings — one subdirectory per hosted framework

godot/ (first; its kit and bridge live in ../../godot and
../../services/bridge until the shared core is extracted),
processing/, openframeworks/, juce/ — created when each binding starts.
Each binding defines: runtime/toolchain pin, adapter, bundle format,
the generated .desktop entry, and a reference app.
