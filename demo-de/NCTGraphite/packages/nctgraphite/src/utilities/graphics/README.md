# NCTGraphite graphics utilities

Renderer-independent geometry used by paint modes. Each file in this folder is
a named module; apps own layer schemas, brush routing, and drawing.

| File | Owns |
|---|---|
| `hull.ts` | Convex hull, shared-edge clustering, perimeter loops, Chaikin smooth |
| `metaballField.ts` | Inverse-square field, d3-contour iso-paths, Perlin stamp noise |
| `satoNeck.ts` | Sato/Paper.js metaball necks and round-rect stamps |
| `vectorField.ts` | Sample lattice, `VECTOR_BRUSH_OPS` stamps, attractors, angle→hue style |
| `sampleLattice.ts` | Edge-aligned sample points, jitter, shading falloff, gain stamps |

Modes call these with polygons, blobs, or samples. They do not import layer
types or UI. Diamond and triangle cells stay distinct polygons; hull clustering
uses shared edges rather than closed-form neighbors.
