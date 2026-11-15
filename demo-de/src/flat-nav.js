/**
 * flat-nav.js — Flat Space's navigation state graph.
 *
 * The environment is a hierarchy of views: the shell opens a frame,
 * a frame opens subviews (a message being read, a treemap descended
 * into, a web page visited, the flow graph drilled into). This module
 * is the single record of where the user is in that hierarchy and
 * which mode the keyboard is in — the state the F / D / Esc operators
 * consult, so they behave the same in every frame:
 *
 *   F     clicks the addressee; when the click opens a subview, the
 *         subview is PUSHED here.
 *   D     goes back: pop the subview; at a frame's root, return to
 *         the frame the user came from; from there, Home.
 *   Esc   the big release, one rung at a time: text mode → target →
 *         subview → frame → rest.
 *
 * The keyboard mode is explicit state, not a guess from DOM focus
 * (the KeyPilot discipline: modes are entered and left deliberately,
 * and Esc leaves them):
 *
 *   mode "nav"   keys are operators and labels.
 *   mode "text"  keys are text for one field; only Esc is monitored.
 *
 * Pure and immutable-ish (functions return new state), node-tested
 * in tests/flat-nav.test.mjs.
 */

export const MODE_NAV = "nav";
export const MODE_TEXT = "text";

/** A view entry: the frame, the subview inside it ("root" for the
 *  frame itself), and the label the crumbs bar shows. */
export function viewOf(frame, view = "root", label = "") {
  return { frame, view, label };
}

export function createNav(homeFrame = "home", homeLabel = "HOME") {
  return {
    stack: [viewOf(homeFrame, "root", homeLabel)],
    frameFrom: null, // the frame openFrame was called from (D's target at a root)
    mode: MODE_NAV,
    textField: null, // label of the field being edited in text mode
  };
}

export function navTop(nav) {
  return nav.stack[nav.stack.length - 1];
}

export function navFrame(nav) {
  return navTop(nav).frame;
}

/** Open a frame: its root becomes the top of the stack. The frame we
 *  came from is remembered so D at the new frame's root can return. */
export function navOpenFrame(nav, frame, label) {
  const cur = navTop(nav);
  const from = cur && cur.frame !== frame ? cur.frame : nav.frameFrom;
  return {
    ...nav,
    stack: [viewOf(frame, "root", label)],
    frameFrom: from === frame ? null : from,
    mode: MODE_NAV,
    textField: null,
  };
}

/** Push a subview inside the current frame (F opened something). */
export function navPush(nav, view, label) {
  const top = navTop(nav);
  if (top.view === view) return nav; // already there — no duplicate rungs
  return { ...nav, stack: [...nav.stack, viewOf(top.frame, view, label)] };
}

/** Relabel / re-view the top rung in place (a treemap focus path
 *  changes without the hierarchy deepening per node). */
export function navSetTop(nav, view, label) {
  const stack = nav.stack.slice();
  stack[stack.length - 1] = viewOf(navTop(nav).frame, view, label);
  return { ...nav, stack };
}

/**
 * What D does, decided from the graph alone:
 *   { kind: "pop", view }   — a subview is open; close the top one.
 *   { kind: "frame", to }   — at a root; return to the frame we came from.
 *   { kind: "home" }        — at a root with no origin; go Home.
 *   { kind: "rest" }        — at Home's root; nothing to go back to.
 */
export function navBackPlan(nav, homeFrame = "home") {
  const top = navTop(nav);
  if (top.view !== "root") return { kind: "pop", view: top };
  if (nav.frameFrom && nav.frameFrom !== top.frame) return { kind: "frame", to: nav.frameFrom };
  if (top.frame !== homeFrame) return { kind: "home" };
  return { kind: "rest" };
}

/** Apply a "pop" plan: drop the top rung. */
export function navPop(nav) {
  if (nav.stack.length <= 1) return nav;
  return { ...nav, stack: nav.stack.slice(0, -1) };
}

/** Enter text mode for a field (F clicked it, or the pointer did). */
export function navEnterText(nav, fieldLabel) {
  return { ...nav, mode: MODE_TEXT, textField: fieldLabel };
}

/** Leave text mode (Esc, or the field losing focus). */
export function navExitText(nav) {
  return { ...nav, mode: MODE_NAV, textField: null };
}

/** The crumbs path: frame label ▸ subview labels. */
export function navCrumbs(nav) {
  return nav.stack.map((v) => v.label).filter(Boolean);
}
