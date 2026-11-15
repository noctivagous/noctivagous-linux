import React, { act } from "react";
import { createRoot } from "react-dom/client";

import TreemapApp from "../src/TreemapApp.jsx";
import TreemapCubeApp from "../src/TreemapCubeApp.jsx";
import SunburstApp from "../src/SunburstApp.jsx";
import SunburstCylinderApp from "../src/SunburstCylinderApp.jsx";
import TangledApp from "../src/TangledApp.jsx";

// Ground truth for the treemap pages: the REAL label helpers (via
// the shims, which re-export them), so the harness computes labels
// from the App's own focus node exactly as the App does.
import { labeledNodes } from "./shims/TreemapView.jsx";
import { cubeAddresses } from "./shims/TreemapCubeView.jsx";

// Ground truth for the tangled page: the real layout, so the
// harness can enumerate figure ids and read their labels back
// through the labelFor prop the App passes its View.
import { constructTangleLayout } from "../NCTGraphite/packages/nctgraphite/src/tangle/NCTGraphiteTangleLayout.ts";
import { TANGLE_LEVELS } from "../src/tangle-data.js";

export {
  React,
  act,
  createRoot,
  TreemapApp,
  TreemapCubeApp,
  SunburstApp,
  SunburstCylinderApp,
  TangledApp,
  labeledNodes,
  cubeAddresses,
  constructTangleLayout,
  TANGLE_LEVELS,
};
