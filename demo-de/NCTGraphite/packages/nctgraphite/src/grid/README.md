# NCTGraphite grid geometry

`NCTGraphiteGridGeometry.ts` contains renderer-independent geometry for square,
flat-top hex, pointy-top hex, hex-split diamonds, and horizontal/vertical
triangle grids. It deliberately owns only grid layout: coordinate conversion,
polygon corners, adjacency, bounds, and hit testing. Diamond-split hexes and
triangles are distinct kinds; they are not aliases of ordinary hexes.

For hex grids, `q` and `r` are axial coordinates. For squares they are the
column and row. `size` is a hex radius or a square half-side. The optional
origin locates coordinate `0,0` in document space.

```ts
import {
  gridCell, gridNeighbors, pointToGridCoordinate,
} from '@nct/nctgraphite';

const grid = { kind: 'hex-flat', size: 28, origin: { x: 480, y: 340 } } as const;
const coordinate = pointToGridCoordinate(grid, pointer);
const cell = gridCell(grid, coordinate);
const neighbors = gridNeighbors(grid, coordinate);
```

Modes own their paint data and rendering. Hull, metaball, and vector-field
geometry live in `src/utilities/graphics/`. More grid kinds should be added when
their mode migrates, rather than represented as an approximate existing kind.
