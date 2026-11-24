# The Browser window and the NCT proxy

Three pieces, in `demo-de/`:

| Piece | File | What it does |
|---|---|---|
| Proxy core | `proxy/handler.mjs` | Fetches a page server-side, strips the headers that refuse framing, rewrites links/assets/forms back through itself, namespaces cookies per target host, and injects the bridge |
| Frame bridge | `proxy/bridge.mjs` | Injected at document start into every proxied page: hover ring, F-click, Alt+K labels, D = back, text-entry respect with Esc handing control back to the chrome, location reporting to the window, and click interception for links the page's own scripts build at runtime (which server-side rewriting cannot see) |
| Browser app | `src/desktop/apps/BrowserApp.jsx` | Address bar, own history, start page, proxy toggle, open-in-tab. Patch ports: `url` (out), `visit` (in) |

Two mounts for the same handler: `proxy/server.mjs` (local) and
`api/proxy.js` (Vercel — if the project's Vercel root is the
repository root rather than `demo-de`, the file belongs in `/api`
at the root; only the handler import path changes).

## The two modes

**Local mode** — the local server binds the loopback interface
only, and the lock stands down entirely: no key, no allowlist,
no rate limit, and local pages (a dev server on another port)
are legitimate targets. The machine itself is the boundary.

**Network mode** — the deployed function. Every request must
pass all of:

1. The master key (`NCT_PROXY_KEY`, an environment variable,
   never in the repo) as `?k=` — used only by the app itself for
   navigations it initiates — or a per-URL signature
   `?s=` = HMAC(secret, target), minted by the proxy when it
   rewrites a page, so the master key never appears inside a
   served page.
2. Origin: a present `Origin`/`Referer` must name the proxy's
   own host.
3. The IP allowlist (`NCT_PROXY_ALLOW_IPS`, comma-separated)
   when configured. The owner's is `104.177.194.134`.
4. A per-IP rate limit (300/min).
5. Targets: http/https only; private, loopback and link-local
   addresses are refused.

Fail-closed: with no key configured, the function answers 500
and fetches nothing.

## How the window uses it

The proxy is **unwired by default**: the Browser window loads
pages directly, and its start page links only to sites verified
on 2026-11-23 to send no framing refusal (Wikipedia — whose
`frame-ancestors` names `localhost` explicitly, so it frames
from a local desktop — Wiktionary, Wikivoyage, Hacker News,
Internet Archive, NPR Text, xkcd, Example Domain). Toggling
PROXY on routes through the proxy instead.

When a proxied load is refused (a network that is not
allowlisted, a wrong key), the window probes the proxy once,
falls back to a direct iframe, and says so in a notice bar —
from any other network the window works as a plain browser
window would. A direct page that stays silent and childless is
treated as a probable framing refusal, and the notice offers
the proxy or a real tab.

## Deployment notes

- Set `NCT_PROXY_KEY` (and optionally `NCT_PROXY_ALLOW_IPS`) in
  the deployment's environment; set `VITE_PROXY_BASE` /
  `VITE_PROXY_KEY` at build time so the app can find and unlock
  the proxy. Locally these live in `demo-de/.env.local`
  (gitignored).
- Serve the proxy from its **own subdomain** in production.
  Proxied pages share the proxy's origin; a separate subdomain
  keeps a hostile page from scripting the desktop itself.
  (Locally the ports already separate them.)

## Known limits

- Document-style sites proxy well. JavaScript web *apps* build
  requests at runtime in ways rewriting only partly survives;
  the bridge's click interception recovers runtime-built links,
  not runtime-built data calls. WebSockets, service workers and
  DRM video generally do not survive a rewriting proxy.
- Some sites answer proxies with CAPTCHAs or blocks.
- HTML is decoded as UTF-8; legacy-charset pages can garble.
- The SSRF guard checks the target's literal address, not DNS
  answers; a hostname that resolves privately is a known gap of
  the network mode (the allowlist and key are the outer walls).
- Anything typed into a proxied page passes through the proxy.
  It is part of the trusted system.
