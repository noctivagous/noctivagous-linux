// Driven-key verification for FLAT SPACE (demo-de/index.html).
// Run from demo-de/:  node tests/flat-driven.mjs
// Spawns its own vite dev server on :5199 and drives headless Chromium
// (playwright-core borrowed from ~/workspace/layout-tools).
import { chromium } from "/home/hatch/workspace/layout-tools/node_modules/playwright-core/index.mjs";
import { spawn } from "node:child_process";

const EXE = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
};

const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore", detached: true });
try {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/`); if (r.ok) break; } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  let inFragment = false;
  page.on("console", (m) => {
    if (m.type() !== "error" || m.text().includes("favicon")) return;
    // The preserved fragment's stylesheet references font files that
    // were never in this repo (website/fonts/*.ttf) — pre-existing
    // 404s, unrelated to the move. Its script/style still load below.
    if (inFragment && m.text().startsWith("Failed to load resource")) return;
    errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() !== 404 || r.url().includes("favicon")) return;
    if (inFragment && r.url().includes("/website/fonts/")) return;
    errors.push(`404 ${r.url()}`);
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const echo = () => page.getByTestId("echo").innerText();
  const readout = () => page.getByTestId("readout").innerText();

  check("page loads: FLAT SPACE top bar", await page.locator(".fl-top strong").innerText().then((t) => t.includes("FLAT SPACE")));
const cardCount = () => page.locator("[data-gui-node]").evaluateAll((els) => els.filter((e) => /^gui:card:[^:]+$/.test(e.getAttribute("data-gui-node"))).length);
  check("home: 14 cards on the board", (await cardCount()) === 14);
  const stageBox = await page.locator(".fl-stage").boundingBox();
  check("stage fills the whole viewport (panels are overlays)", stageBox && stageBox.x === 0 && stageBox.y === 0 && stageBox.width === 1600 && stageBox.height === 1000, JSON.stringify(stageBox));

  // Label targeting: B = FILES card.
  await page.keyboard.press("b");
  check("type B targets FILES card", (await readout()).includes("FILES"));
  await page.keyboard.press("f");
  await page.waitForSelector(".fl-tm", { timeout: 3000 });
  check("F opens FILES: treemap renders", (await page.locator(".fl-tm-node").count()) > 10);
  check("files crumbs show the filesystem root", (await page.locator(".fl-crumbs").innerText()).includes("/"));

  // Keys descend into a branch (its surface is covered by its children,
  // so the label is the way in — that is the demo's point); D climbs back.
  // Pick a branch label that resolves immediately (not a prefix of a
  // longer label — those stay pending until the buffer timer flushes).
  const crumbsText = async () => (await page.locator(".fl-crumbs").innerText()).split("key buffer")[0].trim();
  const crumbsBefore = await crumbsText();
  const branchLabel = await page.evaluate(() => {
    const labels = [...document.querySelectorAll(".fl-tm-node .fl-chip")].map((c) => c.textContent.trim());
    for (const node of document.querySelectorAll(".fl-tm-node.branch")) {
      const l = node.querySelector(".fl-chip")?.textContent.trim();
      if (l && !labels.some((x) => x.length > l.length && x.startsWith(l))) return l;
    }
    return null;
  });
  check("an unambiguous branch label exists", Boolean(branchLabel), `label=${branchLabel}`);
  await page.keyboard.type(branchLabel.toLowerCase());
  await page.keyboard.press("f");
  await page.waitForTimeout(150);
  const crumbsAfter = await crumbsText();
  check("F on branch label descends", crumbsAfter.length > crumbsBefore.length, `${crumbsBefore} -> ${crumbsAfter}`);
  await page.keyboard.press("d");
  await page.waitForTimeout(150);
  const crumbsBack = await crumbsText();
  check("D climbs back to root crumbs", crumbsBack === crumbsBefore, `[${crumbsBefore}] vs [${crumbsBack}] echo=[${await echo()}]`);

  // Label inside files targets a node. "A" prefixes longer labels
  // (AA, AB…), so it stays pending until the 800 ms buffer flush.
  await page.keyboard.press("a");
  await page.waitForTimeout(950);
  check("type A (pending) flushes to first treemap node", (await readout()).includes("TARGET"));

  // Esc releases: target first, then frame -> home.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  check("Esc Esc returns HOME", (await cardCount()) === 14);

  // Monitor via label E + F (alphabet: A B E G H I J K — C is dolly out).
  await page.keyboard.press("e");
  await page.keyboard.press("f");
  await page.waitForSelector(".fl-lane", { timeout: 3000 });
  check("MONITOR: 8 lanes", (await page.locator(".fl-lane").count()) === 8);
  await page.keyboard.press("3");
  await page.waitForTimeout(100);
  check("key 3 focuses lane 3", (await page.locator(".fl-lane.focus .nm").innerText()).length > 0);
  await page.keyboard.press(" ");
  await page.waitForTimeout(100);
  check("Space holds time", (await echo()).includes("held"));
  await page.keyboard.press(" ");
  await page.keyboard.press("Escape"); // clears the lane target first
  await page.keyboard.press("Escape"); // pops the focused-lane subview (nav graph rung)
  await page.keyboard.press("Escape"); // then leaves the frame
  await page.waitForTimeout(500);
  check("Esc Esc Esc from monitor returns HOME", (await cardCount()) === 14);

  // Drag-lock on home: hover FILES card, Space, move, Space drops.
  const card = page.locator('[data-gui-node="gui:card:files"]');
  const box = await card.boundingBox();
  const leftBefore = await card.evaluate((el) => el.style.left);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(120);
  await page.keyboard.press(" ");
  await page.waitForTimeout(80);
  check("Space picks card up (DRAG LOCK)", (await echo()).includes("DRAG LOCK"));
  await page.mouse.move(box.x + 260, box.y + 150, { steps: 8 });
  await page.waitForTimeout(120);
  await page.keyboard.press(" ");
  await page.waitForTimeout(100);
  const leftAfter = await card.evaluate((el) => el.style.left);
  check("Space drops card at a new position", leftBefore !== leftAfter, `${leftBefore} -> ${leftAfter}`);

  // Keyboard panel: Alt+K, sparse board.
  await page.keyboard.press("Alt+k");
  await page.waitForSelector(".fl-keys", { timeout: 3000 });
  const caps = await page.locator(".fl-cap").count();
  const bound = await page.locator(".fl-cap.bound").count();
  check(`keyboard panel: sparse board (${bound}/${caps} bound)`, bound > 5 && bound < caps / 2);
  await page.keyboard.press("Alt+k");

  // Search: / then type, Enter opens first result.
  await page.keyboard.press("/");
  await page.waitForSelector(".fl-search input", { timeout: 3000 });
  await page.keyboard.type("sunburst");
  await page.waitForTimeout(200);
  check("search finds SUNBURST frame", (await page.locator(".fl-search").innerText()).includes("SUNBURST"));
  await page.keyboard.press("Enter");
  await page.waitForSelector(".fl-sb-svg", { timeout: 3000 });
  check("Enter opens SUNBURST frame", (await page.locator(".fl-sb-path").count()) > 5);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);

  // Mail: label H is MAIL card on home.
  check("back HOME for mail", (await cardCount()) === 14);
  // The cursor is still resting on the FILES card from the drag test,
  // and hover wins for F — move it to neutral chrome so the label
  // target is the addressee here.
  await page.mouse.move(20, 20);
  await page.waitForTimeout(100);
  await page.keyboard.press("h");
  await page.keyboard.press("f");
  await page.waitForSelector('[data-gui-node^="gui:mail:"]', { timeout: 3000 });
  check("MAIL: inbox messages listed", (await page.locator("[data-gui-node]").evaluateAll((els) => els.filter((e) => /^gui:mail:[^:]+$/.test(e.getAttribute("data-gui-node"))).length)) === 5);
  await page.locator('[data-gui-node^="gui:mail:"] .gui-panel-title').first().click();
  await page.waitForTimeout(120);
  check("click opens message in reading pane", (await page.locator('[data-gui-node="gui:read"] .gui-panel-title').innerText()).includes("Nightly backup"));
  await page.keyboard.press("d");
  await page.waitForTimeout(100);
  check("D backs to list (reading pane cleared)", (await page.locator('[data-gui-node="gui:read:body"]').innerText()).includes("Open a message with F"));

  // Compose: real text mode — F typed into a field must not click.
  await page.locator('[data-gui-node="gui:act:compose"]').click();
  await page.waitForSelector('[data-gui-node="gui:cmp-to"] input', { timeout: 3000 });
  // F clicks fields too: the TO field is label A in compose — target + F
  // puts the keyboard into it (text mode is state, shown on the chip).
  // (Mouse to neutral chrome first: hover wins for F, and the cursor is
  // resting where the COMPOSE button was.)
  await page.mouse.move(20, 20);
  await page.waitForTimeout(100);
  await page.keyboard.press("a");
  await page.keyboard.press("f");
  await page.waitForTimeout(120);
  check("F on the TO field enters text mode", (await page.locator(".fl-mode").innerText()).includes("TEXT")
    && (await page.evaluate(() => document.activeElement?.closest("[data-gui-node]")?.getAttribute("data-gui-node"))) === "gui:cmp-to");
  await page.keyboard.type("friend@example.com");
  await page.keyboard.type("fff"); // would be clicks outside text mode
  check("text mode: fff lands in the To field", (await page.inputValue('[data-gui-node="gui:cmp-to"] input')) === "friend@example.comfff");
  check("mode chip reads TEXT", (await page.locator(".fl-mode").innerText()).includes("TEXT"));
  await page.keyboard.press("Escape"); // exits text mode (blur)
  await page.click('[data-gui-node="gui:cmp-subject"] input');
  await page.keyboard.type("Driven test");
  await page.click('[data-gui-node="gui:cmp-body"] textarea');
  await page.keyboard.type("Sent by the driven-key harness.");
  await page.keyboard.press("Escape");
  // SEND follows the three fields in compose (labels A B E, SEND = G): target + F.
  // (Mouse off the body field first — fields are addressable now, so a
  // resting hover on one would win F.)
  await page.mouse.move(20, 20);
  await page.waitForTimeout(100);
  await page.keyboard.press("g");
  await page.keyboard.press("f");
  await page.waitForTimeout(200);
  check("SEND lands message in Sent", (await page.locator('[data-gui-node^="gui:mail:"] .gui-panel-title').first().innerText()).includes("Driven test"));

  // OVERLAYS: collapse the Inspector by clicking its overlay button,
  // then prove the keys still work afterwards (backtick home).
  await page.locator(".fl-insp .fl-collapse").click();
  await page.waitForTimeout(250);
  check("inspector overlay collapses", (await page.locator(".fl-insp").getAttribute("class")).includes("closed"));
  await page.keyboard.press("`");
  await page.waitForTimeout(100);
  check("keys work after overlay click: backtick reaches HOME", (await cardCount()) === 14);
  await page.locator(".fl-tab.right").click();
  await page.waitForTimeout(250);
  check("inspector reopens from its tab", !(await page.locator(".fl-insp").getAttribute("class")).includes("closed"));

  // DOLLY: V dollies into the targeted thing, C dollies back out.
  await page.mouse.move(20, 20);
  await page.keyboard.press("b"); // target FILES card
  await page.keyboard.press("v");
  await page.waitForTimeout(120);
  check("V dollies in (readout ×1.25)", (await readout()).includes("DOLLY") && (await readout()).includes("×1.25"));
  const tf = await page.locator(".fl-dolly").evaluate((el) => el.style.transform);
  check("dolly transform applied to the stage content", tf.includes("1.25"), tf);
  await page.keyboard.press("c");
  await page.waitForTimeout(120);
  check("C dollies back out to ×1", (await readout()).includes("×1"));

  // WEB: label I is the WEB card. Links are subnodes; D is history back.
  await page.keyboard.press("i");
  await page.keyboard.press("f");
  await page.waitForSelector('[data-gui-node="gui:page"]', { timeout: 3000 });
  check("WEB: start page renders", (await page.locator('[data-gui-node="gui:page"] .gui-panel-title').innerText()).includes("Start"));
  await page.keyboard.press("b"); // first link on the page (A is the address field now)
  await page.keyboard.press("f");
  await page.waitForTimeout(200);
  check("F follows a link to the article", (await page.locator('[data-gui-node="gui:page"] .gui-panel-title').innerText()).includes("Installation guide"));
  await page.keyboard.press("d");
  await page.waitForTimeout(150);
  check("D is history back to Start", (await page.locator('[data-gui-node="gui:page"] .gui-panel-title').innerText()).includes("Start"));
  await page.keyboard.press("Escape"); // leave the frame
  await page.waitForTimeout(100);

  // FLOW: label J is the FLOW card. The graph renders frames,
  // subnodes and the six gap nodes; F on a node goes to the thing.
  await page.keyboard.press("j");
  await page.keyboard.press("f");
  await page.waitForSelector(".fl-flow-svg", { timeout: 3000 });
  const flowNodes = await page.locator(".fl-flow-node").count();
  check(`FLOW: graph renders frame + subnode nodes (${flowNodes})`, flowNodes > 40);
  check("FLOW: no gap nodes left — every usual activity has a frame", (await page.locator(".fl-flow-gap").count()) === 0);
  check("FLOW: availability strip lists 11 activities", (await page.locator(".fl-act-chip").count()) === 11);
  check("FLOW: no activities marked not yet", (await page.locator(".fl-act-chip.gap").count()) === 0);
  const jumpLabel = await page.evaluate(() => {
    const gs = [...document.querySelectorAll(".fl-flow-svg g")];
    const idx = gs.findIndex((g) => g.querySelector("text")?.textContent === "var");
    return idx > 0 ? document.querySelectorAll(".fl-flow-chip")[idx - 1]?.textContent.trim() : null;
  });
  check("found the FILES var subnode in the graph", Boolean(jumpLabel), `label=${jumpLabel}`);
  await page.keyboard.type(jumpLabel.toLowerCase());
  await page.keyboard.press("f");
  await page.waitForSelector(".fl-flow-detail", { timeout: 3000 });
  check("FLOW: F on a subnode drills in — the view never leaves FLOW", (await page.locator(".fl-flow-svg").count()) === 1);
  check("FLOW: the subnode's contents are here (var ▸ backups)", (await page.locator(".fl-flow-detail").innerText()).includes("backups"));
  check("FLOW: crumbs track the drill path", (await page.locator(".fl-crumbs").innerText()).includes("FILES"));
  await page.keyboard.press("d");
  await page.waitForTimeout(150);
  check("FLOW: D climbs to the frame's graph (detail closed)", (await page.locator(".fl-flow-detail").count()) === 0 && (await page.locator(".fl-flow-svg").count()) === 1);
  await page.keyboard.press("d");
  await page.waitForTimeout(150);
  check("FLOW: D again returns to the whole-environment graph", (await page.locator(".fl-flow-node").count()) > 40);

  // SETTINGS (card K): F on the ACCENT setting cycles it, live.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(120);
  check("back HOME for settings", (await cardCount()) === 14);
  await page.mouse.move(20, 20);
  await page.keyboard.press("k");
  await page.keyboard.press("f");
  await page.waitForSelector('[data-gui-node="gui:set:accent"]', { timeout: 3000 });
  await page.keyboard.press("a");
  await page.keyboard.press("f");
  await page.waitForTimeout(150);
  check("SETTINGS: F cycles accent AMBER -> TEAL", (await page.locator('[data-gui-node="gui:set-val-accent"]').innerText()).includes("TEAL"));

  // CHAT (card L): type in the field, Enter sends, the channel answers.
  await page.keyboard.press("`");
  await page.waitForTimeout(120);
  await page.keyboard.press("l");
  await page.keyboard.press("f");
  await page.waitForSelector('[data-gui-node="gui:chat-in"] input', { timeout: 3000 });
  await page.click('[data-gui-node="gui:chat-in"] input');
  await page.keyboard.type("hello relay");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  check("CHAT: Enter sends the message", (await page.locator('[data-gui-node="gui:chat-panel"]').innerText()).includes("hello relay"));
  await page.waitForTimeout(900);
  check("CHAT: the channel answers", (await page.locator('[data-gui-node="gui:chat-panel"]').innerText()).includes("Relay copies that."));

  // DOCUMENTS (card M): the editor is a real text area; words count live.
  await page.keyboard.press("Escape");
  await page.keyboard.press("`");
  await page.waitForTimeout(120);
  await page.keyboard.press("m");
  await page.keyboard.press("f");
  await page.waitForSelector('[data-gui-node="gui:doc-body"] textarea', { timeout: 3000 });
  check("DOCUMENTS: install checklist opens at 41 words", (await page.locator('[data-gui-node="gui:doc-meta"]').innerText()).includes("41 words"));
  await page.click('[data-gui-node="gui:doc-body"] textarea');
  await page.keyboard.type(" Again.");
  await page.waitForTimeout(200);
  check("DOCUMENTS: typing updates the word count", (await page.locator('[data-gui-node="gui:doc-meta"]').innerText()).includes("42 words"));

  // TERMINAL (card N): commands run; open <frame> really jumps.
  await page.keyboard.press("Escape");
  await page.keyboard.press("`");
  await page.waitForTimeout(120);
  await page.keyboard.press("n");
  await page.keyboard.press("f");
  await page.waitForSelector('[data-gui-node="gui:term-in"] input', { timeout: 3000 });
  await page.click('[data-gui-node="gui:term-in"] input');
  await page.keyboard.type("graph");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  check("TERMINAL: graph reports the flow graph", (await page.locator('[data-gui-node="gui:term-panel"]').innerText()).includes("0 gaps"));
  await page.keyboard.type("open files");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".fl-tm", { timeout: 3000 });
  check("TERMINAL: open files jumps to FILES", true);

  // MEDIA (card O): F on an item plays it; Space pauses.
  await page.keyboard.press("Escape");
  await page.keyboard.press("`");
  await page.waitForTimeout(120);
  await page.keyboard.press("o");
  await page.keyboard.press("f");
  await page.waitForSelector('[data-gui-node="gui:media-panel"]', { timeout: 3000 });
  await page.keyboard.press("a");
  await page.keyboard.press("f");
  await page.waitForTimeout(200);
  check("MEDIA: F plays the first item", (await page.locator('[data-gui-node="gui:media-title"]').innerText()).includes("ui-space-slice15-demo"));
  await page.keyboard.press(" ");
  await page.waitForTimeout(150);
  check("MEDIA: Space pauses", (await page.locator('[data-gui-node="gui:media-title"]').innerText()).includes("paused"));

  // SOFTWARE (card P): disabling FILES removes its card and rail entry.
  await page.keyboard.press("`");
  await page.waitForTimeout(120);
  await page.keyboard.press("p");
  await page.keyboard.press("f");
  await page.waitForSelector('[data-gui-node="gui:soft:files"]', { timeout: 3000 });
  const filesLabel = await page.evaluate(() => {
    const chips = [...document.querySelectorAll(".gui-addressed .gui-chip")];
    const rows = [...document.querySelectorAll('[data-gui-node^="gui:soft-row-"]')];
    const idx = rows.findIndex((r) => r.getAttribute("data-gui-node") === "gui:soft-row-files");
    return idx >= 0 ? document.querySelectorAll(".fl-app .gui-chip")[idx]?.textContent.trim() : null;
  });
  check("found the FILES row in SOFTWARE", Boolean(filesLabel), `label=${filesLabel}`);
  await page.keyboard.type(filesLabel.toLowerCase());
  await page.keyboard.press("f");
  await page.waitForTimeout(200);
  check("SOFTWARE: F disables FILES", (await page.locator('[data-gui-node="gui:soft-desc-files"]').innerText()).includes("DISABLED"));
  await page.keyboard.press("`");
  await page.waitForTimeout(150);
  check("SOFTWARE: the FILES card leaves HOME", (await cardCount()) === 13);
  check("SOFTWARE: the FILES rail entry leaves too", (await page.locator(".fl-rail-btn", { hasText: "FILES" }).count()) === 0);

  check("zero console/page errors in Flat Space", errors.length === 0, errors.slice(0, 3).join(" | "));
  errors.length = 0;
  inFragment = true;

  // Fragment: the old sim survives at index_fragment.html.
  await page.goto(`${BASE}/index_fragment.html`, { waitUntil: "networkidle" });
  check("index_fragment.html serves the old Keyclicks sim", (await page.locator(".de-topbar strong").innerText()).includes("Keyclicks"));
  check("fragment sim content injected", (await page.locator("#sim-content .mock-page").count()) === 1);

  check("zero console/page errors in fragment (legacy font 404s excluded)", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); }
}
console.log(`\nflat-driven: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
