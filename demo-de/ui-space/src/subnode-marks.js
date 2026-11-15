/**
 * UI Space — the sub-node MARK index (slice 13-4, item C).
 *
 * A selection convention, held as plain data: for each citizen,
 * the set of its sub-nodes the user has MARKED. Pure — no React,
 * no three.js, no DOM — in the subnodes.js mould: SpaceApp holds
 * one of these in state, Enter toggles the hovered sub-node's
 * mark in the CURRENT citizen's index, and SpaceView renders a
 * marked node amber-outlined and held (the selected tier's
 * language), beside the hover tier's teal.
 *
 * Node ids are the providers' TRUE-ROOT path ids (subnodes.js;
 * the knot's part ids and the tree's branch ids ride the same
 * index through their own channels), so a citizen's descent —
 * a display re-rooting — never invalidates its marks: rendering
 * applies them to whichever nodes are visible. Marks persist
 * per citizen while the user moves around the space, and no
 * operation consumes them in this slice: the convention, its
 * display and its storage are the deliverable.
 *
 * Shape: { [citizenId]: [nodeId, ...] } — insertion-ordered,
 * duplicate-free; a citizen whose last mark is removed loses
 * its key, so an empty index is the empty object.
 */

export function createMarks() {
  return {};
}

/** The citizen's marked node ids, in the order they were marked. */
export function marksFor(marks, citizenId) {
  if (!marks || !citizenId) return [];
  const list = marks[citizenId];
  return Array.isArray(list) ? list : [];
}

export function isMarked(marks, citizenId, nodeId) {
  if (!nodeId) return false;
  return marksFor(marks, citizenId).includes(nodeId);
}

export function countMarks(marks, citizenId) {
  return marksFor(marks, citizenId).length;
}

/** Every mark in the space, across citizens. */
export function totalMarks(marks) {
  if (!marks) return 0;
  return Object.values(marks).reduce(
    (n, list) => n + (Array.isArray(list) ? list.length : 0), 0,
  );
}

/**
 * Toggle one node's mark in one citizen's index; returns a NEW
 * marks object (the input is never mutated). Toggling a marked
 * node unmarks it; toggling the citizen's last marked node
 * removes the citizen's key entirely.
 */
export function toggleMark(marks, citizenId, nodeId) {
  if (!citizenId || !nodeId) return marks || createMarks();
  const cur = marksFor(marks, citizenId);
  const next = isMarked(marks, citizenId, nodeId)
    ? cur.filter((id) => id !== nodeId)
    : [...cur, nodeId];
  const out = { ...(marks || {}) };
  if (next.length) out[citizenId] = next;
  else delete out[citizenId];
  return out;
}
