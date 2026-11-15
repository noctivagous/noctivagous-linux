import React from "react";

// Test shim for the sunburst mesa page's View: a props recorder so
// the harness can assert on the App's state (keyTargets, focusNode,
// selected) as passed to its View. The App needs no named exports
// from the real View module.
export default function SunburstView(props) {
  (globalThis.__viewProps ??= {}).sunburst = props;
  return null;
}
