// Cloudflare Workers static hosting has no "single-page app" fallback when
// uploaded from the dashboard, so /admin etc. would 404. Give each page
// address its own folder with a copy of index.html; the app's router does the rest.
import { copyFileSync, mkdirSync } from "node:fs";

const routes = ["admin", "login", "brands", "video"];
for (const r of routes) {
  mkdirSync(`dist/${r}`, { recursive: true });
  copyFileSync("dist/index.html", `dist/${r}/index.html`);
}
console.log(`route pages: ${routes.join(", ")}`);
