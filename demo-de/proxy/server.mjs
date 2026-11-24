/* The local proxy server — the same handler as the Vercel
 * function (api/proxy.js), on its own port, so the desktop in
 * local development (a different origin) reaches it exactly the
 * way the deployed one will.
 *
 *   NCT_PROXY_KEY=… NCT_PROXY_ALLOW_IPS=… node proxy/server.mjs
 *
 * Port: NCT_PROXY_PORT or 8933.
 */
import { createServer } from "node:http";
import { handleProxy } from "./handler.mjs";

const PORT = Number(process.env.NCT_PROXY_PORT || 8933);
const LOCAL = process.env.NCT_PROXY_LOCAL !== "0";

createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  if (u.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("nct-proxy: POST or GET /proxy?u=<url>&k=<key>\n");
    return;
  }
  if (u.pathname !== "/proxy") {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found\n");
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const out = await handleProxy({
    method: req.method,
    target: u.searchParams.get("u") || "",
    keyParam: u.searchParams.get("k") || req.headers["x-nct-key"] || "",
    sigParam: u.searchParams.get("s") || "",
    headers: req.headers,
    body: Buffer.concat(chunks),
    clientIp: req.socket.remoteAddress || "",
    host: req.headers.host || "",
    secure: false,
    proxyPath: "/proxy",
    localMode: LOCAL,
  });
  res.writeHead(out.status, out.headers);
  res.end(out.body);
}).listen(PORT, LOCAL ? "127.0.0.1" : undefined, () => {
  console.log("nct-proxy on http://localhost:" + PORT + "/proxy" + (LOCAL ? " (local mode: loopback only, no limits)" : " (network mode: the lock applies)"));
});
