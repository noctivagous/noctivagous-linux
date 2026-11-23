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
    <div id="kcHud"><span class="kc-mode">KEY-CLICK</span><span class="kc-target">target — —</span><span class="kc-hints"><span class="kc-kbd">F</span> click <span class="kc-kbd">E</span> collapse <span class="kc-kbd">R</span> collapse+drag <span class="kc-kbd">T</span> vertical <span class="kc-kbd">A</span> close <span class="kc-kbd">D</span> back <span class="kc-kbd">Tab</span> target <span class="kc-kbd">Space</span> drag-lock <span class="kc-kbd">Alt+L</span> labels <span class="kc-kbd">Alt+K</span> keys</span></div>
    <button id="kcHudBtn" type="button" title="Key-click status — click to expand, right-click to collapse">KEY-CLICK</button>
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
      setHudCollapsed(!hudCollapsed);
    }
  }
  const reticle = root.querySelector("#kcReticle");
  const hud = root.querySelector("#kcHud");
  const hudMode = hud.querySelector(".kc-mode");
  const hudTgt = hud.querySelector(".kc-target");
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
    onMode(m);
  }

  /* ---------- activation (through the elements' own handlers) --- */
  function kcClick(el) {
    if (!el) return false;
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
  function winAtCursor() {
    const el = document.elementFromPoint(mouseX, mouseY);
    return el && el.closest ? el.closest(".nwin") : null;
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
      case "d": case "D":
        e.preventDefault(); goBack(); setMode(); return;
      case "e": case "E":
        e.preventDefault();
        if (collapseAtCursor()) setMode();
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
        if (closeAtCursor()) setMode();
        return;
      case "r": case "R":
        // E + Space in one press: collapse, then drag-lock the
        // titlebar that remains. A second R drops the lock.
        e.preventDefault();
        if (dragLock) dropDragLock();
        else {
          collapseAtCursor();
          requestAnimationFrame(() => tryDragLock());
        }
        setMode();
        return;
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
  setMode();

  return {
    destroy() {
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
