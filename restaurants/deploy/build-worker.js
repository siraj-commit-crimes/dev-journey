// Packs a static site folder into one Cloudflare Worker module (files embedded as base64),
// optionally with Blaze's /api/menu live-menu proxy and a pitch "demo gate".
//   node build-worker.js <siteDir> <out.js> [--blaze] [--demo]
// Demo gate (--demo) reads env: DEMO_PASS_HASH (sha-256 hex of the password), DEMO_EXPIRES (ISO date),
// DEMO_NAME, DEMO_NAME_AR, DEMO_SITE (shown on the login page).
const fs = require("fs"), path = require("path");
const [dir, out] = process.argv.slice(2);
const blaze = process.argv.includes("--blaze"), demo = process.argv.includes("--demo");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const files = {};
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f), rel = "/" + path.relative(dir, p).split(path.sep).join("/");
    if (fs.statSync(p).isDirectory()) { walk(p); continue; }
    if (/^\/(_headers|_redirects)$/.test(rel)) continue;
    if (demo && rel === "/sw.js") continue; // no offline copy in demo links
    files[rel] = [TYPES[path.extname(f)] || "application/octet-stream", fs.readFileSync(p).toString("base64")];
  }
})(dir);

const D = demo ? {
  hash: process.env.DEMO_PASS_HASH, expires: process.env.DEMO_EXPIRES, name: process.env.DEMO_NAME || "the designer",
  nameAr: process.env.DEMO_NAME_AR || "", site: process.env.DEMO_SITE || "Restaurant",
} : null;
if (demo && (!D.hash || !D.expires)) throw new Error("demo needs DEMO_PASS_HASH and DEMO_EXPIRES");

const src = `const FILES = ${JSON.stringify(files)};
const DEMO = ${JSON.stringify(D)};
const cache = new Map();
function body(b64) { if (!cache.has(b64)) { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); cache.set(b64, a); } return cache.get(b64); }
const BASE = { "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
function page(title, inner, status = 200) {
  return new Response(\`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>\${esc(title)}</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:20px;background:#141110;color:#f4ece4;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.c{width:min(380px,100%);padding:28px 22px;border-radius:22px;background:#201b18;box-shadow:0 30px 60px rgba(0,0,0,.4);text-align:center}
h1{margin:0 0 6px;font-size:1.5rem}p{margin:0 0 18px;color:#b9aca2}input{width:100%;height:50px;padding:0 14px;border:0;border-radius:12px;background:#fff;color:#141110;font-size:16px}
button{width:100%;height:50px;margin-top:10px;border:0;border-radius:12px;background:#ffb444;color:#141110;font-weight:800;font-size:1rem}.e{color:#ff8a80;margin:10px 0 0}small{display:block;margin-top:16px;color:#8a7c72}</style></head>
<body><div class="c">\${inner}</div></body></html>\`, { status, headers: { ...BASE, "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
const login = (err) => page(DEMO.site + " · Demo", \`<h1>\${esc(DEMO.site)}</h1><p>Private demo by \${esc(DEMO.name)}. Enter the password to view it.</p>
<form method="post" action="/__login"><input name="p" type="password" placeholder="Password" autocomplete="current-password" autofocus required><button>View demo</button></form>
\${err ? '<p class="e">Wrong password, try again.</p>' : ""}<small>Available until \${esc(new Date(DEMO.expires).toUTCString().slice(0, 16))}</small>\`, err ? 401 : 200);
const ended = () => page("Demo ended", \`<h1>This demo has ended</h1><p>This private preview by \${esc(DEMO.name)} is no longer available. Please get in touch with \${esc(DEMO.name)} for access.</p>\`, 410);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (DEMO) {
      if (Date.now() > Date.parse(DEMO.expires)) return ended();
      const token = await sha(DEMO.hash + "|" + DEMO.expires);
      if (url.pathname === "/__login" && request.method === "POST") {
        const form = await request.formData();
        const ok = (await sha(String(form.get("p") || ""))) === DEMO.hash;
        if (!ok) return login(true);
        const maxAge = Math.max(60, Math.floor((Date.parse(DEMO.expires) - Date.now()) / 1000));
        return new Response(null, { status: 303, headers: { ...BASE, location: "/", "set-cookie": \`demo=\${token}; Path=/; Max-Age=\${maxAge}; HttpOnly; Secure; SameSite=Lax\` } });
      }
      const cookie = request.headers.get("cookie") || "";
      if (!cookie.split(/;\\s*/).includes("demo=" + token)) return url.pathname === "/" || url.pathname.endsWith(".html") ? login(false) : new Response("Locked", { status: 401, headers: BASE });
    }
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
    const isPage = DEMO || f[0].startsWith("text/html") || p === "/sw.js" || p.endsWith(".json") || p.endsWith(".webmanifest");
    const h = new Headers({ ...BASE, "content-type": f[0], "cache-control": isPage ? (DEMO ? "private, no-store" : "no-cache") : "public, max-age=3600" });
    return new Response(request.method === "HEAD" ? null : body(f[1]), { headers: h });
  },
};
`;
fs.writeFileSync(out, src);
console.log(path.basename(out), Object.keys(files).length, "files", (src.length / 1024).toFixed(0) + "KB", demo ? `(demo, until ${D.expires})` : "");
