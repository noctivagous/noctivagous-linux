/**
 * UI Space — THE HORIZON LANES (slice 14): the activity
 * monitor's eight lanes as the space's two horizon citizens
 * share them.
 *
 * The lane machinery is the lab's own: NCTGraphite's horizon
 * module (ACTIVITY_LANES + HorizonSeries — the tempered walks
 * the standalone horizon pages run), shared here by the flat
 * panel and the 3D skyline exactly as those pages share it.
 * The space's lane ORDER is its own ruling: the six machine
 * lanes first, in the module's order, and the NETWORK lanes
 * LAST — net-in, net-out — because in this slice they stop
 * being walks:
 *
 * THE NET LANES ARE DRIVEN, not walked. Their samples are the
 * environment snapshot's captured strip for the primary
 * interface (environment.js's netLaneValues: rates normalised
 * against the strip's own peak, resampled onto the lane). A
 * net lane's `driven` says which it is — "environment" when
 * the snapshot carries a series, "walk" when it does not (a
 * snapshot with no network section leaves the net lanes on
 * the tempered walk, labelled as such wherever they are
 * listed). The other six lanes keep the walk they always had:
 * synthetic, seeded, reproducible.
 */

import {
  ACTIVITY_LANES,
  HorizonSeries,
  mulberry32,
} from "../../NCTGraphite/packages/nctgraphite/src/horizon/NCTGraphiteHorizon.ts";
import {
  ENVIRONMENT,
  netLaneValues,
  netRates,
  formatRate,
} from "./environment.js";

/** Samples per lane — the strip the miniatures read. */
export const LANE_SAMPLES = 48;

export const NET_LANE_IDS = ["net-in", "net-out"];

/** The space's lane order: the machine lanes, then the network pair last. */
export const SPACE_LANE_IDS = [
  ...ACTIVITY_LANES.filter((l) => !NET_LANE_IDS.includes(l.id)).map((l) => l.id),
  ...NET_LANE_IDS,
];

const laneDef = (id) => ACTIVITY_LANES.find((l) => l.id === id);

function buildLanes() {
  // One seeded source of chance for the walked lanes, consumed
  // in lane order — the standalone pages' createMonitor pattern.
  const rand = mulberry32(20261113);
  return SPACE_LANE_IDS.map((id) => {
    const def = laneDef(id);
    if (NET_LANE_IDS.includes(id)) {
      const dir = id === "net-in" ? "in" : "out";
      const values = netLaneValues(ENVIRONMENT, dir, LANE_SAMPLES);
      if (values) {
        const rates = netRates(ENVIRONMENT, dir);
        return {
          ...def,
          samples: values,
          current: values[values.length - 1],
          driven: "environment",
          peakRate: rates.length ? Math.max(...rates) : 0,
          currentRate: rates.length ? rates[rates.length - 1] : 0,
        };
      }
    }
    const series = new HorizonSeries(def, LANE_SAMPLES, rand);
    return {
      ...def,
      samples: [...series.data],
      current: series.current,
      driven: "walk",
      peakRate: null,
      currentRate: null,
    };
  });
}

/**
 * The eight lanes, in the space's order. Each carries its
 * NCTGraphite definition (label, what, format, scheme), its
 * samples in [0, 1] (oldest first), its current value, and
 * its `driven` provenance — plus, for an environment-driven
 * net lane, the strip's peak and current raw rates.
 */
export const SPACE_LANES = buildLanes();

/** One lane by id ("net-in", "cpu", ...), or null. */
export const spaceLaneById = (id) => SPACE_LANES.find((l) => l.id === id) || null;

/** Where a lane's samples come from, in words. */
export function laneSource(lane) {
  return lane && lane.driven === "environment"
    ? "the environment snapshot"
    : "the tempered walk";
}

/** A lane's current reading, in words: a net lane driven by
 *  the snapshot reads as a rate; everything else reads in its
 *  definition's own unit. */
export function laneNow(lane) {
  if (!lane) return "";
  if (lane.driven === "environment" && lane.currentRate != null) {
    return formatRate(lane.currentRate);
  }
  return lane.format(lane.current);
}
