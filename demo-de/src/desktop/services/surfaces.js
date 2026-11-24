/* Backdrop surfaces — the same four sheets the iGeo live demo offers
 * (src/IgeoLiveView.jsx SURFACES), built from the NCTGraphite
 * panelization library's own NURBS surface class and presets, so the
 * desktop backdrop and the demo solve the same surfaces. */

import {
  NCTGraphiteNurbsSurface,
  createDemoSheetSurface,
  createFlatSheetSurface,
} from "../../../NCTGraphite/packages/nctgraphite/src/panelization/NCTGraphiteNurbsSurface.ts";
import { vec3 } from "../../../NCTGraphite/packages/nctgraphite/src/panelization/NCTGraphiteVec3.ts";

function createWaveSurface() {
  // A wave sheet over the same 200 x 60 extent as the tutorial sheet.
  // The net samples y = 8 sin(2πu) cos(πv); the cubic surface smooths it.
  const ys = [
    [0, 8, 0, -8, 0],
    [0, 4, 0, -4, 0],
    [0, -4, 0, 4, 0],
    [0, -8, 0, 8, 0],
  ];
  const net = ys.map((row, j) =>
    row.map((y, i) => vec3((200 * i) / 4, y, (60 * j) / 3)),
  );
  return new NCTGraphiteNurbsSurface({
    controlPoints: net,
    degreeU: 3,
    degreeV: 3,
  });
}

export const BACKDROP_SURFACES = [
  { id: "arch", name: "ARCH", make: () => createDemoSheetSurface(1) },
  { id: "flat", name: "FLAT SHEET", make: () => createFlatSheetSurface() },
  { id: "vault", name: "VAULT", make: () => createDemoSheetSurface(2.4) },
  { id: "wave", name: "WAVE", make: createWaveSurface },
];

export const BACKDROP_DENSITIES = {
  coarse: { udiv: 42, vdiv: 12, label: "Coarse · 42×12" },
  standard: { udiv: 70, vdiv: 20, label: "Standard · 70×20" },
  dense: { udiv: 98, vdiv: 28, label: "Dense · 98×28" },
};

export const BACKDROP_DEFAULTS = {
  mode: "parametric", // 'parametric' | 'classic'
  surface: "arch",
  density: "coarse",
  swarmCount: 50,
  speed: 1,
  reach: 10,
  memory: 0.95, // PanelizationSimulation dirDecay
  motion: true,
  cursorField: true,
  drift: 0.5, // viewpoint drift: the projection slowly sways, so panels parallax by depth
  variation: 0.5, // appearance variation: surface breathing + a slow light sheen across the field
};
