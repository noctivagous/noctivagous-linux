import React from "react";

// Test shim for the treemap cube page's View: the pure address
// helpers are the REAL ones (the App's targeting must agree with
// them), the WebGL component is replaced by a props recorder so
// the harness can assert on the App's state as passed to its View.
export { cubeAddresses, LABEL_ALPHABET, labelForIndex } from "../../src/TreemapCubeView.jsx";

export default function TreemapCubeView(props) {
  (globalThis.__viewProps ??= {}).treemapCube = props;
  return null;
}
