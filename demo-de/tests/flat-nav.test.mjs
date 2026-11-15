/* flat-nav.test.mjs — the navigation state graph: F pushes, D pops,
   frame history at roots, explicit text mode. */
import { createNav, navOpenFrame, navPush, navSetTop, navBackPlan, navPop, navEnterText, navExitText, navCrumbs, navTop, MODE_TEXT, MODE_NAV } from "../src/flat-nav.js";

let n = 0;
const ok = (cond, msg) => { n += 1; if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } };

let nav = createNav();
ok(navTop(nav).frame === "home" && nav.mode === MODE_NAV, "starts at home root in nav mode");

// open mail, push reading, push nothing twice
nav = navOpenFrame(nav, "mail", "MAIL");
ok(nav.frameFrom === "home", "frameFrom remembers home");
nav = navPush(nav, "reading:m1", "RE — standup notes");
ok(navBackPlan(nav).kind === "pop", "D pops the subview first");
nav = navPush(nav, "reading:m1", "RE — standup notes");
ok(nav.stack.length === 2, "pushing the same view twice does not duplicate");
nav = navPop(nav);
ok(navTop(nav).view === "root", "pop returns to the frame root");
ok(navBackPlan(nav).kind === "frame" && navBackPlan(nav).to === "home", "D at mail root returns to home (the origin frame)");

// frame chain: home -> files -> (descend is setTop within a pushed rung)
nav = navOpenFrame(createNav(), "files", "FILES");
nav = navPush(nav, "node:Projects", "FILES ▸ Projects");
nav = navSetTop(nav, "node:Projects/demo-de", "FILES ▸ Projects ▸ demo-de");
ok(navCrumbs(nav).join("|") === "FILES|FILES ▸ Projects ▸ demo-de", "crumbs follow the stack");
nav = navPop(nav);
ok(navBackPlan(nav).kind === "frame" && navBackPlan(nav).to === "home", "files root: D returns to home, its origin");

// text mode is explicit and Esc-shaped
nav = navEnterText(nav, "COMPOSE · TO");
ok(nav.mode === MODE_TEXT && nav.textField === "COMPOSE · TO", "text mode records the field");
nav = navExitText(nav);
ok(nav.mode === MODE_NAV && nav.textField === null, "exit text clears the mode");

// home root rests
ok(navBackPlan(createNav()).kind === "rest", "home root: D rests");

console.log(`flat-nav: ${n} checks pass`);
