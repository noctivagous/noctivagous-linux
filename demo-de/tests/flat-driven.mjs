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
  check("home: 6 cards on the board", (await page.locator(".fl-card").count()) === 6);

  // Label targeting: B = FILES card.
  await page.keyboard.press("b");
  check("type B targets FILES card", (await readout()).includes("FILES"));
  await page.keyboard.press("f");
  await page.waitForSelector(".fl-tm", { timeout: 3000 });
  check("F opens FILES: treemap renders", (await page.locator(".fl-tm-node").count()) > 10);
  check("files crumbs show flare root", (await page.locator(".fl-crumbs").innerText()).includes("flare"));

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
  check("Esc Esc returns HOME", (await page.locator(".fl-card").count()) === 6);

  // Monitor via label C + F.
  await page.keyboard.press("c");
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
  await page.keyboard.press("Escape"); // then leaves the frame
  await page.waitForTimeout(100);
  check("Esc Esc from monitor returns HOME", (await page.locator(".fl-card").count()) === 6);

  // Drag-lock on home: hover FILES card, Space, move, Space drops.
  const card = page.locator(".fl-card").nth(1);
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

  // Mail: label G is MAIL card on home.
  check("back HOME for mail", (await page.locator(".fl-card").count()) === 6);
  // The cursor is still resting on the FILES card from the drag test,
  // and hover wins for F — move it to neutral chrome so the label
  // target is the addressee here.
  await page.mouse.move(20, 20);
  await page.waitForTimeout(100);
  await page.keyboard.press("g");
  await page.keyboard.press("f");
  await page.waitForSelector(".fl-msg", { timeout: 3000 });
  check("MAIL: inbox messages listed", (await page.locator(".fl-msg").count()) === 3);
  await page.locator(".fl-msg").first().click();
  await page.waitForTimeout(120);
  check("click opens message in reading pane", (await page.locator(".fl-mail-read h4").innerText()).includes("KeyPilot"));
  await page.keyboard.press("d");
  await page.waitForTimeout(100);
  check("D backs to list (reading pane cleared)", (await page.locator(".fl-mail-read .fl-empty").count()) === 1);

  // Compose: real text mode — F typed into a field must not click.
  await page.locator(".fl-folder.compose").click();
  await page.waitForSelector("#cmp-to", { timeout: 3000 });
  await page.click("#cmp-to");
  await page.keyboard.type("friend@example.com");
  await page.keyboard.type("fff"); // would be clicks outside text mode
  check("text mode: fff lands in the To field", (await page.inputValue("#cmp-to")) === "friend@example.comfff");
  check("mode chip reads TEXT", (await page.locator(".fl-mode").innerText()).includes("TEXT"));
  await page.keyboard.press("Escape"); // exits text mode (blur)
  await page.click("#cmp-subject");
  await page.keyboard.type("Driven test");
  await page.click("#cmp-body");
  await page.keyboard.type("Sent by the driven-key harness.");
  await page.keyboard.press("Escape");
  // SEND is the first compose action (label A): target + F.
  await page.keyboard.press("a");
  await page.keyboard.press("f");
  await page.waitForTimeout(200);
  check("SEND lands message in Sent", (await page.locator(".fl-msg h5").first().innerText()).includes("Driven test"));

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
