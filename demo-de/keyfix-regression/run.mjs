/**
 * Driven-key regression for the demo-de App-shell key-click
 * latency fix (Patterns A + B). See README.md in this directory.
 *
 * The point of the harness is the UNPACED burst: a sequence's
 * keystrokes are dispatched synchronously back-to-back inside a
 * single React act() block — no wall-clock delay and no render
 * between keystrokes — which is exactly the condition under which
 * the old shells swallowed F (stale closure) or let an 800 ms
 * buffer timer override a newer target (Pattern B). Timer
 * sequences then wait out the real 800 ms window (inside an async
 * act, so the timer's state updates flush) and assert on the
 * settled state.
 *
 * Assertions read the props each App passes its (stubbed) View —
 * the App's own state, no DOM scraping — plus the rendered readout
 * text where a sequence is about what the user would see.
 *
 * Run:  node keyfix-regression/run.mjs        (from demo-de/)
 * Needs jsdom (not a project dependency):  npm install --no-save jsdom
 */
import { JSDOM } from "jsdom";
import * as esbuild from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/* ---------------- jsdom globals (before any React loads) ---------------- */

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
  try { globalThis[k] = w[k]; } catch { /* some are accessor-guarded */ }
}
globalThis.window = w;
globalThis.document = w.document;
globalThis.self = w;
if (!globalThis.matchMedia) {
  globalThis.matchMedia = () => ({
    matches: false, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__viewProps = {};

/* ---------------- bundle the Apps with View stubs ---------------- */

const SHIMS = {
  "TreemapView.jsx": "shims/TreemapView.jsx",
  "TreemapCubeView.jsx": "shims/TreemapCubeView.jsx",
  "SunburstView.jsx": "shims/SunburstView.jsx",
  "SunburstCylinderView.jsx": "shims/SunburstCylinderView.jsx",
  "TangledView.jsx": "shims/TangledView.jsx",
};
const stubViews = {
  name: "stub-views",
  setup(build) {
    build.onResolve(
      { filter: /(TreemapView|TreemapCubeView|SunburstView|SunburstCylinderView|TangledView)\.jsx$/ },
      (args) => {
        // The shims (and the entry) import the REAL modules for
        // their pure helpers — let those resolve normally.
        if (args.importer.includes("keyfix-regression")) return null;
        const base = args.path.split("/").pop();
        return { path: path.join(here, SHIMS[base]) };
      },
    );
  },
};

const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "keyfix-regression-"));
const bundlePath = path.join(outdir, "bundle.cjs");
await esbuild.build({
  entryPoints: [path.join(here, "entry.jsx")],
  bundle: true,
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  outfile: bundlePath,
  plugins: [stubViews],
  logLevel: "silent",
});
const require = createRequire(import.meta.url);
const X = require(bundlePath);
const { React, act, createRoot } = X;

/* ---------------- driving machinery ---------------- */

function mount(App) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(React.createElement(App)); });
  return { container, root };
}
function unmount(m) {
  act(() => { m.root.unmount(); });
  m.container.remove();
}
function key(k) {
  window.dispatchEvent(new window.KeyboardEvent("keydown", { key: k }));
}
/** The unpaced burst: every keystroke inside ONE act block. */
function burst(...ks) { act(() => { for (const k of ks) key(k); }); }
/** A single keystroke, flushed (the paced case). */
function press(k) { act(() => { key(k); }); }
/** Wait out the real 800 ms buffer window, flushing its updates. */
async function waitWindow() {
  await act(async () => { await new Promise((r) => setTimeout(r, 950)); });
}

const results = [];
function check(seq, cond, detail) {
  results.push({ seq, ok: Boolean(cond), detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${seq} — ${detail}`);
}
function precondition(seq, cond, detail) {
  if (!cond) throw new Error(`precondition failed [${seq}]: ${detail}`);
}

/** A single-letter label that completes immediately (not a prefix). */
function exactOnlyLabel(entries, keyOf) {
  return entries.find((e) => {
    const k = keyOf(e);
    return k.length === 1 && !entries.some((o) => {
      const ok = keyOf(o);
      return ok.length > k.length && ok.startsWith(k);
    });
  });
}
/** A single-letter label that is exact AND starts a longer label. */
function prefixLabel(entries, keyOf) {
  return entries.find((e) => {
    const k = keyOf(e);
    return k.length === 1 && entries.some((o) => {
      const ok = keyOf(o);
      return ok.length > k.length && ok.startsWith(k);
    });
  });
}

/* ---------------- Pattern A: TreemapApp ---------------- */

async function treemapSequences() {
  const m = mount(X.TreemapApp);
  const props = () => globalThis.__viewProps.treemap;
  const rootNode = props().focusNode;
  const labels = X.labeledNodes(rootNode);
  const only = exactOnlyLabel(labels, (l) => l.label);
  precondition("treemap (a)", only, "an exact-only single-letter label exists at root focus");
  const { node, label } = only;
  burst(label, "F");
  if (node.children.length === 0) {
    check("treemap (a) target-then-F, unpaced",
      props().openLeaf === node && props().targetNode === node,
      `F opened the leaf "${node.name}" targeted by ${label} in the same burst`);
  } else {
    check("treemap (a) target-then-F, unpaced",
      props().focusNode === node,
      `F descended into "${node.name}" targeted by ${label} in the same burst`);
  }
  unmount(m);

  // Invariant: the wait-out-the-window targeting still works — a
  // label that is exact AND a prefix targets its node when the
  // 800 ms window lapses with no second letter.
  const m2 = mount(X.TreemapApp);
  const labels2 = X.labeledNodes(globalThis.__viewProps.treemap.focusNode);
  const pre = prefixLabel(labels2, (l) => l.label);
  precondition("treemap invariant", pre, "an exact+prefix label exists at root focus");
  press(pre.label);
  await waitWindow();
  check("treemap invariant prefix-then-window",
    globalThis.__viewProps.treemap.targetNode === pre.node,
    `window lapsing targeted the pending node "${pre.node.name}"`);
  unmount(m2);

  // (e) prefix, then Escape, then past the window: Escape leaves
  // the buffer behind, so the armed timer must not target the
  // pending node afterwards. (Second fix round, at the user's
  // word: F, D and Escape disarm the buffer on the Pattern A
  // pages too, as Pattern B's leaveBuffer does.)
  const m3 = mount(X.TreemapApp);
  const pre3 = prefixLabel(X.labeledNodes(globalThis.__viewProps.treemap.focusNode), (l) => l.label);
  precondition("treemap (e)", pre3, "an exact+prefix label exists at root focus");
  press(pre3.label);
  press("Escape");
  await waitWindow();
  check("treemap (e) prefix-then-Escape, past the window",
    globalThis.__viewProps.treemap.targetNode === null,
    `nothing targeted after Escape (pending was "${pre3.node.name}")`);
  unmount(m3);

  // (f) prefix, then F in the same burst, then past the window:
  // F clicks the current target (none yet — the pending node is
  // only a half-typed label) and leaves the buffer; no stale
  // retarget may follow.
  const m4 = mount(X.TreemapApp);
  const pre4 = prefixLabel(X.labeledNodes(globalThis.__viewProps.treemap.focusNode), (l) => l.label);
  precondition("treemap (f)", pre4, "an exact+prefix label exists at root focus");
  burst(pre4.label, "F");
  await waitWindow();
  check("treemap (f) prefix-then-F, past the window",
    globalThis.__viewProps.treemap.targetNode === null && globalThis.__viewProps.treemap.openLeaf === null,
    `no stale retarget after F (pending was "${pre4.node.name}")`);
  unmount(m4);

  // (g) prefix, then D, then past the window: the same disarm.
  const m5 = mount(X.TreemapApp);
  const pre5 = prefixLabel(X.labeledNodes(globalThis.__viewProps.treemap.focusNode), (l) => l.label);
  precondition("treemap (g)", pre5, "an exact+prefix label exists at root focus");
  press(pre5.label);
  press("d");
  await waitWindow();
  check("treemap (g) prefix-then-D, past the window",
    globalThis.__viewProps.treemap.targetNode === null,
    `no stale retarget after D (pending was "${pre5.node.name}")`);
  unmount(m5);
}

/* ---------------- Pattern A: TreemapCubeApp ---------------- */

async function cubeSequences() {
  const m = mount(X.TreemapCubeApp);
  const props = () => globalThis.__viewProps.treemapCube;
  const labels = X.cubeAddresses(props().focusNode);
  const only = exactOnlyLabel(labels, (l) => l.label);
  precondition("cube (a)", only, "an exact-only single-letter address exists at root focus");
  const { node, label } = only;
  burst(label, "F");
  if (node.children.length === 0) {
    check("cube (a) target-then-F, unpaced",
      props().openLeaf === node && props().targetNode === node,
      `F slid out the leaf "${node.name}" targeted by ${label} in the same burst`);
  } else {
    check("cube (a) target-then-F, unpaced",
      props().focusNode === node,
      `F re-formed the cube to "${node.name}" targeted by ${label} in the same burst`);
  }
  unmount(m);

  // (e)/(f) setup: at root focus no address is a prefix of a
  // longer one (only 10 pieces), so descend into the "query"
  // house first — its 29 pieces give two-letter addresses, and
  // "A" there is exact AND a prefix, pending the node "methods".
  const cubePrefixSetup = () => {
    const mm = mount(X.TreemapCubeApp);
    const pp = () => globalThis.__viewProps.treemapCube;
    const q = X.cubeAddresses(pp().focusNode).find((a) => a.node.name === "query");
    precondition("cube timer seqs", q, 'a root address names "query"');
    burst(q.label, "F");
    const pre = prefixLabel(X.cubeAddresses(pp().focusNode), (l) => l.label);
    precondition("cube timer seqs", pre, "an exact+prefix address exists inside query");
    return { mm, pp, pre };
  };

  // (e) prefix, then Escape, then past the window — the armed
  // timer must not target the pending node after Escape.
  {
    const { mm, pp, pre } = cubePrefixSetup();
    press(pre.label);
    press("Escape");
    await waitWindow();
    check("cube (e) prefix-then-Escape, past the window",
      pp().targetNode === null && pp().openLeaf === null,
      `nothing targeted after Escape (pending was "${pre.node.name}")`);
    unmount(mm);
  }

  // (f) prefix, then D, then past the window: the same disarm.
  {
    const { mm, pp, pre } = cubePrefixSetup();
    press(pre.label);
    press("d");
    await waitWindow();
    check("cube (f) prefix-then-D, past the window",
      pp().targetNode === null && pp().openLeaf === null,
      `no stale retarget after D (pending was "${pre.node.name}")`);
    unmount(mm);
  }
}

/* ---------------- Pattern B: SunburstCylinderApp ---------------- */

async function cylinderSequences() {
  // (a) exact-only letter, then F, unpaced: F must click the node
  // the letter just targeted.
  {
    const m = mount(X.SunburstCylinderApp);
    const props = () => globalThis.__viewProps.cylinder;
    const targets = props().keyTargets;
    const only = exactOnlyLabel(targets, (t) => t.key);
    precondition("cylinder (a)", only, "an exact-only single-letter key exists");
    burst(only.key, "F");
    if (only.node.children.length) {
      // A descent shows in the props as a zoom request for the node
      // (the cylinder App hands its View zoomReq, not a focus prop).
      check("cylinder (a) target-then-F, unpaced",
        props().zoomReq?.node === only.node,
        `F descended into "${only.node.name}" targeted by ${only.key} in the same burst`);
    } else {
      check("cylinder (a) target-then-F, unpaced",
        props().openNode === only.node && props().targetNode === only.node,
        `F pulled out "${only.node.name}" targeted by ${only.key} in the same burst`);
    }
    unmount(m);
  }

  // Shared setup for the timer sequences: a prefix letter P (exact
  // AND the start of longer labels) and a two-letter label P?.
  const setup = () => {
    const m = mount(X.SunburstCylinderApp);
    const props = () => globalThis.__viewProps.cylinder;
    const targets = props().keyTargets;
    const pre = prefixLabel(targets, (t) => t.key);
    precondition("cylinder timer seqs", pre, "an exact+prefix key exists");
    const two = targets.find((t) => t.key.length === 2 && t.key.startsWith(pre.key));
    precondition("cylinder timer seqs", two, `a two-letter label starts with ${pre.key}`);
    return { m, props, pre, two };
  };

  // (b) prefix keystroke arms the timer; the next keystroke
  // completes an exact two-letter label. After the window, the
  // target must still be the exact-match node — the stale pending
  // node must not override it.
  {
    const { m, props, pre, two } = setup();
    burst(pre.key, two.key[1]);
    check("cylinder (b) exact match acted immediately",
      props().targetNode === two.node,
      `burst ${pre.key}+${two.key[1]} targeted "${two.node.name}" (${two.key})`);
    await waitWindow();
    check("cylinder (b) no stale retarget after the window",
      props().targetNode === two.node,
      `target is still "${two.node.name}", not the pending "${pre.node.name}"`);
    unmount(m);
  }

  // (c) prefix, then Escape, then past the window: nothing may be
  // targeted afterwards.
  {
    const { m, props, pre } = setup();
    press(pre.key);
    press("Escape");
    await waitWindow();
    check("cylinder (c) prefix-then-Escape, past the window",
      props().targetNode === null && props().openNode === null && props().zoomReq === null,
      `nothing targeted after Escape (pending was "${pre.node.name}")`);
    unmount(m);
  }

  // (d) prefix, then F immediately, then past the window: F leaves
  // the buffer, and no stale retarget may follow the click.
  {
    const { m, props, pre } = setup();
    burst(pre.key, "F");
    await waitWindow();
    check("cylinder (d) prefix-then-F, past the window",
      props().targetNode === null && props().openNode === null && props().zoomReq === null,
      `no stale retarget after F (pending was "${pre.node.name}")`);
    unmount(m);
  }
}

/* ---------------- Pattern B: SunburstApp (mesa) ---------------- */

async function sunburstSequences() {
  // (a-variant) A two-letter label typed unpaced: the second
  // keystroke must compose with the first (the buffer is the
  // handler's own, read fresh), so the TWO-letter node is acted
  // on — not whatever the second letter means alone.
  const m = mount(X.SunburstApp);
  const props = () => globalThis.__viewProps.sunburst;
  const targets = props().keyTargets;
  const two = targets.find((t) => t.key.length === 2 && t.node.children.length > 0)
    ?? targets.find((t) => t.key.length === 2);
  precondition("sunburst (a)", two, "a two-letter label exists");
  burst(two.key[0], two.key[1]);
  if (two.node.children.length) {
    check("sunburst (a) two-letter label, unpaced",
      props().focusNode === two.node,
      `burst ${two.key[0]}+${two.key[1]} descended into "${two.node.name}" (${two.key})`);
  } else {
    check("sunburst (a) two-letter label, unpaced",
      props().selected === two.node,
      `burst ${two.key[0]}+${two.key[1]} read out "${two.node.name}" (${two.key})`);
  }
  unmount(m);

  // Invariant: prefix, Escape, past the window — nothing acted on,
  // and the buffer is empty again.
  const m2 = mount(X.SunburstApp);
  const props2 = () => globalThis.__viewProps.sunburst;
  const rootNode = props2().focusNode;
  const pre = prefixLabel(props2().keyTargets, (t) => t.key);
  precondition("sunburst invariant", pre, "an exact+prefix key exists");
  press(pre.key);
  press("Escape");
  await waitWindow();
  check("sunburst invariant prefix-Escape-window",
    props2().focusNode === rootNode && props2().selected === null
      && m2.container.textContent.includes("buffer:"),
    "nothing descended or selected; the page settled back at root");
  unmount(m2);
}

/* ---------------- Pattern B: TangledApp ---------------- */

async function tangledSequences() {
  const layout = X.constructTangleLayout(X.TANGLE_LEVELS);
  // (a-variant) A two-letter label typed unpaced must click the
  // figure the two letters name together.
  const m = mount(X.TangledApp);
  const props = () => globalThis.__viewProps.tangled;
  const labelFor = props().labelFor;
  const twoEntry = layout.nodes
    .map((n) => ({ id: n.id, label: labelFor(n.id) }))
    .find((e) => e.label && e.label.length === 2);
  precondition("tangled (a)", twoEntry, "a two-letter figure label exists");
  burst(twoEntry.label[0], twoEntry.label[1]);
  check("tangled (a) two-letter label, unpaced",
    props().selectedId === twoEntry.id
      && m.container.textContent.includes(twoEntry.id.toUpperCase()),
    `burst ${twoEntry.label[0]}+${twoEntry.label[1]} clicked "${twoEntry.id}" (${twoEntry.label})`);
  unmount(m);

  // Invariant: prefix, Escape, past the window — nothing selected.
  const m2 = mount(X.TangledApp);
  const props2 = () => globalThis.__viewProps.tangled;
  const preEntry = layout.nodes
    .map((n) => ({ id: n.id, label: props2().labelFor(n.id) }))
    .find((e) => e.label && e.label.length === 1
      && layout.nodes.some((n) => {
        const l = props2().labelFor(n.id);
        return l && l.length > 1 && l.startsWith(e.label);
      }));
  precondition("tangled invariant", preEntry, "an exact+prefix figure label exists");
  press(preEntry.label);
  press("Escape");
  await waitWindow();
  check("tangled invariant prefix-Escape-window",
    props2().selectedId === null,
    "nothing selected after Escape and the window");
  unmount(m2);
}

/* ---------------- run ---------------- */

const suites = [
  ["TreemapApp", treemapSequences],
  ["TreemapCubeApp", cubeSequences],
  ["SunburstCylinderApp", cylinderSequences],
  ["SunburstApp", sunburstSequences],
  ["TangledApp", tangledSequences],
];
for (const [name, fn] of suites) {
  try {
    await fn();
  } catch (err) {
    results.push({ seq: name, ok: false, detail: `ERROR: ${err.message}` });
    console.log(`ERROR ${name} — ${err.message}`);
  }
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
