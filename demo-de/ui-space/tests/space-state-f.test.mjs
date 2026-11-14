import test from "node:test";
import assert from "node:assert/strict";

import { resolveFAction } from "../src/space-state.js";

const INSPECT = ["media-1", "media-2", "clipboard"];

test("F opens the hovered object when nothing was clicked or Tabbed first", () => {
  assert.deepEqual(
    resolveFAction({ hoverId: "mesa", currentId: null, inspectIds: INSPECT }),
    { type: "open", targetId: "mesa" },
  );
});

test("hover wins over a different current object", () => {
  assert.deepEqual(
    resolveFAction({ hoverId: "drum", currentId: "mesa", inspectIds: INSPECT }),
    { type: "open", targetId: "drum" },
  );
});

test("F opens the current object when the cursor addresses nothing", () => {
  assert.deepEqual(
    resolveFAction({ hoverId: null, currentId: "cube", inspectIds: INSPECT }),
    { type: "open", targetId: "cube" },
  );
});

test("F with nothing addressed is a no-op", () => {
  assert.deepEqual(
    resolveFAction({ hoverId: null, currentId: null, inspectIds: INSPECT }),
    { type: "none", targetId: null },
  );
});

test("a live patch completes onto the addressed target", () => {
  assert.deepEqual(
    resolveFAction({ pendingId: "mesa", hoverId: "drum", currentId: "mesa", inspectIds: INSPECT }),
    { type: "completePatch", targetId: "drum" },
  );
  assert.deepEqual(
    resolveFAction({ pendingId: "mesa", hoverId: "mesa", currentId: "mesa", inspectIds: INSPECT }),
    { type: "none", targetId: null },
  );
});

test("media cards and the clipboard tray inspect on F", () => {
  assert.deepEqual(
    resolveFAction({ hoverId: "media-1", currentId: "mesa", inspectIds: INSPECT }),
    { type: "inspect", targetId: "media-1" },
  );
  assert.deepEqual(
    resolveFAction({ hoverId: "clipboard", currentId: null, inspectIds: INSPECT }),
    { type: "inspect", targetId: "clipboard" },
  );
});

test("the knot focuses a hovered part, and otherwise opens", () => {
  assert.deepEqual(
    resolveFAction({ hoverId: "knot", currentId: "knot", partId: "ingress", inspectIds: INSPECT }),
    { type: "partFocus", targetId: "knot", partId: "ingress" },
  );
  assert.deepEqual(
    resolveFAction({ hoverId: "knot", currentId: null, partId: null, inspectIds: INSPECT }),
    { type: "open", targetId: "knot" },
  );
  assert.deepEqual(
    resolveFAction({ hoverId: "mesa", currentId: "knot", partId: "ingress", inspectIds: INSPECT }),
    { type: "open", targetId: "mesa" },
  );
});
