/* NCT-WL-COMPOSITOR — the engine is the model's seat: pointer focus (window under the cursor) vs keyboard focus, and the operators are compositor input policy, so they apply to foreign windows too. See WAYLAND-MAP.md. */
/* Key-clicks · engine — the mode state machine.
 *
 * Bimodal control: the cursor steers, the keyboard activates.
 *   F click · D back · Tab step · Space drag-lock · Enter open
 *   / launcher · Alt+L labels · Alt+K board · Esc unwinds one rung
 *
 * Modes are explicit state: KEY-CLICK, TEXT (a text-entry control
 * holds focus — keys type, only Esc and the Alt+K global are
 * monitored), LABELS (a letter buffer is being typed), DRAG-LOCK.
 * Mode changes are reported to the host through hooks.onMode.
 *
 * The engine owns NO application state. It activates elements
 * through their own handlers, and where the host owns the truth
 * (window geometry lives in the shell's store) it asks through
 * the bridge event `nct:winmove` instead of writing the DOM.
 * See KEYCLICKS-AUDIT.md and DESKTOP-ARCHITECTURE.md.
 */

import {
  BUFFER_MS,
  resolveBuffer,
  labelForIndex,
  isTextEntryControl,
  visible,
  nameOf,
  addressablesIn,
} from "./addressing.js";
import { BOARD_ROWS, keyForCap, bindingFor, SCOPE_FOR_APP } from "./board.js";
import { appActionFor, OVERRIDABLE_KEYS } from "../desktop/core/keymaps.js";

export function createKeyClicks(hooks = {}) {
  const onMode = hooks.onMode || (() => {});
  let mouseX = innerWidth / 2;
  let mouseY = innerHeight / 2;
  let hovered = null;
  let targeted = null;
  let textMode = false;
  let textEl = null;
  // The text-mode grace period (KeyPilot's armed-click countdown):
  // while typing, moving the mouse over a clickable arms F for
  // TEXT_ARM_SECONDS; F pressed inside the window leaves text
  // mode and clicks the armed target instead of typing "f".
  let textArm = null; // {target, remaining, timer}
  const TEXT_ARM_SECONDS = 3;
  let labelsOn = false;
  let marks = [];
  let buffer = "";
  let bufferTimer = 0;
  let dragLock = null; // {kind:'win', el, id, dx, dy, ox, oy} | {kind:'range', el}
  let boardOn = false;
  let boardSig = "";
  let ringEl = null;
  let filesFolder = "Home";
  const folderTrail = [];
  const winTrail = [];

  /* ---------- DOM (one engine-owned root) ---------- */
  const root = document.createElement("div");
  root.id = "kcRoot";
  root.innerHTML = `
    <div id="kcReticle"></div>
    <div id="kcHud"><span class="kc-mode">KEY-CLICK</span><span class="kc-target">target — —</span><span class="kc-hints"></span><button id="kcHudCollapse" type="button" title="Collapse the status bar into the task bar (or hover it and press E)">▾</button></div>
    <button id="kcHudBtn" type="button" title="Key-click status — click to expand, right-click for bar options">KEY-CLICK</button>
    <button id="kcTab" type="button" aria-label="Toggle onscreen keyboard" title="Onscreen keyboard (Alt+K)">KEYBOARD</button>
    <div id="kcPanel" hidden></div>`;
  document.body.appendChild(root);
  let hudCollapsed = false;
  let inKcMousedown = false; // reentry guard for the kcRoot bridge below
  function setHudCollapsed(on) {
    hudCollapsed = on;
    hud.style.display = on ? "none" : "";
    hudBtn.style.display = on ? "" : "none";
  }
  /* ---------- the bar: orientation + live option rows ----------
   * Modelled on NibGlider's KeymapWidget (nibglider
   * src/components/KeymapWidget.tsx): the bar lists the
   * key-click options AVAILABLE right now — rows of key chip +
   * action, recomputed from the cursor's context (the same
   * branching the key handler acts on) whenever the mode or the
   * hover changes — with the always-available system keys as a
   * separated section at the end, like NibGlider's adjust
   * section. NibGlider's bar stands vertical by default; here
   * the horizontal strip is the default and the vertical
   * orientation is offered on the bar's right-click menu, next
   * to the collapse the right-click used to do on its own. The
   * choice persists across sessions. */
  let hudOrient = "h";
  try { hudOrient = localStorage.getItem("nct-kc-orient") === "v" ? "v" : "h"; } catch (err) { /* storage off */ }
  let hudMenu = null;
  function applyHudOrient() {
    hud.classList.toggle("kc-vertical", hudOrient === "v");
    renderHudRows(true);
  }
  function setHudOrient(o) {
    hudOrient = o;
    try { localStorage.setItem("nct-kc-orient", o); } catch (err) { /* storage off */ }
    applyHudOrient();
  }
  function closeHudMenu() {
    if (!hudMenu) return;
    hudMenu.remove();
    hudMenu = null;
    document.removeEventListener("mousedown", onHudMenuOutside, true);
  }
  function onHudMenuOutside(e) {
    if (hudMenu && !(e.target.closest && e.target.closest("#kcHudMenu"))) closeHudMenu();
  }
  function showHudMenu() {
    closeHudMenu();
    hudMenu = document.createElement("div");
    hudMenu.id = "kcHudMenu";
    const item = (label, fn, on) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kc-hudmenu-item" + (on ? " on" : "");
      b.textContent = (on ? "✓ " : "") + label;
      // mousedown, like the board caps: the engine's F path
      // enters #kcRoot through a synthetic mousedown.
      b.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        closeHudMenu();
        fn();
      });
      hudMenu.appendChild(b);
    };
    item("Vertical orientation", () => setHudOrient("v"), hudOrient === "v");
    item("Horizontal orientation", () => setHudOrient("h"), hudOrient === "h");
    const sep = document.createElement("div");
    sep.className = "kc-hudmenu-sep";
    hudMenu.appendChild(sep);
    item(hudCollapsed ? "Expand bar" : "Collapse bar", () => setHudCollapsed(!hudCollapsed), false);
    root.appendChild(hudMenu);
    // Anchor at the bar: above it when horizontal, beside it
    // when vertical; clamped into the viewport.
    const anchor = (hudCollapsed ? hudBtn : hud).getBoundingClientRect();
    const mw = hudMenu.offsetWidth, mh = hudMenu.offsetHeight;
    let x = anchor.left, y = anchor.top - mh - 6;
    if (hudOrient === "v" && !hudCollapsed) { x = anchor.right + 6; y = anchor.top; }
    hudMenu.style.left = Math.max(4, Math.min(innerWidth - mw - 4, x)) + "px";
    hudMenu.style.top = Math.max(4, Math.min(innerHeight - mh - 4, y)) + "px";
    document.addEventListener("mousedown", onHudMenuOutside, true);
  }
  // The HUD is pointer-events:none (it must never block the dock
  // beneath it), so its right-click is caught by hit-testing the
  // event's point against the bar's box in the capture phase.
  function onHudContextMenu(e) {
    const el = hudCollapsed ? hudBtn : hud;
    const r = el.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      const under = document.elementFromPoint(e.clientX, e.clientY);
      if (under && under.closest && under.closest(".nwin, .dicon, .dock .task")) return;
      e.preventDefault();
      e.stopPropagation();
      if (hudMenu) closeHudMenu(); else showHudMenu();
    }
  }
  /* The rows for the cursor's current context — a mirror of
   * onKeyDown's branching, so the bar never promises a key the
   * handler would not honour. Returns {rows, sys}: sys is the
   * always-available section, de-duplicated against rows. */
  function hudContextRows() {
    const SYS = [
      ["Tab", "target"], ["Space", "drag-lock"], ["Alt+L", "labels"],
      ["Alt+K", "keys"], ["\\", "configure"], ["9", "freeze"],
    ];
    if (textMode) {
      const rows = [["Esc", "leave text mode"]];
      if (textArm) rows.push(["F", "click " + nameOf(textArm.target)]);
      else rows.push(["F", "type — hover a control to arm a click"]);
      return { rows, sys: [] };
    }
    if (labelsOn) {
      return {
        rows: [["A–Z", "type a label"], ["F", "click target"], ["D", "back"], ["Esc", "dismiss"]],
        sys: [],
      };
    }
    if (dragLock) {
      return {
        rows: [["F", "drop"], ["Space", "drop"], ["D", "cancel"], ["Esc", "cancel"]],
        sys: SYS,
      };
    }
    const rows = [];
    const at = document.elementFromPoint(mouseX, mouseY);
    const inEl = (sel) => (at && at.closest ? at.closest(sel) : null);
    if (document.querySelector(".dropdown.open, .launcher.open, .ctxmenu.open")) {
      if (currentTarget()) rows.push(["F", "click"]);
      rows.push(["A", "close menu"], ["D", "back"]);
      return { rows, sys: SYS };
    }
    if (document.body.classList.contains("patch-pending")) {
      rows.push(["F", inEl("[data-port]") ? "complete the cord" : "cancel the cord"]);
      rows.push(["A", "cancel the cord"], ["Esc", "cancel the cord"]);
      return { rows, sys: SYS };
    }
    if (inEl("[data-cord]")) rows.push(["F", "move cord"], ["A", "remove cord"]);
    else if (inEl("[data-port]")) rows.push(["F", "draw a cord"]);
    if (hudAtCursor()) rows.push(["E", "collapse bar"], ["R", "collapse bar"]);
    if (inEl("[data-stack-item]")) rows.push(["F", "raise window"], ["A", "close window"]);
    if (inEl("[data-min-item]")) rows.push(["F", "restore window"]);
    if (inEl("[data-widget]")) {
      rows.push(["0", "widget style"], ["O", "ports"]);
      rows.push(["9", inEl("[data-widget].frozen") ? "unfreeze widget" : "freeze widget"]);
    }
    const win = winAtCursor();
    if (win) {
      rows.push(
        ["F", "click"], ["E", "collapse + drag"], ["R", "collapse"],
        ["T", "vertical collapse"], ["S", "minimize"], ["A", "close"],
        ["G", "hide"], ["H", "resize"], ["P", "flip"], ["O", "ports"],
      );
    } else if (frozenWinAtCursor()) {
      rows.push(["9", "unfreeze"]);
    } else if (iconAtCursor()) {
      rows.push(["F", "open"], ["D", "group"], ["G", "hide / show"], ["A", "quit"]);
    }
    if (inEl(".ng-layer")) rows.push([";", "rotate"], ["'", "rotate"], ["[ ]", "scale"]);
    if (!rows.length) rows.push(["F", "click"], ["/", "start menu"]);
    if (!rows.some((r) => r[0] === "D")) rows.push(["D", "back"]);
    const seen = new Set(rows.map((r) => r[0]));
    return { rows, sys: SYS.filter((r) => !seen.has(r[0])) };
  }
  let hudRowsSig = "";
  function renderHudRows(force) {
    if (!hintsEl) return;
    const { rows, sys } = hudContextRows();
    const all = rows.map((r) => [r[0], r[1], ""])
      .concat(sys.map((r) => [r[0], r[1], "sys"]));
    const sig = hudOrient + "|" + all.map((r) => r[0] + "=" + r[1]).join(",");
    if (!force && sig === hudRowsSig) return;
    hudRowsSig = sig;
    hintsEl.textContent = "";
    all.forEach(([key, label, sec], i) => {
      const row = document.createElement("span");
      row.className = "kc-row" + (sec ? " sys" : "") +
        (sec && (i === 0 || all[i - 1][2] !== "sys") ? " sys-first" : "");
      const kbd = document.createElement("span");
      kbd.className = "kc-kbd";
      kbd.textContent = key;
      row.appendChild(kbd);
      row.appendChild(document.createTextNode(" " + label));
      hintsEl.appendChild(row);
    });
  }
  const reticle = root.querySelector("#kcReticle");
  const hud = root.querySelector("#kcHud");
  const hudMode = hud.querySelector(".kc-mode");
  const hudTgt = hud.querySelector(".kc-target");
  const hintsEl = hud.querySelector(".kc-hints");
  const tab = root.querySelector("#kcTab");
  const panel = root.querySelector("#kcPanel");

  /* ---------- helpers ---------- */
  const liveScreen = () =>
    document.querySelector("#desktopScreen.on") ||
    document.querySelector("#loginScreen.on");
  const focusedWin = () => document.querySelector(".nwin.focused");
  function scope() {
    const s = liveScreen();
    if (s && s.id === "loginScreen") return "login";
    const fw = focusedWin();
    if (!fw) return "shell";
    return SCOPE_FOR_APP[fw.getAttribute("data-app")] || "shell";
  }
  function syncTextMode() {
    const ae = document.activeElement;
    const t = isTextEntryControl(ae) && visible(ae);
    textEl = t ? ae : null;
    if (t !== textMode) {
      textMode = t;
      if (!t) disarmTextClick();
      document.body.classList.toggle("kc-textmode", t);
      setMode();
      renderBoard(true);
    }
    applyTextRing();
  }
  // KeyPilot's text-mode mark: an orange ring on the thing being
  // typed into — the terminal's content viewport when the field
  // belongs to the Terminal, the field itself otherwise (login
  // screen included).
  function applyTextRing() {
    document.querySelectorAll(".kc-textring").forEach((e) => {
      if (e !== ringEl) e.classList.remove("kc-textring");
    });
    let target = null;
    if (textMode && textEl) {
      const win = textEl.closest && textEl.closest(".nwin");
      if (win && win.getAttribute("data-app") === "terminal") {
        target = win.querySelector(".wbody") || textEl;
      } else {
        target = textEl;
      }
    }
    if (ringEl && ringEl !== target) ringEl.classList.remove("kc-textring");
    ringEl = target;
    if (ringEl) ringEl.classList.add("kc-textring");
  }
  function armTextClick(target) {
    disarmTextClick();
    textArm = { target, remaining: TEXT_ARM_SECONDS, timer: null };
    target.classList.add("kc-armed");
    document.body.classList.add("kc-textarmed");
    textArm.timer = setInterval(() => {
      if (!textArm) return;
      textArm.remaining -= 1;
      if (textArm.remaining > 0) { setMode(); return; }
      // Grace expired: the hover is just a hover again until the
      // mouse moves and re-arms.
      disarmTextClick();
      setMode();
    }, 1000);
    setMode();
  }
  function disarmTextClick() {
    if (!textArm) return;
    clearInterval(textArm.timer);
    if (textArm.target && textArm.target.isConnected) {
      textArm.target.classList.remove("kc-armed");
    }
    textArm = null;
    document.body.classList.remove("kc-textarmed");
  }
  // Re-evaluated on every mouse move while in text mode: a
  // clickable under the cursor arms (a new target re-arms fresh),
  // anything else disarms. The field being typed into and the
  // engine's own furniture (board caps type in text mode) never
  // arm.
  function updateTextArm() {
    const t = hovered;
    const ok =
      t &&
      t !== textEl &&
      visible(t) &&
      !(t.closest && t.closest("#kcBoard, #kcPanel, #kcHud, #kcTab"));
    if (!ok) {
      if (textArm) { disarmTextClick(); setMode(); }
      return;
    }
    if (textArm && textArm.target === t) return; // countdown runs on
    armTextClick(t);
  }
  function currentTarget() {
    if (targeted && targeted.isConnected && visible(targeted)) return targeted;
    if (hovered && hovered.isConnected && visible(hovered)) return hovered;
    return null;
  }
  function setMode() {
    let m;
    if (textMode) {
      m = textArm
        ? "TEXT · F CLICKS " + textArm.remaining
        : "TEXT · " + (textEl ? nameOf(textEl) : "field");
      hud.classList.add("text");
    } else if (labelsOn) {
      m = "LABELS" + (buffer ? " · " + buffer : "");
      hud.classList.remove("text");
    } else if (dragLock) {
      m = "DRAG-LOCK";
      hud.classList.remove("text");
    } else {
      m = "KEY-CLICK";
      hud.classList.remove("text");
    }
    hudMode.textContent = m;
    const t = currentTarget();
    hudTgt.textContent =
      "target — " + (t ? nameOf(t) : labelsOn ? "type a label" : "—");
    renderHudRows(false);
    onMode(m);
  }

  /* ---------- activation (through the elements' own handlers) --- */
  function kcClick(el) {
    if (!el) return false;
    // A frozen element accepts no events at all.
    if (el.closest && el.closest(".frozen")) return false;
    const range = el.closest && el.closest('input[type="range"]');
    if (range) {
      setRangeFromCursor(range);
      range.focus({ preventScroll: true });
      targeted = range;
      return true;
    }
    // A real control wins over the titlebar it may sit inside:
    // F over a window's close/min/shade button must CLICK it, not
    // focus the window. Only bare titlebar surface focuses.
    const t = el.closest
      ? el.closest("button, a[href], input, select, textarea, label, .dicon, [tabindex]")
      : null;
    if (t) {
      if (!inKcMousedown && t.closest && t.closest("#kcRoot")) {
        inKcMousedown = true;
        t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        inKcMousedown = false;
      }
      // A label is clicked through its control (checkbox, radio):
      // hovering the label's text must toggle it, not miss.
      if (t.tagName === "LABEL") {
        const c = t.control || t.querySelector("input, select, textarea, button");
        if (c) {
          c.click();
          targeted = c;
          ripple();
          return true;
        }
      }
      if (t.focus && t.tagName !== "BUTTON") t.focus({ preventScroll: true });
      if (t.click) t.click();
      targeted = t;
      ripple();
      return true;
    }
    // KeyPilot's terminal rule: F anywhere in the Terminal's
    // content area focuses its input — the viewport is the field.
    const twin = el.closest && el.closest('.nwin[data-app="terminal"]');
    if (twin && !el.closest(".titlebar")) {
      const ti = [...twin.querySelectorAll(".wbody input, .wbody textarea")].find(
        (c) => isTextEntryControl(c),
      );
      if (ti) {
        ti.focus({ preventScroll: true });
        targeted = ti;
        ripple();
        return true;
      }
    }
    const tb = el.closest && el.closest(".nwin .titlebar");
    if (tb) {
      const w = tb.closest(".nwin");
      if (w) w.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      targeted = tb;
      return true;
    }
    // Nothing addressable here: F is still a click at the cursor
    // point, with the full mouse sequence, so the shell's own
    // outside-click handling runs (an open menu closes, exactly
    // as a mouse click outside it would close it).
    const at = document.elementFromPoint(mouseX, mouseY) || el;
    if (at && at !== document.body && at !== document.documentElement) {
      const init = { bubbles: true, cancelable: true, clientX: mouseX, clientY: mouseY };
      at.dispatchEvent(new MouseEvent("mousedown", init));
      at.dispatchEvent(new MouseEvent("mouseup", init));
      at.dispatchEvent(new MouseEvent("click", init));
      ripple();
      return true;
    }
    return false;
  }
  function setRangeFromCursor(range) {
    // A React host tracks range values: write through the native
    // setter so its change detection sees the value as user input.
    const min = parseFloat(range.min || 0);
    const max = parseFloat(range.max || 100);
    const r = range.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (mouseX - r.left) / Math.max(1, r.width)));
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(range, String(Math.round(min + f * (max - min))));
    range.dispatchEvent(new Event("input", { bubbles: true }));
    range.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function ripple() {
    const r = document.createElement("div");
    r.className = "kc-ripple";
    r.style.left = mouseX + "px";
    r.style.top = mouseY + "px";
    document.body.appendChild(r);
    requestAnimationFrame(() => r.classList.add("go"));
    setTimeout(() => r.remove(), 500);
  }

  /* ---------- labels ---------- */
  function clearMarks() {
    marks.forEach((m) => m.chip.remove());
    marks = [];
    buffer = "";
    clearTimeout(bufferTimer);
  }
  function dismissLabels() {
    if (!labelsOn) return;
    labelsOn = false;
    clearMarks();
    document.querySelectorAll(".kc-scope").forEach((e) => e.classList.remove("kc-scope"));
    setMode();
    renderBoard(true);
  }
  function summonLabels() {
    dismissLabels();
    const fw = focusedWin();
    const rootEl = fw || liveScreen() || document.body;
    rootEl.classList.add("kc-scope");
    const items = addressablesIn(rootEl).slice(0, 60);
    marks = items.map((el, i) => {
      const chip = document.createElement("span");
      chip.className = "kc-chip";
      chip.textContent = labelForIndex(i);
      document.body.appendChild(chip);
      const r = el.getBoundingClientRect();
      chip.style.left = Math.max(0, r.left - 2) + "px";
      chip.style.top = Math.max(0, r.top - 9) + "px";
      return { el, label: labelForIndex(i), chip };
    });
    labelsOn = true;
    buffer = "";
    setMode();
    renderBoard(true);
  }
  function typeLabel(ch) {
    buffer += ch;
    clearTimeout(bufferTimer);
    bufferTimer = setTimeout(() => {
      buffer = "";
      setMode();
    }, BUFFER_MS);
    const res = resolveBuffer(marks, buffer);
    if (res.status === "exact") {
      const el = res.item.el;
      dismissLabels();
      hovered = el;
      targeted = el;
      kcClick(el);
    } else if (res.status === "none") {
      buffer = "";
    }
    setMode();
  }

  /* ---------- drag-lock (geometry goes through the host bridge) - */
  function winMove(id, x, y) {
    document.dispatchEvent(
      new CustomEvent("nct:winmove", { detail: { id, x, y } }),
    );
  }
  function setLockState(kind, id) {
    document.body.classList.toggle("kc-lock-win", kind === "win");
    document.body.classList.toggle("kc-lock-range", kind === "range");
    reticle.classList.toggle("lock-win", kind === "win");
    reticle.classList.toggle("lock-range", kind === "range");
    // The locked window's cast is host-rendered: React owns the
    // window's className, so the engine reports the lock and the
    // shell paints it (same bridge pattern as nct:winmove).
    document.dispatchEvent(
      new CustomEvent("nct:winlock", {
        detail: kind === "win" ? { id: id || null, kind } : null,
      }),
    );
  }
  function tryDragLock() {
    const el = document.elementFromPoint(mouseX, mouseY);
    if (!el) return;
    if (el.closest && el.closest(".frozen")) return;
    const range = el.closest && el.closest('input[type="range"]');
    if (range) {
      dragLock = { kind: "range", el: range };
      range.classList.add("kc-dragging");
      setLockState("range");
      setRangeFromCursor(range);
      setMode();
      return;
    }
    const win = el.closest && el.closest(".nwin");
    if (win && !win.closest("#loginWin")) {
      win.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      dragLock = {
        kind: "win",
        el: win,
        id: win.getAttribute("data-app"),
        dx: mouseX - win.offsetLeft,
        dy: mouseY - win.offsetTop,
        ox: win.offsetLeft,
        oy: win.offsetTop,
      };
      setLockState("win", win.getAttribute("data-app"));
      setMode();
    }
  }
  function dragMove(e) {
    if (dragLock.kind === "win") {
      const w = dragLock.el;
      const nx = Math.min(innerWidth - 80, Math.max(-w.offsetWidth + 120, e.clientX - dragLock.dx));
      const ny = Math.min(innerHeight - 40, Math.max(0, e.clientY - dragLock.dy));
      winMove(dragLock.id, nx, ny); // the host owns the position
    } else if (dragLock.kind === "range") {
      setRangeFromCursor(dragLock.el);
    }
  }
  /* The shell can hand a window to drag-lock directly (the
   * transformer stack restores a titlebar already carried).
   * The grab is the titlebar's centre, so the bar stays centred
   * on the cursor it was clicked at. */
  function lockWindowById(id) {
    const win = document.querySelector('.nwin[data-app="' + id + '"]');
    if (!win) return;
    win.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const op = win.offsetParent
      ? win.offsetParent.getBoundingClientRect()
      : { left: 0, top: 0 };
    dragLock = {
      kind: "win",
      el: win,
      id,
      dx: win.offsetWidth / 2 + op.left,
      dy: 14 + op.top,
      ox: win.offsetLeft,
      oy: win.offsetTop,
    };
    setLockState("win", id);
    setMode();
  }
  window.addEventListener("nct:lockwin", (e) => {
    const id = e.detail && e.detail.id;
    if (id) lockWindowById(id);
  });

  function dropDragLock() {
    if (dragLock && dragLock.el && dragLock.kind === "range")
      dragLock.el.classList.remove("kc-dragging");
    dragLock = null;
    setLockState(null);
    setMode();
  }
  function cancelDragLock() {
    if (dragLock && dragLock.kind === "win") winMove(dragLock.id, dragLock.ox, dragLock.oy);
    dropDragLock();
  }

  /* ---------- E collapse / A close, at the cursor ---------- */
  function appAtCursor() {
    const el = document.elementFromPoint(mouseX, mouseY);
    const win = el && el.closest && el.closest(".nwin");
    if (win && win.classList.contains("frozen")) return null;
    return win ? win.getAttribute("data-app") : null;
  }
  function iconAtCursor() {
    const el = document.elementFromPoint(mouseX, mouseY);
    const ic = el && el.closest && el.closest(".dicon");
    return ic ? ic.getAttribute("data-icon") : null;
  }
  /* H: resize the focused window to the cursor point. The
   * window's edges, extended, divide the space around it into
   * 8 sections; the section the cursor sits in decides which
   * edge — or corner — moves to the cursor. Inside the window
   * H runs in reverse: the right and bottom edges inset to the
   * cursor together, shrinking the window around its interior
   * point. Geometry goes through the nct:winresize bridge; the
   * store's writer owns clamps, shade and max. */
  function resizeToCursor() {
    const win = focusedWin();
    if (!win || win.classList.contains("vshade") || win.classList.contains("frozen")) return false;
    const id = win.getAttribute("data-app");
    if (!id) return false;
    const r = win.getBoundingClientRect();
    const op = win.offsetParent
      ? win.offsetParent.getBoundingClientRect()
      : { left: 0, top: 0 };
    const cx = mouseX - op.left, cy = mouseY - op.top;
    const x0 = r.left - op.left, y0 = r.top - op.top;
    const x1 = x0 + r.width, y1 = y0 + r.height;
    const col = cx < x0 ? "w" : cx > x1 ? "e" : "";
    const row = cy < y0 ? "n" : cy > y1 ? "s" : "";
    if (!col && !row) {
      // Interior: the reverse of the south-east section — the
      // right and bottom edges move in to the cursor at once.
      window.dispatchEvent(
        new CustomEvent("nct:winresize", {
          detail: { id, x: x0, y: y0, w: cx - x0, h: cy - y0, v: true },
        }),
      );
      return true;
    }
    let nx = x0, ny = y0, nw = r.width, nh = r.height;
    if (col === "e") nw = cx - x0;
    if (col === "w") { nw = x1 - cx; nx = x1 - nw; }
    if (row === "s") nh = cy - y0;
    if (row === "n") { nh = y1 - cy; ny = y1 - nh; }
    window.dispatchEvent(
      new CustomEvent("nct:winresize", {
        detail: { id, x: nx, y: ny, w: nw, h: nh, v: row !== "" },
      }),
    );
    return true;
  }
  function winAtCursor() {
    const el = document.elementFromPoint(mouseX, mouseY);
    const win = el && el.closest ? el.closest(".nwin") : null;
    // Frozen windows are invisible to the operators: they stay
    // in place and accept nothing until unfrozen.
    return win && win.classList.contains("frozen") ? null : win;
  }
  /* The frozen window at the cursor, found geometrically —
   * a frozen window's body takes no events, so hit-testing
   * alone can miss it. The 9 key uses this to unfreeze. */
  /* The configure target at the cursor: the nearest
   * data-configure hook, else the window's app, else the
   * layer app, else a frozen window found geometrically. */
  function configureTargetAtCursor() {
    const el = document.elementFromPoint(mouseX, mouseY);
    if (el && el.closest) {
      const c = el.closest("[data-configure]");
      if (c) return c.getAttribute("data-configure");
      const win = el.closest(".nwin");
      if (win && !win.closest("#loginWin")) return win.getAttribute("data-app");
      const layer = el.closest("[data-layer-app]");
      if (layer) return layer.getAttribute("data-layer-app");
    }
    const fw = frozenWinAtCursor();
    return fw ? fw.getAttribute("data-app") : null;
  }
  function frozenWinAtCursor() {
    const wins = document.querySelectorAll(".nwin.frozen");
    for (const w of wins) {
      const r = w.getBoundingClientRect();
      if (mouseX >= r.left && mouseX <= r.right && mouseY >= r.top && mouseY <= r.bottom) return w;
    }
    return null;
  }
  // Collapse (shade) through the window's own shade button; the
  // titlebar that remains is placed directly under the cursor —
  // its vertical centre on the cursor, horizontal span unchanged
  // (the cursor was inside the window, so it stays over the bar).
  // Position goes through the host bridge, like drag-lock.
  function vshade(id, on) {
    document.dispatchEvent(
      new CustomEvent("nct:vshade", { detail: { id, on } }),
    );
  }
  /* Is the cursor over the key-click status bar (or its
   * collapsed button in the task bar)? The bar is
   * pointer-events:none, so this is a geometric test, with the
   * context menu's courtesy: a window, icon or task under the
   * point wins. */
  function hudAtCursor() {
    const el = hudCollapsed ? hudBtn : hud;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (mouseX < r.left || mouseX > r.right || mouseY < r.top || mouseY > r.bottom) return false;
    const under = document.elementFromPoint(mouseX, mouseY);
    if (under && under.closest && under.closest(".nwin, .dicon, .dock .task")) return false;
    return true;
  }
  function collapseAtCursor() {
    const win = winAtCursor();
    if (!win) return false;
    // E restores a vertically-shaded window to its full frame.
    if (win.classList.contains("vshade")) {
      vshade(win.getAttribute("data-app"), false);
      return true;
    }
    const shadeBtn = win.querySelector(".wbtn.shade");
    if (!shadeBtn) return false; // e.g. the login window cannot shade
    const wasShaded = !win.querySelector(".wbody");
    shadeBtn.click();
    if (!wasShaded) {
      const id = win.getAttribute("data-app");
      if (id) {
        // mouseY is viewport coordinates; window positions live in
        // the window layer's frame — convert before bridging.
        const layerTop = win.offsetParent
          ? win.offsetParent.getBoundingClientRect().top
          : 0;
        winMove(id, win.offsetLeft, Math.max(0, mouseY - layerTop - 15));
      }
    }
    return true;
  }
  function closeAtCursor() {
    // A closes a system menu first, when one is open.
    const openMenu = document.querySelector(
      ".dropdown.open, .launcher.open, .ctxmenu.open",
    );
    if (openMenu) {
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    }
    const win = winAtCursor();
    if (!win) return false;
    const closeBtn = win.querySelector(".wbtn.close");
    if (!closeBtn) return false;
    closeBtn.click();
    return true;
  }

  /* ---------- back (D): one rung at a time ---------- */
  function goBack() {
    if (buffer) {
      buffer = buffer.slice(0, -1);
      setMode();
      return true;
    }
    if (labelsOn) { dismissLabels(); return true; }
    if (dragLock) { cancelDragLock(); return true; }
    const openMenu = document.querySelector(
      ".dropdown.open, .launcher.open, .ctxmenu.open",
    );
    if (openMenu) {
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    }
    const sc = scope();
    if (sc === "files" && folderTrail.length) {
      const prev = folderTrail.pop();
      const btn = document.querySelector(
        '#fileTree button[data-folder="' + prev + '"]',
      );
      if (btn) {
        filesFolder = prev;
        btn.click();
        return true;
      }
    }
    if (winTrail.length > 1) {
      winTrail.pop();
      const prev = winTrail[winTrail.length - 1];
      if (prev && prev.isConnected) {
        prev.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  /* ---------- view operators (NavGraph first) ---------- */
  // ; and ' rotate, [ and ] scale — they act on the NavGraph
  // trees when the cursor is over the layer with nothing
  // obscuring it (a window over the graph takes the point, and
  // the keys stay inert). The layer owns the transform; the
  // engine only names the operation, over the same window-event
  // bridge the window actions use.
  function navGraphOp(op) {
    const layer = document.querySelector(".ng-layer");
    if (!layer) return false;
    const r = layer.getBoundingClientRect();
    if (mouseX < r.left || mouseX > r.right || mouseY < r.top || mouseY > r.bottom) return false;
    const el = document.elementFromPoint(mouseX, mouseY);
    if (!el) return false;
    if (el.closest && el.closest(".ng-layer")) {
      window.dispatchEvent(new CustomEvent("nct:navgraph", { detail: { op } }));
      return true;
    }
    // Off its nodes the layer lets the point through to the desk
    // beneath — still over the graph, unless a window, a menu or
    // desktop furniture is in the way.
    if (el.closest && el.closest(".nwin, .dropdown, .ctxmenu, .sysbar, .dock, .dicon, .widgets, #kcRoot")) return false;
    window.dispatchEvent(new CustomEvent("nct:navgraph", { detail: { op } }));
    return true;
  }
  // - and = step the font size of whatever element is under the
  // cursor: an inline size on that element, ratio steps so small
  // UI text and big display text both move sensibly.
  function fontStep(f) {
    const el = document.elementFromPoint(mouseX, mouseY);
    if (!el || el === document.body || el === document.documentElement) return false;
    const cur = parseFloat(getComputedStyle(el).fontSize) || 16;
    const next = Math.min(120, Math.max(6, Math.round(cur * f * 2) / 2));
    el.style.fontSize = next + "px";
    return true;
  }

  /* ---------- pointer tracking ---------- */
  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    reticle.style.left = mouseX + "px";
    reticle.style.top = mouseY + "px";
    if (dragLock) { dragMove(e); return; }
    const el = document.elementFromPoint(mouseX, mouseY);
    const t = el && el.closest
      ? el.closest("button, a[href], input, select, textarea, label, .dicon, [tabindex], .nwin .titlebar")
      : null;
    if (t !== hovered) {
      if (hovered) hovered.classList.remove("kc-hover");
      hovered = t;
      // Moving onto a different element re-aims: a stale Tab/label
      // target must not outrank the thing now under the cursor.
      targeted = null;
      if (hovered) hovered.classList.add("kc-hover");
      setMode();
    }
    if (textMode) updateTextArm();
  }
  function onMouseDown(e) {
    disarmTextClick(); // a real click supersedes the armed F
    const t = e.target.closest
      ? e.target.closest("button, a[href], input, select, textarea, label, .dicon, [tabindex], .nwin .titlebar")
      : null;
    if (t) targeted = t;
    const w = e.target.closest && e.target.closest(".nwin");
    if (w && winTrail[winTrail.length - 1] !== w) {
      winTrail.push(w);
      if (winTrail.length > 12) winTrail.shift();
    }
    if (e.target.closest && e.target.closest("#fileTree button[data-folder]")) {
      const f = e.target.closest("#fileTree button[data-folder]").getAttribute("data-folder");
      if (f && f !== filesFolder) {
        folderTrail.push(filesFolder);
        filesFolder = f;
      }
    }
  }
  function onFocusChange() {
    setTimeout(syncTextMode, 0);
  }

  /* ---------- the onscreen board ---------- */
  function boardSignature() {
    const fw = focusedWin();
    return [
      scope(),
      textMode ? "text" : "kc",
      labelsOn ? "labels" : "",
      fw ? fw.getAttribute("data-app") : "",
    ].join("|");
  }
  function renderBoard(force) {
    const sig = boardSignature();
    if (!force && sig === boardSig) return;
    boardSig = sig;
    panel.innerHTML = "";
    // Markup follows styles/keyclicks.css: a panel head with a
    // collapse button, .kc-krow rows, caps with .g glyph / .n name.
    const head = document.createElement("div");
    head.className = "kc-panel-head";
    head.innerHTML =
      "<span>⌨ KEYBOARD · " +
      (textMode ? "TEXT MODE — CAPS TYPE" : "SCOPE: " + scope().toUpperCase()) +
      "</span>";
    const collapse = document.createElement("button");
    collapse.type = "button";
    collapse.className = "kc-collapse";
    collapse.textContent = "—";
    collapse.title = "Collapse keyboard (Alt+K)";
    collapse.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      setBoard(false);
    });
    head.appendChild(collapse);
    head.addEventListener("mousedown", (ev) => {
      if (ev.target.closest(".kc-collapse")) return;
      ev.preventDefault();
      beginPanelDrag(ev);
    });
    panel.appendChild(head);
    const altDown = false;
    for (const row of BOARD_ROWS) {
      const rowEl = document.createElement("div");
      rowEl.className = "kc-krow";
      for (const spec of row) {
        const parts = spec.split(":");
        const code = parts[0];
        const glyph = parts[1];
        const wide = parts[2] ? parseFloat(parts[2]) : 1;
        const bind = textMode ? "" : bindingFor(scope(), code, altDown);
        const cap = document.createElement("button");
        cap.type = "button";
        cap.className = "kc-cap" + (bind ? " bound" : "");
        cap.dataset.code = code;
        cap.style.flex = wide + " 1 0";
        cap.innerHTML =
          '<span class="g">' +
          glyph +
          "</span>" +
          (bind ? '<span class="n">' + bind + "</span>" : "");
        cap.addEventListener("mousedown", (ev) => {
          ev.preventDefault(); // caps never steal focus
          pressCap(code, glyph);
        });
        rowEl.appendChild(cap);
      }
      panel.appendChild(rowEl);
    }
  }
  function setBoard(on) {
    boardOn = on;
    panel.hidden = !on;
    tab.classList.toggle("open", on);
    document.body.classList.toggle("kc-board-on", on);
    if (on) {
      renderBoard(true);
      // Home position: the left side of the screen, vertically
      // centred. Activation always docks it there; dragging moves
      // it from there for as long as it stays open.
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.left = "10px";
      const ph = panel.getBoundingClientRect().height;
      panel.style.top = Math.max(52, Math.round((innerHeight - ph) / 2)) + "px";
    }
  }
  function pressCap(code, glyph) {
    const key = keyForCap(code, glyph);
    syncTextMode();
    if (textMode && textEl) {
      if (key === "Backspace") {
        const el = textEl;
        const s = el.selectionStart || 0;
        if (s > 0) {
          el.setRangeText("", s - 1, s, "end");
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return;
      }
      if (key === "Enter") {
        // A synthetic keydown never submits a form; the board's
        // Enter must (audit finding 5).
        if (textEl.form) textEl.form.requestSubmit();
        else textEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
        return;
      }
      if (key.length === 1) {
        textEl.setRangeText(key, textEl.selectionStart || 0, textEl.selectionEnd || 0, "end");
        textEl.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
      if (key === "Tab") {
        textEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
        return;
      }
      return;
    }
    const init = {
      key,
      code,
      bubbles: true,
      cancelable: true,
      altKey: code === "AltLeft" || code === "AltRight",
    };
    document.dispatchEvent(new KeyboardEvent("keydown", init));
    document.dispatchEvent(new KeyboardEvent("keyup", init));
  }

  /* ---------- the key handler ---------- */
  function stepTarget(dir) {
    const fw = focusedWin();
    const items = addressablesIn(fw || liveScreen() || document.body);
    if (!items.length) return;
    let i = items.indexOf(currentTarget());
    i = (i + dir + items.length) % items.length;
    targeted = items[i];
    hovered = items[i];
    document.querySelectorAll(".kc-hover").forEach((e) => e.classList.remove("kc-hover"));
    targeted.classList.add("kc-hover");
    const r = targeted.getBoundingClientRect();
    mouseX = r.left + r.width / 2;
    mouseY = r.top + r.height / 2;
    reticle.style.left = mouseX + "px";
    reticle.style.top = mouseY + "px";
    if (targeted.focus) targeted.focus({ preventScroll: true });
    setMode();
  }
  function onKeyDown(e) {
    syncTextMode();
    // The bar's own menu takes Escape first, in any mode.
    if (hudMenu && e.key === "Escape") {
      e.preventDefault();
      closeHudMenu();
      return;
    }
    // Alt+K is global: the shell's Cancel focuses a text field, so
    // a text-mode exemption here would strand the keyboard user.
    if (e.altKey && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      setBoard(!boardOn);
      return;
    }
    if (textMode) {
      if (e.key === "Escape") {
        e.preventDefault();
        disarmTextClick();
        if (textEl) textEl.blur();
        syncTextMode();
        setMode();
        return;
      }
      // Armed F — the one action key allowed out of text mode,
      // and only inside the grace period. A real pointer click
      // would blur the field first; a programmatic one does not,
      // so leave text mode explicitly, then click.
      if ((e.key === "f" || e.key === "F") && textArm) {
        e.preventDefault();
        e.stopPropagation();
        const t = textArm.target;
        disarmTextClick();
        if (textEl) textEl.blur();
        syncTextMode();
        if (t && t.isConnected) kcClick(t);
        setMode();
        renderBoard(true);
        return;
      }
      return; // keys type; the engine watches Esc and the armed F
    }
    if (e.metaKey || e.ctrlKey) return;
    if (e.altKey && (e.key === "l" || e.key === "L")) {
      e.preventDefault();
      if (labelsOn) dismissLabels(); else summonLabels();
      return;
    }
    if (e.altKey) return;

    const k = e.key;
    if (labelsOn) {
      if (k === "Escape") { e.preventDefault(); dismissLabels(); return; }
      if (k === "Backspace") { e.preventDefault(); goBack(); return; }
      if (/^[a-zA-Z]$/.test(k)) {
        const up = k.toUpperCase();
        if ("ABEGHIJKLMNOPQRSTUWXYZ".includes(up)) {
          e.preventDefault();
          typeLabel(up);
          return;
        }
        if (up === "F") { e.preventDefault(); dismissLabels(); kcClick(currentTarget()); setMode(); return; }
        if (up === "D") { e.preventDefault(); goBack(); return; }
        e.preventDefault();
        return;
      }
      return;
    }
    // App keymaps: an overridable slot pressed over an app's
    // window belongs to that app — the hovered rectangle is the
    // context. Reserved slots (F above all: the system click)
    // never reach this check; an app with no binding for the
    // slot gets the global behaviour below.
    if (OVERRIDABLE_KEYS.has(k.toLowerCase())) {
      const app = appAtCursor();
      const action = app && appActionFor(app, k.toLowerCase());
      if (action) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("nct:key", { detail: { app, key: k.toLowerCase(), action } }));
        setMode();
        return;
      }
    }
    switch (k) {
      case "f": case "F": {
        if (dragLock) { dropDragLock(); e.preventDefault(); return; }
        // A cord is being drawn: F completes it on a port, and
        // cancels it anywhere else (the click is spent on the
        // cord, not on whatever lies beneath).
        if (document.body.classList.contains("patch-pending")) {
          const pt = currentTarget() || document.elementFromPoint(mouseX, mouseY);
          if (!(pt && pt.closest && pt.closest("[data-port]"))) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("nct:patch", { detail: { op: "cancelPending" } }));
            setMode();
            return;
          }
        }
        // Fall back to the element at the cursor point: over a
        // non-addressable area (the terminal's output viewport)
        // there is no hovered control, but F still acts there.
        const t = currentTarget() || document.elementFromPoint(mouseX, mouseY);
        if (t) { e.preventDefault(); kcClick(t); setMode(); renderBoard(true); }
        return;
      }
      case "o": case "O": {
        // Open the ports of the window or element under the
        // cursor (the clock's ports too — not only windows).
        e.preventDefault();
        const el = document.elementFromPoint(mouseX, mouseY);
        const own = el && el.closest && (el.closest("[data-patch-owner]") || el.closest(".nwin"));
        if (own) {
          const owner = own.getAttribute("data-patch-owner") || own.getAttribute("data-app");
          if (owner) window.dispatchEvent(new CustomEvent("nct:patch", { detail: { op: "togglePorts", owner } }));
        }
        return;
      }
      case "p": case "P": {
        // Flip the window under the cursor onto its back.
        e.preventDefault();
        const el = document.elementFromPoint(mouseX, mouseY);
        const win = el && el.closest && el.closest(".nwin");
        if (win) window.dispatchEvent(new CustomEvent("nct:winflip", { detail: { id: win.getAttribute("data-app") } }));
        return;
      }
      case ";": case ":":
        e.preventDefault(); navGraphOp("rotL"); return;
      case "'": case "\"":
        e.preventDefault(); navGraphOp("rotR"); return;
      case "[":
        e.preventDefault(); navGraphOp("scaleDown"); return;
      case "]":
        e.preventDefault(); navGraphOp("scaleUp"); return;
      case "-": case "_":
        e.preventDefault(); fontStep(1 / 1.1); return;
      case "=": case "+":
        e.preventDefault(); fontStep(1.1); return;
      case "g": case "G": {
        // Hide/show toggle: over an app icon it hides or shows
        // that app; over a window it hides that window's app.
        e.preventDefault();
        const app = iconAtCursor() || appAtCursor();
        if (app) window.dispatchEvent(new CustomEvent("nct:appctl", { detail: { op: "toggleHide", app } }));
        setMode();
        return;
      }
      case "h": case "H":
        e.preventDefault();
        if (resizeToCursor()) setMode();
        return;
      case "d": case "D":
        e.preventDefault(); goBack(); setMode(); return;
      case "e": case "E":
        // E and R swapped (the user's default): E is collapse +
        // drag-lock — the titlebar that remains is already
        // carried, because what is underneath is draggable (all
        // windows are). A second E drops the lock. Over the
        // status bar, E collapses the bar into the task bar.
        e.preventDefault();
        if (hudAtCursor()) { setHudCollapsed(!hudCollapsed); setMode(); return; }
        if (dragLock) dropDragLock();
        else {
          collapseAtCursor();
          requestAnimationFrame(() => tryDragLock());
        }
        setMode();
        return;
      case "a": case "A":
        e.preventDefault();
        if (boardOn) { setBoard(false); setMode(); return; }
        if (document.body.classList.contains("patch-pending")) {
          window.dispatchEvent(new CustomEvent("nct:patch", { detail: { op: "cancelPending" } }));
          setMode();
          return;
        }
        {
          const at = document.elementFromPoint(mouseX, mouseY);
          const cord = at && at.closest && at.closest("[data-cord]");
          if (cord) {
            window.dispatchEvent(new CustomEvent("nct:patch", { detail: { op: "removeCord", id: cord.getAttribute("data-cord") } }));
            setMode();
            return;
          }
        }
        {
          // Over a WindowTransformer stack item, A closes that
          // window where it sits in the stack.
          const atS = document.elementFromPoint(mouseX, mouseY);
          const si = atS && atS.closest && atS.closest("[data-stack-item]");
          if (si) {
            window.dispatchEvent(new CustomEvent("nct:appctl", { detail: { op: "quit", app: si.getAttribute("data-stack-item") } }));
            setMode();
            return;
          }
        }
        {
          // Over an app icon, A quits the app (an open menu
          // still closes first — that courtesy is the ladder's).
          const menuOpen = document.querySelector(".dropdown.open, .launcher.open, .ctxmenu.open");
          const ic = !menuOpen && iconAtCursor();
          if (ic) {
            window.dispatchEvent(new CustomEvent("nct:appctl", { detail: { op: "quit", app: ic } }));
            setMode();
            return;
          }
        }
        if (closeAtCursor()) setMode();
        return;
      case "r": case "R":
        // R took E's old job in the swap: the plain collapse,
        // no lock. Over the status bar it collapses the bar too.
        e.preventDefault();
        if (hudAtCursor()) { setHudCollapsed(!hudCollapsed); setMode(); return; }
        if (collapseAtCursor()) setMode();
        return;
      case "0": {
        // Cycle the built-in style set of the element under the
        // cursor — desktop widgets carry data-widget and the
        // shell owns their style sets. Everywhere else 0 is
        // left alone.
        const at = document.elementFromPoint(mouseX, mouseY);
        const w = at && at.closest && at.closest("[data-widget]");
        if (w) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("nct:widgetstyle", { detail: { id: w.getAttribute("data-widget") } }));
          setMode();
        }
        return;
      }
      case "9": {
        // Freeze toggle (its key since \\ became Configure):
        // the window at the cursor — or a frozen one found
        // geometrically, since its body takes no events — else
        // the mounted desktop-layer app beneath.
        e.preventDefault();
        const w9 = winAtCursor();
        if (w9) {
          window.dispatchEvent(new CustomEvent("nct:freeze", { detail: { target: "window", id: w9.getAttribute("data-app") } }));
        } else {
          const fw9 = frozenWinAtCursor();
          if (fw9) {
            window.dispatchEvent(new CustomEvent("nct:freeze", { detail: { target: "window", id: fw9.getAttribute("data-app") } }));
          } else {
            // A desktop widget under the cursor freezes too —
            // widgets are frozen by default, so 9 over one is
            // usually the unfreeze.
            const wEl = document.elementFromPoint(mouseX, mouseY);
            const wd = wEl && wEl.closest && wEl.closest("[data-widget]");
            if (wd) {
              window.dispatchEvent(new CustomEvent("nct:freeze", { detail: { target: "widget", id: wd.getAttribute("data-widget") } }));
            } else {
              const layerEl = document.querySelector("[data-layer-app]");
              if (layerEl) {
                window.dispatchEvent(new CustomEvent("nct:freeze", { detail: { target: "layer", id: layerEl.getAttribute("data-layer-app") } }));
              }
            }
          }
        }
        setMode();
        return;
      }
      case "\\": {
        // The global Configure key: whatever the cursor hovers
        // that carries a configure hook gets its Settings
        // opened — a launch item, the launch column itself, a
        // widget, a window's app, a layer app. Elements declare
        // the hook with data-configure; windows and layer apps
        // resolve through their app id. With no hook under the
        // cursor, the reticle says so (a shake) and nothing
        // opens. (Freeze, this key's previous job, keeps its
        // context menus.)
        e.preventDefault();
        const target = configureTargetAtCursor();
        if (target) {
          window.dispatchEvent(new CustomEvent("nct:configure", { detail: { target } }));
        } else {
          reticle.classList.remove("kc-noconfig");
          void reticle.offsetWidth;
          reticle.classList.add("kc-noconfig");
          setTimeout(() => reticle.classList.remove("kc-noconfig"), 420);
        }
        setMode();
        return;
      }
      case "s": case "S": {
        // Minimize the window under the cursor. The minimized
        // window becomes a list item under (or beside) its app's
        // launch-bar button — the shell renders it (Desktop.jsx
        // .minlist) — and F over that item restores it, F being
        // the click, as everywhere.
        e.preventDefault();
        const wS = winAtCursor();
        if (wS) {
          window.dispatchEvent(new CustomEvent("nct:appctl", { detail: { op: "minimize", app: wS.getAttribute("data-app") } }));
        }
        setMode();
        return;
      }
      case "t": case "T": {
        e.preventDefault();
        const win = winAtCursor();
        if (win && !win.classList.contains("vshade")) {
          const id = win.getAttribute("data-app");
          if (id) vshade(id, true);
        }
        setMode();
        return;
      }
      case "Tab":
        e.preventDefault(); stepTarget(e.shiftKey ? -1 : 1); return;
      case " ":
        e.preventDefault();
        if (dragLock) dropDragLock(); else tryDragLock();
        return;
      case "Enter": {
        const t = currentTarget() || document.elementFromPoint(mouseX, mouseY);
        if (t) { e.preventDefault(); kcClick(t); setMode(); }
        return;
      }
      case "/": {
        const sb = document.querySelector("#startBtn");
        if (sb) { e.preventDefault(); sb.click(); }
        return;
      }
      case "Escape":
        if (dragLock) { e.preventDefault(); cancelDragLock(); return; }
        if (document.body.classList.contains("patch-pending")) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("nct:patch", { detail: { op: "cancelPending" } }));
          setMode();
        }
        return;
    }
  }

  /* ---------- board dragging (by the panel head) ---------- */
  let panelDrag = null;
  function onPanelMouseMove(e) {
    if (!panelDrag) return;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    panel.style.left =
      Math.min(innerWidth - 60, Math.max(-w + 80, e.clientX - panelDrag.dx)) + "px";
    panel.style.top =
      Math.min(innerHeight - 30, Math.max(0, e.clientY - panelDrag.dy)) + "px";
  }
  function onPanelMouseUp() {
    panelDrag = null;
  }
  function beginPanelDrag(e) {
    const r = panel.getBoundingClientRect();
    panelDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    panel.style.left = r.left + "px";
    panel.style.top = r.top + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  /* ---------- wiring ---------- */
  const hudBtn = root.querySelector("#kcHudBtn");
  hudBtn.style.display = "none";
  hudBtn.addEventListener("click", () => setHudCollapsed(false));
  root.querySelector("#kcHudCollapse").addEventListener("click", () => setHudCollapsed(true));

  /* The scroll wheel zooms desktop-layer apps (NavGraph
   * today): with a layer mounted, wheel steps over the desktop
   * walk the same scale the [ ] keys walk. Windows, frames and
   * the engine's own furniture keep their wheel. Steps
   * accumulate, so a trackpad flick doesn't slam the clamp. */
  let wheelAcc = 0;
  document.addEventListener("wheel", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest(".nwin, iframe, #kcRoot")) return;
    if (!document.querySelector(".ng-layer")) return;
    if (document.querySelector(".ng-layer.frozen")) return;
    e.preventDefault();
    wheelAcc += e.deltaY;
    while (wheelAcc <= -50) {
      window.dispatchEvent(new CustomEvent("nct:navgraph", { detail: { op: "scaleUp" } }));
      wheelAcc += 50;
    }
    while (wheelAcc >= 50) {
      window.dispatchEvent(new CustomEvent("nct:navgraph", { detail: { op: "scaleDown" } }));
      wheelAcc -= 50;
    }
  }, { capture: true, passive: false });
  document.addEventListener("contextmenu", onHudContextMenu, true);
  tab.addEventListener("mousedown", (e) => {
    e.preventDefault();
    setBoard(!boardOn);
  });
  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("mousemove", onPanelMouseMove, true);
  document.addEventListener("mouseup", onPanelMouseUp, true);
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("focusin", onFocusChange);
  document.addEventListener("focusout", onFocusChange);
  const boardTimer = setInterval(() => { if (boardOn) renderBoard(false); }, 900);
  applyHudOrient();
  setMode();

  return {
    destroy() {
      closeHudMenu();
      disarmTextClick();
      clearInterval(boardTimer);
      clearTimeout(bufferTimer);
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("mousemove", onPanelMouseMove, true);
      document.removeEventListener("mouseup", onPanelMouseUp, true);
      document.removeEventListener("contextmenu", onHudContextMenu, true);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusChange);
      document.removeEventListener("focusout", onFocusChange);
      root.remove();
    },
  };
}
