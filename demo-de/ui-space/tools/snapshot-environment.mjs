#!/usr/bin/env node
/**
 * UI Space — the ENVIRONMENT snapshot generator (slice 14).
 *
 * Slice 13 taught the space to eat its own repo; this generator
 * teaches it to eat its own MACHINE. It writes the one generated
 * data file the slice's depictions import:
 *
 *   ui-space/src/environment.json — { sample, devices, network }:
 *     devices — the machine's attachments: a printer (with its
 *       queue: jobs of { name, pages, status }, pages null when
 *       the queue does not say), a keyboard, a pointing device,
 *       a display, and storage volumes ({ name, sizeGB, freeGB }).
 *     network — interfaces, each with a captured strip of rates
 *       ({ name, series: [{ in, out }, ...] } in BYTES PER
 *       SECOND), and connections ({ host, port, protocol,
 *       bytesIn, bytesOut }).
 *
 * TWO MODES:
 *
 *   SAMPLE (the default — what gets committed): a plausible
 *   sample machine, built from constants in this file, clearly
 *   sample in every name ("Sample Press", "example.org"). The
 *   committed snapshot is the sample, so the deployed space
 *   shows a sample machine and says so. Sample generation is a
 *   pure function of nothing: byte-identical across runs.
 *
 *   REAL (--real): probe THIS machine, best-effort, and write
 *   what is found. Printers from lpstat/lpq when CUPS exists;
 *   interface counters from /proc/net/dev (Linux), sampled a
 *   dozen times over about six seconds to build the rate strip;
 *   connections from `ss -tin` (remote endpoints and their byte
 *   counts where ss reports them); volumes from `df`; keyboard
 *   and pointer from /proc/bus/input/devices. Anything
 *   unavailable is simply ABSENT from the snapshot — a section,
 *   a device kind, a queue — never an error: the consumers
 *   render what the snapshot carries and no more. (The display
 *   is not probed in this slice: real mode carries no display
 *   entry rather than a guessed one.)
 *
 * PRIVACY, stated plainly: REAL output contains this machine's
 * REAL device names and REAL connection endpoints. It is a
 * LOCAL artifact. The committed file is the sample; if you
 * regenerate with --real, REVIEW the file before committing it
 * — it names real devices and real endpoints.
 *
 * Usage:
 *   node ui-space/tools/snapshot-environment.mjs [--real] [--out <path>]
 * (run from demo-de; the default --out is ui-space/src/environment.json)
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* ---------------- the sample machine ---------------- */

/**
 * The sample interface strip: 24 samples of rates (bytes/s),
 * a deterministic function of the sample index — a morning's
 * traffic in miniature: a swell, a lull, a burst near the end.
 */
function sampleSeries(seedIn, seedOut) {
  const series = [];
  for (let i = 0; i < 24; i++) {
    const swell = Math.sin(i * 0.55) * 0.5 + 0.5; // 0..1
    const burst = i >= 18 && i <= 20 ? 1.6 : 1;
    const inRate = Math.round((6_000_000 + 26_000_000 * swell * burst + (i % 4) * 1_700_000) * seedIn);
    const outRate = Math.round((900_000 + 5_500_000 * swell + (i % 3) * 640_000) * seedOut);
    series.push({ in: inRate, out: outRate });
  }
  return series;
}

/** The committed snapshot: a sample machine, honestly named. */
export function buildSampleEnvironment() {
  return {
    sample: true,
    devices: {
      printer: {
        name: "Sample Press — OfficeJet class",
        kind: "printer",
        state: "printing — job 1 of 3",
        queue: [
          { name: "field-notes-draft.pdf", pages: 12, status: "printing" },
          { name: "treemap-poster.pdf", pages: 2, status: "queued" },
          { name: "boarding-pass.pdf", pages: 1, status: "queued" },
        ],
      },
      keyboard: { name: "Sample Keys — 65% board", kind: "keyboard", state: "connected" },
      pointer: { name: "Sample Pointer — trackball", kind: "pointer", state: "connected" },
      display: { name: "Sample Display — 27-inch panel", kind: "display", state: "primary · 5120 × 2880" },
      volumes: [
        { name: "Sample Volume — System", kind: "storage", slug: "volume-system", sizeGB: 512, freeGB: 188, state: "512 GB · 188 GB free" },
        { name: "Sample Volume — Archive", kind: "storage", slug: "volume-archive", sizeGB: 2048, freeGB: 1211, state: "2048 GB · 1211 GB free" },
      ],
    },
    network: {
      interfaces: [
        { name: "en0", series: sampleSeries(1, 1) },
        { name: "en1", series: sampleSeries(0.06, 0.11) },
      ],
      connections: [
        { host: "example.org", port: 443, protocol: "tcp", bytesIn: 61_204_800, bytesOut: 22_915_600 },
        { host: "cdn.example.net", port: 443, protocol: "tcp", bytesIn: 11_318_400, bytesOut: 1_621_900 },
        { host: "mail.example.org", port: 993, protocol: "tcp", bytesIn: 2_904_300, bytesOut: 307_450 },
        { host: "updates.example.net", port: 80, protocol: "tcp", bytesIn: 918_300, bytesOut: 45_920 },
        { host: "time.example.org", port: 123, protocol: "udp", bytesIn: 41_760, bytesOut: 6_360 },
      ],
    },
  };
}

/* ---------------- probe parsers (pure; fixtures in the tests) ---------------- */

/** /proc/net/dev text → [{ name, rxBytes, txBytes }] in file order. */
export function parseProcNetDev(text) {
  const out = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.match(/^\s*([^:\s]+):\s*(\d+)(?:\s+\d+){7}\s+(\d+)/);
    if (m) out.push({ name: m[1], rxBytes: Number(m[2]), txBytes: Number(m[3]) });
  }
  return out;
}

/**
 * A sequence of /proc/net/dev reads ([{ name, rxBytes, txBytes,
 * at }] with `at` in seconds) → per-interface rate strips:
 * [{ name, series: [{ in, out }] }] with rates in bytes/s
 * between consecutive reads. Interfaces with no reads in common
 * drop out; loopback keeps its place only when it is all there
 * is. Order: busiest first (the primary leads).
 */
export function seriesFromReads(reads) {
  if (!reads || reads.length < 2) return [];
  const byName = new Map();
  for (const read of reads) {
    for (const iface of read.ifaces) {
      if (!byName.has(iface.name)) byName.set(iface.name, []);
      byName.get(iface.name).push({ ...iface, at: read.at });
    }
  }
  const strips = [];
  for (const [name, samples] of byName) {
    if (samples.length < 2) continue;
    const series = [];
    for (let i = 1; i < samples.length; i++) {
      const dt = samples[i].at - samples[i - 1].at;
      if (!(dt > 0)) continue;
      series.push({
        in: Math.max(0, Math.round((samples[i].rxBytes - samples[i - 1].rxBytes) / dt)),
        out: Math.max(0, Math.round((samples[i].txBytes - samples[i - 1].txBytes) / dt)),
      });
    }
    if (series.length) {
      const total = series.reduce((n, s) => n + s.in + s.out, 0);
      strips.push({ name, series, total });
    }
  }
  strips.sort((a, b) => b.total - a.total);
  const nonLoop = strips.filter((s) => s.name !== "lo");
  const picked = nonLoop.length ? nonLoop : strips;
  return picked.map(({ name, series }) => ({ name, series }));
}

/** `lpstat -p` text → [{ name, state }] ("printer X is idle." etc.). */
export function parseLpstat(text) {
  const out = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.match(/^printer\s+(\S+)\s+(is idle|is printing|disabled|enabled)/);
    if (m) out.push({ name: m[1], state: m[2] === "is idle" ? "idle" : m[2] });
  }
  return out;
}

/**
 * `lpq` text (the default queue) → jobs [{ name, pages, status }].
 * lpq does not report page counts, so pages is null — the card
 * says so rather than inventing a number. The "active" rank is
 * the job being printed; the rest are queued.
 */
export function parseLpq(text) {
  const jobs = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.match(/^(\S+)\s+\S+\s+(\d+)\s+(.+?)\s+(\d+)\s+bytes?\s*$/);
    if (m) {
      jobs.push({
        name: m[3].trim(),
        pages: null,
        status: m[1] === "active" ? "printing" : "queued",
      });
    }
  }
  return jobs;
}

/**
 * `ss -tin` text → connections [{ host, port, protocol,
 * bytesIn, bytesOut }]: established TCP sockets, the remote
 * endpoint, and the byte counts ss reports on the following
 * info line when it does (bytes_received is what arrived here,
 * so it is bytesIn). Sorted by traffic, capped at eight.
 */
export function parseSs(text) {
  const lines = String(text || "").split("\n");
  const conns = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s*ESTAB/.test(line)) continue;
    const cols = line.trim().split(/\s+/);
    // ESTAB Recv-Q Send-Q Local Peer [Process]
    const peer = cols[4] || "";
    const cut = peer.lastIndexOf(":");
    if (cut < 1) continue;
    let host = peer.slice(0, cut);
    host = host.replace(/^\[|\]$/g, "").replace(/%.*$/, "");
    const port = Number(peer.slice(cut + 1));
    if (!host || !Number.isFinite(port)) continue;
    let bytesIn = 0;
    let bytesOut = 0;
    const info = lines[i + 1] || "";
    const recv = info.match(/bytes_received:(\d+)/);
    const sent = info.match(/bytes_sent:(\d+)/);
    if (recv) bytesIn = Number(recv[1]);
    if (sent) bytesOut = Number(sent[1]);
    conns.push({ host, port, protocol: "tcp", bytesIn, bytesOut });
  }
  conns.sort((a, b) => (b.bytesIn + b.bytesOut) - (a.bytesIn + a.bytesOut));
  return conns.slice(0, 8);
}

/** `df -P -h` text → up to two local volumes, largest first. */
export function parseDf(text) {
  const vols = [];
  const toGB = (s) => {
    const m = String(s).match(/^([\d.]+)([KMGT])?$/);
    if (!m) return 0;
    const n = Number(m[1]);
    return Math.round(m[2] === "T" ? n * 1024 : m[2] === "G" ? n : m[2] === "M" ? n / 1024 : n / 1048576);
  };
  for (const line of String(text || "").split("\n")) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 6 || !cols[0].startsWith("/dev/")) continue;
    const sizeGB = toGB(cols[1]);
    const freeGB = toGB(cols[3]);
    if (!(sizeGB > 0)) continue;
    const mount = cols.slice(5).join(" ");
    vols.push({
      name: mount === "/" ? "Volume — System" : `Volume — ${mount.split("/").pop() || mount}`,
      kind: "storage",
      sizeGB,
      freeGB,
      state: `${sizeGB} GB · ${freeGB} GB free`,
    });
  }
  vols.sort((a, b) => b.sizeGB - a.sizeGB);
  return vols.slice(0, 2);
}

/**
 * /proc/bus/input/devices text → { keyboard?, pointer? }: the
 * devices whose handlers carry kbd / a mouse, named as the
 * machine names them. Several devices can carry kbd (a power
 * button does), so a candidate whose NAME says what it is
 * wins over the merely first.
 */
export function parseInputDevices(text) {
  const keyboards = [];
  const pointers = [];
  for (const block of String(text || "").split(/\n\s*\n/)) {
    const name = (block.match(/N:\s*Name="([^"]+)"/) || [])[1];
    const handlers = (block.match(/H:\s*Handlers=([^\n]+)/) || [])[1] || "";
    if (!name) continue;
    if (/\bkbd\b/.test(handlers)) keyboards.push(name);
    if (/\bmouse\d*\b/.test(handlers)) pointers.push(name);
  }
  const pick = (names, hint) =>
    names.find((n) => hint.test(n)) || names[0] || null;
  const out = {};
  const kb = pick(keyboards, /keyboard/i);
  if (kb) out.keyboard = { name: kb, kind: "keyboard", state: "connected" };
  const ptr = pick(pointers, /mouse|pointer|trackball|touchpad/i);
  if (ptr) out.pointer = { name: ptr, kind: "pointer", state: "connected" };
  return out;
}

/**
 * Assemble a real snapshot from probe texts — pure, so the
 * tests drive it with fixtures. `probes` carries any of:
 * { lpstat, lpq, ss, df, inputDevices, netDevReads }. Absent
 * probes and empty results simply omit their section.
 */
export function environmentFromProbes(probes = {}) {
  const env = { sample: false, devices: {}, network: { interfaces: [], connections: [] } };
  const printers = probes.lpstat ? parseLpstat(probes.lpstat) : [];
  if (printers.length) {
    const queue = probes.lpq ? parseLpq(probes.lpq) : [];
    const first = printers[0];
    env.devices.printer = {
      name: first.name,
      kind: "printer",
      state: queue.length
        ? `${first.state} — ${queue.length} job${queue.length === 1 ? "" : "s"} queued`
        : first.state,
      queue,
    };
  }
  const inputs = probes.inputDevices ? parseInputDevices(probes.inputDevices) : {};
  if (inputs.keyboard) env.devices.keyboard = inputs.keyboard;
  if (inputs.pointer) env.devices.pointer = inputs.pointer;
  const vols = probes.df ? parseDf(probes.df) : [];
  if (vols.length) {
    env.devices.volumes = vols.map((v, i) => ({ ...v, slug: `volume-${i + 1}` }));
  }
  if (probes.netDevReads) env.network.interfaces = seriesFromReads(probes.netDevReads);
  if (probes.ss) env.network.connections = parseSs(probes.ss);
  return env;
}

/* ---------------- main ---------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function probe(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null; // unavailable is an answer, not an error
  }
}

function readFileOrNull(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

async function collectRealProbes() {
  const probes = {};
  const lpstat = probe("lpstat", ["-p"]);
  if (lpstat != null) {
    probes.lpstat = lpstat;
    const lpq = probe("lpq", []);
    if (lpq != null) probes.lpq = lpq;
  }
  // No state filter on the ss call: a filter makes ss drop the
  // State column the parser anchors on; parseSs keeps ESTAB only.
  const ss = probe("ss", ["-tin"]);
  if (ss != null) probes.ss = ss;
  const df = probe("df", ["-P", "-h"]);
  if (df != null) probes.df = df;
  const inputDevices = readFileOrNull("/proc/bus/input/devices");
  if (inputDevices != null) probes.inputDevices = inputDevices;
  // Interface counters: a dozen reads over about six seconds —
  // the strip is the change between reads, so the snapshot
  // carries a captured strip like the waveform's tracks.
  if (readFileOrNull("/proc/net/dev") != null) {
    const reads = [];
    for (let i = 0; i < 13; i++) {
      const text = readFileOrNull("/proc/net/dev");
      if (text == null) break;
      reads.push({ at: i * 0.5, ifaces: parseProcNetDev(text) });
      if (i < 12) await sleep(500);
    }
    if (reads.length >= 2) probes.netDevReads = reads;
  }
  return probes;
}

export function serializeEnvironment(env) {
  return `${JSON.stringify(env, null, 1)}\n`;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const args = process.argv.slice(2);
  const real = args.includes("--real");
  const outIdx = args.indexOf("--out");
  const toolsDir = path.dirname(fileURLToPath(import.meta.url));
  const outPath = outIdx >= 0
    ? path.resolve(args[outIdx + 1])
    : path.join(toolsDir, "..", "src", "environment.json");
  const env = real
    ? environmentFromProbes(await collectRealProbes())
    : buildSampleEnvironment();
  const json = serializeEnvironment(env);
  writeFileSync(outPath, json);
  const devCount = Object.values(env.devices).reduce(
    (n, d) => n + (Array.isArray(d) ? d.length : 1), 0,
  );
  console.log(
    `environment.json (${real ? "REAL — review before committing" : "sample"}): ` +
      `${devCount} devices, ${env.network.interfaces.length} interfaces, ` +
      `${env.network.connections.length} connections, ${json.length} bytes of JSON`,
  );
}
