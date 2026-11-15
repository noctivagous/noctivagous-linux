import React from "react";

// Test shim for the tangled tree page's View: a props recorder so
// the harness can assert on the App's state (selectedId, labelFor)
// as passed to its View. The App needs no named exports from the
// real View module.
export default function TangledView(props) {
  (globalThis.__viewProps ??= {}).tangled = props;
  return null;
}
