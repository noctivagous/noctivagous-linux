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
  let labelsOn = false;
  let marks = [];
  let buffer = "";
  let bufferTimer = 0;
  let dragLock = null; // {kind:'win', el, id, dx, dy, ox, oy} | {kind:'range', el}
  let boardOn = false;
  let boardSig = "";
  let filesFolder = "Home";
  const folderTrail = [];
  const winTrail = [];

  /* ---------- DOM (one engine-owned root) ---------- */
  const root = document.createElement("div");
  root.id = "kcRoot";
  root.innerHTML = `
    <div id="kcReticle"></div>
    <div id="kcHud"><span class="m">KEY-CLICK</span><span class="tgt">target — —</span><span class="hint">F click · D back · Tab target · Space drag-lock · Alt+L labels · Alt+K keys</span></div>
    <button id="kcTab" type="button" aria-label="Toggle onscreen keyboard" title="Onscreen keyboard (Alt+K)">KEYBOARD</button>
    <div id="kcPanel" hidden></div>`;
  document.body.appendChild(root);
  const reticle = root.querySelector("#kcReticle");
  const hud = root.querySelector("#kcHud");
  const hudMode = hud.querySelector(".m");
  const hudTgt = hud.querySelector(".tgt");
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
      document.body.classList.toggle("kc-textmode", t);
      setMode();
      renderBoard(true);
    }
  }
  function currentTarget() {
    if (targeted && targeted.isConnected && visible(targeted)) return targeted;
    if (hovered && hovered.isConnected && visible(hovered)) return hovered;
    return null;
  }
  function setMode() {
    let m;
    if (textMode) {
      m = "TEXT · " + (textEl ? nameOf(textEl) : "field");
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
    const tb = el.closest && el.closest(".nwin .titlebar");
    if (tb) {
      const w = tb.closest(".nwin");
      if (w) w.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      targeted = tb;
      return true;
    }
    const t = el.closest
      ? el.closest("button, a[href], input, select, textarea, .dicon, [tabindex]") || el
      : el;
    if (t.focus && t.tagName !== "BUTTON") t.focus({ preventScroll: true });
    if (t.click) t.click();
    targeted = t;
    return true;
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
  function tryDragLock() {
    const el = document.elementFromPoint(mouseX, mouseY);
    if (!el) return;
    const range = el.closest && el.closest('input[type="range"]');
    if (range) {
      dragLock = { kind: "range", el: range };
      range.classList.add("kc-dragging");
      setRangeFromCursor(range);
      setMode();
      return;
    }
    const tb = el.closest && el.closest(".nwin .titlebar");
    const win = tb && tb.closest(".nwin");
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
      win.classList.add("kc-dragging");
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
    if (dragLock && dragLock.el) dragLock.el.classList.remove("kc-dragging");
    dragLock = null;
    setMode();
  }
  function cancelDragLock() {
    if (dragLock && dragLock.kind === "win") winMove(dragLock.id, dragLock.ox, dragLock.oy);
    dropDragLock();
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
      document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

  /* ---------- pointer tracking ---------- */
  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (dragLock) { dragMove(e); return; }
    reticle.style.left = mouseX + "px";
    reticle.style.top = mouseY + "px";
    const el = document.elementFromPoint(mouseX, mouseY);
    const t = el && el.closest
      ? el.closest("button, a[href], input, select, textarea, .dicon, [tabindex], .nwin .titlebar")
      : null;
    if (t !== hovered) {
      if (hovered) hovered.classList.remove("kc-hover");
      hovered = t;
      if (hovered) hovered.classList.add("kc-hover");
      setMode();
    }
  }
  function onMouseDown(e) {
    const t = e.target.closest
      ? e.target.closest("button, a[href], input, select, textarea, .dicon, [tabindex], .nwin .titlebar")
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
    if (on) renderBoard(true);
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
        if (textEl) textEl.blur();
        syncTextMode();
        setMode();
      }
      return; // keys type; the engine only watches Esc
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
        const t = currentTarget();
        if (t) { e.preventDefault(); kcClick(t); setMode(); renderBoard(true); }
        return;
      }
      case "d": case "D":
        e.preventDefault(); goBack(); setMode(); return;
      case "Tab":
        e.preventDefault(); stepTarget(e.shiftKey ? -1 : 1); return;
      case " ":
        e.preventDefault();
        if (dragLock) dropDragLock(); else tryDragLock();
        return;
      case "Enter": {
        const t = currentTarget();
        if (t) { e.preventDefault(); kcClick(t); setMode(); }
        return;
      }
      case "/": {
        const sb = document.querySelector("#startBtn");
        if (sb) { e.preventDefault(); sb.click(); }
        return;
      }
      case "Escape":
        if (dragLock) { e.preventDefault(); cancelDragLock(); }
        return;
    }
  }

  /* ---------- wiring ---------- */
  tab.addEventListener("mousedown", (e) => {
    e.preventDefault();
    setBoard(!boardOn);
  });
  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("focusin", onFocusChange);
  document.addEventListener("focusout", onFocusChange);
  const boardTimer = setInterval(() => { if (boardOn) renderBoard(false); }, 900);
  setMode();

  return {
    destroy() {
      clearInterval(boardTimer);
      clearTimeout(bufferTimer);
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusChange);
      document.removeEventListener("focusout", onFocusChange);
      root.remove();
    },
  };
}
