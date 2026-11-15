// UI Space slice 14 — the environment snapshot, its pure
// readers, the devices citizen and the network lanes/cables.
//
// The snapshot is data the space eats: a committed SAMPLE
// machine by default, a real probe only on --real. These
// tests pin the sample's shape and totals, the generator's
// determinism, the real-mode parsers against fixtures, the
// lane driver's mapping, the cable scale's clamps, the
// devices sub-node provider, and F's routing on devices
// and hosts.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ENVIRONMENT,
  ENV_TOTALS,
  deviceList,
  deviceBySlug,
  printerOf,
  queueTotals,
  primaryInterface,
  netLaneValues,
  connectionsOf,
  connectionIds,
  connectionTotals,
  cableRadiusForBytes,
  cableGlowForBytes,
  formatBytes,
} from "../src/environment.js";
import { SPACE_LANES, laneSource } from "../src/horizon-lanes.js";
import {
  SUBNODE_OBJECT_IDS,
  subnodeRootOf,
  subnodeById,
  subnodesFor,
  subnodeParentOf,
} from "../src/subnodes.js";
import { resolveFAction } from "../src/space-state.js";
import {
  buildSampleEnvironment,
  parseProcNetDev,
  seriesFromReads,
  parseLpstat,
  parseLpq,
  parseSs,
  parseDf,
  parseInputDevices,
  environmentFromProbes,
  serializeEnvironment,
} from "../tools/snapshot-environment.mjs";
import { ACTIVITY_LANES, HorizonSeries, mulberry32 } from "../../NCTGraphite/packages/nctgraphite/src/horizon/NCTGraphiteHorizon.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const GENERATOR = join(HERE, "..", "tools", "snapshot-environment.mjs");
const COMMITTED = join(HERE, "..", "src", "environment.json");

/* ---------------- the committed sample ---------------- */

test("the committed environment is the sample machine, honestly flagged", () => {
  assert.equal(ENVIRONMENT.sample, true);
  assert.equal(ENV_TOTALS.sample, true);
  // Sample hosts are example hosts, never real-looking ones.
  for (const conn of connectionsOf(ENVIRONMENT)) {
    assert.match(conn.host, /example\.(org|net)$/);
  }
  const printer = printerOf(ENVIRONMENT);
  assert.match(printer.name, /Sample Press/);
});

test("the sample's shape: devices, a 3-job queue, two interfaces, five connections", () => {
  const devices = deviceList(ENVIRONMENT);
  assert.deepEqual(
    devices.map((d) => d.kind),
    ["printer", "keyboard", "pointer", "display", "storage", "storage"],
  );
  const queue = queueTotals(printerOf(ENVIRONMENT));
  assert.deepEqual(queue, { jobs: 3, pages: 15, pagesKnown: true, printing: 1 });
  assert.equal(ENVIRONMENT.network.interfaces.length, 2);
  for (const iface of ENVIRONMENT.network.interfaces) {
    assert.equal(iface.series.length, 24, "a captured strip of 24");
    for (const s of iface.series) {
      assert.ok(Number.isFinite(s.in) && Number.isFinite(s.out), "rates in and out");
    }
  }
  assert.equal(connectionsOf(ENVIRONMENT).length, 5);
  assert.deepEqual(ENV_TOTALS, {
    sample: true,
    devices: 6,
    jobs: 3,
    pages: 15,
    connections: 5,
    interfaces: 2,
  });
});

test("sample regeneration is deterministic — byte-identical, and equal to the committed file", () => {
  assert.deepEqual(buildSampleEnvironment(), buildSampleEnvironment());
  const dir = mkdtempSync(join(tmpdir(), "env-snap-"));
  const a = join(dir, "a.json");
  const b = join(dir, "b.json");
  execFileSync(process.execPath, [GENERATOR, "--out", a]);
  execFileSync(process.execPath, [GENERATOR, "--out", b]);
  const bytesA = readFileSync(a, "utf8");
  assert.equal(bytesA, readFileSync(b, "utf8"), "two runs, one byte stream");
  assert.equal(bytesA, readFileSync(COMMITTED, "utf8"), "the committed file is the generator's output");
  assert.equal(bytesA, serializeEnvironment(buildSampleEnvironment()));
});

/* ---------------- the real-mode parsers ---------------- */

test("parseProcNetDev reads cumulative counters, skipping the header", () => {
  const text = [
    "Inter-|   Receive                                                |  Transmit",
    " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
    "    lo: 1000 10 0 0 0 0 0 0 1000 10 0 0 0 0 0 0",
    "  eth0: 5000000 4000 0 0 0 0 0 0 900000 3000 0 0 0 0 0 0",
  ].join("\n");
  const reads = parseProcNetDev(text);
  assert.equal(reads.length, 2);
  assert.deepEqual(reads[1], { name: "eth0", rxBytes: 5000000, txBytes: 900000 });
});

test("seriesFromReads turns cumulative reads into per-interval rates", () => {
  const reads = [
    { at: 0, ifaces: [{ name: "eth0", rxBytes: 1000, txBytes: 500 }] },
    { at: 1, ifaces: [{ name: "eth0", rxBytes: 3000, txBytes: 900 }] },
    { at: 2, ifaces: [{ name: "eth0", rxBytes: 3000, txBytes: 900 }] },
  ];
  const ifaces = seriesFromReads(reads);
  assert.equal(ifaces.length, 1);
  assert.deepEqual(ifaces[0].series, [
    { in: 2000, out: 400 },
    { in: 0, out: 0 },
  ]);
  // Loopback is dropped when a real interface exists…
  const mixed = seriesFromReads([
    {
      at: 0,
      ifaces: [
        { name: "lo", rxBytes: 10, txBytes: 10 },
        { name: "eth0", rxBytes: 100, txBytes: 50 },
      ],
    },
    {
      at: 0.5,
      ifaces: [
        { name: "lo", rxBytes: 20, txBytes: 20 },
        { name: "eth0", rxBytes: 300, txBytes: 90 },
      ],
    },
  ]);
  assert.deepEqual(mixed.map((i) => i.name), ["eth0"]);
  // …and kept when it is all there is.
  const only = seriesFromReads([
    { at: 0, ifaces: [{ name: "lo", rxBytes: 10, txBytes: 10 }] },
    { at: 1, ifaces: [{ name: "lo", rxBytes: 30, txBytes: 25 }] },
  ]);
  assert.equal(only[0].name, "lo");
});

test("parseLpstat and parseLpq read a CUPS queue", () => {
  const printers = parseLpstat(
    [
      "printer OfficeJet is idle.  enabled since Fri 14 Nov 2026 09:00:00 AM CST",
      "printer OldLaser disabled since Fri 14 Nov 2026 08:00:00 AM CST -",
    ].join("\n"),
  );
  assert.equal(printers.length, 2);
  assert.equal(printers[0].name, "OfficeJet");
  assert.match(printers[0].state, /idle/);
  const jobs = parseLpq(
    [
      "OfficeJet is ready and printing",
      "Rank    Owner   Job     File(s)                         Total Size",
      "active  alice   42      report.pdf                      20480 bytes",
      "1st     bob     43      poster.pdf                      102400 bytes",
    ].join("\n"),
  );
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs[0], { name: "report.pdf", pages: null, status: "printing" });
  assert.equal(jobs[1].status, "queued");
});

test("parseSs reads established peers and their byte counters", () => {
  const text = [
    "State Recv-Q Send-Q Local Address:Port Peer Address:Port Process",
    'ESTAB 0 0 192.168.1.2:51024 93.184.216.34:443 users:(("curl",pid=1,fd=3))',
    " cubic wscale:7,7 rto:204 bytes_sent:1234 bytes_received:56789",
    "ESTAB 0 0 [2001:db8::1]:8080 [2001:db8::2]:443",
    " bytes_sent:10 bytes_received:20",
    "TIME-WAIT 0 0 192.168.1.2:51025 10.0.0.1:80",
  ].join("\n");
  const conns = parseSs(text);
  assert.equal(conns.length, 2, "only ESTAB rows");
  assert.equal(conns[0].host, "93.184.216.34", "sorted by traffic, biggest first");
  assert.equal(conns[0].port, 443);
  assert.equal(conns[0].bytesIn, 56789);
  assert.equal(conns[0].bytesOut, 1234);
  assert.equal(conns[1].host, "2001:db8::2", "IPv6 brackets stripped");
});

test("parseDf and parseInputDevices fill the device sections", () => {
  const vols = parseDf(
    [
      "Filesystem      Size  Used Avail Capacity Mounted on",
      "/dev/sda1       512G  324G  188G    64% /",
      "tmpfs           16G     0   16G     0% /run",
      "/dev/sdb1       2.0T  800G  1.2T    40% /archive",
    ].join("\n"),
  );
  assert.equal(vols.length, 2, "real devices only, largest first");
  assert.deepEqual(
    vols.map((v) => [v.sizeGB, v.freeGB]),
    [
      [2048, 1229],
      [512, 188],
    ],
  );
  const input = parseInputDevices(
    [
      'N: Name="Power Button"',
      "H: Handlers=kbd event0",
      "",
      'N: Name="AT Translated Set 2 keyboard"',
      "H: Handlers=sysrq kbd event1 leds",
      "",
      'N: Name="Logitech USB Mouse"',
      "H: Handlers=mouse0 event2",
    ].join("\n"),
  );
  assert.equal(input.keyboard.name, "AT Translated Set 2 keyboard", "the named keyboard wins over the power button");
  assert.equal(input.pointer.name, "Logitech USB Mouse");
});

test("environmentFromProbes: unavailable probes mean empty sections, never a crash", () => {
  const env = environmentFromProbes({});
  assert.equal(env.sample, false);
  assert.deepEqual(env.devices, {});
  assert.deepEqual(env.network, { interfaces: [], connections: [] });
  const partial = environmentFromProbes({
    netDevReads: [
      { at: 0, ifaces: [{ name: "eth0", rxBytes: 0, txBytes: 0 }] },
      { at: 1, ifaces: [{ name: "eth0", rxBytes: 1000, txBytes: 200 }] },
    ],
  });
  assert.deepEqual(partial.devices, {});
  assert.equal(partial.network.interfaces.length, 1);
  assert.deepEqual(partial.network.interfaces[0].series, [{ in: 1000, out: 200 }]);
  assert.equal(partial.network.connections.length, 0);
});

/* ---------------- the pure readers ---------------- */

test("deviceList orders the shelf and tolerates missing kinds", () => {
  const only = { devices: { printer: { name: "P", kind: "printer", queue: [] } } };
  assert.deepEqual(deviceList(only).map((d) => d.kind), ["printer"]);
  assert.equal(deviceBySlug(only, "printer").name, "P");
  assert.equal(deviceBySlug(only, "keyboard"), null);
  assert.deepEqual(deviceList({}), []);
  assert.deepEqual(deviceList(null), []);
});

test("queueTotals counts jobs and pages, and knows when pages are unknown", () => {
  const printer = {
    kind: "printer",
    queue: [
      { name: "a", pages: 4, status: "printing" },
      { name: "b", pages: null, status: "queued" },
    ],
  };
  assert.deepEqual(queueTotals(printer), { jobs: 2, pages: 4, pagesKnown: false, printing: 1 });
  assert.deepEqual(queueTotals(null), { jobs: 0, pages: 0, pagesKnown: true, printing: 0 });
});

test("netLaneValues: normalised, resampled, monotonic on a rising strip, clamped", () => {
  const env = {
    network: {
      interfaces: [
        {
          name: "eth0",
          series: [
            { in: 100, out: 10 },
            { in: 200, out: 20 },
            { in: 400, out: 40 },
            { in: 800, out: 80 },
          ],
        },
      ],
    },
  };
  const walk = netLaneValues(env, "in", 16);
  assert.equal(walk.length, 16);
  for (let i = 1; i < walk.length; i += 1) {
    assert.ok(walk[i] >= walk[i - 1] - 1e-9, "a rising strip maps to a rising walk");
  }
  assert.ok(Math.abs(walk[walk.length - 1] - 1) < 1e-9, "the peak maps to 1");
  assert.ok(walk.every((v) => v >= 0 && v <= 1), "values clamp to [0, 1]");
  // Negative (counter-reset) rates clamp to the floor.
  const reset = {
    network: { interfaces: [{ name: "e", series: [{ in: -50, out: 0 }, { in: 10, out: 0 }] }] },
  };
  assert.ok(netLaneValues(reset, "in", 4).every((v) => v >= 0));
  // Absent data → null (the lanes fall back to the walk).
  assert.equal(netLaneValues({}, "in", 8), null);
  assert.equal(netLaneValues({ network: { interfaces: [] } }, "in", 8), null);
  // A silent interface reads as a flat zero lane, not a crash.
  const silent = { network: { interfaces: [{ name: "e", series: [{ in: 0, out: 0 }] }] } };
  assert.deepEqual(netLaneValues(silent, "out", 3), [0, 0, 0]);
  assert.equal(primaryInterface(env).name, "eth0");
});

test("the cable scale: log in the bytes, clamped at both ends", () => {
  let prev = -Infinity;
  for (const bytes of [0, 10, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e12]) {
    const r = cableRadiusForBytes(bytes);
    assert.ok(r >= prev, "monotonic in the bytes");
    prev = r;
  }
  assert.equal(cableRadiusForBytes(0), 0.22, "the floor");
  assert.equal(cableRadiusForBytes(1e12), cableRadiusForBytes(1e9), "the ceiling clamps");
  assert.ok(cableGlowForBytes(1e12) <= 0.75 && cableGlowForBytes(0) >= 0.18);
  assert.equal(formatBytes(0), "0 B");
  assert.match(formatBytes(61204800), /MB$/);
});

/* ---------------- the horizon lanes ---------------- */

test("the space's lanes: eight, NET IN and NET OUT last, driven by the snapshot", () => {
  assert.equal(SPACE_LANES.length, 8);
  assert.deepEqual(
    SPACE_LANES.map((l) => l.id),
    ["disk-read", "disk-write", "ram", "swap", "cpu", "gpu", "net-in", "net-out"],
  );
  const netIn = SPACE_LANES[6];
  const netOut = SPACE_LANES[7];
  // The lanes keep their shared NCTGraphite names — the same
  // labels the standalone horizon pages show for these lanes.
  assert.equal(netIn.label, "NETWORK IN");
  assert.equal(netOut.label, "NETWORK OUT");
  assert.equal(netIn.driven, "environment");
  assert.equal(laneSource(netIn), "the environment snapshot");
  // The net lanes carry the snapshot's strip, normalised.
  assert.deepEqual(netIn.samples, netLaneValues(ENVIRONMENT, "in", netIn.samples.length));
  assert.deepEqual(netOut.samples, netLaneValues(ENVIRONMENT, "out", netOut.samples.length));
  for (const lane of SPACE_LANES) {
    assert.equal(lane.samples.length, 48);
    assert.ok(lane.samples.every((v) => v >= 0 && v <= 1));
  }
  // The synthetic lanes ride the shared NCTGraphite path: the
  // first lane is exactly a fresh HorizonSeries on the shared
  // seed — the same series the standalone horizons draw.
  const laneDef = ACTIVITY_LANES.find((l) => l.id === "disk-read");
  const fresh = new HorizonSeries(laneDef, 48, mulberry32(20261113));
  assert.deepEqual(SPACE_LANES[0].samples, [...fresh.data]);
});

/* ---------------- the devices provider ---------------- */

test("the devices provider: devices on the shelf, hosts under the hub", () => {
  assert.ok(SUBNODE_OBJECT_IDS.includes("devices"));
  const root = subnodeRootOf("devices");
  assert.equal(root.id, "devices");
  assert.equal(root.value, 11, "6 devices + the hub + … counted as things attached");
  const nodes = subnodesFor("devices");
  const ids = nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "ids unique");
  const printer = subnodeById("devices", "devices/printer");
  assert.ok(printer, "the printer node is present");
  assert.equal(printer.depth, 1);
  // Depth-1 shares sum to the whole shelf.
  const shareSum = nodes.filter((n) => n.depth === 1).reduce((s, n) => s + n.share, 0);
  assert.ok(Math.abs(shareSum - 1) < 1e-9);
  // The hub carries the connection count; hosts hang under it.
  const hub = subnodeById("devices", "devices/net");
  assert.equal(hub.value, 5);
  const hosts = nodes.filter((n) => n.depth === 2);
  assert.equal(hosts.length, 5);
  for (const host of hosts) {
    assert.equal(subnodeParentOf("devices", host.id), "devices/net");
    assert.ok(host.id.startsWith("devices/net/"));
  }
  assert.deepEqual(connectionIds(ENVIRONMENT), hosts.map((h) => h.id));
  assert.equal(connectionTotals(ENVIRONMENT).count, 5);
});

test("resolveFAction: F on a device or a host flies into it; on the citizen it opens", () => {
  const at = (over) => resolveFAction({ hoverId: "devices", currentId: "devices", ...over });
  assert.deepEqual(
    at({ subId: "devices/printer" }),
    { type: "partFocus", targetId: "devices", partId: "devices/printer" },
  );
  assert.deepEqual(
    at({ subId: "devices/net/example-org" }),
    { type: "partFocus", targetId: "devices", partId: "devices/net/example-org" },
  );
  // No sub-node under the hand: the citizen opens as usual.
  assert.deepEqual(at({ subId: null }), { type: "open", targetId: "devices" });
  // A devices sub-id never hijacks another citizen's F.
  assert.deepEqual(
    resolveFAction({ hoverId: "mesa", currentId: "mesa", subId: "devices/printer", subLeaf: true }),
    { type: "partFocus", targetId: "mesa", partId: "devices/printer" },
    "mesa's own leaf rule answers first — devices' ids mean nothing there",
  );
  assert.deepEqual(
    resolveFAction({ hoverId: "cube", currentId: "cube", subId: "devices/printer" }),
    { type: "open", targetId: "cube" },
  );
});
