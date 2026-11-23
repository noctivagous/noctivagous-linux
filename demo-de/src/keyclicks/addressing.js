/* Key-clicks · addressing — the pure half of the subsystem.
 *
 * Which elements are addressable, how labels are assigned and
 * resolved, and which controls count as text entry. No state, no
 * listeners: the engine (engine.js) drives these. The label algebra
 * mirrors the environment's own implementation (src/flat-keys.js):
 * the operator keys C D F V are never addresses, a buffer resolves
 * when it is exact and not a prefix of a longer label, and a buffer
 * lives for 1600 ms.
 *
 * The DOM contract this encodes is written down in
 * KEYCLICKS-AUDIT.md; the shell renders to it.
 */

export const LABEL_ALPHABET = "ABEGHIJKLMNOPQRSTUWXYZ";
export const BUFFER_MS = 1600;

export const ADDRESSABLE =
  "button, a[href], input, select, textarea, label, [tabindex], .nwin .titlebar, .dicon";

/** Two-letter labels once the alphabet is exhausted (AA, AB, ...). */
export function labelForIndex(i) {
  const A = LABEL_ALPHABET;
  if (i < A.length) return A[i];
  const j = i - A.length;
  return A[Math.floor(j / A.length)] + A[j % A.length];
}

/** Mirrors flat-keys.js resolveLabels: {status:'exact'|'prefix'|'none'}. */
export function resolveBuffer(items, buf) {
  const exact = items.find((m) => m.label === buf);
  if (exact && !items.some((m) => m.label !== buf && m.label.startsWith(buf)))
    return { status: "exact", item: exact };
  if (items.some((m) => m.label.startsWith(buf))) return { status: "prefix" };
  return { status: "none" };
}

/**
 * The text-entry guard, the repo's standing rule: only controls
 * whose job is entering text hold text mode. Sliders, checkboxes
 * and selects keep the operator keys — after a slider drag the
 * control keeps focus, and swallowing F/D there is what made the
 * keys read as dead on the demo-de pages.
 */
const TEXT_TYPES = ["text", "password", "search", "email", "url", "number", "tel"];
export function isTextEntryControl(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") return TEXT_TYPES.includes(el.type || "text");
  return false;
}

export function visible(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const cs = getComputedStyle(el);
  return cs.display !== "none" && cs.visibility !== "hidden";
}

export function nameOf(el) {
  const a =
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 22);
  return a || el.tagName.toLowerCase();
}

/** Visible addressables inside a root element, in DOM order. */
export function addressablesIn(root) {
  if (!root) return [];
  return [...root.querySelectorAll(ADDRESSABLE)].filter(
    (el) => visible(el) && !el.disabled,
  );
}
