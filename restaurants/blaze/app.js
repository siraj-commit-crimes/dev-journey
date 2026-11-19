/* Blaze redesign demo.
 * Menu, prices, hours and stock come live from Blaze's existing system
 * (/api/menu, proxied by Netlify), so their /staff editor keeps working.
 */
(() => {
  "use strict";

  // ---------- Config ----------
  const MENU_URL = "/api/menu";
  const VERSION_URL = "/api/menu?scope=version";
  const SNAPSHOT_URL = "menu-snapshot.json";
  const DEFAULT_DISCOUNT = 10;
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const SPICE = [
    { name: "Mild", flames: "🔥", say: "Mild: all the flavour, none of the regret." },
    { name: "Hot", flames: "🔥🔥", say: "Hot: the classic Nashville kick. You'll sweat a little." },
    { name: "Blazing", flames: "🔥🔥🔥", say: "Blazing: sign a waiver. Keep the honey close." },
  ];
  // Used when the live settings don't list delivery areas (same as Blaze's current site).
  const DEFAULT_AREAS = [
    { id: "beirut", name: "Beirut and surrounding / Hazmieh / Baabda", phone: "96171830272", available: true },
    { id: "maten", name: "Maten / Mansourieh", phone: "96181469388", available: true },
  ];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  // ---------- State ----------
  const state = {
    settings: {},
    categories: [],
    items: new Map(),
    version: null,
    activeFilters: new Set(),
    query: "",
    heat: 1,
    area: load("blaze.area", null),
    cart: load("blaze.cart", []),
  };

  // ---------- Helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function load(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }

  function money(n) {
    const cur = state.settings.currency || "USD";
    const v = Math.round((Number(n) || 0) * 100) / 100;
    if (cur === "USD") return "$" + (Number.isInteger(v) ? v : v.toFixed(2));
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, currencyDisplay: "code" }).format(v);
  }

  function imageUrl(ref) {
    if (typeof ref !== "string" || !ref) return "img/logo.webp";
    const photo = /^photo:([0-9a-f-]{36})$/i.exec(ref);
    if (photo) return "/api/menu?scope=image&id=" + photo[1];
    if (ref.startsWith("asset:")) return ref === "asset:logo" ? "img/logo.webp" : "img/dishes/" + ref.slice(6) + ".webp";
    if (/^https?:\/\//.test(ref)) return ref;
    return "img/logo.webp";
  }

  // Same pricing rules as Blaze's current site.
  function discountPct(item) {
    const p = Number(item.discountPercent);
    if (Number.isFinite(p) && (p > 0 || (p === 0 && item.discountMode))) return p;
    const g = Number(state.settings.discount);
    return Number.isFinite(g) ? g : DEFAULT_DISCOUNT;
  }
  function unitPrice(item, optionDelta = 0) {
    const base = Number(item.basePrice || 0);
    if (item.noDiscount) return base + optionDelta;
    const sale = Number(item.salePrice);
    if (item.salePrice != null && Number.isFinite(sale) && (sale > 0 || (sale === 0 && item.discountMode === "sale"))) return sale + optionDelta;
    return Math.round(base * (1 - discountPct(item) / 100) * 100) / 100 + optionDelta;
  }
  const status = (it) => it.status || (it.inStock === false ? "stock" : it.available === false ? "temporary" : "active");
  const isAvailable = (it) => status(it) === "active";
  const groupsOf = (it) => it.groups || (it.options ? [{ id: "legacy", name: "Options", mode: "multiple", min: 0, max: it.options.length, choices: it.options }] : []);
  const hasSpice = (it) => !!it.isMeal;

  // ---------- Data ----------
  async function fetchJson(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.json();
  }

  async function loadMenu() {
    let data, live = true;
    try { data = await fetchJson(MENU_URL); }
    catch { live = false; data = await fetchJson(SNAPSHOT_URL); }
    const pub = data.published || data;
    state.version = data.version ?? null;
    state.settings = pub.settings || {};
    state.categories = (pub.categories || []).map((c) => ({ ...c, items: (c.items || []).filter((i) => status(i) !== "hidden") })).filter((c) => c.items.length);
    state.items = new Map(state.categories.flatMap((c) => c.items.map((i) => [i.id, { ...i, category: c.name }])));
    const note = $("#syncNote");
    note.classList.toggle("offline", !live);
    note.lastChild.textContent = live ? " Live from the Blaze kitchen" : " Showing a saved copy of the menu";
    return live;
  }

  function startVersionPolling() {
    setInterval(async () => {
      if (document.hidden) return;
      try {
        const { version } = await fetchJson(VERSION_URL);
        if (version != null && version !== state.version) {
          await loadMenu();
          renderAll();
          toast("Menu just updated by the kitchen 🔥");
        }
      } catch { /* ignore: next tick will retry */ }
    }, 60000);
  }

  // ---------- Hours ----------
  function beirutNow() {
    const tz = state.settings.timeZone || "Asia/Beirut";
    let parts;
    try { parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()); }
    catch { parts = new Intl.DateTimeFormat("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()); }
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return { day: DAYS.indexOf(get("weekday")), mins: (+get("hour") % 24) * 60 + +get("minute") };
  }
  const toMins = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + m; };
  const allDay = (h) => h && h.enabled && h.open === h.close;

  function openState() {
    const hours = state.settings.hours;
    if (!Array.isArray(hours) || hours.length !== 7) return { open: true, label: "Open now" };
    if (hours.every(allDay)) return { open: true, label: "Open now · 24/7" };
    const { day, mins } = beirutNow();
    const today = hours[day], yest = hours[(day + 6) % 7];
    const inRange = (h, m, prevDay) => {
      if (!h || !h.enabled) return false;
      if (allDay(h)) return !prevDay;
      const o = toMins(h.open), c = toMins(h.close);
      if (c > o) return !prevDay && m >= o && m < c;
      return prevDay ? m < c : m >= o; // overnight
    };
    if (inRange(today, mins, false)) return { open: true, label: allDay(today) ? "Open now · all day" : `Open now · until ${today.close}` };
    if (inRange(yest, mins, true)) return { open: true, label: `Open now · until ${yest.close}` };
    for (let i = 0; i < 7; i++) {
      const d = (day + i) % 7, h = hours[d];
      if (!h || !h.enabled) continue;
      if (i === 0 && toMins(h.open) <= mins) continue;
      return { open: false, label: `Closed · opens ${i === 0 ? "" : i === 1 ? "tomorrow " : DAYS[d] + " "}${h.open}` };
    }
    return { open: false, label: "Closed" };
  }

  function renderHours() {
    const s = openState();
    const badge = $("#liveBadge");
    badge.classList.toggle("closed", !s.open);
    $("#liveText").textContent = state.settings.paused ? "Taking a short break" : s.label;
    const hours = state.settings.hours || [];
    const { day } = beirutNow();
    $("#hoursList").innerHTML = DAYS.map((d, i) => {
      const h = hours[i];
      const txt = !h ? "—" : !h.enabled ? "Closed" : allDay(h) ? "Open 24 hours" : `${h.open} – ${h.close}`;
      return `<li class="${i === day ? "today" : ""}"><span>${d}</span><span>${txt}</span></li>`;
    }).join("");
  }

  // ---------- Areas ----------
  const areas = () => (Array.isArray(state.settings.locations) && state.settings.locations.length ? state.settings.locations : DEFAULT_AREAS);
  const areaById = (id) => areas().find((a) => a.id === id && a.available !== false);
  const pin = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';

  function renderAreas() {
    const html = areas().map((a) => `
      <button type="button" class="area ${state.area === a.id ? "sel" : ""}" data-area="${esc(a.id)}" ${a.available === false ? "disabled" : ""}>
        ${pin}<span><strong>${esc(a.name)}</strong><small>${a.available === false ? "Currently unavailable" : state.area === a.id ? "Your area ✓" : "Deliver here"}</small></span>
      </button>`).join("");
    $("#areaList").innerHTML = html;
    $("#areaPicker").innerHTML = html;
    const sel = areaById(state.area);
    $("#areaChipName").textContent = sel ? sel.name.split("/")[0].trim() : "Choose area";
    $("#cartArea").innerHTML = `<option value="">Choose your area</option>` + areas().filter((a) => a.available !== false).map((a) => `<option value="${esc(a.id)}" ${state.area === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("");
    const phone = (sel || areas()[0] || {}).phone || state.settings.whatsapp;
    $("#waContact").href = phone ? `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent("Hi Blaze!")}` : "#";
  }

  function setArea(id) {
    state.area = id || null;
    save("blaze.area", state.area);
    renderAreas();
  }

  // ---------- Menu rendering ----------
  function priceHtml(item) {
    const now = unitPrice(item), was = Number(item.basePrice || 0);
    return `<strong data-v="${now}">${money(now)}</strong>${now < was ? `<s>${money(was)}</s>` : ""}`;
  }
  function badgeHtml(item) {
    if (!isAvailable(item)) return "";
    const now = unitPrice(item), was = Number(item.basePrice || 0);
    if (!(now < was)) return "";
    const pct = Math.round((1 - now / was) * 100);
    const delay = `style="--wd:${(Math.random() * 4).toFixed(2)}s"`;
    return item.salePrice != null ? `<span class="badge hot" ${delay}>-${pct}% DEAL</span>` : `<span class="badge" ${delay}>-${pct}%</span>`;
  }
  function cardHtml(item, i) {
    const avail = isAvailable(item);
    const label = status(item) === "stock" ? "Sold out" : "Unavailable";
    return `
      <article class="card pop ${avail ? "" : "sold"}" data-id="${esc(item.id)}" tabindex="${avail ? 0 : -1}" style="--d:${(i % 4) * 0.09}s;--r:${i % 2 ? 4 : -4}deg" aria-label="${esc(item.name)}">
        <div class="card-media"><img src="${imageUrl(item.image)}" alt="" loading="lazy" />${badgeHtml(item)}</div>
        <div class="card-body">
          <h4>${esc(item.name)}${hasSpice(item) && avail ? ` <span class="spicy" title="Pick your heat" aria-hidden="true">🔥</span>` : ""}</h4>
          ${item.description ? `<p>${esc(item.description)}</p>` : ""}
          <div class="card-foot">
            <div class="price">${priceHtml(item)}</div>
            ${avail ? `<button class="quick-add" type="button" aria-label="Add ${esc(item.name)}" data-add="${esc(item.id)}">+</button>` : `<span class="sold-tag">${label}</span>`}
          </div>
        </div>
      </article>`;
  }

  function matches(item) {
    const q = state.query.trim().toLowerCase();
    if (q && !(`${item.name} ${item.description || ""} ${item.category}`.toLowerCase().includes(q))) return false;
    const f = state.activeFilters;
    if (f.has("sale") && !(unitPrice(item) < Number(item.basePrice || 0) && item.salePrice != null)) return false;
    if (f.has("meal") && !item.isMeal) return false;
    if (f.has("under10") && unitPrice(item) >= 10) return false;
    return true;
  }

  const slug = (s) => "cat-" + String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");

  function renderMenu() {
    const body = $("#menuBody");
    let shown = 0;
    const banner = state.settings.paused ? `<p class="banner">Blaze isn't taking orders right now. You can still browse the menu.</p>` : "";
    body.innerHTML = banner + state.categories.map((c) => {
      const items = c.items.map((i) => state.items.get(i.id)).filter(matches);
      if (!items.length) return "";
      shown += items.length;
      return `<section class="cat" id="${slug(c.name)}" data-cat="${esc(c.name)}">
        <div class="cat-title"><h3>${esc(c.name)}</h3><span>${items.length} item${items.length > 1 ? "s" : ""}</span></div>
        <div class="grid">${items.map(cardHtml).join("")}</div>
      </section>`;
    }).join("");
    $("#emptyState").hidden = shown > 0;
    renderTabs();
    observeReveals(body);
    observePops(body);
    attachTilt(body);
    observeCats();
  }

  function renderTabs() {
    const tabs = $("#tabs");
    $$(".tab", tabs).forEach((t) => t.remove());
    $$(".cat", $("#menuBody")).forEach((sec, i) => {
      const b = document.createElement("button");
      b.className = "tab" + (i === 0 ? " active" : "");
      b.type = "button";
      b.role = "tab";
      b.textContent = sec.dataset.cat;
      b.dataset.target = sec.id;
      tabs.appendChild(b);
    });
    requestAnimationFrame(moveInk);
  }

  function moveInk() {
    const active = $(".tab.active");
    const ink = $("#tabInk");
    if (!active) { ink.style.width = "0"; return; }
    ink.style.width = active.offsetWidth + "px";
    ink.style.transform = `translateX(${active.offsetLeft}px)`;
    const tabs = $("#tabs");
    const target = active.offsetLeft - tabs.clientWidth / 2 + active.offsetWidth / 2;
    tabs.scrollTo({ left: target, behavior: reduceMotion ? "auto" : "smooth" });
  }

  let catObserver;
  let tabLock = 0;
  function observeCats() {
    catObserver?.disconnect();
    catObserver = new IntersectionObserver((entries) => {
      if (Date.now() < tabLock) return;
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!vis) return;
      setActiveTab(vis.target.id);
    }, { rootMargin: "-170px 0px -55% 0px" });
    $$(".cat").forEach((s) => catObserver.observe(s));
  }
  function setActiveTab(id) {
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.target === id));
    moveInk();
  }

  function renderCombos() {
    const cat = state.categories.find((c) => /combo|shar/i.test(c.name));
    const items = cat ? cat.items.map((i) => state.items.get(i.id)) : [];
    $("#combos").hidden = !items.length;
    $("#comboGrid").innerHTML = items.map((item, i) => `
      <article class="combo reveal ${isAvailable(item) ? "" : "sold"}" data-id="${esc(item.id)}" tabindex="0" style="--d:${i * 0.1}s">
        <div class="card-media"><img src="${imageUrl(item.image)}" alt="" loading="lazy" />${badgeHtml(item)}</div>
        <div class="combo-body">
          <h4>${esc(item.name)}</h4>
          ${item.description ? `<p>${esc(item.description)}</p>` : ""}
          <div class="card-foot"><div class="price">${priceHtml(item)}</div>
          ${isAvailable(item) ? `<button class="quick-add" type="button" aria-label="Add ${esc(item.name)}" data-add="${esc(item.id)}">+</button>` : ""}</div>
        </div>
      </article>`).join("");
    observeReveals($("#comboGrid"));
  }

  function renderGallery() {
    const imgs = ["img/hero.webp", ...[...state.items.values()].filter((i) => i.isMeal || /combo/i.test(i.category)).map((i) => imageUrl(i.image))];
    const uniq = [...new Set(imgs)].slice(0, 10);
    const html = uniq.map((src) => `<figure><img src="${src}" alt="" loading="lazy" /></figure>`).join("");
    $("#galleryTrack").innerHTML = html + html; // doubled for seamless loop
  }

  function renderAll() {
    const d = state.settings.discount;
    $("#discountValue").textContent = (Number.isFinite(Number(d)) && Number(d) > 0 ? Number(d) : DEFAULT_DISCOUNT) + "%";
    renderHours();
    renderAreas();
    renderMenu();
    renderCombos();
    renderGallery();
    pruneCart();
    renderCart();
  }

  // ---------- Item sheet ----------
  const sheet = $("#itemSheet");
  let current = null, qty = 1;

  function openItem(id) {
    const item = state.items.get(id);
    if (!item || !isAvailable(item)) return;
    current = item; qty = 1;
    $("#itemImg").src = imageUrl(item.image);
    $("#itemTitle").textContent = item.name;
    $("#itemPrice").innerHTML = priceHtml(item);
    $("#itemDesc").textContent = item.description || "";
    $("#itemNotes").value = "";
    $("#itemSpice").innerHTML = hasSpice(item) ? `
      <span class="opt-title">Heat level <small>Required</small></span>
      <div class="spice-row">${SPICE.map((s, i) => `<label><input type="radio" name="spice" value="${s.name}" ${i === state.heat ? "checked" : ""} /><span><em>${s.flames}</em>${s.name}</span></label>`).join("")}</div>` : "";
    $("#itemGroups").innerHTML = groupsOf(item).map((g) => {
      const single = g.mode === "single";
      const min = Number(g.min || 0), max = Number(g.max || (single ? 1 : g.choices.length));
      const hint = min > 0 ? `Choose ${min}${max > min ? `–${max}` : ""}` : max < g.choices.length ? `Up to ${max}` : "Optional";
      return `<div class="opt-block" data-group="${esc(g.id)}" data-min="${min}" data-max="${max}">
        <span class="opt-title">${esc(g.name)} <small>${hint}</small></span>
        ${g.choices.map((c) => `<label class="opt ${c.available === false ? "disabled" : ""}">
          <input type="${single ? "radio" : "checkbox"}" name="g_${esc(g.id)}" value="${esc(c.id)}" data-delta="${Number(c.priceDelta) || 0}" data-name="${esc(c.name)}" ${c.available === false ? "disabled" : ""} />
          <span>${esc(c.name)}</span>${Number(c.priceDelta) ? `<em>+ ${money(c.priceDelta)}</em>` : ""}</label>`).join("")}
        <p class="err" hidden></p>
      </div>`;
    }).join("");
    updateSheet();
    sheet.showModal();
    sheet.querySelector(".sheet-body").scrollTop = 0;
  }

  function selections() {
    const opts = $$("#itemGroups input:checked").map((i) => ({ id: i.value, name: i.dataset.name, priceDelta: Number(i.dataset.delta) }));
    const spice = $("#itemSpice input:checked")?.value || "";
    return { opts, spice, delta: opts.reduce((s, o) => s + o.priceDelta, 0) };
  }

  function updateSheet() {
    if (!current) return;
    let ok = true;
    $$("#itemGroups [data-group]").forEach((g) => {
      const max = +g.dataset.max, min = +g.dataset.min;
      const boxes = $$("input", g), n = boxes.filter((b) => b.checked).length;
      if (boxes[0]?.type === "checkbox") boxes.forEach((b) => { if (!b.checked && !b.closest(".opt").classList.contains("disabled")) b.disabled = n >= max; });
      const err = $(".err", g);
      const bad = n < min;
      err.hidden = !bad; err.textContent = bad ? `Pick at least ${min}` : "";
      if (bad) ok = false;
    });
    const { delta } = selections();
    $("#qtyOut").textContent = qty;
    $("#addTotal").textContent = money(unitPrice(current, delta) * qty);
    const add = $("#addBtn");
    add.classList.toggle("no", !ok);
    add.dataset.ok = ok ? "1" : "";
  }

  $("#itemGroups").addEventListener("change", updateSheet);
  $("#qtyMinus").addEventListener("click", () => { qty = Math.max(1, qty - 1); updateSheet(); });
  $("#qtyPlus").addEventListener("click", () => { qty = Math.min(50, qty + 1); updateSheet(); });
  $("#itemForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.submitter?.value === "cancel") return closeDialog(sheet);
    if (!$("#addBtn").dataset.ok) { $("#itemGroups .err:not([hidden])")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const { opts, spice } = selections();
    addToCart(current, qty, { opts, spice, notes: $("#itemNotes").value.trim() }, $("#itemImg"));
    closeDialog(sheet);
  });

  // Animated close for dialogs
  function closeDialog(d) {
    if (!d.open || d.classList.contains("closing")) return;
    if (reduceMotion) { d.close(); return; }
    d.classList.add("closing");
    const inner = d.firstElementChild;
    const done = () => { d.classList.remove("closing"); d.close(); };
    inner.addEventListener("animationend", done, { once: true });
    setTimeout(() => d.open && d.classList.contains("closing") && done(), 450);
  }
  $$("dialog").forEach((d) => {
    d.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(d); });
    d.addEventListener("click", (e) => { if (e.target === d) closeDialog(d); });
  });

  // ---------- Cart ----------
  const lineKey = (id, sel) => [id, sel.spice, sel.opts.map((o) => o.id).sort().join("+"), sel.notes].join("|");

  function addToCart(item, n, sel, fromEl) {
    const key = lineKey(item.id, sel);
    const existing = state.cart.find((l) => l.key === key);
    if (existing) existing.qty = Math.min(50, existing.qty + n);
    else state.cart.push({ key, id: item.id, qty: n, spice: sel.spice, opts: sel.opts, notes: sel.notes });
    save("blaze.cart", state.cart);
    flyToCart(fromEl, imageUrl(item.image));
    renderCart(true);
    celebrate(item.id);
    toast(`${item.name} added ${sel.spice ? "· " + sel.spice : ""}`);
  }

  function quickAdd(id, btn) {
    const item = state.items.get(id);
    if (!item) return;
    // Items with choices (heat, options) open the sheet; simple items go straight in.
    if (hasSpice(item) || groupsOf(item).some((g) => g.choices?.length)) return openItem(id);
    addToCart(item, 1, { opts: [], spice: "", notes: "" }, btn.closest(".card, .combo")?.querySelector("img"));
  }

  function lineCalc(l) {
    const item = state.items.get(l.id);
    if (!item) return null;
    const delta = l.opts.reduce((s, o) => s + (Number(o.priceDelta) || 0), 0);
    const unit = unitPrice(item, delta);
    return { item, unit, total: unit * l.qty, full: (Number(item.basePrice || 0) + delta) * l.qty };
  }

  function pruneCart() {
    const before = state.cart.length;
    state.cart = state.cart.filter((l) => { const it = state.items.get(l.id); return it && isAvailable(it); });
    if (state.cart.length !== before) { save("blaze.cart", state.cart); toast("Something in your cart just sold out, so we removed it."); }
  }

  function renderCart(bump = false) {
    const lines = state.cart.map((l) => ({ l, c: lineCalc(l) })).filter((x) => x.c);
    const count = lines.reduce((s, x) => s + x.l.qty, 0);
    const total = lines.reduce((s, x) => s + x.c.total, 0);
    const full = lines.reduce((s, x) => s + x.c.full, 0);

    const cc = $("#cartCount");
    cc.textContent = count;
    cc.classList.toggle("has", count > 0);
    if (bump) { const b = $("#cartBtn"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
    $("#cartBarCount").textContent = count;
    $("#cartBarTotal").textContent = money(total);
    $("#cartBar").hidden = count === 0;

    $("#cartLines").innerHTML = lines.length ? lines.map(({ l, c }) => `
      <div class="line-item" data-key="${esc(l.key)}">
        <img src="${imageUrl(c.item.image)}" alt="" />
        <div><h4>${esc(c.item.name)}</h4>
          <p>${[l.spice && "🔥 " + esc(l.spice), l.opts.length && esc(l.opts.map((o) => o.name).join(", ")), l.notes && "“" + esc(l.notes) + "”"].filter(Boolean).join(" · ") || money(c.unit) + " each"}</p></div>
        <div class="line-right"><strong>${money(c.total)}</strong>
          <div class="mini-stepper"><button type="button" data-dec aria-label="Fewer">−</button><span>${l.qty}</span><button type="button" data-inc aria-label="More">+</button></div></div>
      </div>`).join("") : `<div class="cart-empty"><b>🍗</b><p>Your order is empty.<br />The chicken is getting lonely.</p></div>`;

    $("#cartFoot").hidden = !lines.length;
    $("#cartTotal").textContent = money(total);
    const saved = full - total;
    $("#saveLine").textContent = saved > 0.009 ? `You're saving ${money(saved)} 🎉` : "";
    $("#checkoutBtn").disabled = !!state.settings.paused;
  }

  $("#cartLines").addEventListener("click", (e) => {
    const row = e.target.closest(".line-item");
    if (!row) return;
    const line = state.cart.find((l) => l.key === row.dataset.key);
    if (!line) return;
    if (e.target.closest("[data-inc]")) line.qty = Math.min(50, line.qty + 1);
    else if (e.target.closest("[data-dec]")) line.qty -= 1;
    else return;
    const commit = () => { state.cart = state.cart.filter((l) => l.qty > 0); save("blaze.cart", state.cart); renderCart(); };
    if (line.qty <= 0 && !reduceMotion) { row.classList.add("leaving"); setTimeout(commit, 280); } else commit();
  });

  function buildMessage(area) {
    const lines = state.cart.map((l) => ({ l, c: lineCalc(l) })).filter((x) => x.c);
    const total = lines.reduce((s, x) => s + x.c.total, 0);
    const out = ["Hello Blaze! I'd like to order:", ""];
    lines.forEach(({ l, c }, i) => {
      out.push(`${i + 1}) ${c.item.name} × ${l.qty} — ${money(c.total)}`);
      if (l.spice) out.push(`   Spice: ${l.spice}`);
      if (l.opts.length) out.push(`   Options: ${l.opts.map((o) => o.name).join(", ")}`);
      if (l.notes) out.push(`   Note: ${l.notes}`);
    });
    out.push("", `Total: ${money(total)}${state.settings.taxIncluded ? " (tax included)" : ""}`);
    if (area) out.push(`Delivery area: ${area.name}`);
    const name = $("#cartName").value.trim(), addr = $("#cartAddress").value.trim();
    if (name) out.push(`Name: ${name}`);
    if (addr) out.push(`Address: ${addr}`);
    return out.join("\n");
  }

  $("#checkoutBtn").addEventListener("click", () => {
    const area = areaById($("#cartArea").value);
    if (!area) { $("#cartArea").focus(); toast("Pick your delivery area first 📍"); return; }
    const phone = String(area.phone || state.settings.whatsapp || "").replace(/\D/g, "");
    if (!/^[1-9]\d{7,14}$/.test(phone)) { toast("This area can't take WhatsApp orders right now."); return; }
    save("blaze.customer", { name: $("#cartName").value, address: $("#cartAddress").value });
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(area))}`, "_blank", "noopener");
  });
  $("#cartArea").addEventListener("change", (e) => setArea(e.target.value));

  const drawer = $("#cartDrawer");
  function openCart() { renderCart(); drawer.showModal(); }
  $("#cartBtn").addEventListener("click", openCart);
  $("#cartBar").addEventListener("click", openCart);
  $("#cartClose").addEventListener("click", () => closeDialog(drawer));

  // ---------- Area picker ----------
  const areaSheet = $("#areaSheet");
  $("#areaChip").addEventListener("click", () => areaSheet.showModal());
  $("#areaClose").addEventListener("click", () => closeDialog(areaSheet));
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-area]");
    if (!b || b.disabled) return;
    setArea(b.dataset.area);
    if (areaSheet.open) { closeDialog(areaSheet); toast("Delivering to " + areaById(b.dataset.area).name.split("/")[0].trim() + " 🛵"); }
  });

  // ---------- Menu interactions ----------
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) { e.stopPropagation(); quickAdd(add.dataset.add, add); return; }
    const card = e.target.closest(".card[data-id], .combo[data-id]");
    if (card) openItem(card.dataset.id);
    const tab = e.target.closest(".tab");
    if (tab) {
      tabLock = Date.now() + 900;
      setActiveTab(tab.dataset.target);
      document.getElementById(tab.dataset.target)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".card[data-id], .combo[data-id]")) { e.preventDefault(); openItem(e.target.dataset.id); }
  });

  let searchT;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(searchT);
    searchT = setTimeout(() => { state.query = e.target.value; renderMenu(); }, 120);
  });
  $("#chips").addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (!c) return;
    const f = c.dataset.filter;
    state.activeFilters.has(f) ? state.activeFilters.delete(f) : state.activeFilters.add(f);
    c.classList.toggle("on");
    renderMenu();
  });

  // ---------- Heat meter ----------
  const heatSec = $("#heat");
  function setHeat(l) {
    state.heat = l;
    heatSec.dataset.level = l;
    $("#heatRange").value = l;
    $$(".heat-flames span").forEach((s, i) => s.classList.toggle("on", i <= l));
    $$(".heat-labels button").forEach((b) => b.classList.toggle("on", +b.dataset.l === l));
    $("#heatSay").textContent = SPICE[l].say;
    if (l === 2) { const inner = $(".heat-inner"); inner.style.animation = "none"; void inner.offsetWidth; inner.style.animation = ""; }
  }
  $("#heatRange").addEventListener("input", (e) => setHeat(+e.target.value));
  $$(".heat-labels button").forEach((b) => b.addEventListener("click", () => setHeat(+b.dataset.l)));

  // ---------- Motion ----------
  let revealObs;
  function observeReveals(root) {
    if (reduceMotion || !("IntersectionObserver" in window)) { $$(".reveal", root).forEach((el) => el.classList.add("in")); return; }
    revealObs ||= new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    $$(".reveal:not(.in)", root).forEach((el) => revealObs.observe(el));
  }

  // Cards slap in with a bounce, then their price counts up.
  let popObs;
  function landCard(card) {
    card.classList.add("in");
    const done = () => card.classList.add("landed");
    if (reduceMotion) { done(); return; }
    card.addEventListener("animationend", (e) => { if (e.animationName === "slap") done(); });
    setTimeout(done, 1600);
    const price = card.querySelector(".price strong[data-v]");
    if (price) countUp(price, Number(price.dataset.v), (parseFloat(getComputedStyle(card).getPropertyValue("--d")) || 0) * 1000 + 250);
  }
  function observePops(root) {
    const cards = $$(".card.pop:not(.in)", root);
    if (reduceMotion || !("IntersectionObserver" in window)) { cards.forEach(landCard); return; }
    popObs ||= new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { popObs.unobserve(e.target); landCard(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
    cards.forEach((c) => popObs.observe(c));
  }
  function countUp(el, value, delay = 0) {
    const dur = 700, start = performance.now() + delay;
    el.textContent = money(0);
    const step = (t) => {
      if (!el.isConnected) return;
      const k = Math.min(1, Math.max(0, (t - start) / dur));
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = money(k < 1 ? Math.round(value * eased * 100) / 100 : value);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Add-to-cart celebration: squish the card, + becomes a tick, sparks burst out.
  function celebrate(id) {
    $$(`.card[data-id="${CSS.escape(id)}"], .combo[data-id="${CSS.escape(id)}"]`).forEach((card) => {
      card.classList.remove("added"); void card.offsetWidth; card.classList.add("added");
      const btn = card.querySelector(".quick-add");
      if (!btn) return;
      btn.classList.add("done");
      btn.textContent = "✓";
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.classList.remove("done"); btn.textContent = "+"; }, 1300);
      const r = btn.getBoundingClientRect();
      if (!reduceMotion && r.width && r.top < innerHeight && r.bottom > 0) burst(r.left + r.width / 2, r.top + r.height / 2);
    });
  }
  function burst(x, y) {
    const bits = ["🔥", "✦", "🔥", "✦", "●", "🔥", "✦", "●", "🔥", "✦", "●", "✦"];
    bits.forEach((ch, i) => {
      const sp = document.createElement("span");
      sp.className = "spark";
      sp.textContent = ch;
      sp.style.left = x + "px"; sp.style.top = y + "px";
      sp.style.color = ["#ffb444", "#ff6a2b", "#dc362e"][i % 3];
      document.body.appendChild(sp);
      const a = (i / bits.length) * Math.PI * 2 + Math.random() * 0.4;
      const d = 50 + Math.random() * 45;
      sp.animate([
        { transform: "translate(-50%,-50%) scale(0.4)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 20}px)) scale(1.1) rotate(${Math.random() * 180}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.2}px), calc(-50% + ${Math.sin(a) * d + 10}px)) scale(0.6)`, opacity: 0 },
      ], { duration: 700 + Math.random() * 250, easing: "cubic-bezier(.2,.8,.3,1)" }).onfinish = () => sp.remove();
    });
  }

  function attachTilt(root) {
    if (!finePointer || reduceMotion) return;
    $$(".card", root).forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        if (!card.classList.contains("landed")) return;
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
  }

  function flyToCart(fromEl, src) {
    if (reduceMotion || !fromEl) return;
    const target = $("#cartBar").hidden || innerWidth > 600 ? $("#cartBtn") : $("#cartBar");
    const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    const img = document.createElement("img");
    img.src = src; img.className = "flyer"; img.alt = "";
    const sx = a.left + a.width / 2 - 35, sy = a.top + a.height / 2 - 35;
    const dx = b.left + b.width / 2 - 35 - sx, dy = b.top + b.height / 2 - 35 - sy;
    Object.assign(img.style, { left: sx + "px", top: sy + "px" });
    document.body.appendChild(img);
    img.animate([
      { transform: "translate(0,0) scale(1.4)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 120}px) scale(1) rotate(180deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.25) rotate(360deg)`, opacity: 0.6 },
    ], { duration: 800, easing: "cubic-bezier(.5,0,.5,1)" }).onfinish = () => img.remove();
  }

  // Header: solid after hero, hides on scroll down
  const topbar = $("#topbar");
  let lastY = scrollY;
  function onScroll() {
    const y = scrollY;
    topbar.classList.toggle("scrolled", y > 40);
    const hide = y > 500 && y > lastY + 4 && !document.querySelector("dialog[open]");
    if (hide) { topbar.classList.add("hide"); document.body.classList.add("nav-hidden"); }
    else if (y < lastY - 4 || y < 500) { topbar.classList.remove("hide"); document.body.classList.remove("nav-hidden"); }
    lastY = y;
    if (!reduceMotion) document.documentElement.style.setProperty("--drift", (-y * 0.12).toFixed(1));
    const tools = $("#menuTools");
    tools.classList.toggle("stuck", tools.getBoundingClientRect().top <= 80);
    if (!reduceMotion && y < innerHeight * 1.2) {
      const img = $("#heroVisual img");
      if (img) img.style.transform = `rotate(${3 - y * 0.006}deg) translateY(${y * 0.12}px)`;
    }
  }
  addEventListener("scroll", () => requestAnimationFrame(onScroll), { passive: true });
  addEventListener("resize", () => requestAnimationFrame(moveInk));

  // Magnetic CTA
  if (finePointer && !reduceMotion) {
    $$("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  // Embers in the hero
  function embers() {
    const c = $("#embers");
    if (reduceMotion || !c.getContext) return;
    const ctx = c.getContext("2d");
    let w, h, dpr, parts = [], visible = true;
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const spawn = (anywhere) => ({ x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10, r: Math.random() * 2.6 + 0.6, vy: Math.random() * 0.8 + 0.35, vx: (Math.random() - 0.5) * 0.4, life: Math.random() * Math.PI * 2, hue: 25 + Math.random() * 25 });
    resize();
    const n = Math.round(Math.min(70, w / 18));
    for (let i = 0; i < n; i++) parts.push(spawn(true));
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) requestAnimationFrame(tick); }).observe(c);
    addEventListener("resize", resize);
    function tick() {
      if (!visible) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.vy; p.life += 0.03; p.x += p.vx + Math.sin(p.life) * 0.3;
        if (p.y < -10) Object.assign(p, spawn(false));
        const a = Math.max(0, Math.min(1, p.y / h)) * 0.9;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 100%, 65%, ${a})`;
        ctx.shadowColor = `hsla(${p.hue}, 100%, 60%, 1)`;
        ctx.shadowBlur = 10;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Toast
  let toastT;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 2400);
  }

  // ---------- Boot ----------
  async function boot() {
    $("#year").textContent = new Date().getFullYear();
    const cust = load("blaze.customer", {});
    $("#cartName").value = cust.name || "";
    $("#cartAddress").value = cust.address || "";
    setHeat(1);
    embers();
    observeReveals(document);
    onScroll();
    try {
      const live = await loadMenu();
      renderAll();
      if (live) startVersionPolling();
    } catch (err) {
      console.error(err);
      $("#menuBody").innerHTML = `<p class="empty">We couldn't load the menu. Please refresh.</p>`;
    }
    setInterval(renderHours, 60000);
  }
  boot();
})();
