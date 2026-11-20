/* Station: train-station themed restaurant site.
 * Menus per branch come from data/menus/<branch>.json (saved copies of each branch's
 * ordering-page menu; refresh with `node tools/update-menus.js`).
 */
(() => {
  "use strict";

  // ---------- Branches (the "network") ----------
  // wa: the mobile number shown on that branch's own ordering page (used for WhatsApp orders).
  // tel: the number on station-restaurant.com/contact. Confirm both with Station before going live.
  const LINES = {
    beirut: { en: "Beirut Line", ar: "خط بيروت", code: "B", c: "var(--line-beirut)" },
    south: { en: "South Line", ar: "خط الجنوب", code: "S", c: "var(--line-south)" },
    bekaa: { en: "Bekaa Line", ar: "خط البقاع", code: "K", c: "var(--line-bekaa)" },
  };
  const BRANCHES = [
    { id: "hadath", en: "Hadath", ar: "الحدث", line: "beirut", menu: true, wa: "96181650620", tel: "9615472247" },
    { id: "mazraa", en: "Mazraa", ar: "المزرعة", line: "beirut", menu: true, wa: "96176024046", tel: "9611819661" },
    { id: "moawad", en: "Moawad", ar: "معوض", line: "beirut", menu: true, wa: "96171500411", tel: "9611270558" },
    { id: "khaldeh", en: "Khaldeh", ar: "خلدة", line: "beirut", menu: true, wa: "96181886698", tel: "9615801109" },
    { id: "saida", en: "Saida", ar: "صيدا", line: "south", menu: true, wa: "96178819669", tel: "9617752877" },
    { id: "nabatieh", en: "Nabatieh", ar: "النبطية", line: "south", menu: false, tel: "9617763263" },
    { id: "barelias", en: "Bar Elias", ar: "برالياس", line: "bekaa", menu: false, tel: "9618511223" },
    { id: "mekseh", en: "Mekseh", ar: "المكسة", line: "bekaa", menu: false, tel: "9618545511" },
    { id: "ferzol", en: "Ferzol", ar: "الفرزل", line: "bekaa", menu: false, tel: "9618951415" },
    { id: "baalbek", en: "Baalbek", ar: "بعلبك", line: "bekaa", menu: false, tel: "9618372852" },
  ];
  const PREVIEW_BRANCH = "saida"; // the departure board shows this branch until you pick one

  // ---------- Words ----------
  const I18N = {
    en: {
      skip: "Skip to menu", navStations: "Stations", navMenu: "Menu", navAbout: "Since 1993", yourStation: "Your station", choose: "Choose",
      tenStations: "10 stations across Lebanon", heroL1: "All aboard", heroL2: "the flavour line",
      heroSub: "Shawarma spins, mashawi grills, saj flips. You pick the station, we’ll handle the delivery.",
      ctaStation: "Choose your station", ctaMenu: "See the menu", departures: "Departures", departuresAlt: "المغادرة",
      colTime: "Time", colDish: "Destination", colPrice: "Fare", colStatus: "Status", boarding: "Boarding", onTime: "On time",
      boardFrom: (b) => `Now departing from ${b} station`, boardPreview: (b) => `Showing ${b} station · pick yours below`,
      stationsEyebrow: "The network", stationsTitle: "Choose your station", stationsLede: "Every station has its own kitchen, menu and prices. Tap yours.",
      nowArriving: "Now arriving", openNow: (t) => `Open now · until ${t}`, closedNow: (t) => `Closed · opens at ${t}`, hoursUnknown: "Call for opening hours",
      seeMenu: "See the menu", whatsapp: "WhatsApp", call: "Call", noMenuYet: "This station's online menu is coming soon. Call to order.",
      pickPrompt: "Tap a station on the map to see where we'll roll out from.", menuEyebrow: "Timetable", menuTitle: "The menu",
      menuAt: (b) => `· ${b}`, gate: "Choose your station to see its menu and prices", menuUpdated: (d, n) => `${n} dishes · prices as of ${d}`,
      searchPh: "Search shawarma, tawook, hummus…", express: "Express line", shawarma: "Shawarma",
      q_shawarma: "Shawarma", q_grill: "Grills", q_saj: "Saj & breakfast", q_mezze: "Mezze & salads", q_sweets: "Sweets", q_drinks: "Drinks",
      noMatch: "No dish on this line. Try “shawarma” or “tawook”.", add: "+ Ticket", added: "✓ Punched", out: "Sold out",
      aboutEyebrow: "Since 1993", aboutTitle: "Thirty years on the same line",
      aboutText: "Fresh ingredients from local farmers, traditional recipes with a modern touch, and a menu that runs from breakfast saj to midnight shawarma.",
      statYears: "years of experience", statBranches: "stations in Lebanon", statOrders: "orders delivered",
      viewTicket: "View ticket", pickTitle: "Where are you ordering from?", notes: "Notes for the kitchen", notesPh: "Extra garlic, no pickles…",
      addTicket: "Add to ticket", ticket: "Ticket", from: "From", to: "To", yourDoor: "Your door", total: "Total fare", name: "Your name",
      address: "Delivery address", addressPh: "Building, street, floor", sendTo: (b) => `Send to ${b} on WhatsApp`,
      sendFine: "You'll check the message in WhatsApp before it's sent.", emptyTicket: "Your ticket is blank. Punch something delicious.",
      size: "Size", options: "Extras", optional: "Optional", required: "Required",
      switchConfirm: (a, b) => `Your ticket is for ${a}. Switch to ${b}? Prices differ per station, so your ticket will be cleared.`,
      addedToast: (n) => `${n} punched on your ticket`, arrivingToast: (b) => `Now arriving at ${b} station 🚉`, chooseFirst: "Choose your station first",
      waHello: (b) => `Hello Station ${b}! I'd like to order:`, waTotal: "Total", waName: "Name", waAddress: "Address", waNote: "Note", waSize: "Size",
      waExtras: "Extras", footFine: (y) => `© ${y} Station Resto-Café · المحطة`, lineName: (l) => l.en, langLabel: "العربية", todaysSpecial: "Today's special", platform: "Platform 1", tapPlate: "Tap a plate to order it", trainPreview: (b) => `Today's train from ${b} · choose your station to order`,
    },
    ar: {
      skip: "انتقل إلى القائمة", navStations: "المحطات", navMenu: "القائمة", navAbout: "منذ ١٩٩٣", yourStation: "محطتك", choose: "اختر",
      tenStations: "١٠ محطات في لبنان", heroL1: "أهلاً بكم", heroL2: "في خط النكهة",
      heroSub: "الشاورما عم تلفّ، المشاوي عالفحم، والصاج عم ينقلب. إنت اختار المحطة، والتوصيل علينا.",
      ctaStation: "اختر محطتك", ctaMenu: "شوف القائمة", departures: "المغادرة", departuresAlt: "Departures",
      colTime: "الوقت", colDish: "الوجهة", colPrice: "السعر", colStatus: "الحالة", boarding: "صعود", onTime: "في الموعد",
      boardFrom: (b) => `المغادرة الآن من محطة ${b}`, boardPreview: (b) => `معروض: محطة ${b} · اختر محطتك تحت`,
      stationsEyebrow: "الشبكة", stationsTitle: "اختر محطتك", stationsLede: "كل محطة إلها مطبخها وقائمتها وأسعارها. اضغط على محطتك.",
      nowArriving: "وصلنا إلى", openNow: (t) => `مفتوح الآن · حتى ${t}`, closedNow: (t) => `مغلق · يفتح الساعة ${t}`, hoursUnknown: "اتصل لمعرفة الدوام",
      seeMenu: "شوف القائمة", whatsapp: "واتساب", call: "اتصل", noMenuYet: "قائمة هالمحطة أونلاين قريباً. اتصل لتطلب.",
      pickPrompt: "اضغط على محطة عالخريطة لتشوف من وين رح ننطلق.", menuEyebrow: "جدول المواعيد", menuTitle: "القائمة",
      menuAt: (b) => `· ${b}`, gate: "اختر محطتك لتشوف قائمتها وأسعارها", menuUpdated: (d, n) => `${n} صنف · الأسعار بتاريخ ${d}`,
      searchPh: "ابحث: شاورما، طاووق، حمص…", express: "الخط السريع", shawarma: "شاورما",
      q_shawarma: "شاورما", q_grill: "مشاوي", q_saj: "صاج وفطور", q_mezze: "مقبلات وسلطات", q_sweets: "حلويات", q_drinks: "مشروبات",
      noMatch: "ما في صنف عهالخط. جرّب «شاورما» أو «طاووق».", add: "+ للتذكرة", added: "✓ انخرمت", out: "نفد",
      aboutEyebrow: "منذ ١٩٩٣", aboutTitle: "ثلاثين سنة على نفس الخط",
      aboutText: "مكونات طازجة من مزارعين محليين، وصفات تقليدية بلمسة عصرية، وقائمة من صاج الصبح لشاورما نص الليل.",
      statYears: "سنة خبرة", statBranches: "محطات في لبنان", statOrders: "طلب انوصل",
      viewTicket: "شوف التذكرة", pickTitle: "من أي محطة بدك تطلب؟", notes: "ملاحظات للمطبخ", notesPh: "ثوم زيادة، بلا كبيس…",
      addTicket: "زيد عالتذكرة", ticket: "تذكرة", from: "من", to: "إلى", yourDoor: "باب بيتك", total: "المجموع", name: "اسمك",
      address: "عنوان التوصيل", addressPh: "البناية، الشارع، الطابق", sendTo: (b) => `ابعت لمحطة ${b} عالواتساب`,
      sendFine: "رح تشوف الرسالة بالواتساب قبل ما تنبعت.", emptyTicket: "تذكرتك فاضية. اخرم شي طيب.",
      size: "الحجم", options: "إضافات", optional: "اختياري", required: "إجباري",
      switchConfirm: (a, b) => `تذكرتك لمحطة ${a}. بدك تنتقل لمحطة ${b}؟ الأسعار بتختلف بين المحطات، فرح تنمسح التذكرة.`,
      addedToast: (n) => `انخرمت ${n} عتذكرتك`, arrivingToast: (b) => `وصلنا إلى محطة ${b} 🚉`, chooseFirst: "اختر محطتك أولاً",
      waHello: (b) => `مرحبا محطة ${b}! بدي اطلب:`, waTotal: "المجموع", waName: "الاسم", waAddress: "العنوان", waNote: "ملاحظة", waSize: "الحجم",
      waExtras: "إضافات", footFine: (y) => `© ${y} المحطة · Station Resto-Café`, lineName: (l) => l.ar, langLabel: "English", todaysSpecial: "طبق اليوم", platform: "رصيف ١", tapPlate: "اضغط على صحن لتطلبه", trainPreview: (b) => `قطار اليوم من ${b} · اختر محطتك لتطلب`,
    },
  };
  const QUICK = [
    ["shawarma", /shawarma|taste box/i], ["grill", /mashawi|grill|steak/i], ["saj", /saj|breakfast|man.?oushe/i],
    ["mezze", /appetizer|salad|nayyee|mezze/i], ["sweets", /crepe|waffle|pancake|cake|ice cream|fruit|sweet|dessert/i],
    ["drinks", /juice|shake|cocktail|drink|smoothie|coffee|narjila/i],
  ];
  const BEIRUT = "Asia/Beirut";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- State ----------
  const state = {
    lang: load("station.lang", "en"),
    branch: load("station.branch", null),
    cart: load("station.cart", { branch: null, lines: [] }),
    menus: {},
    quick: null,
    query: "",
  };

  // ---------- Helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }
  const L = () => I18N[state.lang];
  const t = (k, ...a) => { const v = L()[k]; return typeof v === "function" ? v(...a) : v ?? k; };
  const nm = (o) => (state.lang === "ar" ? o.ar || o.en : o.en || o.ar) || "";
  const altNm = (o) => (state.lang === "ar" ? o.en : o.ar) || "";
  const money = (n) => { const v = Math.round((Number(n) || 0) * 100) / 100; return "$" + (Number.isInteger(v) ? v : v.toFixed(2)); };
  const branchById = (id) => BRANCHES.find((b) => b.id === id);
  const lineOf = (b) => LINES[b.line];
  const pad = (n) => String(n).padStart(2, "0");
  const fmtMin = (m) => `${pad(Math.floor((((m % 1440) + 1440) % 1440) / 60))}:${pad(((m % 1440) + 1440) % 1440 % 60)}`;
  function nowBeirut() {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: BEIRUT, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date());
    const g = (k) => +p.find((x) => x.type === k).value;
    return { h: g("hour") % 24, m: g("minute"), s: g("second"), mins: (g("hour") % 24) * 60 + g("minute") };
  }
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ---------- Data ----------
  async function getMenu(id) {
    if (state.menus[id]) return state.menus[id];
    const r = await fetch(`data/menus/${id}.json`);
    if (!r.ok) throw new Error("menu " + id);
    const m = await r.json();
    m.items = new Map(m.categories.flatMap((c) => c.items.map((i) => [i.id, { ...i, cat: c }])));
    state.menus[id] = m;
    return m;
  }
  function openStatus(menu) {
    const h = menu?.hours?.[0];
    if (!h) return null;
    const now = nowBeirut().mins;
    const open = h.open, close = h.close;
    const isOpen = close > 1440 ? now >= open || now < close - 1440 : now >= open && now < close;
    return isOpen ? { open: true, label: t("openNow", fmtMin(close)) } : { open: false, label: t("closedNow", fmtMin(open)) };
  }

  // ---------- Language ----------
  function applyLang() {
    const ar = state.lang === "ar";
    document.documentElement.lang = ar ? "ar" : "en";
    document.documentElement.dir = ar ? "rtl" : "ltr";
    $$("[data-i18n]").forEach((el) => { const v = t(el.dataset.i18n); if (typeof v === "string") el.textContent = v; });
    $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    const lb = $("#langBtn");
    lb.textContent = ar ? "EN" : "ع";
    lb.setAttribute("aria-label", t("langLabel"));
    $("#footFine").textContent = t("footFine", new Date().getFullYear());
    splitHeroTitle();
    renderAll();
  }
  $("#langBtn").addEventListener("click", () => {
    state.lang = state.lang === "ar" ? "en" : "ar";
    save("station.lang", state.lang);
    document.body.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], { duration: 450, easing: "ease-in-out" });
    setTimeout(applyLang, reduceMotion ? 0 : 200);
  });

  // Hero title: letters rise in one by one (whole words for Arabic so letters stay joined).
  function splitHeroTitle() {
    $$(".ht-line").forEach((line, li) => {
      const text = line.textContent;
      let i = 0;
      // Arabic: animate whole words (letters must stay joined). Latin: letters, wrapped per word so lines never break mid-word.
      line.innerHTML = text.split(/(\s+)/).map((w) => {
        if (/^\s+$/.test(w)) return w;
        if (state.lang === "ar") return `<span class="ch" style="--i:${i++ + li * 8}">${esc(w)}</span>`;
        return `<span class="wd">${[...w].map((c) => `<span class="ch" style="--i:${i++ + li * 8}">${esc(c)}</span>`).join("")}</span>`;
      }).join("");
      if (reduceMotion) return;
      $$(".ch", line).forEach((s) => s.animate(
        [{ transform: "translateY(110%) rotate(6deg)", opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 800, delay: 120 + Number(s.style.getPropertyValue("--i")) * 35, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" }));
    });
  }

  // ---------- Hero train ----------
  // A cargo train carries plates of real dishes. It pulls in, brakes (sparks, bounce),
  // waits at the platform so you can tap a plate, then leaves and comes back with new dishes.
  let trainDishes = [], trainTrip = 0, trainBranch = null, trainLoop = false, trainHold = false;
  // Size the train to the room left under the hero text (never overlaps the buttons).
  // Size the train to the room under the hero text (never overlaps the buttons), and fit as
  // many plates as possible (up to 6) beside the engine without shrinking them below ~1x.
  let trainN = 4;
  function fitTrain() {
    const hero = $("#hero"), copy = $(".hero-inner");
    if (!hero || !copy) return;
    const vw = innerWidth, phone = vw <= 600;
    const maxZ = phone ? (vw <= 360 ? 0.68 : 0.82) : vw >= 1100 ? 1.3 : 1.12;
    let z = maxZ;
    if (phone) {
      // Phones: 2 plates + the whole engine (engine is drawn at 0.75 on phones)
      trainN = 2;
      z = Math.min(maxZ, (vw - 16) / (300 * 0.75 + 14 + trainN * 224));
    }
    else {
      const sp = $("#special"), heroTop = hero.getBoundingClientRect().top;
      const textBottom = Math.max($(".hero-copy").getBoundingClientRect().bottom, sp && !sp.hidden && sp.offsetParent ? sp.getBoundingClientRect().bottom : 0) - heroTop;
      const room = innerHeight - textBottom - 24 - 80 - 16; // gap, track, platform edge
      const zRoom = Math.max(0.75, Math.min(maxZ, room / 254));
      const zFor = (n) => (vw - 80) / (300 + 14 + n * 224); // engine + wagons must fit the width
      trainN = 1;
      for (let n = 6; n >= 1; n--) {
        if (Math.min(zRoom, zFor(n)) >= Math.min(1, zRoom) || n === 1) { trainN = n; break; }
      }
      z = Math.min(zRoom, zFor(trainN));
    }
    hero.style.setProperty("--z", z.toFixed(3));
  }
  const wagonsPerTrip = () => trainN;
  async function renderTrain() {
    fitTrain();
    const id = state.branch && branchById(state.branch)?.menu ? state.branch : PREVIEW_BRANCH;
    let menu;
    try { menu = await getMenu(id); } catch { return; }
    const pri = (c) => (/shawarma|taste box/i.test(c.en) ? 0 : /mashawi|grill/i.test(c.en) ? 1 : /saj|burger|appetizer|plate/i.test(c.en) ? 2 : 3);
    const seen = new Set();
    trainDishes = [...menu.categories].sort((a, b) => pri(a) - pri(b)).flatMap((c) => c.items)
      .filter((i) => !i.out && i.price > 0 && i.img && !seen.has(i.en || i.ar) && !seen.has(i.ih || i.img) && seen.add(i.en || i.ar) && seen.add(i.ih || i.img));
    const changed = trainBranch !== id;
    trainBranch = id;
    if (changed) trainTrip = 0;
    const b = branchById(id);
    $("#platformSign").innerHTML = `<b>${esc(t("platform"))}</b><span>${esc(nm(b))}</span>`;
    $("#platformHint").textContent = state.branch === id ? t("tapPlate") : t("trainPreview", nm(b));
    loadWagons();
    renderSpecial();
    if (!trainLoop) runTrain();
  }

  // ---------- Today's special (right side of the hero) ----------
  let specials = [], spIdx = 0, spTimer;
  function renderSpecial() {
    const firstTrip = new Set(trainDishes.slice(0, wagonsPerTrip()));
    const pool = trainDishes.filter((i) => !firstTrip.has(i) && /mashawi|grill|plate|shawarma|steak|chicken/i.test(i.en || ""));
    const list = pool.length >= 4 ? pool : trainDishes;
    specials = list.filter((_, k) => k % 3 === 1).slice(0, 4);
    if (specials.length < 2) specials = list.slice(0, 4);
    $("#special").hidden = !specials.length;
    $("#ttDots").innerHTML = specials.map((_, k) => `<button type="button" data-sp="${k}" aria-label="${k + 1}"></button>`).join("");
    showSpecial(0, true);
    clearInterval(spTimer);
    if (!reduceMotion && specials.length > 1) spTimer = setInterval(() => { if (!document.hidden && heroInView) showSpecial(spIdx + 1); }, 6000);
  }
  function showSpecial(k, instant = false) {
    if (!specials.length) return;
    spIdx = (k + specials.length) % specials.length;
    const i = specials[spIdx], el = $("#special");
    const apply = () => {
      $("#ttImg").src = i.img;
      $("#ttName").textContent = nm(i);
      $("#ttPrice").textContent = money(i.price);
      $("#ttRing").setAttribute("aria-label", nm(i));
      $$("#ttDots button").forEach((b, n) => b.classList.toggle("on", n === spIdx));
    };
    if (instant || reduceMotion) { apply(); return; }
    el.classList.add("swap");
    setTimeout(() => { apply(); el.classList.remove("swap"); }, 350);
  }
  $("#ttDots").addEventListener("click", (e) => { const b = e.target.closest("[data-sp]"); if (b) showSpecial(+b.dataset.sp); });
  const openSpecial = () => {
    const i = specials[spIdx]; if (!i) return;
    if (state.branch !== trainBranch) { toast(t("chooseFirst")); $("#pickSheet").showModal(); return; }
    openItem(i.id);
  };
  $("#ttRing").addEventListener("click", openSpecial);
  $("#ttCard").addEventListener("click", openSpecial);
  function loadWagons() {
    const n = wagonsPerTrip(), len = trainDishes.length;
    if (!len) { $("#wagons").innerHTML = ""; return; }
    const set = Array.from({ length: Math.min(n, len) }, (_, k) => trainDishes[(trainTrip * n + k) % len]);
    $("#wagons").innerHTML = set.map((i) => `<button type="button" class="wagon" data-dish="${esc(i.id)}" aria-label="${esc(nm(i))} ${money(i.price)}">
        <span class="plate"><img src="${esc(i.img)}" alt="" /></span>
        <span class="chassis"><span class="wtag"><b>${esc(nm(i))}</b><i dir="ltr">${money(i.price)}</i></span></span>
        <span class="wheel"></span><span class="wheel"></span>
      </button>`).join("");
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function untilVisible() { while (document.hidden || !heroInView) await sleep(400); }
  let heroInView = true;
  new IntersectionObserver(([e]) => { heroInView = e.isIntersecting; }).observe($("#hero"));
  function stopX(train, scene) {
    const w = train.getBoundingClientRect().width, vw = scene.clientWidth;
    if (w + 32 >= vw) return Math.max(4, Math.round(vw - w - 6)); // narrow screens: keep the engine and plate in view
    return w + 32 < vw ? Math.round((vw - w) / 2 + Math.min(120, (vw - w) / 4)) : Math.round(vw - w - 12); // keep the engine in view on phones
  }
  async function runTrain() {
    trainLoop = true;
    const scene = $("#scene"), train = $("#cargoTrain"), body = $("#trainBody");
    if (reduceMotion) { train.style.transform = `translateX(${stopX(train, scene)}px)`; trainLoop = false; return; }
    for (;;) {
      await untilVisible();
      const vw = scene.clientWidth, w = train.getBoundingClientRect().width, x = stopX(train, scene);
      // pull in
      scene.classList.add("moving");
      const arrive = train.animate([{ transform: `translateX(${-w - 60}px)` }, { transform: `translateX(${x}px)` }], { duration: 3000, easing: "cubic-bezier(.12,.75,.25,1)", fill: "forwards" });
      setTimeout(() => sparks(), 2000);
      await arrive.finished;
      scene.classList.remove("moving");
      body.animate([{ transform: "translateY(0)" }, { transform: "translate(5px, 3px)" }, { transform: "translate(-2px,-1px)" }, { transform: "none" }], { duration: 500, easing: "ease-out" });
      puffBurst(6);
      // wait at the platform (longer while someone is pointing at it)
      for (let t0 = Date.now(); Date.now() - t0 < 7500 || trainHold;) await sleep(250);
      await untilVisible();
      // leave
      scene.classList.add("moving");
      const leave = train.animate([{ transform: `translateX(${x}px)` }, { transform: `translateX(${vw + 60}px)` }], { duration: 2600, easing: "cubic-bezier(.6,0,.9,.4)", fill: "forwards" });
      await leave.finished;
      trainTrip++;
      loadWagons();
      await sleep(700);
    }
  }
  // steam: a gentle puff while waiting, a busy chuff while moving
  setInterval(() => {
    if (reduceMotion || document.hidden || !heroInView) return;
    const moving = $("#scene").classList.contains("moving");
    if (moving || Math.random() < 0.35) puffBurst(1);
  }, 260);
  function puffBurst(n) {
    const stack = $("#chimney");
    if (!stack || reduceMotion) return;
    for (let k = 0; k < n; k++) {
      const p = document.createElement("span");
      p.className = "puff";
      stack.appendChild(p);
      const drift = $("#scene").classList.contains("moving") ? -90 : -20;
      p.animate([
        { transform: "translate(0,0) scale(.35)", opacity: 0.85 },
        { transform: `translate(${drift + Math.random() * 30}px, ${-70 - Math.random() * 40}px) scale(${2.2 + Math.random()})`, opacity: 0 },
      ], { duration: 1500 + Math.random() * 600, delay: k * 90, easing: "ease-out" }).onfinish = () => p.remove();
    }
  }
  function sparks() {
    const scene = $("#scene"), sr = scene.getBoundingClientRect();
    $$("#cargoTrain .wheel, #cargoTrain .dwheel").slice(0, 8).forEach((wheel) => {
      const r = wheel.getBoundingClientRect();
      for (let k = 0; k < 3; k++) {
        const s = document.createElement("span");
        s.className = "spark";
        s.style.left = r.left - sr.left + r.width / 2 + "px";
        s.style.top = r.bottom - sr.top - 4 + "px";
        scene.appendChild(s);
        s.animate([{ transform: "translate(0,0)", opacity: 1 }, { transform: `translate(${-30 - Math.random() * 50}px, ${-10 - Math.random() * 25}px)`, opacity: 0 }],
          { duration: 450 + Math.random() * 300, delay: Math.random() * 600, easing: "ease-out" }).onfinish = () => s.remove();
      }
    });
  }
  $("#cargoTrain").addEventListener("pointerenter", () => { trainHold = true; });
  $("#cargoTrain").addEventListener("pointerleave", () => { trainHold = false; });
  $("#cargoTrain").addEventListener("click", (e) => {
    const w = e.target.closest("[data-dish]");
    if (!w) return;
    if (state.branch !== trainBranch) { toast(t("chooseFirst")); $("#pickSheet").showModal(); return; }
    openItem(w.dataset.dish);
  });

  // ---------- Route map ----------
  function renderRoute() {
    const map = $("#routeMap");
    let i = 0;
    map.innerHTML = Object.entries(LINES).map(([lid, line]) => {
      const stops = BRANCHES.filter((b) => b.line === lid);
      return `<div class="line" data-line="${lid}" style="--c:${line.c}">
        <div class="line-name"><i>${line.code}</i>${esc(t("lineName", line))}</div>
        <div class="line-track">
          ${stops.map((b) => `<button type="button" class="stop ${b.menu ? "" : "nomenu"} ${state.branch === b.id ? "sel" : ""}" data-branch="${b.id}" style="--i:${i++}" aria-pressed="${state.branch === b.id}">
              <span class="stop-dot"></span><span class="stop-name">${esc(nm(b))}</span>${b.menu ? "" : `<small>${state.lang === "ar" ? "قريباً" : "menu soon"}</small>`}
            </button>`).join("")}
          <span class="mini-train" aria-hidden="true"></span>
        </div>
      </div>`;
    }).join("");
    requestAnimationFrame(placeTrain);
  }
  function placeTrain() {
    $$(".line", $("#routeMap")).forEach((line) => {
      const sel = $(".stop.sel", line);
      line.classList.toggle("has-train", !!sel);
      if (!sel) return;
      const train = $(".mini-train", line);
      train.style.left = sel.offsetLeft + sel.offsetWidth / 2 + "px";
    });
  }
  addEventListener("resize", () => requestAnimationFrame(placeTrain));
  let lastWagons = wagonsPerTrip();
  addEventListener("resize", () => { fitTrain(); if (wagonsPerTrip() !== lastWagons) { lastWagons = wagonsPerTrip(); loadWagons(); } });

  async function renderArrival() {
    const box = $("#arrival");
    const b = branchById(state.branch);
    if (!b) { box.innerHTML = `<p class="arrival-empty">${esc(t("pickPrompt"))}</p>`; return; }
    const line = lineOf(b);
    let menu = null;
    if (b.menu) { try { menu = await getMenu(b.id); } catch { /* offline */ } }
    const st = menu ? openStatus(menu) : null;
    const wa = b.wa ? `https://wa.me/${b.wa}?text=${encodeURIComponent(t("waHello", nm(b)))}` : "";
    box.innerHTML = `<div class="arrival-card" style="--c:${line.c}">
      <div class="arrival-sign"><small>${esc(t("nowArriving"))}</small><b>${esc(nm(b))}</b></div>
      <div class="arrival-info">
        <p><b>${esc(t("lineName", line))}</b>${menu?.address ? ` · ${esc(menu.address)}` : ""}</p>
        <p class="${st ? (st.open ? "open" : "closed") : ""}">${esc(st ? st.label : b.menu ? t("hoursUnknown") : t("noMenuYet"))}</p>
        <p dir="ltr" style="text-align:${state.lang === "ar" ? "right" : "left"}">${b.wa ? "+" + fmtPhone(b.wa) + " · " : ""}+${fmtPhone(b.tel)}</p>
      </div>
      <div class="arrival-actions">
        ${b.menu ? `<a class="btn btn-brass" href="#menu">${esc(t("seeMenu"))}</a>` : ""}
        ${wa ? `<a class="btn btn-ghost" href="${wa}" target="_blank" rel="noopener">${esc(t("whatsapp"))}</a>` : ""}
        <a class="btn btn-ghost" href="tel:+${b.tel}">${esc(t("call"))}</a>
      </div>
    </div>`;
  }
  const fmtPhone = (d) => (d.startsWith("961") ? `961 ${d.slice(3, d.length - 6)} ${d.slice(-6, -3)} ${d.slice(-3)}` : d);

  async function selectBranch(id, { scroll = false } = {}) {
    const b = branchById(id);
    if (!b || id === state.branch) { if (scroll) $(b?.menu ? "#menu" : "#stations").scrollIntoView({ behavior: "smooth" }); return; }
    if (state.cart.lines.length && state.cart.branch && state.cart.branch !== id) {
      if (!confirm(t("switchConfirm", nm(branchById(state.cart.branch)), nm(b)))) return;
      state.cart = { branch: id, lines: [] }; save("station.cart", state.cart);
    }
    state.branch = id; save("station.branch", id);
    state.quick = null; state.query = ""; $("#search").value = "";
    toast(t("arrivingToast", nm(b)));
    await renderAll();
    if (scroll) $(b.menu ? "#menu" : "#arrival").scrollIntoView({ behavior: "smooth" });
  }
  document.addEventListener("click", (e) => {
    const s = e.target.closest("[data-branch]");
    if (!s) return;
    const fromSheet = !!s.closest("#pickSheet");
    if (fromSheet) closeDialog($("#pickSheet"));
    selectBranch(s.dataset.branch, { scroll: fromSheet || !!s.closest(".menu-gate") });
  });
  function renderChip() {
    const b = branchById(state.branch);
    $("#chipName").textContent = b ? nm(b) : t("choose");
    $("#chipDot").style.setProperty("--chip", b ? lineOf(b).c : "var(--brass)");
    $("#pickList").innerHTML = BRANCHES.map((x) => `<button type="button" class="pick ${state.branch === x.id ? "sel" : ""}" data-branch="${x.id}" style="--c:${lineOf(x).c}">
      <i></i><span><b>${esc(nm(x))}</b><small>${esc(t("lineName", lineOf(x)))}${x.menu ? "" : " · " + esc(state.lang === "ar" ? "القائمة قريباً" : "menu coming soon")}</small></span></button>`).join("");
  }
  $("#stationChip").addEventListener("click", () => $("#pickSheet").showModal());

  // ---------- Menu ----------
  async function renderMenu() {
    const body = $("#menuBody");
    const b = branchById(state.branch);
    $("#menuAt").textContent = b ? t("menuAt", nm(b)) : "";
    $("#menuTools").hidden = true; $("#express").hidden = true; $("#emptyState").hidden = true;
    if (!b || !b.menu) {
      $("#menuNote").textContent = b ? t("noMenuYet") : "";
      body.innerHTML = `<div class="menu-gate"><p>${esc(t("gate"))}</p><div class="gate-list">${BRANCHES.filter((x) => x.menu).map((x) =>
        `<button type="button" class="btn btn-ghost" data-branch="${x.id}" style="--c:${lineOf(x).c}">${esc(nm(x))}</button>`).join("")}</div></div>`;
      return;
    }
    body.innerHTML = `<div class="skeleton-grid">${'<div class="skeleton"></div>'.repeat(4)}</div>`;
    let menu;
    try { menu = await getMenu(b.id); } catch { body.innerHTML = `<p class="empty">${esc(t("noMenuYet"))}</p>`; return; }
    if (state.branch !== b.id) return; // switched while loading
    $("#menuNote").textContent = t("menuUpdated", menu.updated, menu.items.size);
    $("#menuTools").hidden = false;

    // Quick lines (only the ones this branch has)
    const quick = QUICK.filter(([, re]) => menu.categories.some((c) => re.test(c.en)));
    $("#quick").innerHTML = quick.map(([k]) => `<button type="button" class="qchip ${state.quick === k ? "on" : ""}" data-quick="${k}">${esc(t("q_" + k))}</button>`).join("");

    const q = state.query.trim().toLowerCase();
    const re = state.quick ? QUICK.find(([k]) => k === state.quick)[1] : null;
    let pf = 0, shown = 0;
    const sections = menu.categories.map((c) => {
      pf++;
      if (re && !re.test(c.en)) return "";
      const items = c.items.filter((i) => !q || `${i.en} ${i.ar} ${i.desc_en} ${i.desc_ar} ${c.en} ${c.ar}`.toLowerCase().includes(q));
      if (!items.length) return "";
      shown += items.length;
      return `<section class="cat" id="cat-${esc(c.id)}" data-pf="${pf}" data-name="${esc(nm(c))}">
        <div class="cat-head"><span class="pf">P${pf}</span><div><h3>${esc(nm(c))}</h3>${altNm(c) ? `<span class="alt">${esc(altNm(c))}</span>` : ""}</div></div>
        <div class="grid">${items.map(cardHtml).join("")}</div>
      </section>`;
    }).join("");
    body.innerHTML = sections;
    $("#emptyState").hidden = shown > 0;
    renderPlatforms();
    renderExpress(menu);
    observeCards(body);
    observeCats();
  }
  function cardHtml(i, n) {
    const img = i.img
      ? `<img src="${esc(i.img)}" alt="" loading="lazy" onload="this.classList.add('ok')" onerror="this.parentNode.classList.add('broken');this.remove()" />`
      : `<div class="noimg"><img class="ok" src="img/logo.webp" alt="" /></div>`;
    return `<article class="card pop ${i.out ? "out" : ""}" data-id="${esc(i.id)}" tabindex="${i.out ? -1 : 0}" style="--d:${(n % 4) * 0.06}s">
      <div class="card-media">${img}</div>
      <div class="card-body">
        <h4>${esc(nm(i))}</h4>${altNm(i) ? `<span class="alt">${esc(altNm(i))}</span>` : ""}
        ${(state.lang === "ar" ? i.desc_ar || i.desc_en : i.desc_en || i.desc_ar) ? `<p>${esc(state.lang === "ar" ? i.desc_ar || i.desc_en : i.desc_en || i.desc_ar)}</p>` : ""}
        <div class="card-foot">
          <span class="fare" data-fare="${money(i.price)}" dir="ltr">${fareHtml(money(i.price))}</span>
          ${i.out ? `<span class="out-tag">${esc(t("out"))}</span>` : `<button type="button" class="add" data-add="${esc(i.id)}">${esc(t("add"))}</button>`}
        </div>
      </div>
    </article>`;
  }
  const fareHtml = (s) => [...s].map((c) => `<span class="flap">${esc(c)}</span>`).join("");
  function renderPlatforms() {
    $("#platforms").innerHTML = $$(".cat").map((s, k) => `<button type="button" class="platform ${k === 0 ? "active" : ""}" data-target="${s.id}"><b>P${s.dataset.pf}</b>${esc(s.dataset.name)}</button>`).join("");
  }
  function renderExpress(menu) {
    const cat = menu.categories.find((c) => /shawarma/i.test(c.en));
    if (!cat || state.quick || state.query) { $("#express").hidden = true; return; }
    const items = cat.items.filter((i) => !i.out && i.img);
    if (!items.length) { $("#express").hidden = true; return; }
    $("#express").hidden = false;
    $("#expressTitle").textContent = nm(cat);
    $("#expressTrack").innerHTML = items.map((i) => `<button type="button" class="xcar" data-open="${esc(i.id)}"><img src="${esc(i.img)}" alt="" loading="lazy" /><span>${esc(nm(i))}<small>${money(i.price)}</small></span></button>`).join("");
  }

  let cardObs, catObs, tabLock = 0;
  function observeCards(root) {
    const cards = $$(".card.pop", root);
    if (reduceMotion || !("IntersectionObserver" in window)) { cards.forEach((c) => c.classList.add("in")); return; }
    cardObs?.disconnect();
    cardObs = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      cardObs.unobserve(e.target);
      e.target.classList.add("in");
      const fare = $(".fare", e.target);
      if (fare) spinFare(fare);
    }), { rootMargin: "0px 0px -5% 0px" });
    cards.forEach((c) => cardObs.observe(c));
  }
  // Fare digits clatter like a split-flap board when a card appears.
  function spinFare(el) {
    $$(".flap", el).forEach((s, i) => {
      const final = s.textContent;
      if (!/\d/.test(final)) return;
      let n = 4 + i;
      const tick = () => {
        if (!s.isConnected) return;
        s.classList.remove("spin"); void s.offsetWidth; s.classList.add("spin");
        s.textContent = --n <= 0 ? final : String((Math.random() * 10) | 0);
        if (n > 0) setTimeout(tick, 60);
      };
      setTimeout(tick, 150);
    });
  }
  function observeCats() {
    catObs?.disconnect();
    catObs = new IntersectionObserver((es) => {
      if (Date.now() < tabLock) return;
      const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (v) setPlatform(v.target.id);
    }, { rootMargin: "-170px 0px -55% 0px" });
    $$(".cat").forEach((s) => catObs.observe(s));
  }
  function setPlatform(id) {
    $$(".platform").forEach((p) => p.classList.toggle("active", p.dataset.target === id));
    // Scroll only the tab strip sideways. (scrollIntoView would also scroll the page
    // and yank it back up while the visitor is scrolling down.)
    const a = $(".platform.active"), bar = $("#platforms");
    if (a && bar) {
      const ar = a.getBoundingClientRect(), br = bar.getBoundingClientRect();
      const delta = ar.left + ar.width / 2 - (br.left + br.width / 2); // works for left-to-right and Arabic
      if (Math.abs(delta) > 4) bar.scrollBy({ left: delta, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }
  $("#platforms").addEventListener("click", (e) => {
    const p = e.target.closest(".platform"); if (!p) return;
    tabLock = Date.now() + 1000; setPlatform(p.dataset.target);
    const sec = document.getElementById(p.dataset.target);
    if (!sec) return;
    // Long trips: jump most of the way instantly, then glide the last stretch,
    // so far-away categories arrive in well under a second.
    const dist = sec.getBoundingClientRect().top - 150;
    if (!reduceMotion && Math.abs(dist) > 1600) {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, scrollY + dist - Math.sign(dist) * 700);
      document.documentElement.style.scrollBehavior = "";
    }
    sec.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });
  $("#quick").addEventListener("click", (e) => {
    const c = e.target.closest("[data-quick]"); if (!c) return;
    state.quick = state.quick === c.dataset.quick ? null : c.dataset.quick;
    renderMenu();
  });
  let searchT;
  $("#search").addEventListener("input", (e) => { clearTimeout(searchT); searchT = setTimeout(() => { state.query = e.target.value; renderMenu(); }, 160); });

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) { e.stopPropagation(); quickAdd(add.dataset.add, add); return; }
    const open = e.target.closest("[data-open]");
    if (open) { openItem(open.dataset.open); return; }
    const card = e.target.closest(".card[data-id]:not(.out)");
    if (card) openItem(card.dataset.id);
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".card[data-id]:not(.out)")) { e.preventDefault(); openItem(e.target.dataset.id); }
  });

  // ---------- Dish sheet ----------
  const sheet = $("#itemSheet");
  let current = null, qty = 1;
  function curMenu() { return state.branch ? state.menus[state.branch] : null; }
  function openItem(id) {
    const item = curMenu()?.items.get(id);
    if (!item || item.out) return;
    current = item; qty = 1;
    $("#itemMedia").innerHTML = item.img ? `<img src="${esc(item.img)}" alt="" />` : `<div class="noimg"><img src="img/logo.webp" alt="" /></div>`;
    $("#itemTitle").textContent = nm(item);
    $("#itemAlt").textContent = altNm(item);
    const desc = state.lang === "ar" ? item.desc_ar || item.desc_en : item.desc_en || item.desc_ar;
    $("#itemDesc").textContent = desc || "";
    $("#itemNotes").value = "";
    let html = "";
    if (item.sizes.length) html += `<div class="opt-block"><span class="opt-title">${esc(t("size"))} <small>${esc(t("required"))}</small></span>${item.sizes.map((s, k) =>
      `<label class="opt"><input type="radio" name="size" value="${k}" ${k === 0 ? "checked" : ""} /><span>${esc(nm(s))}</span><em>${money(s.price)}</em></label>`).join("")}</div>`;
    item.groups.forEach((g, gi) => {
      html += `<div class="opt-block" data-g="${gi}"><span class="opt-title">${esc(nm(g) || t("options"))} <small>${esc(g.min ? t("required") : t("optional"))}</small></span>${g.options.map((o, k) =>
        `<label class="opt"><input type="${g.max === 1 ? "radio" : "checkbox"}" name="g${gi}" value="${k}" /><span>${esc(nm(o))}</span>${o.price ? `<em>+ ${money(o.price)}</em>` : ""}</label>`).join("")}</div>`;
    });
    $("#itemOptions").innerHTML = html;
    updateSheet();
    sheet.showModal();
    $(".sheet-body", sheet).scrollTop = 0;
  }
  function selection() {
    const sizeIdx = $("#itemOptions input[name=size]:checked")?.value;
    const size = sizeIdx != null ? current.sizes[+sizeIdx] : null;
    const opts = $$("#itemOptions [data-g] input:checked").map((inp) => current.groups[+inp.closest("[data-g]").dataset.g].options[+inp.value]);
    const unit = (size ? size.price : current.price) + opts.reduce((s, o) => s + o.price, 0);
    return { size, opts, unit };
  }
  function updateSheet() {
    if (!current) return;
    const { unit } = selection();
    $("#itemPrice").innerHTML = `<span class="fare" dir="ltr">${fareHtml(money(unit))}</span>`;
    $("#qtyOut").textContent = qty;
    $("#addTotal").textContent = money(unit * qty);
  }
  $("#itemOptions").addEventListener("change", updateSheet);
  $("#qtyMinus").addEventListener("click", () => { qty = Math.max(1, qty - 1); updateSheet(); });
  $("#qtyPlus").addEventListener("click", () => { qty = Math.min(50, qty + 1); updateSheet(); });
  $("#itemForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const { size, opts } = selection();
    addToCart(current, qty, { size, opts, notes: $("#itemNotes").value.trim() }, $("#itemMedia"));
    closeDialog(sheet);
  });
  function quickAdd(id, btn) {
    const item = curMenu()?.items.get(id);
    if (!item) return;
    if (item.sizes.length || item.groups.length) return openItem(id);
    addToCart(item, 1, { size: null, opts: [], notes: "" }, btn);
    btn.classList.add("done"); btn.textContent = t("added");
    setTimeout(() => { if (btn.isConnected) { btn.classList.remove("done"); btn.textContent = t("add"); } }, 1300);
  }

  // ---------- Ticket (cart) ----------
  function addToCart(item, n, sel, fromEl) {
    if (state.cart.branch !== state.branch) state.cart = { branch: state.branch, lines: [] };
    const key = [item.id, sel.size ? nm(sel.size) : "", sel.opts.map((o) => o.en).join("+"), sel.notes].join("|");
    const ex = state.cart.lines.find((l) => l.key === key);
    if (ex) ex.qty = Math.min(50, ex.qty + n);
    else state.cart.lines.push({ key, id: item.id, qty: n, size: sel.size, opts: sel.opts, notes: sel.notes });
    save("station.cart", state.cart);
    flyStub(fromEl, n);
    renderCart(true);
    toast(t("addedToast", nm(item)));
  }
  function lineCalc(l) {
    const item = state.menus[state.cart.branch]?.items.get(l.id);
    if (!item) return null;
    const unit = (l.size ? l.size.price : item.price) + l.opts.reduce((s, o) => s + o.price, 0);
    return { item, unit, total: unit * l.qty };
  }
  async function renderCart(bump = false) {
    if (state.cart.branch && !state.menus[state.cart.branch]) { try { await getMenu(state.cart.branch); } catch { /* ignore */ } }
    const lines = state.cart.lines.map((l) => ({ l, c: lineCalc(l) })).filter((x) => x.c);
    const count = lines.reduce((s, x) => s + x.l.qty, 0);
    const total = lines.reduce((s, x) => s + x.c.total, 0);
    const tc = $("#ticketCount"); tc.textContent = count; tc.classList.toggle("has", count > 0);
    if (bump) { const b = $("#ticketBtn"); b.classList.remove("punch"); void b.offsetWidth; b.classList.add("punch"); }
    $("#tbCount").textContent = count; $("#tbTotal").textContent = money(total); $("#ticketBar").hidden = count === 0;
    const b = branchById(state.cart.branch || state.branch);
    $("#ticketFrom").textContent = b ? nm(b) : "—";
    $("#punches").innerHTML = "<i></i>".repeat(Math.min(count, 24));
    $("#ticketLines").innerHTML = lines.length ? lines.map(({ l, c }) => `<div class="tline" data-key="${esc(l.key)}">
        <h4>${esc(nm(c.item))}</h4><span class="tprice" dir="ltr">${money(c.total)}</span>
        <p>${[l.size && esc(nm(l.size)), l.opts.length && esc(l.opts.map(nm).join(", ")), l.notes && "“" + esc(l.notes) + "”"].filter(Boolean).join(" · ") || money(c.unit)}</p>
        <div class="tqty"><button type="button" data-dec aria-label="−">−</button><span>${l.qty}</span><button type="button" data-inc aria-label="+">+</button></div>
      </div>`).join("") : `<div class="ticket-empty"><b>🎫</b>${esc(t("emptyTicket"))}</div>`;
    $("#ticketFoot").hidden = !lines.length;
    $("#ticketTotal").textContent = money(total);
    $("#sendLabel").textContent = t("sendTo", b ? nm(b) : "");
    $("#sendBtn").disabled = !b?.wa;
  }
  $("#ticketLines").addEventListener("click", (e) => {
    const row = e.target.closest(".tline"); if (!row) return;
    const l = state.cart.lines.find((x) => x.key === row.dataset.key); if (!l) return;
    if (e.target.closest("[data-inc]")) l.qty = Math.min(50, l.qty + 1);
    else if (e.target.closest("[data-dec]")) l.qty -= 1; else return;
    const commit = () => { state.cart.lines = state.cart.lines.filter((x) => x.qty > 0); save("station.cart", state.cart); renderCart(); };
    if (l.qty <= 0 && !reduceMotion) { row.classList.add("leaving"); setTimeout(commit, 280); } else commit();
  });
  function waMessage() {
    const b = branchById(state.cart.branch);
    const out = [t("waHello", nm(b)), ""];
    let total = 0;
    state.cart.lines.forEach((l, i) => {
      const c = lineCalc(l); if (!c) return;
      total += c.total;
      const both = [c.item.en, c.item.ar].filter(Boolean).join(" / ");
      out.push(`${i + 1}) ${both} × ${l.qty} — ${money(c.total)}`);
      if (l.size) out.push(`   ${t("waSize")}: ${nm(l.size)}`);
      if (l.opts.length) out.push(`   ${t("waExtras")}: ${l.opts.map(nm).join(", ")}`);
      if (l.notes) out.push(`   ${t("waNote")}: ${l.notes}`);
    });
    out.push("", `${t("waTotal")}: ${money(total)}`);
    const name = $("#custName").value.trim(), addr = $("#custAddress").value.trim();
    if (name) out.push(`${t("waName")}: ${name}`);
    if (addr) out.push(`${t("waAddress")}: ${addr}`);
    return out.join("\n");
  }
  $("#sendBtn").addEventListener("click", () => {
    const b = branchById(state.cart.branch);
    if (!b?.wa || !state.cart.lines.length) return;
    save("station.customer", { name: $("#custName").value, address: $("#custAddress").value });
    const stamp = $("#stamp"); stamp.classList.remove("go"); void stamp.offsetWidth; stamp.classList.add("go");
    const url = `https://wa.me/${b.wa}?text=${encodeURIComponent(waMessage())}`;
    setTimeout(() => window.open(url, "_blank", "noopener"), reduceMotion ? 0 : 700);
  });
  const drawer = $("#ticketDrawer");
  function openTicket() { renderCart(); drawer.showModal(); }
  $("#ticketBtn").addEventListener("click", openTicket);
  $("#ticketBar").addEventListener("click", openTicket);

  function flyStub(fromEl, n) {
    if (reduceMotion || !fromEl) return;
    const target = innerWidth <= 600 && !$("#ticketBar").hidden ? $("#ticketBar") : $("#ticketBtn");
    const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    const s = document.createElement("div");
    s.className = "stub"; s.textContent = `×${n}`;
    const sx = a.left + a.width / 2 - 35, sy = a.top + a.height / 2 - 19;
    Object.assign(s.style, { left: sx + "px", top: sy + "px" });
    document.body.appendChild(s);
    const dx = b.left + b.width / 2 - 35 - sx, dy = b.top + b.height / 2 - 19 - sy;
    s.animate([
      { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 110}px) rotate(-200deg) scale(1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) rotate(-360deg) scale(0.35)`, opacity: 0.7 },
    ], { duration: 820, easing: "cubic-bezier(.5,0,.5,1)" }).onfinish = () => s.remove();
  }

  // ---------- Dialogs ----------
  function closeDialog(d) {
    if (!d.open || d.classList.contains("closing")) return;
    if (reduceMotion) { d.close(); return; }
    d.classList.add("closing");
    setTimeout(() => { d.classList.remove("closing"); d.close(); }, 280);
  }
  $$("dialog").forEach((d) => {
    d.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(d); });
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) closeDialog(d); });
  });

  // ---------- Scroll effects ----------
  const topbar = $("#topbar");
  let lastY = scrollY;
  function onScroll() {
    const y = scrollY;
    topbar.classList.toggle("scrolled", y > 40);
    const anyOpen = !!document.querySelector("dialog[open]");
    if (y > 500 && y > lastY + 4 && !anyOpen) { topbar.classList.add("hide"); document.body.classList.add("nav-hidden"); }
    else if (y < lastY - 4 || y < 500) { topbar.classList.remove("hide"); document.body.classList.remove("nav-hidden"); }
    lastY = y;
    const tools = $("#menuTools");
    if (!tools.hidden) tools.classList.toggle("stuck", tools.getBoundingClientRect().top <= 70);
  }
  addEventListener("scroll", () => requestAnimationFrame(onScroll), { passive: true });

  function observeReveals() {
    const els = $$(".reveal:not(.in), .route-map:not(.in)");
    if (reduceMotion || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const o = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); o.unobserve(e.target); if (e.target.id === "routeMap") setTimeout(placeTrain, 50); } }), { rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => o.observe(e));
  }
  // Stat counters roll up like an odometer.
  function observeStats() {
    const o = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      o.unobserve(e.target);
      const to = +e.target.dataset.to, suf = e.target.dataset.suffix || "";
      if (reduceMotion) { e.target.textContent = to + suf; return; }
      const t0 = performance.now();
      const step = (now) => { const k = Math.min(1, (now - t0) / 1400); e.target.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + suf; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }), { threshold: 0.6 });
    $$(".flapnum").forEach((el) => o.observe(el));
  }

  // ---------- Boot ----------
  async function renderAll() {
    renderChip();
    renderRoute();
    $("#routeMap").classList.add(...($("#routeMap").dataset.seen ? ["in"] : []));
    await Promise.all([renderArrival(), renderMenu(), renderTrain()]);
    renderCart();
  }
  const cust = load("station.customer", {});
  $("#custName").value = cust.name || "";
  $("#custAddress").value = cust.address || "";
  applyLang();
  observeReveals();
  observeStats();
  onScroll();
  // keep the route map's "drawn" state across re-renders (language switch etc.)
  new MutationObserver(() => { const m = $("#routeMap"); if (m.classList.contains("in")) m.dataset.seen = "1"; }).observe($("#routeMap"), { attributes: true, attributeFilter: ["class"] });
  setInterval(() => { if (!document.hidden) renderArrival(); }, 60000);
})();
