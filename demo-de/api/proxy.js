/* The Vercel mount of the NCT proxy — the same handler the
 * local server runs (proxy/server.mjs). If this project's
 * Vercel root is the repository root rather than demo-de, this
 * file belongs in /api at the root; the handler import path is
 * the only thing that changes.
 *
 * Environment (set in the deployment, never in the repo):
 *   NCT_PROXY_KEY        the master key (required; fails closed)
 *   NCT_PROXY_ALLOW_IPS  optional comma-separated client IPs
 */
import { handleProxy } from "../proxy/handler.mjs";

export default async function handler(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const u = new URL(req.url, "http://localhost");
  const fwd = (req.headers["x-forwarded-for"] || "").split(",")[0];
  const out = await handleProxy({
    method: req.method,
    target: u.searchParams.get("u") || "",
    keyParam: u.searchParams.get("k") || req.headers["x-nct-key"] || "",
    sigParam: u.searchParams.get("s") || "",
    headers: req.headers,
    body: Buffer.concat(chunks),
    clientIp: fwd || (req.socket && req.socket.remoteAddress) || "",
    host: req.headers.host || "",
    secure: req.headers["x-forwarded-proto"] === "https",
    proxyPath: "/api/proxy",
  });
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  res.statusCode = out.status;
  res.end(out.body);
}
