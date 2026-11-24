/* NCT-WL-BRIDGE — the Browser hosts a foreign surface: a shell-owned frame around content the shell does not control; what needs the content's help goes through the bridge. See WAYLAND-MAP.md. */
import React, { useEffect, useRef, useState } from "react";
import { publish, onDeliver } from "../core/patchbay.js";
import { onAppAction } from "../core/keymaps.js";

/* Browser — a window on the web. Pages load through the NCT
 * proxy by default (proxy/handler.mjs): the proxy strips the
 * headers that refuse framing and injects the key-click bridge,
 * so pages arrive both visible and operable. With the proxy
 * off — or when it refuses (this network is not allowlisted) —
 * the window falls back to a plain iframe, exactly as a browser
 * window would behave without it.
 *
 * Configuration comes from the build environment:
 *   VITE_PROXY_BASE  proxy endpoint (default /api/proxy)
 *   VITE_PROXY_KEY   the app's key for a locked proxy; a local
 *                    loopback proxy needs none.
 */
const ENV = import.meta.env || {};
const PROXY_BASE = ENV.VITE_PROXY_BASE || "/api/proxy";
const PROXY_KEY = ENV.VITE_PROXY_KEY || "";

/* Start-page links, each checked on 2026-11-23 to send no
 * framing refusal (no X-Frame-Options, no CSP frame-ancestors
 * excluding us). Wikipedia's frame-ancestors names localhost
 * explicitly, so it frames from a local desktop; from a public
 * origin it refuses, which is what the proxy is for. */
const START_LINKS = [
  ["Wikipedia", "https://en.wikipedia.org/wiki/Main_Page"],
  ["Wiktionary", "https://en.wiktionary.org/wiki/Wiktionary:Main_Page"],
  ["Wikivoyage", "https://en.wikivoyage.org/wiki/Main_Page"],
  ["Hacker News", "https://news.ycombinator.com/"],
  ["Internet Archive", "https://archive.org/"],
  ["NPR Text", "https://text.npr.org/"],
  ["xkcd", "https://xkcd.com/"],
  ["Example Domain", "https://example.org/"],
];

function normalize(raw) {
  const v = (raw || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (!/\s/.test(v) && v.includes(".")) return "https://" + v;
  return "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(v);
}

function realFromFrame(href) {
  if (href && href.includes(PROXY_BASE)) {
    try {
      const u = new URL(href).searchParams.get("u");
      if (u) return u;
    } catch { /* fall through */ }
  }
  return href;
}

export default function BrowserApp() {
  const [entries, setEntries] = useState([]);
  const [idx, setIdx] = useState(-1);
  const [input, setInput] = useState("");
  const [proxyOn, setProxyOn] = useState(false); // unwired for now: direct framing first; the proxy is kept and one click away
  const [notice, setNotice] = useState(null);
  const [bridgeLive, setBridgeLive] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const frameRef = useRef(null);
  const addrRef = useRef(null);
  const loadSeq = useRef(0);
  const expectRef = useRef("");

  const current = idx >= 0 ? entries[idx] : null;
  const frameSrc = current
    ? proxyOn
      ? PROXY_BASE + "?u=" + encodeURIComponent(current) + (PROXY_KEY ? "&k=" + encodeURIComponent(PROXY_KEY) : "")
      : current
    : null;

  const pushEntry = (url, replace) => {
    setEntries((prev) => {
      const base = replace && idx >= 0 ? prev.slice() : prev.slice(0, idx + 1);
      if (replace && idx >= 0) { base[idx] = url; return base; }
      base.push(url);
      return base;
    });
    if (!replace) setIdx((i) => i + 1);
  };

  const navigate = (raw, replace) => {
    const url = normalize(raw);
    if (!url) return;
    expectRef.current = url;
    setNotice(null);
    setBridgeLive(false);
    pushEntry(url, replace);
    setInput(url);
    publish("browser", "url", url);
  };

  /* Bridge reports + the refusal fallback. */
  useEffect(() => {
    const onMsg = (e) => {
      const f = frameRef.current;
      if (!f || e.source !== f.contentWindow) return;
      const d = e.data || {};
      if (d.t === "nct-hello") {
        setBridgeLive(true);
        setNotice(null);
        const real = realFromFrame(d.href);
        if (real && real !== "about:blank") {
          setInput(real);
          publish("browser", "url", real);
          if (expectRef.current !== real) {
            // An in-page navigation (a link the bridge clicked):
            // it earns its own history entry.
            expectRef.current = real;
            pushEntry(real, false);
          } else {
            pushEntry(real, true);
          }
        }
      } else if (d.t === "nct-exit") {
        if (addrRef.current) addrRef.current.focus();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  });

  /* After each load settles: if the bridge never reported and
   * we went through the proxy, probe it — a refusal (this
   * network is not allowlisted, or the key is wrong) falls back
   * to a direct iframe with a notice. If we went direct, a
   * silent frame with no children is the refusal signature of a
   * site that will not be framed. */
  useEffect(() => {
    if (!current) return;
    const seq = ++loadSeq.current;
    setBridgeLive(false);
    const timer = setTimeout(async () => {
      if (loadSeq.current !== seq || bridgeLive) return;
      if (proxyOn) {
        try {
          const resp = await fetch(frameSrc, { method: "GET" });
          if (resp.body) resp.body.cancel();
          if (loadSeq.current !== seq) return;
          if (resp.status === 403 || resp.status === 500) {
            setProxyOn(false);
            setNotice("proxy-refused");
          }
        } catch { /* the frame itself may still be fine */ }
      } else {
        const f = frameRef.current;
        try {
          if (f && f.contentWindow && f.contentWindow.length === 0) setNotice("framing");
        } catch { /* cross-origin success also hides the window */ }
      }
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameSrc, frameKey]);

  useEffect(() => onDeliver("browser", "visit", (v) => {
    if (v) navigate(String(v), false);
  }), [idx, entries]);

  /* This app's keymap: D is bound to the generic HISTORY_BACK
   * action (core/keymaps.js). The engine delivers it only while
   * the cursor is over this window; inside a proxied page the
   * bridge's own D does the same for the page's history. */
  useEffect(() => onAppAction("browser", "HISTORY_BACK", () => go(-1)), [idx, entries]);

  const go = (d) => {
    const n = idx + d;
    if (n < 0 || n >= entries.length) return;
    expectRef.current = entries[n];
    setIdx(n);
    setInput(entries[n]);
    setNotice(null);
    publish("browser", "url", entries[n]);
  };

  const host = (() => {
    try { return current ? new URL(current).host : ""; } catch { return ""; }
  })();

  return (
    <div className="browser-app">
      <div className="bbar">
        <button className="wbtn" disabled={idx <= 0} onClick={() => go(-1)} title="Back">◂</button>
        <button className="wbtn" disabled={idx >= entries.length - 1} onClick={() => go(1)} title="Forward">▸</button>
        <button className="wbtn" disabled={!current} onClick={() => setFrameKey((k) => k + 1)} title="Reload">⟳</button>
        <button className="wbtn" onClick={() => { setEntries([]); setIdx(-1); setInput(""); setNotice(null); }} title="Start page">⌂</button>
        <input ref={addrRef} className="tinput baddr" value={input}
          placeholder="Address or search"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Committing an address hands the keyboard back
              // to the desktop, like the Terminal's run port:
              // a field that keeps focus would eat the operator
              // keys (D = HISTORY_BACK in this app) as text.
              navigate(input, false);
              e.currentTarget.blur();
            }
          }} />
        <button className={"wbtn bproxy" + (proxyOn ? " on" : "")}
          onClick={() => { setProxyOn((v) => !v); setNotice(null); }}
          title="Route pages through the NCT proxy">
          PROXY {proxyOn ? "ON" : "OFF"}
        </button>
        <button className="wbtn" disabled={!current}
          onClick={() => window.open(current, "_blank")} title="Open in a browser tab">⧉</button>
      </div>

      {notice === "proxy-refused" && (
        <div className="bnotice">
          <span>The proxy refused this network, so the page is shown directly — framed sites that refuse framing will stay blank.</span>
          <button className="wbtn" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}
      {notice === "framing" && (
        <div className="bnotice">
          <span>This page may have refused to be framed.</span>
          <button className="wbtn" onClick={() => { setProxyOn(true); setNotice(null); }}>Use the proxy</button>
          <button className="wbtn" disabled={!current} onClick={() => window.open(current, "_blank")}>Open in a tab</button>
          <button className="wbtn" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}

      <div className="bview" data-bridge={bridgeLive ? "live" : "off"} data-url={current || ""}>
        {current ? (
          <iframe key={frameKey + "|" + (proxyOn ? "p" : "d")} ref={frameRef}
            src={frameSrc} title="Browser view" />
        ) : (
          <div className="bstart">
            <div className="bstart-title">START</div>
            <div className="bstart-links">
              {START_LINKS.map(([name, url]) => (
                <button key={url} className="bstart-link" onClick={() => navigate(url, false)}>
                  <span>{name}</span><span className="bstart-host">{new URL(url).host}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="wstatus">
        <span>{!current ? "START PAGE" : bridgeLive ? "BRIDGE LIVE" : proxyOn ? "VIA PROXY" : "DIRECT"}</span>
        <span className="grow">{host}</span>
      </div>
    </div>
  );
}
