/* NCT Desktop — key-clicks (bimodal control), the default input mode.
 *
 * Steering and activation are separate modalities: the cursor steers,
 * the keyboard activates. This file is the KeyPilot / Floating Marker
 * model applied to the desktop, following the house rules established
 * across demo-de (see src/flat-keys.js and refs/bimodal/):
 *
 *  - The thing under the cursor is the addressee. F clicks it.
 *  - Labels are OPT-IN: Alt+L summons letter chips; bare letters do
 *    nothing as addresses until then. The label alphabet skips the
 *    operator letters (C, D, F, V) — operators are not addresses.
 *  - D goes back, scoped: buffer → drag-lock → open menu → the focused
 *    window's own navigation (Files folders) → previous window.
 *  - Esc releases: exits label mode, cancels drag-lock, leaves text
 *    mode, clears the target.
 *  - Space is drag-lock: pick up a window by its titlebar (or lock a
 *    slider to the cursor), steer with the mouse, Space again to drop.
 *  - Tab is the accumulative target: it steps the target through the
 *    addressable things in the current scope; F then clicks the target.
 *  - TEXT MODE is automatic and exclusive: while a genuine text-entry
 *    control has focus (input text/password/search, textarea,
 *    contentEditable — the flat-keys guard), keys type text and only
 *    Esc is monitored. Sliders, checkboxes and selects do NOT swallow
 *    key-clicks (the demo-de slider-focus lesson).
 *  - Alt+K toggles the keyboard panel: the board is fixed, bindings
 *    are sparse per scope (shell + the focused window's scope), in the
 *    Floating Marker sparse-database arrangement.
 *  - Mouse clicks still work — bimodal is dual input, not a ban.
 *
 * Everything here dispatches through the desktop's own click handlers
 * (synthetic .click()), so key-clicks can never drift from mouse behaviour.
 */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- addressing ---------------- */

  // Same alphabet as src/flat-keys.js: no C, D, F, V — the operators.
  var LABEL_ALPHABET = "ABEGHIJKLMNOPQRSTUWXYZ";
  function labelForIndex(i) {
    if (i < LABEL_ALPHABET.length) return LABEL_ALPHABET[i];
    var j = i - LABEL_ALPHABET.length;
    return LABEL_ALPHABET[Math.floor(j / LABEL_ALPHABET.length)] + LABEL_ALPHABET[j % LABEL_ALPHABET.length];
  }
  function resolveBuffer(buffer, labels) {
    if (!buffer) return { kind: "dead" };
    var isPrefix = labels.some(function (l) { return l.length > buffer.length && l.indexOf(buffer) === 0; });
    var exact = labels.indexOf(buffer) !== -1;
    if (exact && !isPrefix) return { kind: "match", label: buffer };
    if (isPrefix || exact) return { kind: "pending" };
    return { kind: "dead" };
  }

  // The flat-keys text-entry guard, verbatim in spirit: only genuine
  // text-entry controls keep their keys.
  function isTextEntryControl(el) {
    if (!el || !el.tagName) return false;
    if (el.isContentEditable) return true;
    var tag = el.tagName.toLowerCase();
    if (tag === "textarea") return true;
    if (tag === "input") {
      var t = (el.getAttribute("type") || "text").toLowerCase();
      return ["text", "search", "password", "email", "url", "number"].indexOf(t) !== -1;
    }
    return false;
  }

  var ADDRESSABLE = [
    "button", "a[href]", "[data-open]", "[data-act]", "[data-c]", "[data-lact]",
    ".dicon", ".task", ".lrow", ".userchip", "#fileTree button", ".tabstrip button",
    "input[type=checkbox]", "input[type=radio]", "input[type=range]", "select", ".swatch", ".app"
  ].join(",");

  function activeScreen() {
    if ($("#desktopScreen") && $("#desktopScreen").classList.contains("on")) return $("#desktopScreen");
    return $("#loginScreen");
  }
  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    var s = window.getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden";
  }
  function addressables(scope) {
    scope = scope || activeScreen();
    if (!scope) return [];
    return $$(ADDRESSABLE, scope).filter(function (el) {
      return visible(el) && !el.disabled && !el.closest("#kcHud") && !el.closest("#kcPanel");
    });
  }
  function nameOf(el) {
    if (!el) return "—";
    var t = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim().replace(/\s+/g, " ");
    if (!t && el.id) t = "#" + el.id;
    if (!t) t = el.tagName.toLowerCase();
    return t.length > 34 ? t.slice(0, 33) + "…" : t;
  }

  /* ---------------- state ---------------- */

  var hovered = null;      // element under the cursor (the addressee)
  var targeted = null;     // element chosen by Tab or by a label
  var mouseX = innerWidth / 2, mouseY = innerHeight / 2;
  var labelMode = false;
  var labelMap = [];       // [{el, label, chip}]
  var buffer = "";
  var bufferTimer = null;
  var dragLock = null;     // {kind:'win', el, dx, dy, ox, oy} | {kind:'range', el}
  var textMode = false;    // explicit state (the nav-graph discipline in
  var textField = null;    // flat-nav.js): entered deliberately when a
                           // field takes focus, left on Esc or blur —
                           // DOM focus is the backstop, not the mode itself
  var filesHistory = [];   // folder keys, for D-back in Files
  var lastFolderBtn = null;

  /* ---------------- HUD + keyboard panel ---------------- */

  var hud = document.createElement("div");
  hud.id = "kcHud";
  hud.innerHTML =
    '<span class="kc-mode" id="kcMode">KEY-CLICK</span>' +
    '<span class="kc-target" id="kcTarget">target —</span>' +
    '<span class="kc-buffer" id="kcBuffer"></span>' +
    '<span class="kc-hints">F click · D back · Tab target · Space drag-lock · Alt+L labels · Alt+K keys</span>';
  document.body.appendChild(hud);

  var panel = document.createElement("div");
  panel.id = "kcPanel";
  panel.hidden = true;
  document.body.appendChild(panel);

  // The keyboard lives collapsed (KeyPilot's arrangement): a slim tab
  // at the screen edge is its presence; Alt+K or the tab expands it,
  // the tab / Alt+K / its own collapse button folds it away again.
  // Collapsed is the default — the board never covers the desktop
  // until summoned, and F clicks things whether it is open or not.
  var tab = document.createElement("button");
  tab.type = "button";
  tab.id = "kcTab";
  tab.textContent = "KEYBOARD";
  tab.setAttribute("aria-label", "Show onscreen keyboard (Alt+K)");
  document.body.appendChild(tab);
  function setPanel(open) {
    panel.hidden = !open;
    tab.classList.toggle("open", open);
    if (open) renderPanel();
  }
  tab.addEventListener("mousedown", function (e) { e.preventDefault(); });
  tab.addEventListener("click", function () { setPanel(panel.hidden); });

  /* The onscreen keyboard (Alt+K). "Onscreen" here means three things,
     all of them load-bearing, not a picture of a keyboard:
       1. LEGEND — the board is fixed data; bindings are SPARSE per
          scope (shell + the focused window's scope + text), resolved
          at render time. Only bound caps carry a name; the rest are
          bare glyphs. The board therefore shows what the keyboard
          currently IS — it relabels as mode and scope change (in text
          mode the one bound cap is Esc: EXIT TEXT).
       2. INPUT DEVICE — every cap is pressable (mouse or touch). A
          press dispatches the same keydown the physical key would, so
          bimodal control works with no physical keyboard at all — the
          tablet arrangement in the refs: one hand steers the cursor,
          the other presses the onscreen click caps.
       3. TEXT BOARD — in text mode the caps type their glyphs into
          the focused field, like any onscreen keyboard, and Esc
          returns the board to operator caps.
     Board rows and the sparse tables mirror src/flat-keys.js. */
  var cap = function (code, glyph, w) { return { code: code, glyph: glyph, w: w || 1 }; };
  var BOARD_ROWS = [
    [cap("Backquote", "`"), cap("Digit1", "1"), cap("Digit2", "2"), cap("Digit3", "3"), cap("Digit4", "4"), cap("Digit5", "5"), cap("Digit6", "6"), cap("Digit7", "7"), cap("Digit8", "8"), cap("Digit9", "9"), cap("Digit0", "0"), cap("Minus", "-"), cap("Equal", "="), cap("Backspace", "⌫", 2)],
    [cap("Tab", "Tab", 1.5), cap("KeyQ", "Q"), cap("KeyW", "W"), cap("KeyE", "E"), cap("KeyR", "R"), cap("KeyT", "T"), cap("KeyY", "Y"), cap("KeyU", "U"), cap("KeyI", "I"), cap("KeyO", "O"), cap("KeyP", "P"), cap("BracketLeft", "["), cap("BracketRight", "]")],
    [cap("CapsLock", "Caps", 1.75), cap("KeyA", "A"), cap("KeyS", "S"), cap("KeyD", "D"), cap("KeyF", "F"), cap("KeyG", "G"), cap("KeyH", "H"), cap("KeyJ", "J"), cap("KeyK", "K"), cap("KeyL", "L"), cap("Semicolon", ";"), cap("Quote", "'"), cap("Enter", "Enter", 2.25)],
    [cap("ShiftLeft", "Shift", 2.25), cap("KeyZ", "Z"), cap("KeyX", "X"), cap("KeyC", "C"), cap("KeyV", "V"), cap("KeyB", "B"), cap("KeyN", "N"), cap("KeyM", "M"), cap("Comma", ","), cap("Period", "."), cap("Slash", "/"), cap("ShiftRight", "Shift", 2.75)],
    [cap("AltLeft", "Alt+L/K", 1.75), cap("Space", "Space", 6.25), cap("Escape", "Esc", 1.5)]
  ];
  var KEY_FOR_CODE = { Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Tab: "Tab", Enter: "Enter", Escape: "Escape", Space: " ", Backspace: "Backspace", CapsLock: "CapsLock" };
  function keyForCap(c) {
    if (KEY_FOR_CODE[c.code]) return KEY_FOR_CODE[c.code];
    if (/^Key/.test(c.code)) return c.code.slice(3).toLowerCase();
    if (/^Digit/.test(c.code)) return c.code.slice(5);
    return c.glyph;
  }
  var BINDINGS = {
    shell: { KeyF: "CLICK", KeyD: "BACK", Tab: "TARGET", Space: "DRAG-LOCK", Escape: "RELEASE", Enter: "OPEN", Slash: "LAUNCHER", AltLeft: "LABELS · KEYS" },
    files: { KeyD: "FOLDER BACK", Enter: "OPEN" },
    terminal: { Enter: "RUN" },
    settings: {},
    text: { Escape: "EXIT TEXT" }
  };
  function currentScope() {
    if (textMode) return "text";
    var fw = $(".nwin.focused", activeScreen());
    if (!fw) return "shell";
    var t = fw.querySelector(".tt");
    var name = t ? t.textContent.toLowerCase() : "";
    if (name.indexOf("file") !== -1) return "files";
    if (name.indexOf("terminal") !== -1) return "terminal";
    if (name.indexOf("note") !== -1) return "notes";
    if (name.indexOf("setting") !== -1 || name.indexOf("control") !== -1) return "settings";
    return "shell";
  }
  function bindingFor(code, scope) {
    if (scope === "text") return BINDINGS.text[code] || null;
    return (BINDINGS[scope] && BINDINGS[scope][code]) || BINDINGS.shell[code] || null;
  }
  function pressCap(c) {
    if (textMode) {
      if (c.code === "Escape") {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
        return;
      }
      var el = document.activeElement;
      if (isTextEntryControl(el)) {
        if (c.code === "Backspace") {
          var s = el.selectionStart || 0;
          if (s > 0) { el.setRangeText("", s - 1, s, "end"); el.dispatchEvent(new Event("input", { bubbles: true })); }
        } else if (c.code === "Enter" && el.tagName === "TEXTAREA") {
          el.setRangeText("\n", el.selectionStart || 0, el.selectionEnd || 0, "end");
          el.dispatchEvent(new Event("input", { bubbles: true }));
        } else if (c.code === "Enter") {
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
        } else if (c.glyph.length === 1) {
          el.setRangeText(c.glyph.toLowerCase(), el.selectionStart || 0, el.selectionEnd || 0, "end");
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      renderPanel();
      return;
    }
    if (c.code === "AltLeft") { toggleLabels(); return; }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: keyForCap(c), code: c.code, bubbles: true, cancelable: true }));
  }
  function renderPanel() {
    var scope = currentScope();
    var sig = scope + "|" + (textMode ? "text" : "nav");
    // Rebuilding the caps mid-press would eat the click, so an unchanged
    // scope leaves the standing board alone.
    if (panel.dataset.sig === sig && $(".kc-cap", panel)) return;
    panel.dataset.sig = sig;
    var scopesLabel = textMode ? "SHELL + TEXT" : "SHELL" + (scope !== "shell" ? " + " + scope.toUpperCase() : "");
    panel.innerHTML = '<div class="kc-panel-head"><span>KEYBOARD · SCOPE ' + scopesLabel + " — sparse: only bound caps carry a name; press a cap to press its key</span>" +
      '<button type="button" class="kc-collapse" aria-label="Collapse keyboard">▾</button></div>' +
      BOARD_ROWS.map(function (row) {
        return '<div class="kc-krow">' + row.map(function (c) {
          var b = bindingFor(c.code, scope);
          return '<button type="button" class="kc-cap' + (b ? " bound" : "") + '" data-code="' + c.code + '" style="flex:' + c.w + ' 1 0">' +
            '<span class="g">' + c.glyph + "</span>" + (b ? '<span class="n">' + b + "</span>" : "") + "</button>";
        }).join("") + "</div>";
      }).join("");
    var col = $(".kc-collapse", panel);
    if (col) col.addEventListener("click", function () { setPanel(false); });
    $$(".kc-cap", panel).forEach(function (btn) {
      btn.addEventListener("mousedown", function (e) { e.preventDefault(); }); // never steal text focus
      btn.addEventListener("click", function () {
        var code = btn.getAttribute("data-code");
        for (var r = 0; r < BOARD_ROWS.length; r++) for (var i = 0; i < BOARD_ROWS[r].length; i++)
          if (BOARD_ROWS[r][i].code === code) { pressCap(BOARD_ROWS[r][i]); return; }
      });
    });
  }

  function setMode() {
    var m = $("#kcMode");
    if (textMode) { m.textContent = "TEXT" + (textField ? " · " + textField : ""); hud.classList.add("text"); }
    else if (labelMode) { m.textContent = "LABELS" + (buffer ? " · " + buffer : ""); hud.classList.remove("text"); }
    else if (dragLock) { m.textContent = "DRAG-LOCK"; hud.classList.remove("text"); }
    else { m.textContent = "KEY-CLICK"; hud.classList.remove("text"); }
    $("#kcTarget").textContent = "target — " + nameOf(targeted || hovered);
    $("#kcBuffer").textContent = labelMode && buffer ? "[" + buffer + "]" : "";
    if (!panel.hidden) renderPanel();
  }

  /* ---------------- hover + target ---------------- */

  function clearMarks() {
    $$(".kc-hover,.kc-hover-text,.kc-target").forEach(function (el) {
      el.classList.remove("kc-hover", "kc-hover-text", "kc-target");
    });
  }
  function mark() {
    clearMarks();
    var hov = hovered, tar = targeted;
    if (tar && visible(tar)) tar.classList.add("kc-target");
    if (hov && hov !== tar) hov.classList.add(isTextEntryControl(hov) ? "kc-hover-text" : "kc-hover");
    setMode();
  }
  document.addEventListener("mousemove", function (e) {
    mouseX = e.clientX; mouseY = e.clientY;
    if (dragLock) { dragMove(e); return; }
    var el = document.elementFromPoint(mouseX, mouseY);
    var addr = el && el.closest ? el.closest(ADDRESSABLE) : null;
    if (addr && !visible(addr)) addr = null;
    if (addr !== hovered) { hovered = addr; mark(); }
  }, { passive: true });
  document.addEventListener("mousedown", function (e) {
    var addr = e.target && e.target.closest ? e.target.closest(ADDRESSABLE) : null;
    if (addr) { targeted = addr; mark(); }
  }, true);

  function ripple() {
    var r = document.createElement("div");
    r.className = "kc-ripple";
    r.style.left = mouseX + "px"; r.style.top = mouseY + "px";
    document.body.appendChild(r);
    setTimeout(function () { r.classList.add("go"); }, 10);
    setTimeout(function () { r.remove(); }, 480);
  }

  /* ---------------- clicking ---------------- */

  function kcClick(el) {
    if (!el) { hud.classList.add("kc-deny"); setTimeout(function () { hud.classList.remove("kc-deny"); }, 220); return; }
    ripple();
    if (el.tagName === "INPUT" && el.getAttribute("type") === "range") {
      setRangeFromCursor(el);
      el.focus && el.focus({ preventScroll: true });
      return;
    }
    if (isTextEntryControl(el)) { el.focus && el.focus(); return; }
    if (el.tagName === "INPUT" && (el.getAttribute("type") === "checkbox" || el.getAttribute("type") === "radio")) {
      el.click();
      return;
    }
    el.click();
  }
  function setRangeFromCursor(el) {
    var r = el.getBoundingClientRect();
    if (r.width === 0) return;
    var min = parseFloat(el.min || "0"), max = parseFloat(el.max || "100");
    var ratio = Math.min(1, Math.max(0, (mouseX - r.left) / r.width));
    el.value = String(Math.round(min + ratio * (max - min)));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /* ---------------- Files history (for D) ---------------- */

  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("#fileTree button") : null;
    if (!b) return;
    var k = b.getAttribute("data-folder");
    if (lastFolderBtn !== k) { filesHistory.push(k); lastFolderBtn = k; }
  }, true);

  /* ---------------- D: scoped back ---------------- */

  function anyMenuOpen() {
    return !!$(".open", activeScreen()) && $$(".open", activeScreen()).some(function (el) {
      return !el.classList.contains("screen") && visible(el);
    });
  }
  function back() {
    if (buffer) { buffer = ""; setMode(); return; }
    if (dragLock) { cancelDragLock(); return; }
    if (anyMenuOpen()) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return;
    }
    // Files: step back through visited folders.
    var fw = $(".nwin.focused", activeScreen());
    if (fw && filesHistory.length > 1 && fw.querySelector("#fileTree")) {
      filesHistory.pop();
      var prev = filesHistory[filesHistory.length - 1];
      var btn = fw.querySelector('#fileTree button[data-folder="' + prev + '"]');
      if (btn) { lastFolderBtn = prev; btn.click(); return; }
    }
    // Otherwise: hand focus to the previous window in the stack.
    var wins = $$(".nwin", activeScreen()).filter(visible);
    if (wins.length > 1) {
      var idx = wins.indexOf(fw);
      var prevWin = wins[(idx - 1 + wins.length) % wins.length];
      if (prevWin && prevWin !== fw) {
        prevWin.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        targeted = null; mark();
      }
    }
  }

  /* ---------------- labels (Alt+L) ---------------- */

  function clearLabels() {
    labelMap.forEach(function (m) { m.chip.remove(); });
    labelMap = []; buffer = "";
    if (bufferTimer) { clearTimeout(bufferTimer); bufferTimer = null; }
  }
  function buildLabels() {
    clearLabels();
    var els = addressables().slice(0, 52);
    labelMap = els.map(function (el, i) {
      var chip = document.createElement("span");
      chip.className = "kc-chip";
      chip.textContent = labelForIndex(i);
      document.body.appendChild(chip);
      return { el: el, label: labelForIndex(i), chip: chip };
    });
    placeLabels();
  }
  function placeLabels() {
    labelMap.forEach(function (m) {
      if (!visible(m.el)) { m.chip.style.display = "none"; return; }
      var r = m.el.getBoundingClientRect();
      m.chip.style.display = "";
      m.chip.style.left = Math.max(0, r.left - 2) + "px";
      m.chip.style.top = Math.max(0, r.top - 9) + "px";
      var partial = buffer && m.label.indexOf(buffer) === 0;
      m.chip.classList.toggle("dim", !!buffer && !partial);
      m.chip.classList.toggle("hit", !!buffer && partial);
    });
  }
  setInterval(function () { if (labelMode) placeLabels(); }, 350);
  window.addEventListener("resize", function () { if (labelMode) placeLabels(); });
  function toggleLabels(force) {
    labelMode = typeof force === "boolean" ? force : !labelMode;
    if (labelMode) buildLabels(); else clearLabels();
    setMode();
  }
  function typeLabel(key) {
    buffer += key;
    if (bufferTimer) clearTimeout(bufferTimer);
    bufferTimer = setTimeout(function () { buffer = ""; placeLabels(); setMode(); }, 1600);
    var labels = labelMap.map(function (m) { return m.label; });
    var res = resolveBuffer(buffer, labels);
    placeLabels(); setMode();
    if (res.kind === "match") {
      var m = labelMap.filter(function (x) { return x.label === res.label; })[0];
      buffer = "";
      if (bufferTimer) { clearTimeout(bufferTimer); bufferTimer = null; }
      if (m) { targeted = m.el; hovered = m.el; mark(); placeLabels(); }
    } else if (res.kind === "dead") {
      buffer = "";
      if (bufferTimer) { clearTimeout(bufferTimer); bufferTimer = null; }
      hud.classList.add("kc-deny"); setTimeout(function () { hud.classList.remove("kc-deny"); }, 220);
      placeLabels(); setMode();
    }
  }

  /* ---------------- drag-lock (Space) ---------------- */

  function tryDragLock() {
    var el = targeted || hovered;
    // Window by titlebar: the hovered point is what counts, not the button.
    var atPoint = document.elementFromPoint(mouseX, mouseY);
    var bar = atPoint && atPoint.closest ? atPoint.closest(".nwin .titlebar") : null;
    if (bar && !atPoint.closest(".wbtn") && !atPoint.closest("#loginWin")) {
      var win = bar.closest(".nwin");
      var r = win.getBoundingClientRect();
      dragLock = { kind: "win", el: win, dx: mouseX - r.left, dy: mouseY - r.top, ox: win.style.left, oy: win.style.top };
      win.classList.add("kc-dragging");
      setMode(); return true;
    }
    if (el && el.tagName === "INPUT" && el.getAttribute("type") === "range") {
      dragLock = { kind: "range", el: el };
      setRangeFromCursor(el);
      setMode(); return true;
    }
    return false;
  }
  function dragMove(e) {
    if (dragLock.kind === "win") {
      var w = dragLock.el;
      var nx = Math.min(innerWidth - 80, Math.max(-w.offsetWidth + 120, e.clientX - dragLock.dx));
      var ny = Math.min(innerHeight - 40, Math.max(0, e.clientY - dragLock.dy));
      w.style.left = nx + "px"; w.style.top = ny + "px";
    } else if (dragLock.kind === "range") {
      mouseX = e.clientX; mouseY = e.clientY;
      setRangeFromCursor(dragLock.el);
    }
  }
  function dropDragLock() { if (dragLock && dragLock.el) dragLock.el.classList.remove("kc-dragging"); dragLock = null; setMode(); }
  function cancelDragLock() {
    if (dragLock && dragLock.kind === "win") { dragLock.el.style.left = dragLock.ox; dragLock.el.style.top = dragLock.oy; }
    dropDragLock();
  }

  /* ---------------- Tab targeting ---------------- */

  function stepTarget(dir) {
    var els = addressables();
    if (!els.length) return;
    var cur = els.indexOf(targeted || hovered);
    var next = els[(cur + dir + els.length) % els.length];
    targeted = next; hovered = next;
    var r = next.getBoundingClientRect();
    mouseX = r.left + r.width / 2; mouseY = r.top + r.height / 2;
    mark();
    if (labelMode) placeLabels();
  }

  /* ---------------- text mode ---------------- */

  function syncTextMode() {
    var now = isTextEntryControl(document.activeElement);
    if (now !== textMode) {
      textMode = now;
      textField = now ? nameOf(document.activeElement) : null;
      document.body.classList.toggle("kc-textmode", now);
      setMode();
    }
  }
  document.addEventListener("focusin", syncTextMode);
  document.addEventListener("focusout", function () { setTimeout(syncTextMode, 0); });

  /* ---------------- the key handler ---------------- */

  document.addEventListener("keydown", function (e) {
    syncTextMode();

    // The two global summons are chords, not text, and stay live in
    // every mode (KeyPilot's Alt+K is a global toggle): without them a
    // field that takes focus on click — Cancel focusing the username
    // field, say — would strand the keyboard in text mode with the
    // board unreachable except by Esc.
    if (e.altKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setPanel(panel.hidden);
      return;
    }
    if (e.altKey && e.key.toLowerCase() === "l" && !textMode) {
      e.preventDefault();
      toggleLabels();
      return;
    }

    // Text mode: only Esc is monitored (KeyPilot). Everything else types.
    if (textMode) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        textMode = false; textField = null; document.body.classList.remove("kc-textmode"); setMode();
      }
      return;
    }

    var mod = e.ctrlKey || e.metaKey;
    if (mod) return; // leave Ctrl/Cmd chords (incl. Ctrl+L lock) to the desktop

    if (e.altKey) return; // Alt+L / Alt+K were handled above, before text mode

    if (e.key === "Escape") {
      // Esc unwinds ONE rung at a time (flat-nav's ladder):
      // drag-lock → labels/buffer → target → (desktop's own menu close).
      // Text mode sits above all of these and is handled earlier.
      if (dragLock) { cancelDragLock(); e.preventDefault(); return; }
      if (labelMode) { toggleLabels(false); e.preventDefault(); return; }
      if (targeted) { targeted = null; mark(); e.preventDefault(); }
      return; // otherwise the desktop's own Esc (close menus) stands
    }

    if (dragLock) {
      if (e.key === " ") { e.preventDefault(); dropDragLock(); }
      return; // while locked, other keys wait
    }

    if (labelMode && e.key.length === 1 && LABEL_ALPHABET.indexOf(e.key.toUpperCase()) !== -1) {
      e.preventDefault(); typeLabel(e.key.toUpperCase()); return;
    }

    switch (e.key) {
      case "f": case "F":
        e.preventDefault(); kcClick(targeted || hovered); break;
      case "Enter":
        // Enter on a targeted thing opens it; with no target, leave the
        // desktop's own Enter behaviour (forms, terminal) alone.
        if (targeted) { e.preventDefault(); kcClick(targeted); }
        break;
      case "d": case "D":
        e.preventDefault(); back(); break;
      case "Tab":
        e.preventDefault(); stepTarget(e.shiftKey ? -1 : 1); break;
      case " ":
        // Space activates a focused button natively; only claim it when
        // the focus is the body / a non-button, and a lock is available.
        if (!document.activeElement || document.activeElement.tagName !== "BUTTON") {
          if (tryDragLock()) e.preventDefault();
        }
        break;
      case "/": {
        var start = $("#startBtn");
        var launcher = $("#launcher");
        if (start && $("#desktopScreen").classList.contains("on") && !(launcher && launcher.classList.contains("open"))) {
          e.preventDefault(); start.click();
        }
        break;
      }
    }
  }, true);

  setMode();
})();
