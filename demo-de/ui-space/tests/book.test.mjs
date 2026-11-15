import test from "node:test";
import assert from "node:assert/strict";

import {
  BOOK,
  BOOK_TOTALS,
  SPREAD_COUNT,
  bookTable,
  bookNodeById,
  bookPages,
  bookPageById,
  bookSpreads,
  spreadIndexForPage,
} from "../src/book.js";
import {
  isSubnodeObject,
  subnodeRootOf,
  subnodeById,
  subnodesFor,
  subnodeParentOf,
} from "../src/subnodes.js";
import {
  OBJECTS,
  LAYOUTS,
  labeledObjects,
  EVENTS,
  backChainLevels,
  resolveBackLevels,
  resolveFAction,
  createDescent,
  descend,
  createBookAccess,
  bookTierChain,
  bookAccessTo,
  climbBookAccess,
  bookAccessDepth,
  bookAccessedId,
  bookAccessChapter,
  bookAccessSection,
  bookPageOutId,
  stepSpread,
} from "../src/space-state.js";
import { resolveKeyboard } from "../src/keyboard.js";

/* Independent recounts over the raw BOOK data — the expectations
 * are computed here from the book's text itself, never from the
 * module's own derived table. */
const wordsOf = (text) => String(text).split(/\s+/).filter(Boolean).length;
const pageWords = (p) => wordsOf(p.title) + p.lines.reduce((n, ln) => n + wordsOf(ln), 0);
const RAW_PAGES = BOOK.chapters.flatMap((c) => c.sections.flatMap((s) => s.pages));
const RAW_WORDS = RAW_PAGES.reduce((n, p) => n + pageWords(p), 0);

/* ---------------- the book as data ---------------- */

test("the book: three chapters, nine sections, twenty pages", () => {
  assert.equal(BOOK.chapters.length, 3);
  assert.deepEqual(BOOK.chapters.map((c) => c.sections.length), [3, 3, 3]);
  assert.deepEqual(
    BOOK.chapters.map((c) => c.sections.reduce((n, s) => n + s.pages.length, 0)),
    [6, 7, 7],
  );
  assert.equal(RAW_PAGES.length, 20);
  assert.deepEqual(BOOK_TOTALS, { chapters: 3, sections: 9, pages: 20, words: RAW_WORDS });
  for (const p of RAW_PAGES) {
    assert.ok(p.lines.length >= 2 && p.lines.length <= 4, "every page carries 2–4 lines");
    assert.ok(p.title.length > 0, "every page is titled");
  }
});

test("the tier table: word counts roll up, ids are unique name paths", () => {
  const { root, all, pages } = bookTable();
  assert.equal(root.id, "book");
  assert.equal(root.name, BOOK.title);
  assert.equal(root.value, RAW_WORDS, "the book's value is its word count");
  assert.equal(root.pageCount, 20);
  assert.equal(new Set(all.map((n) => n.id)).size, all.length, "ids unique");
  assert.equal(all.length, 1 + 3 + 9 + 20);
  for (const n of all) {
    if (n.kind === "root") continue;
    assert.ok(n.id.startsWith("book/"), "ids are name paths under the root");
    assert.equal(n.id.split("/").length, n.depth + 1);
    assert.equal(n.path.length, n.depth + 1);
    assert.equal(n.path[n.path.length - 1], n.name);
  }
  for (const ch of root.children) {
    const rawCh = BOOK.chapters.find((c) => c.name === ch.name);
    const expect = rawCh.sections.flatMap((s) => s.pages).reduce((n, p) => n + pageWords(p), 0);
    assert.equal(ch.value, expect, `chapter ${ch.name} sums its pages`);
    assert.equal(ch.pageCount, rawCh.sections.reduce((n, s) => n + s.pages.length, 0));
    for (const sec of ch.children) {
      const rawSec = rawCh.sections.find((s) => s.name === sec.name);
      assert.equal(sec.value, rawSec.pages.reduce((n, p) => n + pageWords(p), 0));
      assert.equal(sec.parentId, ch.id);
    }
  }
  assert.equal(pages.length, 20);
  pages.forEach((p, i) => {
    assert.equal(p.number, i + 1, "pages are numbered in reading order");
    assert.equal(p.value, pageWords(RAW_PAGES[i]), "a page's value is its word count");
    assert.equal(p.isLeaf, true);
  });
  assert.equal(bookPages()[0].title, "A Sample Book of the Space", "the first page is the title page");
});

test("the arc layout: children partition their parent's arc by value", () => {
  const { root } = bookTable();
  assert.ok(Math.abs(root.a0) < 1e-12 && Math.abs(root.a1 - Math.PI * 2) < 1e-12,
    "the book spans the whole circle");
  const walk = (n) => {
    let at = n.a0;
    for (const c of n.children) {
      assert.ok(Math.abs(c.a0 - at) < 1e-9, "children are contiguous");
      assert.ok(c.a1 > c.a0, "every arc has span");
      assert.ok(Math.abs((c.a1 - c.a0) / (n.a1 - n.a0) - c.value / n.value) < 1e-9,
        "spans are proportional to value");
      at = c.a1;
      walk(c);
    }
    if (n.children.length) {
      assert.ok(Math.abs(at - n.a1) < 1e-9, "children fill the parent's arc");
    }
  };
  walk(root);
});

/* ---------------- the provider ---------------- */

test("the provider: the book reads like every sub-node citizen", () => {
  assert.ok(isSubnodeObject("book"));
  const whole = subnodeRootOf("book");
  assert.deepEqual(whole, { id: "book", name: BOOK.title, value: RAW_WORDS });
  const nodes = subnodesFor("book");
  assert.equal(nodes.length, 3 + 9 + 20, "every tier under the root is rendered and addressed");
  // Shares read against the book, and each tier's set sums to 1.
  for (const depth of [1, 2, 3]) {
    const sum = nodes.filter((n) => n.depth === depth).reduce((s, n) => s + n.share, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `tier ${depth} shares sum to 1`);
  }
  const page = subnodeById("book", "book/the-room/the-platter/title-page");
  assert.equal(page.depth, 3);
  assert.equal(page.isLeaf, true);
  assert.deepEqual(page.path, [BOOK.title, "The Room", "The Platter", "A Sample Book of the Space"]);
  assert.equal(subnodeParentOf("book", page.id), "book/the-room/the-platter",
    "the parent walk answers with the parent tier's id");
  assert.equal(subnodeParentOf("book", "book/the-room"), "book");
  assert.equal(subnodeById("book", "book/nope"), null);
  assert.equal(bookPageById("book/the-room"), null, "a chapter is not a page");
  assert.equal(bookNodeById("book/going-in/the-book-itself/colophon").number, 20);
});

/* ---------------- the citizen registration ---------------- */

test("the citizen: the book is registered, plotted in every layout, labelled O", () => {
  const def = OBJECTS[OBJECTS.length - 1];
  assert.equal(def.id, "book");
  assert.equal(def.name, "Sample Book");
  for (const layout of Object.values(LAYOUTS)) {
    assert.ok(Array.isArray(layout.positions.book), "a plot in every layout");
  }
  const labeled = labeledObjects();
  assert.equal(labeled[labeled.length - 1].object.id, "book");
  assert.equal(labeled[labeled.length - 1].label, "O", "the thirteenth citizen takes the next derived letter");
});

/* ---------------- tier access ---------------- */

const CH = "book/the-hands";
const SEC = "book/the-hands/keys";
const PAGE = "book/the-hands/keys/the-click";

test("access: F walks chapter → section → page; the getters read the path", () => {
  let a = createBookAccess();
  assert.equal(bookAccessDepth(a), 0);
  assert.equal(bookAccessedId(a), null);
  assert.equal(bookPageOutId(a), null);
  a = bookAccessTo(a, CH);
  assert.deepEqual(a.path, [CH]);
  assert.equal(bookAccessChapter(a), CH);
  assert.equal(bookAccessSection(a), null);
  a = bookAccessTo(a, SEC);
  assert.deepEqual(a.path, [CH, SEC], "accessing a section carries its chapter with it");
  a = bookAccessTo(a, PAGE);
  assert.deepEqual(a.path, [CH, SEC, PAGE]);
  assert.equal(bookAccessDepth(a), 3);
  assert.equal(bookAccessedId(a), PAGE);
  assert.equal(bookPageOutId(a), PAGE, "at page depth the page stands out");
  // Access is a position, not a history: F on another chapter
  // moves the whole path there at once.
  a = bookAccessTo(a, "book/going-in");
  assert.deepEqual(a.path, ["book/going-in"]);
  assert.equal(bookPageOutId(a), null);
  // Foreign ids never move the access.
  assert.deepEqual(bookAccessTo(a, "mesa/demo-de"), a);
  assert.deepEqual(bookTierChain("book"), []);
  assert.deepEqual(bookTierChain(null), []);
});

test("access: the climb pops one tier at a time and rests at the whole book", () => {
  let a = bookAccessTo(createBookAccess(), PAGE);
  a = climbBookAccess(a);
  assert.deepEqual(a.path, [CH, SEC], "the page slides home first");
  assert.equal(bookPageOutId(a), null);
  a = climbBookAccess(a);
  assert.deepEqual(a.path, [CH]);
  a = climbBookAccess(a);
  assert.deepEqual(a.path, [], "then the whole book stands again");
  const rested = climbBookAccess(a);
  assert.deepEqual(rested.path, [], "climbing at the whole book is a no-op");
});

test("access: the book's tiers never disturb the sunbursts' descents", () => {
  let mesa = descend(createDescent(), "mesa", "demo-de/ui-space");
  const before = JSON.parse(JSON.stringify(mesa));
  let a = bookAccessTo(createBookAccess(), PAGE);
  a = climbBookAccess(a);
  assert.deepEqual(mesa, before, "book access leaves a descent untouched");
  // …and a descent leaves the book's access untouched.
  const bookBefore = JSON.parse(JSON.stringify(a));
  mesa = descend(mesa, "mesa", "demo-de/ui-space/src");
  assert.deepEqual(a, bookBefore);
});

/* ---------------- the back chain ---------------- */

test("the chain: book access counts at the descent tier, after descent", () => {
  const chain = { partFocus: true, descent: 1, bookAccess: 3, pending: true, card: true, selection: true };
  assert.deepEqual(backChainLevels(chain), [
    "partFocus", "descent", "bookAccess", "bookAccess", "bookAccess",
    "patch", "card", "selection",
  ]);
  // One back event pops the deepest access tier; GO_BACK_II pops two.
  const inBook = { bookAccess: 3, card: true, selection: true };
  assert.deepEqual(resolveBackLevels(inBook, EVENTS.CANCEL), ["bookAccess"]);
  assert.deepEqual(resolveBackLevels(inBook, EVENTS.GO_BACK_I), ["bookAccess"]);
  assert.deepEqual(resolveBackLevels(inBook, EVENTS.GO_BACK_II), ["bookAccess", "bookAccess"]);
  assert.deepEqual(resolveBackLevels(inBook, EVENTS.FINISH), []);
  assert.deepEqual(backChainLevels({ bookAccess: 0 }), [], "no access, no levels");
});

/* ---------------- resolveFAction ---------------- */

test("resolveFAction: the book's tiers split access, page-out and spread-turn", () => {
  const at = (over) => resolveFAction({
    hoverId: "book", currentId: "book", subId: CH, subTier: 1, ...over,
  });
  assert.deepEqual(at({}), { type: "bookAccess", targetId: "book", nodeId: CH });
  assert.deepEqual(at({ subId: SEC, subTier: 2 }), { type: "bookAccess", targetId: "book", nodeId: SEC });
  assert.deepEqual(at({ subId: PAGE, subTier: 3 }),
    { type: "bookPage", targetId: "book", nodeId: PAGE },
    "a page in the cylinder presentation comes out");
  assert.deepEqual(at({ subId: PAGE, subTier: 3, bookStyle: "spread" }),
    { type: "bookSpreadTo", targetId: "book", nodeId: PAGE },
    "a page in the spread presentation turns to its spread");
  // The book itself, with no tier addressed, opens as any citizen.
  assert.deepEqual(at({ subId: null, subTier: 0 }), { type: "open", targetId: "book" });
  // A live patch keeps its F, ahead of every book case.
  assert.deepEqual(
    resolveFAction({ pendingId: "mesa", hoverId: "book", currentId: "book", subId: PAGE, subTier: 3 }),
    { type: "completePatch", targetId: "book" },
  );
  // Another citizen's tiers never resolve as the book's.
  assert.deepEqual(
    resolveFAction({ hoverId: "cube", currentId: "cube", subId: PAGE, subTier: 3 }),
    { type: "open", targetId: "cube" },
  );
});

/* ---------------- spreads ---------------- */

test("spreads: the title page stands alone, then pages pair in reading order", () => {
  const spreads = bookSpreads();
  const pages = bookPages();
  assert.equal(spreads.length, 11);
  assert.equal(SPREAD_COUNT, 11);
  assert.equal(spreads[0].verso, null, "the first verso is blank");
  assert.equal(spreads[0].recto.id, pages[0].id, "the title page is the first recto");
  assert.deepEqual([spreads[1].verso.number, spreads[1].recto.number], [2, 3]);
  assert.deepEqual([spreads[9].verso.number, spreads[9].recto.number], [18, 19]);
  assert.equal(spreads[10].verso.number, 20);
  assert.equal(spreads[10].recto, null, "the last page leaves its recto blank");
  const seen = spreads.flatMap((s) => [s.verso, s.recto]).filter(Boolean).map((p) => p.id);
  assert.equal(new Set(seen).size, 20, "every page stands in exactly one spread");
  assert.equal(spreadIndexForPage(pages[0].id), 0);
  assert.equal(spreadIndexForPage(pages[1].id), 1);
  assert.equal(spreadIndexForPage(pages[19].id), 10);
  assert.equal(spreadIndexForPage("book/nope"), -1);
});

test("spreads: stepping clamps at the book's ends", () => {
  assert.equal(stepSpread(0, -1, SPREAD_COUNT), 0);
  assert.equal(stepSpread(0, 1, SPREAD_COUNT), 1);
  assert.equal(stepSpread(10, 1, SPREAD_COUNT), 10);
  assert.equal(stepSpread(10, -1, SPREAD_COUNT), 9);
  assert.equal(stepSpread(5, 1, SPREAD_COUNT), 6);
});

/* ---------------- the keyboard derivation ---------------- */

test("keyboard: U is BOOK STYLE only while the book is current; B/N flip in spread", () => {
  const capOf = (kb, code) => kb.caps.find((c) => c.code === code);
  const plain = resolveKeyboard({ scope: "space" });
  assert.equal(capOf(plain, "KeyU").binding, null, "no book, no BOOK STYLE cap");
  const cyl = resolveKeyboard({ scope: "space", bookStyle: "cylinder" });
  assert.equal(capOf(cyl, "KeyU").binding.label, "BOOK STYLE");
  assert.equal(capOf(cyl, "KeyU").binding.operator, true);
  assert.equal(capOf(cyl, "KeyB").binding.label, "ROTATE PLANE -",
    "in the cylinder presentation B still plane-spins");
  const spread = resolveKeyboard({ scope: "space", bookStyle: "spread", bookFlip: true });
  assert.equal(capOf(spread, "KeyB").binding.label, "SPREAD -");
  assert.equal(capOf(spread, "KeyN").binding.label, "SPREAD +");
  const labels = resolveKeyboard({ scope: "labels", bookStyle: "spread", bookFlip: true });
  assert.notEqual(capOf(labels, "KeyU").binding?.label, "BOOK STYLE",
    "in label scope U stays an address");
});
