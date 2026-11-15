import React from "react";

// Test shim for the sunburst cylinder page's View: a props recorder
// so the harness can assert on the App's state (keyTargets,
// targetNode, openNode, focusNode) as passed to its View. The App
// needs no named exports from the real View module.
export default function SunburstCylinderView(props) {
  (globalThis.__viewProps ??= {}).cylinder = props;
  return null;
}
