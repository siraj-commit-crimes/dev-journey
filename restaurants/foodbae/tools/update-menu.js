#!/usr/bin/env node
/*
 * Refreshes Food Bae's menu into data/menu.json from their current Restbits page.
 *   node tools/update-menu.js        (from restaurants/foodbae/)
 * The page embeds each dish as items[ID]={...} (name, price, photo, extras) and
 * groups dishes under category headers; both are read here. No browser needed.
 */
const fs = require("fs");
const path = require("path");

const URL = "https://rest.thrubits.com/restaurant/food-bae";
const ORIGIN = "https://rest.thrubits.com";
const OUT = path.join(__dirname, "..", "data", "menu.json");

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const decode = (s) => clean(s).replace(/&amp;/g, "&").replace(/&#039;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const slug = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const titleCase = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s);

// Real macros where a dish states them, e.g. "500 calories, 47g protein" or "19g Protein".
function macros(text) {
  const t = String(text || "");
  const p = t.match(/(\d+(?:\.\d+)?)\s*g\s*protein/i);
  const k = t.match(/(\d+)\s*(?:k?cal(?:ories)?)\b/i);
  return { protein: p ? Number(p[1]) : null, kcal: k ? Number(k[1]) : null };
}

(async () => {
  const html = await (await fetch(URL, { headers: { "accept-language": "en" } })).text();

  // 1) dish data
  const items = new Map();
  for (const m of html.matchAll(/items\[(\d+)\]=(\{.*?\});(?=items\[|\s)/g)) {
    try { items.set(Number(m[1]), JSON.parse(m[2])); } catch { /* skip malformed */ }
  }
  if (!items.size) throw new Error("no items found; the page layout may have changed");

  // 2) categories, in page order, with the dishes inside each
  const cats = [];
  const parts = html.split(/<div class="card shadow mb-3[^"]*" id="category_(\d+)">/).slice(1);
  for (let k = 0; k < parts.length; k += 2) {
    const body = parts[k + 1];
    const name = decode((body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]);
    const ids = [...new Set([...body.matchAll(/setCurrentItem\((\d+)\)/g)].map((x) => Number(x[1])))];
    if (name && ids.length) cats.push({ id: slug(name), name: titleCase(name), ids });
  }

  const categories = cats.map((c) => ({
    id: c.id,
    name: c.name,
    items: c.ids.map((id) => items.get(id)).filter(Boolean).map((i) => {
      const extras = (i.extras || []).map((e) => ({ id: e.id, name: decode(e.name), price: Number(e.price) || 0 }));
      const variants = (i.variants || []).map((v) => ({ id: v.id, name: decode(v.name || v.options || ""), price: Number(v.price) || 0 }));
      const desc = decode(i.description);
      return {
        id: String(i.id),
        name: decode(i.name),
        desc,
        price: Number(i.priceNotFormated) || 0,
        img: i.image ? ORIGIN + i.image : null,
        extras,
        variants,
        spicy: /🌶|spicy|buffalo|jalape/i.test(i.name + " " + desc),
        ...macros(i.name + " " + desc),
      };
    }),
  }));

  // "Dips" and "Extras" are add-on lists, not dishes: keep them as add-ons for burgers etc.
  const addonCats = new Set(["dips", "extras"]);
  const addons = {};
  for (const c of categories) for (const i of c.items) if (addonCats.has(slug(i.name))) addons[slug(i.name)] = i.extras;
  for (const c of categories) c.items = c.items.filter((i) => !addonCats.has(slug(i.name)));

  // Opening hours from the page's schema.org data: [{ day: 0-6 (Mon=0), open: "09:00", close: "23:00" }]
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  let hours = [];
  try {
    const ld = JSON.parse((html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/) || [])[1] || "{}");
    hours = (ld.openingHoursSpecification || []).flatMap((h) => [].concat(h.dayOfWeek).map((d) => ({ day: DAYS.indexOf(String(d).replace(/.*\//, "")), open: h.opens, close: h.closes }))).filter((h) => h.day >= 0);
  } catch { /* no hours */ }
  const out = { updated: new Date().toISOString().slice(0, 10), source: URL, hours, addons, categories: categories.filter((c) => c.items.length) };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  const n = out.categories.reduce((s, c) => s + c.items.length, 0);
  console.log(`saved ${n} dishes in ${out.categories.length} categories, add-on lists: ${Object.keys(addons).join(", ") || "none"} → ${OUT}`);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
