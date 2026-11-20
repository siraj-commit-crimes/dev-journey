#!/usr/bin/env node
/*
 * Refreshes Station's menus into data/menus/<branch>.json.
 *
 * Station's branch menus live on two systems:
 *   - restaurantlogin.com ordering pages (Saida, Mazraa, Khaldeh, Moawad): we open
 *     the page in a headless browser and read the menu it loads (the cart/init call).
 *   - Hadath's own page on station-restaurant.com, which has the menu built in.
 * A web page can't read these directly (different site, session tokens), so the
 * site uses these saved copies. Re-run this script to pick up price/menu changes:
 *
 *   node tools/update-menus.js            (from restaurants/station/)
 *
 * Needs Playwright (preinstalled in Claude Code cloud sessions; otherwise `npm i playwright`).
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUT = path.join(__dirname, "..", "data", "menus");
// Each branch's own address forwards to its restaurantlogin.com ordering page.
const SOURCES = {
  saida: "https://saida.station-restaurant.com/",
  mazraa: "https://mazraa.station-restaurant.com/",
  khaldeh: "https://khaldeh.station-restaurant.com/",
  moawad: "https://moawad.station-restaurant.com/",
};
const HADATH = "https://station-restaurant.com/hadathmenu/";

const AR = /[؀-ۿ]/;
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const slug = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const titleCase = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s);

// "Zaatar - زعتر" → { en: "Zaatar", ar: "زعتر" }
function splitName(name) {
  const n = clean(name);
  const m = n.match(/^(.*?)\s*[-–]\s*([^-–]*[؀-ۿ][^-–]*)$/);
  if (m) return { en: clean(m[1]), ar: clean(m[2]) };
  return AR.test(n) ? { en: "", ar: n } : { en: n, ar: "" };
}

function pictureUrl(pics, type, id, density = 2) {
  const p = pics[`${type}-${id}`];
  if (!p) return null;
  const [base, ext] = p.filename.split(".");
  // Photos stored at a single size have no "_dN" ending; asking for one gives a 404.
  const d = Math.min(density, p.density || 1);
  return `https://www.fbgcdn.com/pictures/${base}${d >= 2 ? `_d${d}` : ""}.${ext}`;
}

function fromRestaurantLogin(data) {
  const r = data.restaurant;
  const pics = r.pictures || {};
  const hours = (r.opening_hours || []).filter((h) => h.type === "opening").map((h) => ({ days: h.day_of_week, open: h.begin_minute, close: h.end_minute }));
  const categories = r.menu.categories.filter((c) => c.active !== false && c.items.length).map((c) => {
    const cn = splitName(c.name);
    return {
      id: slug(cn.en || c.name) || String(c.id),
      en: titleCase(cn.en || c.name).replace(/\s*-\s*only takeaway & delivery\s*-?/i, " (takeaway & delivery)"),
      ar: clean(cn.ar || (AR.test(c.description || "") ? c.description : "")),
      img: pictureUrl(pics, "category", c.id),
      items: c.items.filter((i) => i.active !== false).map((i) => {
        const nm = splitName(i.name);
        const desc = clean(i.description);
        return {
          id: String(i.id),
          en: nm.en, ar: nm.ar,
          desc_en: AR.test(desc) ? "" : desc,
          desc_ar: AR.test(desc) ? desc : "",
          price: Number(i.price) || 0,
          img: pictureUrl(pics, "menu_item", i.id),
          out: !!i.is_out_of_stock,
          sizes: (i.sizes || []).map((s) => ({ ...splitName(s.name), price: Number(s.price) || 0 })),
          groups: (i.groups || []).map((g) => ({
            ...splitName(g.name), min: g.required ? Math.max(1, g.force_min || 1) : g.force_min || 0, max: g.force_max || g.options?.length || 1,
            options: (g.options || []).map((o) => ({ ...splitName(o.name), price: Number(o.price) || 0 })),
          })),
        };
      }),
    };
  });
  return { phone: clean(r.phone || r.terms?.phone), address: clean(r.address), currency: r.menu.currency || "USD", hours, categories };
}

async function fetchRestaurantLogin(browser, url) {
  const page = await browser.newPage();
  let menu = null;
  page.on("response", async (res) => {
    if (/\/api\/cart\/init/.test(res.url())) { try { const j = await res.json(); if (j?.restaurant?.menu) menu = j; } catch { /* ignore */ } }
  });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  for (let i = 0; i < 20 && !menu; i++) await page.waitForTimeout(500);
  await page.close();
  if (!menu) throw new Error("menu data not found");
  return fromRestaurantLogin(menu);
}

async function fetchHadath() {
  const html = await (await fetch(HADATH)).text();
  const start = html.indexOf("const menuData = ") + 17;
  let depth = 0, j = start, inStr = false;
  for (; j < html.length; j++) {
    const ch = html[j];
    if (ch === '"' && html[j - 1] !== "\\") inStr = !inStr;
    if (inStr) continue;
    if (ch === "{") depth++; else if (ch === "}" && --depth === 0) break;
  }
  const src = html.slice(start, j + 1).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[\]}])/g, "$1");
  const data = JSON.parse(src);
  const phone = (html.match(/wa\.me\/(\d{8,15})/) || [])[1];
  return {
    phone: phone ? "+" + phone : "", address: "Old Saida Road, Hadath, near LB University", currency: "USD", hours: [],
    categories: data.categories.map((c) => ({
      id: slug(c.en), en: titleCase(clean(c.en)), ar: clean(c.ar), img: null,
      // skip unnamed placeholder rows (Hadath's data has a hidden "banner" row)
      items: c.items.filter((i) => clean(i.name_en) || clean(i.name_ar)).map((i) => ({
        id: `${slug(c.en)}-${i.id}`, // Hadath's own ids repeat across categories, so make them unique
        en: clean(i.name_en), ar: clean(i.name_ar), desc_en: clean(i.desc_en), desc_ar: clean(i.desc_ar),
        price: Number(i.price) || 0, img: null, out: false, sizes: [], groups: [],
      })),
    })),
  };
}

// Hadath's own photos are tiny placeholders, so borrow the same dish's photo from another branch.
function borrowPhotos(target, others) {
  const key = (s) => s.toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "");
  const lib = new Map();
  for (const m of others) for (const c of m.categories) for (const i of c.items) if (i.img && !lib.has(key(i.en))) lib.set(key(i.en), i.img);
  let hit = 0, total = 0;
  for (const c of target.categories) for (const i of c.items) { total++; const img = lib.get(key(i.en)); if (img) { i.img = img; hit++; } }
  return `${hit}/${total}`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const menus = {};
  for (const [id, url] of Object.entries(SOURCES)) {
    try { menus[id] = await fetchRestaurantLogin(browser, url); console.log(`${id}: ${menus[id].categories.reduce((s, c) => s + c.items.length, 0)} items`); }
    catch (e) { console.log(`${id}: FAILED (${e.message}) - keeping the previous file if any`); }
  }
  await browser.close();
  try {
    menus.hadath = await fetchHadath();
    console.log(`hadath: ${menus.hadath.categories.reduce((s, c) => s + c.items.length, 0)} items, photos matched ${borrowPhotos(menus.hadath, Object.values(menus).filter((m) => m !== menus.hadath))}`);
  } catch (e) { console.log(`hadath: FAILED (${e.message})`); }
  const updated = new Date().toISOString().slice(0, 10);
  for (const [id, m] of Object.entries(menus)) fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify({ branch: id, updated, ...m }));
  console.log("saved to", OUT);
})();
