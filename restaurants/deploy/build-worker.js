// Packs a static site folder into one Cloudflare Worker module (files embedded as base64),
// optionally with Blaze's /api/menu live-menu proxy. Usage: node build-worker.js <siteDir> <out.js> [--blaze]
const fs = require("fs"), path = require("path");
const [dir, out] = process.argv.slice(2), blaze = process.argv.includes("--blaze");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const files = {};
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f), rel = "/" + path.relative(dir, p).split(path.sep).join("/");
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (/^\/(_headers|_redirects)$/.test(rel)) continue;
    files[rel] = [TYPES[path.extname(f)] || "application/octet-stream", fs.readFileSync(p).toString("base64")];
  }
})(dir);
const src = `const FILES = ${JSON.stringify(files)};
const cache = new Map();
function body(b64) { if (!cache.has(b64)) { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); cache.set(b64, a); } return cache.get(b64); }
const BASE = { "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff" };
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    ${blaze ? `if (url.pathname === "/api/menu") {
      // Blaze's live menu from their existing system (keeps their /staff editor in charge).
      const r = await fetch("https://blaze-menu.com/api/menu" + url.search, { headers: { accept: request.headers.get("accept") || "*/*" } });
      const h = new Headers(BASE);
      for (const k of ["content-type", "etag", "last-modified"]) { const v = r.headers.get(k); if (v) h.set(k, v); }
      h.set("cache-control", r.headers.get("cache-control") || "no-store");
      return new Response(r.body, { status: r.status, headers: h });
    }` : ""}
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith("/")) p += "index.html";
    let f = FILES[p];
    if (!f && !p.includes(".")) f = FILES[p + "/index.html"];
    if (!f) return new Response("Not found", { status: 404, headers: BASE });
    const isPage = f[0].startsWith("text/html") || p === "/sw.js" || p.endsWith(".json") || p.endsWith(".webmanifest");
    const h = new Headers({ ...BASE, "content-type": f[0], "cache-control": isPage ? "no-cache" : "public, max-age=3600" });
    return new Response(request.method === "HEAD" ? null : body(f[1]), { headers: h });
  },
};
`;
fs.writeFileSync(out, src);
console.log(out, Object.keys(files).length, "files", (src.length / 1024).toFixed(0) + "KB");
