/* The key-click frame bridge — injected by the proxy into every
 * HTML page it serves. A framed page's keys and layout belong to
 * its own document, which the desktop's engine cannot reach; the
 * bridge is the page-side half of the engine (the pattern
 * KeyPilot uses with a content script per frame):
 *
 *   - a hover ring over the addressable element at the cursor
 *   - F clicks the element under the cursor
 *   - Alt+K labels the page's addressable elements; letters
 *     narrow, a full label activates, Esc dismisses
 *   - D goes back, as on the desktop
 *   - text-entry controls keep their keys (typing is typing);
 *     Esc in one hands control back to the browser chrome
 *   - the page reports its location/title to the parent so the
 *     Browser app's address bar and history stay true
 *
 * Exported as a string: the proxy inlines it verbatim.
 */
export const BRIDGE_JS = `
(function () {
  if (window.__nctBridge) return;
  window.__nctBridge = true;
  var CH = "ABEGHIJKLMNOPQRSTUWXYZ";
  var SEL = 'a[href],button,input,select,textarea,label,summary,[role="button"],[tabindex],[onclick]';
  var mouseX = innerWidth / 2, mouseY = innerHeight / 2;
  var hovered = null, labelsOn = false, labelMap = [], typed = "";

  var ring = document.createElement("div");
  ring.style.cssText = "position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #5cb85c;border-radius:3px;box-shadow:0 0 0 2px rgba(0,0,0,.45);display:none";
  var chipBox = document.createElement("div");
  chipBox.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:none";

  function ready() {
    document.documentElement.appendChild(ring);
    document.documentElement.appendChild(chipBox);
    report();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();

  function report() {
    try { parent.postMessage({ t: "nct-hello", href: location.href, title: document.title || "" }, "*"); } catch (e) {}
  }
  addEventListener("popstate", report);
  addEventListener("hashchange", report);
  addEventListener("load", report);

  function isTextEntry(el) {
    if (!el || !el.tagName) return false;
    if (el.isContentEditable) return true;
    var tag = el.tagName.toLowerCase();
    if (tag === "textarea") return true;
    if (tag === "input") {
      var ty = (el.getAttribute("type") || "text").toLowerCase();
      return ["text","search","password","email","url","tel","number"].indexOf(ty) >= 0;
    }
    return false;
  }
  function addressable() {
    var out = [];
    var els = document.querySelectorAll(SEL);
    for (var i = 0; i < els.length && out.length < 140; i++) {
      var el = els[i], r = el.getBoundingClientRect();
      if (r.width < 3 || r.height < 3) continue;
      var cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      out.push(el);
    }
    return out;
  }
  function target() {
    var el = document.elementFromPoint(mouseX, mouseY);
    if (!el) return null;
    var c = el.closest ? el.closest(SEL) : null;
    return c || el;
  }
  function drawRing() {
    var el = labelsOn ? null : target();
    hovered = el;
    if (!el) { ring.style.display = "none"; return; }
    var r = el.getBoundingClientRect();
    ring.style.display = "block";
    ring.style.left = (r.left - 2) + "px";
    ring.style.top = (r.top - 2) + "px";
    ring.style.width = (r.width + 2) + "px";
    ring.style.height = (r.height + 2) + "px";
  }
  document.addEventListener("mousemove", function (e) {
    mouseX = e.clientX; mouseY = e.clientY;
    drawRing();
  }, true);
  document.addEventListener("scroll", drawRing, true);

  function fireClick(el) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    var o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, view: window };
    ["mouseover","mousedown","mouseup","click"].forEach(function (n) {
      el.dispatchEvent(new MouseEvent(n, o));
    });
    setTimeout(report, 60);
  }

  function labelsFor(els) {
    var singles = CH.split("");
    var labels = singles.slice(0, els.length);
    var i = 0;
    while (labels.length < els.length) {
      labels.push(singles[Math.floor(i / singles.length)] + singles[i % singles.length]);
      i++;
    }
    return labels.slice(0, els.length);
  }
  function showLabels() {
    var els = addressable();
    var labels = labelsFor(els);
    labelMap = els.map(function (el, i) { return { el: el, label: labels[i] }; });
    typed = "";
    chipBox.innerHTML = "";
    labelMap.forEach(function (m) {
      var r = m.el.getBoundingClientRect();
      var c = document.createElement("div");
      c.textContent = m.label;
      c.setAttribute("data-l", m.label);
      c.style.cssText = "position:fixed;left:" + Math.max(0, r.left) + "px;top:" + Math.max(0, r.top - 9) + "px;background:#0d2812;color:#7be07b;border:1.5px solid #5cb85c;border-radius:3px;font:700 11px monospace;padding:1px 5px;letter-spacing:.08em";
      chipBox.appendChild(c);
    });
    chipBox.style.display = "block";
    labelsOn = true;
    ring.style.display = "none";
  }
  function hideLabels() {
    labelsOn = false;
    chipBox.style.display = "none";
    chipBox.innerHTML = "";
    labelMap = [];
    typed = "";
  }
  function narrowLabels(k) {
    typed += k;
    var match = null, alive = 0;
    labelMap.forEach(function (m, i) {
      var chip = chipBox.children[i];
      if (!chip) return;
      if (m.label === typed) match = m;
      var on = m.label.indexOf(typed) === 0;
      chip.style.display = on ? "block" : "none";
      if (on) alive++;
    });
    if (match) { var el = match.el; hideLabels(); fireClick(el); }
    else if (!alive) hideLabels();
  }

  // Runtime-built links escape server-side rewriting (the
  // page's own scripts construct them after load — example.org
  // works this way). Intercept clicks on anchors that point
  // outside the proxy and route them through it, reusing the
  // credential this page itself arrived with.
  function wrapRuntime(href) {
    try {
      var u = new URL(href, location.href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      var here = new URL(location.href);
      if (u.origin === here.origin && u.pathname === here.pathname) return null;
      var k = here.searchParams.get("k");
      var out = here.pathname + "?u=" + encodeURIComponent(u.href);
      if (k) out += "&k=" + encodeURIComponent(k);
      return out;
    } catch (e) { return null; }
  }
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var w = wrapRuntime(a.href);
    if (w) { e.preventDefault(); location.href = w; }
  }, true);

  document.addEventListener("keydown", function (e) {
    var ae = document.activeElement;
    if (labelsOn) {
      if (e.key === "Escape") { e.preventDefault(); hideLabels(); return; }
      var k = e.key.toUpperCase();
      if (CH.indexOf(k) >= 0 && k.length === 1) { e.preventDefault(); narrowLabels(k); }
      return;
    }
    if (e.altKey && (e.key === "k" || e.key === "K")) {
      e.preventDefault(); showLabels(); return;
    }
    if (isTextEntry(ae)) {
      if (e.key === "Escape") {
        e.preventDefault(); ae.blur();
        try { parent.postMessage({ t: "nct-exit" }, "*"); } catch (err) {}
      }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "f" || e.key === "F") {
      e.preventDefault(); fireClick(target());
    } else if (e.key === "d" || e.key === "D") {
      e.preventDefault(); history.back();
    } else if (e.key === "Escape") {
      try { parent.postMessage({ t: "nct-exit" }, "*"); } catch (err) {}
    }
  }, true);
})();
`;
