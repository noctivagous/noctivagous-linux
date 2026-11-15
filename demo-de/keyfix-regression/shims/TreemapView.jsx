import React from "react";

// Test shim for the treemap page's View: the pure label helpers are
// the REAL ones (the App's targeting must agree with them), the
// WebGL component is replaced by a props recorder so the harness
// can assert on the App's state as passed to its View.
export { labeledNodes, LABEL_ALPHABET, labelForIndex } from "../../src/TreemapView.jsx";

export default function TreemapView(props) {
  (globalThis.__viewProps ??= {}).treemap = props;
  return null;
}
