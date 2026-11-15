/**
 * UI Space — THE ENVIRONMENT (slice 14): the machine the space
 * is sitting on, as data.
 *
 * Slice 13's snapshot taught the space to eat its own repo;
 * this one (tools/snapshot-environment.mjs) snapshots the
 * MACHINE: its devices (a printer with its queue, a keyboard,
 * a pointer, a display, storage volumes) and its network
 * (interfaces with a captured strip of rates, and connections
 * with their byte counts). This module is the pure face of
 * that snapshot — the flattenings, totals and mappings the
 * depictions consume:
 *
 *   - the DEVICES citizen's shelf list (deviceList) and the
 *     printer's queue totals;
 *   - the HORIZON citizens' net lanes: netLaneValues turns the
 *     primary interface's captured strip into a lane of [0, 1]
 *     values (see horizon-lanes.js);
 *   - the CONNECTION CABLES' measures: a log-scale radius and
 *     glow per connection, from its bytes.
 *
 * The committed snapshot is a SAMPLE machine (sample: true)
 * and everything that shows it says so; a real snapshot names
 * real devices and endpoints and is a local artifact. Absent
 * sections are honest: a snapshot without a printer has no
 * printer, and the consumers render only what is carried.
 */

import snapshot from "./environment.json" with { type: "json" };

/** The environment snapshot, as generated: { sample, devices, network }. */
export const ENVIRONMENT = snapshot;

/** True when the snapshot is the committed SAMPLE machine. */
export const isSampleEnvironment = (env) => Boolean(env && env.sample);

/* ---------------- devices ---------------- */

/**
 * The shelf list, flattened in display order — printer,
 * keyboard, pointer, display, then the volumes in data order.
 * Each entry: { slug, name, kind, state, ... } with the
 * kind's own fields riding along (the printer's queue, a
 * volume's sizeGB/freeGB). Kinds absent from the snapshot are
 * absent from the list: forms follow data.
 */
export function deviceList(env) {
  const d = (env && env.devices) || {};
  const out = [];
  if (d.printer) out.push({ slug: "printer", ...d.printer });
  if (d.keyboard) out.push({ slug: "keyboard", ...d.keyboard });
  if (d.pointer) out.push({ slug: "pointer", ...d.pointer });
  if (d.display) out.push({ slug: "display", ...d.display });
  for (const [i, v] of (d.volumes || []).entries()) {
    out.push({ slug: v.slug || `volume-${i + 1}`, ...v });
  }
  return out;
}

/** One shelf device by its slug, or null. */
export function deviceBySlug(env, slug) {
  return deviceList(env).find((d) => d.slug === slug) || null;
}

/** The printer device (with its queue), or null when the machine has none. */
export function printerOf(env) {
  return deviceList(env).find((d) => d.kind === "printer") || null;
}

/**
 * A printer's queue as totals: { jobs, pages, printing } —
 * pages sums the jobs that report a count (lpq does not, so a
 * real queue's pages can be null per job); `pagesKnown` says
 * whether every job reported one.
 */
export function queueTotals(printer) {
  const queue = (printer && printer.queue) || [];
  let pages = 0;
  let pagesKnown = true;
  for (const job of queue) {
    if (typeof job.pages === "number") pages += job.pages;
    else pagesKnown = false;
  }
  return {
    jobs: queue.length,
    pages,
    pagesKnown,
    printing: queue.filter((j) => j.status === "printing").length,
  };
}

/* ---------------- network ---------------- */

/** The snapshot's interfaces ([{ name, series }]), or none. */
export function interfacesOf(env) {
  return (env && env.network && env.network.interfaces) || [];
}

/**
 * The PRIMARY interface: the one whose captured strip moved
 * the most traffic (the generator orders busiest-first, but
 * the choice is recomputed here so any well-formed snapshot
 * reads the same). Loopback is passed over when anything else
 * exists. Null when the snapshot carries no usable strip.
 */
export function primaryInterface(env) {
  const ifaces = interfacesOf(env).filter((i) => i.series && i.series.length);
  if (!ifaces.length) return null;
  const total = (i) => i.series.reduce((n, s) => n + (s.in || 0) + (s.out || 0), 0);
  const nonLoop = ifaces.filter((i) => i.name !== "lo");
  const pool = nonLoop.length ? nonLoop : ifaces;
  return pool.reduce((best, i) => (total(i) > total(best) ? i : best), pool[0]);
}

/** The primary interface's raw rates (bytes/s) for a direction ("in" | "out"). */
export function netRates(env, dir) {
  const iface = primaryInterface(env);
  if (!iface) return [];
  return iface.series.map((s) => Math.max(0, dir === "out" ? s.out || 0 : s.in || 0));
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * THE NET LANE DRIVER: the primary interface's captured strip
 * as a lane of `length` values in [0, 1] — each rate divided
 * by the strip's peak rate for that direction (the lane reads
 * against its own busiest moment, as a monitor's strip does),
 * then resampled onto the lane's length by linear
 * interpolation. The mapping is monotonic: a busier moment
 * never reads lower. Null when the snapshot carries no series
 * — the caller falls back to the lane's tempered walk, and
 * says so.
 */
export function netLaneValues(env, dir, length) {
  const rates = netRates(env, dir);
  const n = Math.max(2, Math.floor(length) || 0);
  if (!rates.length) return null;
  const peak = Math.max(...rates);
  if (!(peak > 0)) return new Array(n).fill(0);
  const norm = rates.map((r) => clamp01(r / peak));
  if (norm.length === 1) return new Array(n).fill(norm[0]);
  const out = [];
  for (let j = 0; j < n; j++) {
    const x = (j * (norm.length - 1)) / (n - 1);
    const lo = Math.floor(x);
    const hi = Math.min(norm.length - 1, lo + 1);
    out.push(clamp01(norm[lo] + (norm[hi] - norm[lo]) * (x - lo)));
  }
  return out;
}

/** The snapshot's connections ([{ host, port, protocol, bytesIn, bytesOut }]). */
export function connectionsOf(env) {
  return (env && env.network && env.network.connections) || [];
}

/** A connection's total traffic, both ways. */
export const connectionBytes = (conn) => (conn.bytesIn || 0) + (conn.bytesOut || 0);

/** The connections' totals: { count, bytesIn, bytesOut, bytes }. */
export function connectionTotals(env) {
  const conns = connectionsOf(env);
  const bytesIn = conns.reduce((n, c) => n + (c.bytesIn || 0), 0);
  const bytesOut = conns.reduce((n, c) => n + (c.bytesOut || 0), 0);
  return { count: conns.length, bytesIn, bytesOut, bytes: bytesIn + bytesOut };
}

/** A host's slug: lowercase, non-alphanumerics folded to dashes. */
export function hostSlug(host) {
  return String(host || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "host";
}

/**
 * The connections' sub-node ids, parallel to connectionsOf:
 * "devices/net/<host-slug>", made unique in data order — a
 * second connection to one host takes its port as a suffix,
 * then a counter. One computation, shared by the provider
 * (subnodes.js) and the view, so both name the same node.
 */
export function connectionIds(env) {
  const taken = new Set();
  return connectionsOf(env).map((conn) => {
    const base = `devices/net/${hostSlug(conn.host)}`;
    let id = base;
    if (taken.has(id)) id = `${base}-${conn.port}`;
    let k = 2;
    while (taken.has(id)) id = `${base}-${conn.port}-${k++}`;
    taken.add(id);
    return id;
  });
}

/**
 * A connection cable's RADIUS from its bytes: a log scale (a
 * connection ten times as busy is a step thicker, not ten
 * times), clamped at both ends — the quietest connection is
 * still a cable, the loudest still a cable and not a pipe.
 */
export function cableRadiusForBytes(bytes) {
  const t = Math.log10(Math.max(1, bytes || 0));
  return Math.max(0.22, Math.min(1.05, 0.22 + (t - 3) * 0.16));
}

/** A connection cable's resting GLOW from its bytes: the same log scale, dimmer range. */
export function cableGlowForBytes(bytes) {
  const t = Math.log10(Math.max(1, bytes || 0));
  return Math.max(0.18, Math.min(0.75, 0.18 + (t - 3) * 0.13));
}

/* ---------------- display ---------------- */

/** Bytes as a short human measure: "48 KB", "61.2 MB", "1.2 GB". */
export function formatBytes(n) {
  const v = Math.max(0, Number(n) || 0);
  if (v < 1000) return `${Math.round(v)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let x = v / 1024;
  let u = 0;
  while (x >= 1024 && u < units.length - 1) { x /= 1024; u++; }
  return `${x >= 100 ? Math.round(x) : x.toFixed(1)} ${units[u]}`;
}

/** A rate (bytes/s) as a short human measure: "12.4 MB/s". */
export function formatRate(n) {
  return `${formatBytes(n)}/s`;
}

/** The snapshot's headline counts, for cards and panels. */
export const ENV_TOTALS = (() => {
  const printer = printerOf(ENVIRONMENT);
  const queue = queueTotals(printer);
  const conns = connectionTotals(ENVIRONMENT);
  return {
    sample: isSampleEnvironment(ENVIRONMENT),
    devices: deviceList(ENVIRONMENT).length,
    jobs: queue.jobs,
    pages: queue.pages,
    connections: conns.count,
    interfaces: interfacesOf(ENVIRONMENT).length,
  };
})();
