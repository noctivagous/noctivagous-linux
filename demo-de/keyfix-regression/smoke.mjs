/**
 * Headless render smoke for the key-click fix: renderToString of
 * the five affected page Apps (REAL views — effects never run
 * under renderToString, so no WebGL is needed) plus two unaffected
 * pages (horizon, definition) to show no collateral. Run from
 * demo-de/:  node keyfix-regression/smoke.mjs  (needs jsdom,
 * npm install --no-save jsdom).
 */
import { JSDOM } from "jsdom";
import * as esbuild from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
const w = dom.window;
for (const k of [
  "window", "document", "navigator", "location", "history",
  "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement",
  "Element", "Node", "Text", "Comment", "DocumentFragment", "SVGElement",
  "Event", "KeyboardEvent", "MouseEvent", "CustomEvent", "MutationObserver",
  "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame",
  "localStorage", "sessionStorage", "DOMParser", "XMLSerializer",
  "Blob", "File", "FileReader",
]) {
  try { globalThis[k] = w[k]; } catch { /* accessor-guarded */ }
}
globalThis.window = w;
globalThis.document = w.document;
globalThis.self = w;

const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "keyfix-smoke-"));
const bundlePath = path.join(outdir, "bundle.cjs");
await esbuild.build({
  entryPoints: [path.join(here, "smoke-entry.jsx")],
  bundle: true,
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  outfile: bundlePath,
  logLevel: "silent",
});
const require = createRequire(import.meta.url);
const X = require(bundlePath);

const pages = [
  ["treemap.html (affected, Pattern A)", X.TreemapApp, "ZOOMABLE TREEMAP IN 3D"],
  ["treemap-cube.html (affected, Pattern A)", X.TreemapCubeApp, "TREEMAP CUBE"],
  ["sunburst.html (affected, Pattern B)", X.SunburstApp, "ZUI VIEWER"],
  ["sunburst-cylinder.html (affected, Pattern B)", X.SunburstCylinderApp, "SUNBURST CYLINDER"],
  ["tangled.html (affected, Pattern B)", X.TangledApp, "TANGLED TREE"],
  ["horizon.html (unaffected)", X.HorizonApp, "ACTIVITY MONITOR"],
  ["definition.html (unaffected)", X.DefinitionApp, "DEFINITION — PANELIZATION"],
];
let failed = 0;
for (const [name, App, probe] of pages) {
  try {
    const html = X.renderToString(X.React.createElement(App));
    const ok = html.includes(probe) && html.length > 2000;
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${html.length} chars, probe "${probe}" ${html.includes(probe) ? "found" : "MISSING"}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name} — threw: ${err.message.split("\n")[0]}`);
  }
}
console.log(`\n${pages.length - failed}/${pages.length} pages rendered.`);
process.exit(failed ? 1 : 0);
