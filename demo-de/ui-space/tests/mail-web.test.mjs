import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

import MAILBOX from "../src/mail.json" with { type: "json" };
import {
  mailTable, mailNodeById, messageById, recentMessages, folderNodes,
  folderCells, MAIL_TOTALS, isSampleMailbox,
} from "../src/mail.js";
import {
  subnodeById, subnodeRootOf, subnodesFor,
} from "../src/subnodes.js";
import {
  EVENTS, backChainLevels, resolveBackLevels, resolveFAction, resolveOpenAction,
  OBJECTS, RING_ITEMS, labeledRingItems, ringItemForLabel,
} from "../src/space-state.js";
import { labelForMedia } from "../src/media-library.js";
import {
  WEBFRAME, WEB_LAYOUT, WEB_TOTALS, layoutWebFrame, layoutWebSection,
  resolveWebLink, pushWebNav, popWebNav, wrapText,
} from "../src/webframe.js";

/* Slice 15: the mail citizen and the captured web frame.
 * Expectations are computed from the committed JSON directly
 * where the data is the subject, never from the module under
 * test alone. */

/* ---------------- the sample mailbox ---------------- */

test("mail.json: a SAMPLE mailbox whose folder totals are its message sums", () => {
  assert.equal(MAILBOX.sample, true);
  assert.ok(isSampleMailbox(MAILBOX));
  const walk = (f) => (f.messages || 0)
    + (f.children || []).reduce((n, c) => n + walk(c), 0);
  const total = MAILBOX.folders.reduce((n, f) => n + walk(f), 0);
  assert.equal(total, 246);
  assert.equal(MAIL_TOTALS.messages, total);
  const walkUnread = (f) => (f.unread || 0)
    + (f.children || []).reduce((n, c) => n + walkUnread(c), 0);
  assert.equal(MAILBOX.folders.reduce((n, f) => n + walkUnread(f), 0), 14);
  assert.equal(MAIL_TOTALS.unread, 14);
  // Projects carries no count of its own: it weighs its children.
  const projects = MAILBOX.folders.find((f) => f.id === "projects");
  assert.equal(walk(projects), 41);
  assert.equal(mailNodeById("mail/projects").value, 41);
  assert.equal(mailNodeById("mail/projects").unread, 5);
});

test("mail.json: 12 recent messages, each whole and in a real folder", () => {
  assert.equal(MAILBOX.messages.length, 12);
  assert.equal(MAIL_TOTALS.recent, 12);
  const folderIds = new Set();
  const collect = (f, prefix) => {
    const id = prefix ? `${prefix}/${f.id}` : f.id;
    folderIds.add(id);
    for (const c of f.children || []) collect(c, id);
  };
  for (const f of MAILBOX.folders) collect(f, "");
  const seen = new Set();
  for (const m of MAILBOX.messages) {
    assert.ok(!seen.has(m.id), `unique id ${m.id}`);
    seen.add(m.id);
    assert.ok(folderIds.has(m.folder), `${m.id} lives in ${m.folder}`);
    assert.ok(m.from && m.from.name && /@example\.(org|net|com)$/.test(m.from.address),
      `${m.id} writes from an example domain`);
    assert.ok(m.subject && m.date && m.snippet, `${m.id} carries its card fields`);
    assert.equal(m.body.length, 2, `${m.id} has a two-paragraph body`);
    for (const p of m.body) assert.ok(p.length > 40, `${m.id} body is prose, not a stub`);
  }
});

test("the mail table: folders roll up, messages are leaves of value 1", () => {
  const t = mailTable();
  assert.equal(t.root.value, 246);
  assert.equal(t.root.unread, 14);
  assert.equal(mailNodeById("mail/inbox").value, 46);
  assert.equal(mailNodeById("mail/inbox").unread, 9);
  assert.equal(mailNodeById("mail/archive").value, 128);
  for (const m of recentMessages()) {
    assert.equal(m.kind, "message");
    assert.equal(m.value, 1);
    assert.equal(messageById(m.id).id, m.id);
    assert.equal(messageById(m.messageId).subject, m.subject);
  }
  assert.equal(messageById("no-such-letter"), null);
  assert.equal(folderNodes().length, 6, "four folders + two subfolders");
});

test("the mail provider: subnodes.js serves folders and messages", () => {
  const root = subnodeRootOf("mail");
  assert.equal(root.value, 246);
  const inbox = subnodeById("mail", "mail/inbox");
  assert.equal(inbox.value, 46);
  assert.ok(Math.abs(inbox.share - 46 / 246) < 1e-9);
  const atlas = subnodeById("mail", "mail/projects/atlas");
  assert.deepEqual(atlas.path, ["Mail", "Projects", "Atlas"]);
  const msg = subnodeById("mail", "mail/msg/mesa-reads");
  assert.ok(msg && msg.name.length > 0);
  const all = subnodesFor("mail");
  const ids = all.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "sub-node ids are unique");
  assert.ok(ids.includes("mail/projects/space"));
  assert.ok(ids.includes("mail/msg/archive-wells"));
});

test("folderCells: areas are proportional to counts; children tile their parent", () => {
  const W = 32, H = 17;
  const cells = folderCells(W, H);
  const totalArea = W * H;
  const byId = new Map(cells.map((c) => [c.id, c]));
  // Every leaf folder has a cell, and only leaves do.
  assert.deepEqual(
    [...byId.keys()].sort(),
    ["mail/archive", "mail/inbox", "mail/projects/atlas", "mail/projects/space", "mail/sent"],
  );
  for (const c of cells) {
    const node = mailNodeById(c.id);
    const expected = (node.value / 246) * totalArea;
    assert.ok(Math.abs(c.w * c.h - expected) < 1e-6,
      `${c.id}: area ${c.w * c.h} ≈ its share ${expected}`);
    assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= W + 1e-9 && c.y + c.h <= H + 1e-9,
      `${c.id} stays inside the cabinet`);
  }
  // Projects' children tile the parent's (implied) cell exactly.
  const kids = ["mail/projects/atlas", "mail/projects/space"].map((id) => byId.get(id));
  assert.equal(kids[0].x, kids[1].x);
  assert.equal(kids[0].w, kids[1].w);
  const unionH = kids.reduce((n, c) => n + c.h, 0);
  const parentArea = (mailNodeById("mail/projects").value / 246) * totalArea;
  assert.ok(Math.abs(kids[0].w * unionH - parentArea) < 1e-6, "the union is the parent's cell");
});

/* ---------------- the back chain: docClose ---------------- */

test("docClose sits immediately after appClose in the release stack", () => {
  assert.deepEqual(
    backChainLevels({ docOpen: true, card: true, selection: true }),
    ["docClose", "card", "selection"],
  );
  assert.deepEqual(
    resolveBackLevels({ docOpen: true, card: true, selection: true }, EVENTS.CANCEL),
    ["docClose"],
    "one back closes the reading before anything beneath it",
  );
  assert.deepEqual(
    resolveBackLevels(
      { appNav: 1, appOpen: true, docOpen: true, partFocus: true }, EVENTS.GO_BACK_II),
    ["appNav", "appClose"],
    "the app's own levels still outrank the document tier",
  );
  assert.deepEqual(
    resolveBackLevels({ appOpen: true, docOpen: true, partFocus: true }, EVENTS.GO_BACK_II),
    ["appClose", "docClose"],
    "D from an app over a reading pops the app, then the document",
  );
  assert.deepEqual(
    resolveBackLevels({ docOpen: true, partFocus: true }, EVENTS.GO_BACK_II),
    ["docClose", "partFocus"],
    "D from a reading pops the reading, then the focus beneath",
  );
});

/* ---------------- F on the mail citizen ---------------- */

test("resolveFAction: a folder focuses, a letter opens", () => {
  assert.deepEqual(
    resolveFAction({ currentId: "mail", subId: "mail/inbox" }),
    { type: "partFocus", targetId: "mail", partId: "mail/inbox" },
  );
  assert.deepEqual(
    resolveFAction({ currentId: "mail", subId: "mail/projects/atlas" }),
    { type: "partFocus", targetId: "mail", partId: "mail/projects/atlas" },
  );
  assert.deepEqual(
    resolveFAction({ currentId: "mail", subId: "mail/msg/mesa-reads" }),
    { type: "openMessage", targetId: "mail", messageId: "mail/msg/mesa-reads" },
  );
  // With no sub-node addressed, F on the citizen itself opens its card.
  assert.deepEqual(
    resolveFAction({ currentId: "mail" }),
    { type: "open", targetId: "mail" },
  );
});

/* ---------------- the ring's second item ---------------- */

test("the ring derivation with two items: R Waveform, S Web, cards from T", () => {
  assert.deepEqual(RING_ITEMS.map((i) => i.id), ["audio", "web"]);
  assert.equal(OBJECTS.length, 15);
  assert.equal(OBJECTS[14].id, "mail");
  const labeled = labeledRingItems();
  assert.deepEqual(labeled.map(({ item, label }) => [item.id, label]),
    [["audio", "R"], ["web", "S"]]);
  assert.equal(ringItemForLabel("S").id, "web");
  assert.equal(ringItemForLabel("R").id, "audio");
  assert.equal(labelForMedia("media-1"), "T");
  assert.equal(labelForMedia("media-8"), "AA");
});

test("resolveOpenAction: the web app opens like the waveform app", () => {
  assert.deepEqual(
    resolveOpenAction({ targetId: "web", key: "f", labelMode: false }),
    { type: "openApp", appId: "web", mode: "center" },
  );
  assert.deepEqual(
    resolveOpenAction({ targetId: "web", key: "e", labelMode: false }),
    { type: "openApp", appId: "web", mode: "full" },
  );
  assert.equal(resolveOpenAction({ targetId: "web", key: "e", labelMode: true }), null);
  assert.equal(resolveOpenAction({ targetId: "mail", key: "f", labelMode: false }), null,
    "citizens bear no apps");
});

/* ---------------- the captured web frame ---------------- */

test("webframe.json: the Snow globe capture, attributed and within its cap", () => {
  const raw = readFileSync(new URL("../src/webframe.json", import.meta.url), "utf8");
  assert.ok(statSync(new URL("../src/webframe.json", import.meta.url)).size <= 30 * 1024,
    "the capture stays under the 30 KB cap");
  const fr = JSON.parse(raw);
  assert.equal(fr.source, "https://en.wikipedia.org/wiki/Snow_globe");
  assert.ok(fr.attribution.includes("CC BY-SA"), "the attribution rides in the capture");
  assert.ok(fr.captured, "a capture date is recorded");
  assert.equal(fr.title, "Snow globe");
  assert.ok(fr.sections.length >= 1 && fr.sections.length <= 8);
  for (const s of fr.sections) {
    assert.ok(s.heading, "every section is headed");
    assert.ok(s.paragraphs.length >= 1 && s.paragraphs.length <= 2,
      "paragraphs are trimmed to the first two");
    for (const l of s.links) assert.ok(l.text && /^https?:\/\//.test(l.href));
  }
  assert.deepEqual(WEBFRAME, fr, "the module serves the committed capture");
});

test("the web layout: ordered bands, real words, link spans inside the measure", () => {
  const L = layoutWebFrame();
  assert.deepEqual(L, WEB_LAYOUT);
  assert.equal(L.sections.length, WEBFRAME.sections.length);
  let lastY = -1;
  for (const s of L.sections) {
    assert.ok(s.y0 > lastY && s.y1 > s.y0, `${s.heading}: bands descend in order`);
    lastY = s.y1;
    assert.ok(s.words > 0, `${s.heading} has words`);
    for (const link of s.links) {
      assert.ok(link.x0 >= 0 && link.x1 > link.x0 && link.x1 <= L.width + 1e-9,
        `link "${link.text}" spans inside the sheet`);
      assert.ok(link.y0 >= s.y0 && link.y1 <= s.y1 + 1e-9, "the span sits in its section");
    }
  }
  assert.ok(WEB_TOTALS.words > 0 && WEB_TOTALS.links > 0);
  // The sheet's page: contents entries for every section, the
  // current one marked, body bands below the header.
  const page = layoutWebSection(1);
  assert.equal(page.toc.length, L.sections.length);
  assert.equal(page.toc.filter((e) => e.current).length, 1);
  assert.equal(page.toc[1].current, true);
  assert.equal(page.body.heading, L.sections[1].heading);
  assert.ok(page.body.y1 > page.body.y0);
});

test("resolveWebLink: a fragment naming a captured section is internal; the rest is not captured", () => {
  const history = WEB_LAYOUT.sections.findIndex((s) => s.heading === "History");
  assert.ok(history >= 0);
  assert.deepEqual(
    resolveWebLink({ text: "History", href: "#History" }),
    { type: "section", index: history },
  );
  assert.deepEqual(
    resolveWebLink({ text: "history", href: "https://en.wikipedia.org/wiki/Snow_globe#History" }),
    { type: "section", index: history },
    "a full URL to a captured section is internal too",
  );
  const external = resolveWebLink({ text: "Glass", href: "https://en.wikipedia.org/wiki/Glass" });
  assert.equal(external.type, "external");
  assert.equal(external.href, "https://en.wikipedia.org/wiki/Glass");
  assert.equal(
    resolveWebLink({ text: "x", href: "#No_Such_Section" }).type, "external",
    "an anchor to a section the capture did not keep is external",
  );
  // Every link the capture actually carries resolves — none is lost.
  for (const s of WEB_LAYOUT.sections) {
    for (const link of s.links) {
      const r = resolveWebLink(link);
      assert.ok(r.type === "section" || r.type === "external");
    }
  }
});

test("the web nav stack: pushes and pops by section, without mutation", () => {
  const s0 = [];
  const s1 = pushWebNav(s0, 0);
  const s2 = pushWebNav(s1, 3);
  assert.deepEqual(s0, [], "the empty stack is not mutated");
  assert.deepEqual(s2, [{ section: 0 }, { section: 3 }]);
  const popped = popWebNav(s2);
  assert.deepEqual(popped.entry, { section: 3 });
  assert.deepEqual(popped.stack, [{ section: 0 }]);
  assert.deepEqual(popWebNav([]), { stack: [], entry: null });
});

test("wrapText: the one wrap the layout and the painter share", () => {
  assert.deepEqual(wrapText("one two three four", 7), ["one two", "three", "four"]);
  assert.deepEqual(wrapText("", 10), []);
  assert.deepEqual(wrapText("  spaced   out  ", 10), ["spaced out"]);
});
