#!/usr/bin/env node
/*
 * End-to-end tests for the Station site. Opens the site in a real (headless)
 * browser and clicks through every feature, on desktop and phone, in English
 * and Arabic. Prints PASS/FAIL per check and exits non-zero if anything fails.
 *
 *   node tests/run-tests.js            (from restaurants/station/)
 *   node tests/run-tests.js --images   (also checks that dish photos load; slower, needs internet)
 *
 * Screenshots of failures go to tests/output/. Needs Playwright
 * (preinstalled in Claude Code cloud sessions; otherwise `npm i playwright`).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(__dirname, "output");
const CHECK_IMAGES = process.argv.includes("--images");
const MENU_BRANCHES = ["hadath", "mazraa", "moawad", "khaldeh", "saida"];
const NO_MENU_BRANCHES = ["nabatieh", "barelias", "mekseh", "ferzol", "baalbek"];
const WA = { hadath: "96181650620", mazraa: "96176024046", moawad: "96171500411", khaldeh: "96181886698", saida: "96178819669" };

// ---------- tiny static server ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split("?")[0])));
      if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (p.endsWith(path.sep)) p = path.join(p, "index.html");
      fs.readFile(p, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
        res.end(data);
      });
    }).listen(0, "127.0.0.1", () => resolve(srv));
  });
}

// ---------- tiny test runner ----------
const results = [];
let currentPage = null;
async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  \x1b[32mPASS\x1b[0m ${name} \x1b[2m(${Date.now() - t0}ms)\x1b[0m`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.log(`  \x1b[31mFAIL\x1b[0m ${name}\n       ${e.message.split("\n")[0]}`);
    if (currentPage) {
      fs.mkdirSync(OUT, { recursive: true });
      const file = path.join(OUT, name.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60) + ".png");
      await currentPage.screenshot({ path: file }).catch(() => {});
    }
  }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
const menuJson = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", "menus", id + ".json"), "utf8"));
const money = (n) => { const v = Math.round(n * 100) / 100; return "$" + (Number.isInteger(v) ? v : v.toFixed(2)); };

(async () => {
  const srv = await serve();
  const BASE = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const errors = [];

  async function newPage(opts = {}, state = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
    // Start from a clean slate, then apply the requested saved state (branch, language, cart).
    await ctx.addInitScript((s) => {
      if (!sessionStorage.getItem("__init")) {
        localStorage.clear();
        for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v));
        sessionStorage.setItem("__init", "1");
      }
    }, state);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${e.message}`));
    page.on("console", (m) => { if (m.type() === "error" && !/fbgcdn|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll(".stop").length === 10);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
    currentPage = page;
    return page;
  }
  const pickBranch = async (page, id) => {
    await page.locator(`.stop[data-branch="${id}"]`).click();
    await page.waitForFunction((b) => document.querySelector(".arrival-card") && localStorage.getItem("station.branch") === JSON.stringify(b), id);
  };
  const waitMenu = (page) => page.waitForFunction(() => document.querySelectorAll(".card").length > 0, null, { timeout: 15000 });
  const ticketCount = async (page) => Number(await page.textContent("#ticketCount"));

  // ======================================================================
  console.log("\nData files");
  for (const id of MENU_BRANCHES) {
    await test(`menu data for ${id} is complete`, async () => {
      const m = menuJson(id);
      const items = m.categories.flatMap((c) => c.items);
      expect(items.length > 30, `only ${items.length} items`);
      const noName = items.filter((i) => !i.en && !i.ar);
      eq(noName.length, 0, "items without any name");
      const badPrice = items.filter((i) => !(i.price >= 0));
      eq(badPrice.length, 0, "items with an invalid price");
      const ids = new Set(items.map((i) => i.id));
      eq(ids.size, items.length, "duplicate item ids");
      expect(m.categories.every((c) => c.en || c.ar), "a category has no name");
    });
  }
  await test("every branch with a menu has a WhatsApp number", async () => {
    const src = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
    for (const [id, wa] of Object.entries(WA)) expect(src.includes(`id: "${id}"`) && src.includes(`wa: "${wa}"`), `${id} WhatsApp number missing or changed`);
  });

  // ======================================================================
  console.log("\nHome page (desktop, English)");
  let page = await newPage();
  await test("loads with no JavaScript errors", async () => { await page.waitForTimeout(1500); eq(errors.length, 0, "errors: " + errors.join(" | ")); });
  await test("page is in English, left-to-right", async () => {
    eq(await page.getAttribute("html", "dir"), "ltr", "dir");
    eq((await page.textContent(".hero-sub")).trim(), "Shawarma spins, mashawi grills, saj flips. You pick the station, we’ll handle the delivery.", "hero subtitle");
  });
  await test("food train pulls in and stops at the platform", async () => {
    await page.waitForFunction(() => document.querySelectorAll(".wagon").length >= 3, null, { timeout: 8000 });
    await page.waitForTimeout(3600);
    const box = await page.locator("#cargoTrain").boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 1441, "train is not fully on screen when stopped: " + JSON.stringify(box));
    expect(!(await page.$eval("#scene", (s) => s.classList.contains("moving"))), "train should be stopped");
  });
  await test("every plate on the train is a real, different dish photo with a price", async () => {
    const plates = await page.$$eval(".wagon", (ws) => ws.map((w) => ({ img: w.querySelector("img").getAttribute("src"), price: w.querySelector(".wtag i").textContent })));
    expect(plates.every((p) => p.img && /^https:/.test(p.img)), "plate without a photo");
    eq(new Set(plates.map((p) => p.img)).size, plates.length, "same photo on two plates");
    expect(plates.every((p) => /^\$\d/.test(p.price)), "bad price tag");
  });
  await test("tapping a plate before choosing a station asks you to choose", async () => {
    await page.locator(".wagon").first().click();
    await page.waitForSelector("#pickSheet[open]");
    await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector("#pickSheet").open);
  });
  await test("no departure board or old train left over", async () => {
    eq(await page.locator(".board, .track").count(), 0, "old elements");
  });
  await test("route map shows 10 stations on 3 lines", async () => {
    eq(await page.locator(".line").count(), 3, "lines");
    eq(await page.locator(".stop").count(), 10, "stops");
    eq(await page.locator(".stop.nomenu").count(), 5, "stations marked 'menu soon'");
  });
  await test("menu asks you to choose a station first", async () => {
    expect(await page.locator(".menu-gate").isVisible(), "no station prompt");
    eq(await page.locator(".menu-gate [data-branch]").count(), 5, "branch buttons in the prompt");
  });
  await test("station chip opens the station picker", async () => {
    await page.click("#stationChip");
    await page.waitForSelector("#pickSheet[open]");
    eq(await page.locator("#pickList .pick").count(), 10, "stations in picker");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#pickSheet").open);
  });
  await page.context().close();

  // ======================================================================
  console.log("\nEach branch");
  for (const id of MENU_BRANCHES) {
    page = await newPage();
    await test(`${id}: picking it loads its full menu with correct prices`, async () => {
      await pickBranch(page, id); await waitMenu(page);
      const m = menuJson(id);
      const items = m.categories.flatMap((c) => c.items);
      eq(await page.locator(".card").count(), items.length, "number of dishes");
      eq(await page.locator(".cat").count(), m.categories.length, "number of categories");
      const first = items[0];
      const card = page.locator(`.card[data-id="${first.id}"] .fare`);
      await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(900); // let the price digits settle
      eq(await card.getAttribute("data-fare"), money(first.price), `price of ${first.en}`);
    });
    await test(`${id}: arrival card, chip and train are updated`, async () => {
      expect((await page.textContent(".arrival-sign b")).toLowerCase().includes(id === "barelias" ? "bar" : id.slice(0, 4)), "arrival sign");
      expect((await page.textContent("#chipName")).length > 1, "chip name empty");
      const wa = WA[id];
      expect((await page.textContent(".arrival-info")).replace(/\D/g, "").includes(wa), "WhatsApp number not shown");
      expect(await page.locator(".line.has-train .mini-train").isVisible(), "little train not shown");
      const hours = menuJson(id).hours;
      const status = await page.textContent(".arrival-info p:nth-child(2)");
      expect(hours.length ? /Open now|Closed/.test(status) : /Call for opening hours/.test(status), `opening status "${status}"`);
    });
    await test(`${id}: the train carries ${id}'s dishes and a plate opens its dish`, async () => {
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForFunction(() => !document.querySelector("#scene").classList.contains("moving") && document.querySelectorAll(".wagon").length, null, { timeout: 15000 });
      const ids = new Set(menuJson(id).categories.flatMap((c) => c.items.map((i) => i.id)));
      const plates = await page.$$eval(".wagon", (ws) => ws.map((w) => w.dataset.dish));
      expect(plates.every((p) => ids.has(p)), "plates from another branch");
      eq(await page.textContent("#platformSign span"), id === "barelias" ? "Bar Elias" : id[0].toUpperCase() + id.slice(1), "platform sign");
      await page.locator(".wagon").first().click({ timeout: 6000 });
      await page.waitForSelector("#itemSheet[open]");
      await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector("#itemSheet").open);
    });
    await page.context().close();
  }
  for (const id of NO_MENU_BRANCHES) {
    page = await newPage();
    await test(`${id}: shows "menu coming soon" with a call button`, async () => {
      await pickBranch(page, id);
      expect(/coming soon/i.test(await page.textContent(".arrival-card")), "no coming-soon message");
      expect((await page.getAttribute(".arrival-actions a[href^='tel:']", "href")).startsWith("tel:+961"), "no call link");
      eq(await page.locator(".card").count(), 0, "should not show dishes");
    });
    await page.context().close();
  }

  // ======================================================================
  console.log("\nMenu tools (Saida)");
  page = await newPage({}, { "station.branch": "saida" });
  await waitMenu(page);
  const saida = menuJson("saida");
  const saidaItems = saida.categories.flatMap((c) => c.items.map((i) => ({ ...i, cat: c })));
  await test("search finds shawarma dishes", async () => {
    await page.fill("#search", "shawarma"); await page.waitForTimeout(500);
    const expected = saidaItems.filter((i) => `${i.en} ${i.ar} ${i.desc_en} ${i.desc_ar} ${i.cat.en} ${i.cat.ar}`.toLowerCase().includes("shawarma")).length;
    eq(await page.locator(".card").count(), expected, "results");
  });
  await test("search works in Arabic", async () => {
    await page.fill("#search", "شاورما"); await page.waitForTimeout(500);
    expect((await page.locator(".card").count()) > 3, "too few results");
  });
  await test("search with no match shows a message", async () => {
    await page.fill("#search", "zzzzqqq"); await page.waitForTimeout(500);
    eq(await page.locator(".card").count(), 0, "cards"); expect(await page.locator("#emptyState").isVisible(), "no empty message");
    await page.fill("#search", ""); await page.waitForTimeout(500);
    eq(await page.locator(".card").count(), saidaItems.length, "all dishes back");
  });
  await test("quick filter 'Shawarma' shows only shawarma categories, and toggles off", async () => {
    await page.click('[data-quick="shawarma"]'); await waitMenu(page);
    const names = await page.$$eval(".cat", (e) => e.map((s) => s.dataset.name));
    expect(names.length > 0 && names.every((n) => /shawarma|taste box/i.test(n)), "categories: " + names);
    await page.click('[data-quick="shawarma"]'); await page.waitForTimeout(400);
    eq(await page.locator(".cat").count(), saida.categories.length, "all categories back");
  });
  await test("category tab jumps to its section", async () => {
    const tab = page.locator(".platform").nth(10);
    const target = await tab.getAttribute("data-target");
    await tab.click(); await page.waitForTimeout(1200);
    const top = await page.$eval("#" + target, (s) => s.getBoundingClientRect().top);
    expect(top > -40 && top < 260, `section is at ${Math.round(top)}px from the top`);
    expect(await tab.evaluate((t) => t.classList.contains("active")), "tab not highlighted");
  });
  await test("express shawarma carousel opens a dish", async () => {
    await page.locator(".xcar").first().click();
    await page.waitForSelector("#itemSheet[open]");
    await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector("#itemSheet").open);
  });
  await test("keyboard: Enter on a dish opens it, Escape closes it", async () => {
    await page.locator(".card:not(.out)").nth(2).focus();
    await page.keyboard.press("Enter"); await page.waitForSelector("#itemSheet[open]");
    await page.keyboard.press("Escape"); await page.waitForFunction(() => !document.querySelector("#itemSheet").open);
  });

  // ======================================================================
  console.log("\nTicket (cart) and WhatsApp");
  const [a, b] = saidaItems.filter((i) => !i.out && i.price > 0 && !i.sizes.length && !i.groups.length);
  await test("'+ Ticket' adds a dish and punches the ticket", async () => {
    const card = page.locator(`.card[data-id="${a.id}"]`);
    await card.scrollIntoViewIfNeeded();
    await card.locator(".add").click();
    await page.waitForFunction(() => document.querySelector("#ticketCount").textContent === "1");
  });
  await test("dish window: quantity 2 + note, total updates", async () => {
    await page.locator(`.card[data-id="${b.id}"]`).click();
    await page.waitForSelector("#itemSheet[open]");
    await page.click("#qtyPlus");
    eq(await page.textContent("#addTotal"), money(b.price * 2), "button total");
    await page.fill("#itemNotes", "extra garlic");
    await page.click("#addBtn");
    await page.waitForFunction(() => document.querySelector("#ticketCount").textContent === "3");
  });
  await test("ticket shows the right lines and total", async () => {
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
    await page.click("#ticketBtn"); await page.waitForSelector("#ticketDrawer[open]");
    eq(await page.locator(".tline").count(), 2, "lines");
    eq(await page.textContent("#ticketTotal"), money(a.price + b.price * 2), "total");
    eq(await page.textContent("#ticketFrom"), "Saida", "from");
    eq(await page.locator("#punches i").count(), 3, "punch holes");
  });
  await test("+ / − in the ticket change quantities and remove lines", async () => {
    await page.locator(".tline").first().locator("[data-inc]").click();
    await page.waitForFunction(() => document.querySelector("#ticketCount").textContent === "4");
    await page.locator(".tline").first().locator("[data-dec]").click();
    await page.locator(".tline").first().locator("[data-dec]").click();
    await page.waitForFunction(() => document.querySelectorAll(".tline").length === 1);
    eq(await page.textContent("#ticketTotal"), money(b.price * 2), "total after removing");
  });
  await test("WhatsApp message goes to Saida with dishes, total, name and address", async () => {
    await page.fill("#custName", "Test Customer");
    await page.fill("#custAddress", "Main Road, 2nd floor");
    const [pop] = await Promise.all([page.waitForEvent("popup", { timeout: 6000 }), page.click("#sendBtn")]);
    const url = decodeURIComponent(pop.url()).replace(/\+/g, " ");
    await pop.close();
    expect(url.includes(WA.saida), "wrong number: " + url.slice(0, 80));
    for (const s of ["Hello Station Saida", b.en, b.ar, "× 2", `Total: ${money(b.price * 2)}`, "Name: Test Customer", "Address: Main Road, 2nd floor", "extra garlic"])
      expect(url.includes(s), `message is missing "${s}"`);
  });
  await test("ticket, station and customer details survive a reload", async () => {
    await page.reload({ waitUntil: "domcontentloaded" }); await waitMenu(page);
    await page.waitForFunction(() => document.querySelector("#ticketCount").textContent === "2");
    eq(await page.textContent("#chipName"), "Saida", "station");
    eq(await page.inputValue("#custName"), "Test Customer", "name");
  });
  await test("switching station asks first; cancel keeps the ticket", async () => {
    page.once("dialog", (d) => d.dismiss());
    await page.locator('.stop[data-branch="mazraa"]').click(); await page.waitForTimeout(600);
    eq(await page.textContent("#chipName"), "Saida", "station changed anyway");
    eq(await ticketCount(page), 2, "ticket was cleared");
  });
  await test("switching station and confirming clears the ticket", async () => {
    page.once("dialog", (d) => d.accept());
    await page.locator('.stop[data-branch="mazraa"]').click();
    await page.waitForFunction(() => document.querySelector("#chipName").textContent === "Mazraa");
    await page.waitForFunction(() => document.querySelector("#ticketCount").textContent === "0");
  });
  await test("scrolling down never jumps back up", async () => {
    await page.evaluate(() => scrollTo(0, 0));
    const jumps = await page.evaluate(async () => {
      const out = []; let last = scrollY;
      const h = () => { if (scrollY < last - 2) out.push([last, scrollY]); last = scrollY; };
      addEventListener("scroll", h);
      for (let i = 0; i < 60; i++) { scrollBy(0, 250); await new Promise((r) => setTimeout(r, 60)); }
      await new Promise((r) => setTimeout(r, 800));
      removeEventListener("scroll", h);
      return out;
    });
    eq(jumps.length, 0, "page jumped back up");
  });
  await page.context().close();

  // ======================================================================
  console.log("\nArabic");
  page = await newPage({}, { "station.branch": "khaldeh", "station.lang": "ar" });
  await waitMenu(page);
  await test("page is in Arabic, right-to-left", async () => {
    eq(await page.getAttribute("html", "dir"), "rtl", "dir");
    eq(await page.getAttribute("html", "lang"), "ar", "lang");
    eq((await page.textContent(".hero-sub")).trim(), "الشاورما عم تلفّ، المشاوي عالفحم، والصاج عم ينقلب. إنت اختار المحطة، والتوصيل علينا.", "hero subtitle");
    eq(await page.textContent("#chipName"), "خلدة", "station name");
  });
  await test("dish names show in Arabic", async () => {
    const m = menuJson("khaldeh"); const item = m.categories[0].items.find((i) => i.ar);
    eq((await page.textContent(`.card[data-id="${item.id}"] h4`)).trim(), item.ar, "first dish");
  });
  await test("WhatsApp message is in Arabic", async () => {
    const item = menuJson("khaldeh").categories.flatMap((c) => c.items).find((i) => !i.out && i.price > 0 && !i.sizes.length && !i.groups.length);
    const card = page.locator(`.card[data-id="${item.id}"]`);
    await card.scrollIntoViewIfNeeded(); await card.locator(".add").click();
    await page.evaluate(() => scrollTo(0, 0)); await page.click("#ticketBtn"); await page.waitForSelector("#ticketDrawer[open]");
    const [pop] = await Promise.all([page.waitForEvent("popup", { timeout: 6000 }), page.click("#sendBtn")]);
    const url = decodeURIComponent(pop.url()).replace(/\+/g, " "); await pop.close();
    expect(url.includes(WA.khaldeh), "wrong number");
    expect(url.includes("مرحبا محطة خلدة") && url.includes("المجموع"), "not Arabic: " + url.slice(0, 120));
  });
  await test("language button switches back to English", async () => {
    await page.keyboard.press("Escape"); await page.waitForTimeout(400);
    await page.click("#langBtn");
    await page.waitForFunction(() => document.documentElement.dir === "ltr");
    eq(await page.textContent("#chipName"), "Khaldeh", "station name");
  });
  await page.context().close();

  // ======================================================================
  console.log("\nPhone (iPhone 13)");
  page = await newPage({ ...devices["iPhone 13"] }, { "station.branch": "hadath" });
  await waitMenu(page);
  await test("no sideways scrolling", async () => {
    const [iw, sw] = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
    eq(sw, iw, "page wider than screen");
  });
  await test("dish window fits the screen and its Add button works", async () => {
    await page.locator(".card:not(.out)").nth(1).click(); await page.waitForSelector("#itemSheet[open]");
    await page.waitForTimeout(600);
    const r = await page.locator("#addBtn").boundingBox();
    expect(r && r.x >= 0 && r.x + r.width <= 391 && r.y + r.height <= 845, "Add button off screen: " + JSON.stringify(r));
    await page.click("#addBtn");
    await page.waitForFunction(() => document.querySelector("#ticketCount").textContent === "1");
  });
  await test("floating 'View ticket' bar appears and opens the ticket", async () => {
    await page.waitForTimeout(500);
    expect(await page.locator("#ticketBar").isVisible(), "bar not visible");
    await page.click("#ticketBar"); await page.waitForSelector("#ticketDrawer[open]");
    expect(await page.locator("#sendBtn").isVisible(), "send button hidden");
  });
  await test("hero headline doesn't break words", async () => {
    await page.keyboard.press("Escape"); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400);
    const broken = await page.$$eval(".ht-line .wd", (ws) => ws.filter((w) => w.getClientRects().length > 1).length);
    eq(broken, 0, "words split across lines");
  });
  await page.context().close();

  // ======================================================================
  console.log("\nReduced motion");
  page = await newPage({ reducedMotion: "reduce" }, { "station.branch": "moawad" });
  await waitMenu(page);
  await test("everything is visible without animations", async () => {
    await page.evaluate(() => scrollTo(0, document.querySelector("#menu").offsetTop));
    await page.waitForTimeout(300);
    const hidden = await page.$$eval(".card", (cs) => cs.filter((c) => getComputedStyle(c).opacity !== "1").length);
    eq(hidden, 0, "cards still hidden");
  });
  await page.context().close();

  // ======================================================================
  if (CHECK_IMAGES) {
    console.log("\nDish photos (online)");
    for (const id of MENU_BRANCHES) {
      await test(`${id}: dish photos load`, async () => {
        const urls = [...new Set(menuJson(id).categories.flatMap((c) => c.items.map((i) => i.img)).filter(Boolean))];
        const sample = urls.filter((_, i) => i % Math.ceil(urls.length / 12) === 0);
        const bad = [];
        for (const u of sample) { const r = await fetch(u, { method: "HEAD" }).catch(() => null); if (!r || !r.ok) bad.push(u); }
        eq(bad.length, 0, `${bad.length}/${sample.length} photos failed, e.g. ${bad[0]}`);
      });
    }
  }

  await test("no JavaScript errors during the whole run", async () => { eq(errors.length, 0, "errors: " + [...new Set(errors)].slice(0, 3).join(" | ")); });

  await browser.close(); srv.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed` + (failed.length ? `, ${failed.length} failed (screenshots in tests/output/)` : " ✓"));
  process.exit(failed.length ? 1 : 0);
})();
