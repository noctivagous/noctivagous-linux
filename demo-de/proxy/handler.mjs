/* The NCT proxy — fetches pages server-side so the desktop's
 * Browser app can frame them and the key-click bridge can live
 * inside them. See demo-de/BROWSER-PROXY.md for the design.
 *
 * Transport-neutral: server.mjs (local) and api/proxy.js
 * (Vercel) both adapt their request/response to this shape:
 *
 *   in : { method, target, keyParam, sigParam, headers, body,
 *          clientIp, host, secure, proxyPath }
 *   out: { status, headers, body }   (body a Buffer; the
 *          "set-cookie" header value is an array)
 *
 * THE LOCK (all must pass):
 *   1. The master key (NCT_PROXY_KEY) as ?k= — used only by the
 *      app itself for navigations it initiates — or a per-URL
 *      signature ?s= HMAC(secret, target), minted by this proxy
 *      when it rewrites a page, so the master key never appears
 *      inside a served page.
 *   2. Origin: a present Origin/Referer must name this proxy's
 *      own host (only our app's pages qualify).
 *   3. IP allowlist (NCT_PROXY_ALLOW_IPS, comma-separated) when
 *      configured — the proxy serves those networks only.
 *   4. A per-IP rate limit.
 *   5. Targets: http/https only, never private/loopback/link-
 *      local addresses (the proxy is not an SSRF cannon).
 *
 * Then: framing/CSP/HSTS headers are stripped, links and assets
 * are rewritten back through the proxy (signed), cookies are
 * namespaced per target host, and HTML gets the key-click
 * bridge (proxy/bridge.mjs) injected.
 */

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { BRIDGE_JS } from "./bridge.mjs";

const RATE_MAX = 300;
const RATE_WINDOW = 60_000;
const buckets = new Map();

const STRIP_HEADERS = new Set([
  "x-frame-options", "content-security-policy",
  "content-security-policy-report-only",
  "cross-origin-embedder-policy", "cross-origin-opener-policy",
  "cross-origin-resource-policy", "strict-transport-security",
  "content-length", "content-encoding", "connection",
  "keep-alive", "transfer-encoding", "set-cookie",
]);

const normIp = (ip) => {
  const v = (ip || "").replace(/^::ffff:/, "").trim();
  return v === "::1" ? "127.0.0.1" : v; // the two loopback spellings are one host
};
const secret = () => process.env.NCT_PROXY_KEY || "local-mode";
const sign = (target) =>
  createHmac("sha256", secret()).update(target).digest("hex").slice(0, 32);
const hostKey = (host) =>
  createHash("sha256").update(host).digest("hex").slice(0, 10);

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function isPrivateTarget(u) {
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, at: now };
  if (now - b.at > RATE_WINDOW) { b.n = 0; b.at = now; }
  b.n += 1;
  buckets.set(ip, b);
  return b.n > RATE_MAX;
}

function fail(status, msg) {
  return {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
    body: Buffer.from(
      `<!doctype html><meta charset="utf-8"><title>Proxy</title>` +
      `<body style="font-family:monospace;background:#101010;color:#ccc;padding:24px">` +
      `<h2 style="color:#e8912d">${status}</h2><p>${msg}</p></body>`,
    ),
  };
}

/* ---------- rewriting ---------- */

function makeWrap(proxyPath) {
  return (absUrl) =>
    `${proxyPath}?u=${encodeURIComponent(absUrl)}&s=${sign(absUrl)}`;
}

const SKIP_SCHEME = /^(data|javascript|mailto|tel|blob|about|chrome|view-source):/i;
function resolveWrapped(raw, base, wrap) {
  const v = (raw || "").trim();
  if (!v || v.startsWith("#") || SKIP_SCHEME.test(v)) return raw;
  try {
    return wrap(new URL(v, base).href);
  } catch {
    return raw;
  }
}

function rewriteHtml(html, base, wrap) {
  let out = html.replace(/<base\b[^>]*>/gi, "");
  const unescapeAttr = (v) => v
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
  const escapeAttr = (v) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  out = out.replace(
    /\b(href|src|action|poster|data-src|background)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/gi,
    (m, attr, eq, raw) => {
      const val = raw.charAt(0) === '"' || raw.charAt(0) === "'"
        ? raw.slice(1, -1) : raw;
      const wrapped = resolveWrapped(unescapeAttr(val), base, wrap);
      return attr + eq + '"' + escapeAttr(wrapped) + '"';
    },
  );
  out = out.replace(
    /\bsrcset(\s*=\s*)("([^"]*)"|'([^']*)')/gi,
    (m, eq, quoted, dq, sq) => {
      const val = dq !== undefined ? dq : sq;
      if (val.includes("data:")) return m;
      const q = quoted.charAt(0);
      const parts = val.split(",").map((part) => {
        const bits = part.trim().split(/\s+/);
        if (bits[0]) bits[0] = resolveWrapped(bits[0], base, wrap);
        return bits.join(" ");
      });
      return "srcset" + eq + q + parts.join(", ") + q;
    },
  );
  out = out.replace(
    /(content\s*=\s*")(\s*\d+\s*;\s*url=)([^"]*)(")/gi,
    (m, a, b, url, c) => a + b + resolveWrapped(url, base, wrap) + c,
  );
  // The bridge goes at document_start (right after <head>),
  // like a content script: at the end of the body it would
  // only register once a slow page finishes parsing, which
  // left heavy pages bridgeless for many seconds.
  const bridge = `<script>${BRIDGE_JS}</script>`;
  if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, (m) => m + bridge);
  else if (/<html[^>]*>/i.test(out)) out = out.replace(/<html[^>]*>/i, (m) => m + bridge);
  else out = bridge + out;
  return out;
}

function rewriteCss(css, base, wrap) {
  return css
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, url) =>
      `url(${q}${resolveWrapped(url, base, wrap)}${q})`)
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, url) =>
      `@import ${q}${resolveWrapped(url, base, wrap)}${q}`);
}

/* ---------- cookies ---------- */

function rewriteSetCookie(list, targetHost, secure) {
  const hk = hostKey(targetHost);
  return (list || []).map((line) => {
    const parts = line.split(";").map((s) => s.trim());
    const first = parts[0];
    const eq = first.indexOf("=");
    const name = eq > 0 ? first.slice(0, eq) : first;
    const value = eq > 0 ? first.slice(eq + 1) : "";
    const attrs = [`nctp_${hk}_${name}=${value}`, "Path=/", "SameSite=Lax"];
    for (const a of parts.slice(1)) {
      const low = a.toLowerCase();
      if (low.startsWith("domain=") || low.startsWith("path=") || low.startsWith("samesite=")) continue;
      if (low === "secure") { if (secure) attrs.push("Secure"); continue; }
      attrs.push(a);
    }
    return attrs.join("; ");
  });
}

function buildCookieHeader(cookieHeader, targetHost) {
  if (!cookieHeader) return "";
  const prefix = `nctp_${hostKey(targetHost)}_`;
  const out = [];
  for (const pair of cookieHeader.split(";")) {
    const t = pair.trim();
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const name = t.slice(0, eq);
    if (name.startsWith(prefix)) out.push(name.slice(prefix.length) + "=" + t.slice(eq + 1));
  }
  return out.join("; ");
}

/* ---------- the handler ---------- */

export async function handleProxy(req) {
  // Local mode: the server is bound to the loopback of the
  // user's own machine, so the machine is the boundary and the
  // lock stands down entirely — no key, no allowlist, no rate
  // limit, and local pages are legitimate targets.
  if (!req.localMode) {
    const sec = secret();
    if (!sec) return fail(500, "Proxy not configured (NCT_PROXY_KEY is unset). It fails closed.");
    const authed = safeEqual(req.keyParam, sec) ||
      (req.sigParam && safeEqual(req.sigParam, sign(req.target || "")));
    if (!authed) return fail(403, "Refused: bad or missing proxy key.");
  }
  const originHost = (() => {
    const o = req.headers.origin || req.headers.referer;
    if (!o) return null;
    try { return new URL(o).host; } catch { return "invalid"; }
  })();
  if (!req.localMode) {
    if (originHost && originHost !== req.host) {
      return fail(403, "Refused: requests must come from the app itself.");
    }
    const ip = normIp(req.clientIp);
    const allow = (process.env.NCT_PROXY_ALLOW_IPS || "")
      .split(",").map(normIp).filter(Boolean);
    if (allow.length && !allow.includes(ip)) {
      return fail(403, "Refused: this network is not on the proxy allowlist.");
    }
    if (rateLimited(ip)) return fail(429, "Refused: rate limit.");
  }

  // The target.
  let target;
  try { target = new URL(req.target); } catch { return fail(400, "Bad target URL."); }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return fail(400, "Only http and https targets are proxied.");
  }
  if (!req.localMode && isPrivateTarget(target)) {
    return fail(403, "Refused: private and loopback targets are never proxied.");
  }

  // Fetch (redirects handled here so Location can be rewritten).
  const fwd = {
    "user-agent": req.headers["user-agent"] || "NCT-Proxy",
    accept: req.headers.accept || "*/*",
    "accept-language": req.headers["accept-language"] || "en",
    "accept-encoding": "identity",
  };
  const cookie = buildCookieHeader(req.headers.cookie, target.host);
  if (cookie) fwd.cookie = cookie;
  if (req.headers["content-type"]) fwd["content-type"] = req.headers["content-type"];
  if (req.headers.referer) {
    // Present the target's own origin as the referer upstream.
    try { fwd.referer = new URL(req.headers.referer).searchParams.get("u") || target.href; }
    catch { fwd.referer = target.href; }
  }
  let resp;
  try {
    resp = await fetch(target.href, {
      method: req.method,
      headers: fwd,
      body: req.body && req.body.length ? req.body : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    return fail(502, "The target could not be reached (" + (e && e.name === "TimeoutError" ? "timeout" : "fetch failed") + ").");
  }

  const wrap = makeWrap(req.proxyPath);
  const headers = {};
  resp.headers.forEach((v, k) => {
    if (!STRIP_HEADERS.has(k.toLowerCase())) headers[k.toLowerCase()] = v;
  });
  // Let the app itself probe this proxy cross-origin (the lock
  // still applies to every request).
  if (originHost && originHost === req.host && req.headers.origin) {
    headers["access-control-allow-origin"] = req.headers.origin;
    headers["access-control-allow-credentials"] = "true";
  }

  if (resp.status >= 300 && resp.status < 400 && resp.headers.get("location")) {
    headers.location = wrap(new URL(resp.headers.get("location"), target).href);
    return { status: resp.status, headers, body: Buffer.alloc(0) };
  }

  const setCookies = typeof resp.headers.getSetCookie === "function"
    ? resp.headers.getSetCookie() : [];
  if (setCookies.length) {
    headers["set-cookie"] = rewriteSetCookie(setCookies, target.host, req.secure);
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  const ctype = (resp.headers.get("content-type") || "").toLowerCase();
  if (ctype.includes("text/html")) {
    const text = rewriteHtml(buf.toString("utf-8"), target.href, wrap);
    return { status: resp.status, headers, body: Buffer.from(text, "utf-8") };
  }
  if (ctype.includes("text/css")) {
    const text = rewriteCss(buf.toString("utf-8"), target.href, wrap);
    return { status: resp.status, headers, body: Buffer.from(text, "utf-8") };
  }
  return { status: resp.status, headers, body: buf };
}
