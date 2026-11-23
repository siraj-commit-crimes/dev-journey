/* Food Bae: phone-first ordering with a dating-app wink.
 * Menu: data/menu.json (refresh: node tools/update-menu.js). Banner: data/promo.json.
 */
(() => {
  "use strict";

  // ---------- Config (confirm with Food Bae before going live) ----------
  // Both branches use the WhatsApp number from their current ordering page until they give per-branch numbers.
  const BRANCHES = [
    { id: "chebbak", en: "Furn El Chebbak", ar: "فرن الشباك", note_en: "Delivery & takeaway", note_ar: "توصيل وتيك أواي", wa: "96178848290" },
    { id: "birelabed", en: "Bir El Abed", ar: "بئر العبد", note_en: "Msharafiyi · dine-in, delivery & takeaway", note_ar: "المشرفية · صالة، توصيل وتيك أواي", wa: "96178848290", tel: "96181827087" },
  ];
  const TZ = "Asia/Beirut";
  const FIT_CATS = /fit bae|protein/i;
  const DIP_CATS = /starter|side|loaded|combo|burger|zinger|sandwich|platter|fit/i;
  const EXTRA_CATS = /burger|zinger|sandwich/i;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const T = {
    en: {
      pickBranch: "Pick branch", h1a: "Too good", h1b: "to ghost.", heroSub: "Burgers, zingers, loaded fries and high-protein plates. Tap, match, and slide into our DMs.",
      cantDecide: "Can't decide? Swipe", seeMenu: "Full menu", stickerA: "Crush<br>worthy", againTitle: "Same as last time?", againBtn: "Reorder",
      dealsTitle: "Deals worth committing to", searchPh: "Search burgers, wings, protein…", fitMode: "Fit Bae", fitNote: "High-protein first. Numbers shown where Food Bae lists them.",
      noMatch: "No match. Try “wings” or “protein”.", findTitle: "Where to find bae", footLine: "Too Good To Ghost · High protein since 2019", yourMatches: "Your matches",
      deckHint: "Swipe right to match, left to ghost.", itsAMatch: "It's a match!", you: "You", keepSwiping: "Keep swiping", seeMatches: "See my matches",
      notes: "Notes for the kitchen", notesPh: "No pickles, extra sauce…", addMatch: "Add", delivery: "Delivery", pickup: "Pick up", name: "Your name", address: "Address",
      addressPh: "Area, street, building, floor", total: "Total", slide: "Slide into our DMs", fine: "Opens WhatsApp with your order ready to send.", whichBranch: "Which Food Bae?",
      openUntil: (t) => `Open now · until ${t}`, closedOpens: (t, d) => `Closed · opens ${d ? d + " " : ""}${t}`, tomorrow: "tomorrow",
      dips: "Add a dip", extras: "Make it extra", itemExtras: "Add-ons", optional: "Optional", all: "All", combos: "Combos", burgers: "Burgers", fit: "Fit Bae", sweet: "Sweet",
      added: (n) => `${n} is in your matches 💘`, ghosted: "Ghosted 👻", emptyCart: "No matches yet. Go swipe some food.", items: (n) => `${n} item${n === 1 ? "" : "s"}`,
      deckDone: "You've seen everyone.", deckDoneSub: "Bae is waiting in your matches.", restart: "Swipe again", pickFirst: "Pick a branch first 📍", needAddress: "Add your address for delivery",
      call: "Call", whatsapp: "WhatsApp", hours: (o, c) => `Open every day ${o}–${c}`, protein: (g) => `${g}g protein`, kcal: (k) => `${k} kcal`, spicy: "Spicy", fitTag: "Fit Bae",
      wa: { hi: "Hi Food Bae! New order:", type: "Order type", del: "Delivery", pick: "Pick up", branch: "Branch", total: "Total", name: "Name", addr: "Address", note: "Note", adds: "Add-ons" },
      reorderToast: "Your usual is back in your matches", pairsTitle: "Complete the date", stepHow: "How do you want it?", stepFrom: "From which Food Bae?", stepWho: "Your details", sendWa: "Send order on WhatsApp", ghostedToday: "Ghosted us today 👻", tryInstead: (n) => `Try ${n} instead`, matchDay: "Match day", lastOrder: (s) => s,
      ticker: ["Too good to ghost", "High protein since 2019", "Bae 4 Two", "Crunch Bae", "Wings feast", "Swipe right on dinner"],
    },
    ar: {
      pickBranch: "اختار الفرع", h1a: "طيب لدرجة", h1b: "ما بينترك.", heroSub: "برغر، زنغر، بطاطا محمّلة وأطباق بروتين عالي. اضغط، اعمل ماتش، وابعتلنا عالخاص.",
      cantDecide: "محتار؟ اسحب", seeMenu: "كل المنيو", stickerA: "بيستاهل<br>الكراش", againTitle: "متل آخر مرة؟", againBtn: "اطلب مجدداً",
      dealsTitle: "عروض بتستاهل الالتزام", searchPh: "ابحث: برغر، وينغز، بروتين…", fitMode: "Fit Bae", fitNote: "البروتين العالي أولاً. الأرقام بتظهر وين Food Bae بيذكرها.",
      noMatch: "ما في ماتش. جرّب «wings» أو «protein».", findTitle: "وين تلاقي Bae", footLine: "Too Good To Ghost · بروتين عالي من ٢٠١٩", yourMatches: "الماتشات تبعك",
      deckHint: "اسحب يمين للماتش، شمال للـ ghost.", itsAMatch: "صار ماتش!", you: "إنت", keepSwiping: "كمّل سحب", seeMatches: "شوف الماتشات",
      notes: "ملاحظات للمطبخ", notesPh: "بلا كبيس، صوص زيادة…", addMatch: "زيد", delivery: "توصيل", pickup: "استلام", name: "اسمك", address: "العنوان",
      addressPh: "المنطقة، الشارع، البناية، الطابق", total: "المجموع", slide: "ابعتلنا عالواتساب", fine: "بيفتح واتساب والطلب جاهز للإرسال.", whichBranch: "أي فرع؟",
      openUntil: (t) => `مفتوح الآن · لحد ${t}`, closedOpens: (t, d) => `مسكّر · بيفتح ${d ? d + " " : ""}${t}`, tomorrow: "بكرا",
      dips: "زيد صوص", extras: "زيد إضافات", itemExtras: "إضافات", optional: "اختياري", all: "الكل", combos: "كومبو", burgers: "برغر", fit: "Fit Bae", sweet: "حلو",
      added: (n) => `${n} صار بالماتشات 💘`, ghosted: "Ghosted 👻", emptyCart: "ما في ماتشات بعد. روح اسحب شوية أكل.", items: (n) => `${n} صنف`,
      deckDone: "شفت الكل.", deckDoneSub: "الـ Bae ناطرك بالماتشات.", restart: "اسحب من جديد", pickFirst: "اختار الفرع أولاً 📍", needAddress: "زيد عنوانك للتوصيل",
      call: "اتصل", whatsapp: "واتساب", hours: (o, c) => `مفتوح كل يوم ${o}–${c}`, protein: (g) => `${g}غ بروتين`, kcal: (k) => `${k} سعرة`, spicy: "حار", fitTag: "Fit Bae",
      wa: { hi: "مرحبا Food Bae! طلب جديد:", type: "نوع الطلب", del: "توصيل", pick: "استلام", branch: "الفرع", total: "المجموع", name: "الاسم", addr: "العنوان", note: "ملاحظة", adds: "إضافات" },
      reorderToast: "طلبك المعتاد رجع عالماتشات", pairsTitle: "كمّل الموعد", stepHow: "كيف بدك ياه؟", stepFrom: "من أي فرع؟", stepWho: "معلوماتك", sendWa: "ابعت الطلب عالواتساب", ghostedToday: "عملنا ghost اليوم 👻", tryInstead: (n) => `جرّب ${n} بدالو`, matchDay: "يوم الماتش", lastOrder: (s) => s,
      ticker: ["Too good to ghost", "بروتين عالي من ٢٠١٩", "Bae 4 Two", "Crunch Bae", "Wings feast", "اسحب يمين عالعشا"],
    },
  };

  // ---------- State ----------
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
  const S = { lang: load("fb.lang", "en"), branch: load("fb.branch", null), cart: load("fb.cart", []), mode: load("fb.mode", "delivery"), last: load("fb.last", null), fit: false, q: "", menu: null, items: new Map(), promo: null };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const t = (k, ...a) => { const v = T[S.lang][k]; return typeof v === "function" ? v(...a) : v ?? k; };
  const money = (n) => "$" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");
  const tidy = (s) => (s === s.toUpperCase() && /[A-Z]{3}/.test(s) ? s.toLowerCase().replace(/(^|[\s(-])([a-z])/g, (m, a, b) => a + b.toUpperCase()) : s);
  const brName = (b) => (S.lang === "ar" ? b.ar : b.en);
  const branchById = (id) => BRANCHES.find((b) => b.id === id);
  function toast(m) { const el = $("#toast"); el.textContent = m; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2300); }
  const vibrate = (ms) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

  // ---------- Language ----------
  function applyLang() {
    const ar = S.lang === "ar";
    document.documentElement.lang = ar ? "ar" : "en";
    document.documentElement.dir = ar ? "rtl" : "ltr";
    $$("[data-i18n]").forEach((el) => { const v = t(el.dataset.i18n); if (typeof v === "string") el.innerHTML = v; });
    $$("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $("#langBtn").textContent = ar ? "EN" : "ع";
    $("#langBtn").setAttribute("aria-label", ar ? "English" : "العربية");
    if (S.menu) renderAll();
  }
  $("#langBtn").addEventListener("click", () => { S.lang = S.lang === "ar" ? "en" : "ar"; save("fb.lang", S.lang); applyLang(); });

  // ---------- Status / hours ----------
  function nowBeirut() {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const g = (k) => p.find((x) => x.type === k).value;
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return { day: days.indexOf(g("weekday")), mins: (+g("hour") % 24) * 60 + +g("minute") };
  }
  const toM = (s) => { const [h, m] = String(s).split(":").map(Number); return h * 60 + m; };
  function renderStatus() {
    const hrs = S.menu.hours || [];
    const el = $("#status");
    if (!hrs.length) { el.hidden = true; return; }
    const { day, mins } = nowBeirut();
    const today = hrs.find((h) => h.day === day);
    let open = false, label;
    if (today) {
      const o = toM(today.open), c = toM(today.close);
      open = c > o ? mins >= o && mins < c : mins >= o || mins < c;
      if (open) label = t("openUntil", today.close);
      else label = mins < o ? t("closedOpens", today.open, "") : t("closedOpens", (hrs.find((h) => h.day === (day + 1) % 7) || today).open, t("tomorrow"));
    }
    el.classList.toggle("closed", !open);
    $("span", el).textContent = label || "";
    const same = hrs.every((h) => h.open === hrs[0].open && h.close === hrs[0].close);
    $("#hours").textContent = same && hrs.length === 7 ? t("hours", hrs[0].open, hrs[0].close) : "";
  }

  // ---------- Data ----------
  async function boot() {
    const [menu, promo] = await Promise.all([fetch("data/menu.json").then((r) => r.json()), fetch("data/promo.json").then((r) => r.json()).catch(() => null)]);
    S.menu = menu; S.promo = promo;
    const out = new Set(((promo && promo.soldOut) || []).map(String));
    menu.categories.forEach((c) => c.items.forEach((i) => S.items.set(i.id, { ...i, cat: c.name, out: out.has(String(i.id)) })));
    S.cart = S.cart.filter((l) => S.items.has(l.id) && !S.items.get(l.id).out);
    if (!S.branch && S.last && S.last.branch) S.branch = S.last.branch; // remember the branch from last time
    applyLang();
    setInterval(renderStatus, 60000);
  }
  function renderAll() {
    renderStatus(); renderTicker(); renderAgain(); renderDeals(); renderPromo(); renderCats(); renderMenu(); renderBranches(); renderCart();
    $("#branchName").textContent = S.branch ? brName(branchById(S.branch)) : t("pickBranch");
  }

  function renderTicker() {
    const words = t("ticker").map((w) => `<span>${esc(w)}</span><i>♥</i>`).join("");
    $("#ticker").innerHTML = words + words;
  }

  // ---------- Tags ----------
  function tagsHtml(i) {
    const out = [];
    if (i.protein) out.push(`<span class="tag macro">💪 ${esc(t("protein", i.protein))}</span>`);
    if (i.kcal) out.push(`<span class="tag fit">${esc(t("kcal", i.kcal))}</span>`);
    if (!i.protein && FIT_CATS.test(i.cat)) out.push(`<span class="tag fit">${esc(t("fitTag"))}</span>`);
    if (i.spicy) out.push(`<span class="tag hot">🌶 ${esc(t("spicy"))}</span>`);
    return out.length ? `<div class="tags">${out.join("")}</div>` : "";
  }

  // ---------- Reorder ----------
  function renderAgain() {
    const ok = S.last && S.last.lines?.length && !S.cart.length && S.last.lines.every((l) => S.items.has(l.id));
    $("#again").hidden = !ok;
    if (!ok) return;
    $("#againText").textContent = S.last.lines.map((l) => `${l.qty}× ${tidy(S.items.get(l.id).name)}`).join(", ");
  }
  $("#againBtn").addEventListener("click", () => {
    S.cart = S.last.lines.map((l) => ({ ...l, key: l.key || l.id }));
    if (S.last.branch) S.branch = S.last.branch;
    save("fb.cart", S.cart); save("fb.branch", S.branch);
    renderAll(); toast(t("reorderToast")); bumpBar();
  });
  $("#againX").addEventListener("click", () => { $("#again").hidden = true; });

  // ---------- Deals ----------
  function renderDeals() {
    const cat = S.menu.categories.find((c) => /combo/i.test(c.name));
    const items = cat ? cat.items.map((i) => S.items.get(i.id)).filter((i) => !i.out) : [];
    const p = S.promo, md = p && p.enabled && S.items.get(String(p.dish));
    const ar = S.lang === "ar";
    const mdCard = md ? `<button type="button" class="deal md" data-open="${esc(md.id)}">
        <span class="md-k">⚽ ${esc((ar && p.kicker_ar) || p.kicker || t("matchDay"))}</span>
        <h3>${esc((ar && p.title_ar) || p.title)}</h3>
        <img src="${esc(md.img)}" alt="" loading="lazy" />
        <span class="price">${money(md.price)}</span></button>` : "";
    $("#deals").innerHTML = mdCard + items.map((i) => {
      const words = tidy(i.name).split(" ");
      const last = words.length > 1 ? words.pop() : "";
      return `<button type="button" class="deal" data-open="${esc(i.id)}">
        <h3>${esc(words.join(" "))}${last ? `<em>${esc(last)}</em>` : ""}</h3>
        <img src="${esc(i.img)}" alt="" loading="lazy" />
        <span class="price">${money(i.price)}</span>
        <span class="what">${esc(i.desc.split(/[,.]/).slice(0, 3).join(" ·"))}</span>
      </button>`;
    }).join("");
  }

  // ---------- Match-day banner ----------
  function renderPromo() {
    $("#matchday").hidden = true; return; // match day now lives in the deals row
    const p = S.promo, on = p && p.enabled && S.items.has(String(p.dish));
    if (!on) return;
    const ar = S.lang === "ar";
    $("#mdKicker").textContent = (ar && p.kicker_ar) || p.kicker;
    $("#mdTitle").textContent = (ar && p.title_ar) || p.title;
    $("#mdText").textContent = (ar && p.text_ar) || p.text;
  }
  $("#mdCard").addEventListener("click", () => openDish(String(S.promo.dish)));

  // ---------- Menu ----------
  function visibleCats() {
    const q = S.q.trim().toLowerCase();
    let cats = S.menu.categories.map((c) => ({ ...c, items: c.items.map((i) => S.items.get(i.id)) }));
    if (S.fit) {
      const fit = cats.flatMap((c) => c.items).filter((i) => i.protein || FIT_CATS.test(i.cat) || /grill|light|healthy|salad/i.test(i.name + " " + i.cat));
      fit.sort((a, b) => (b.protein || 0) - (a.protein || 0));
      cats = [{ id: "fit", name: "Fit Bae picks", items: fit }];
    }
    if (q) cats = cats.map((c) => ({ ...c, items: c.items.filter((i) => `${i.name} ${i.desc} ${i.cat}`.toLowerCase().includes(q)) }));
    return cats.filter((c) => c.items.length);
  }
  const countIn = (id) => S.cart.filter((l) => l.id === id).reduce((s, l) => s + l.qty, 0);
  function rowHtml(i, k) {
    const n = countIn(i.id);
    if (i.out) {
      const alt = [...S.items.values()].find((x) => x.cat === i.cat && !x.out && x.id !== i.id);
      return `<article class="row out">
      <div class="row-img"><img src="${esc(i.img)}" alt="" loading="lazy" /></div>
      <div class="row-body"><span class="ghost-tag">${esc(t("ghostedToday"))}</span><h4>${esc(tidy(i.name))}</h4>
        ${alt ? `<button type="button" class="try" data-open="${esc(alt.id)}">${esc(t("tryInstead", tidy(alt.name)))} →</button>` : ""}</div></article>`;
    }
    return `<article class="row pop-in ${n ? "in-cart" : ""}" data-open="${esc(i.id)}" tabindex="0" style="animation-delay:${Math.min(k, 8) * 30}ms">
      <div class="row-img"><img src="${esc(i.img)}" alt="" loading="lazy" /></div>
      <div class="row-body">
        ${tagsHtml(i)}
        <h4>${esc(tidy(i.name))}</h4>
        ${i.desc ? `<p>${esc(i.desc)}</p>` : ""}
        <div class="row-foot"><span class="row-price">${money(i.price)}</span>
          <button type="button" class="add" data-add="${esc(i.id)}" aria-label="${esc(t("addMatch"))} ${esc(tidy(i.name))}">+${n ? `<span class="n">${n}</span>` : ""}</button></div>
      </div>
    </article>`;
  }
  function renderMenu() {
    const cats = visibleCats();
    $("#menuBody").innerHTML = cats.map((c) => `<section class="cat" id="c-${esc(c.id)}" data-cat="${esc(c.id)}">
      <div class="cat-title"><h3>${esc(tidy(c.name))}</h3><small>${c.items.length}</small></div>
      <div class="list">${c.items.map(rowHtml).join("")}</div></section>`).join("");
    $("#empty").hidden = cats.length > 0;
    $("#fitNote").hidden = !S.fit;
    observeCats();
  }
  function renderCats() {
    $("#cats").innerHTML = S.menu.categories.map((c, k) => `<button type="button" class="cat-chip ${k === 0 ? "on" : ""}" data-go="${esc(c.id)}">${esc(tidy(c.name))}</button>`).join("");
  }
  let catObs, lockUntil = 0;
  function observeCats() {
    catObs?.disconnect();
    catObs = new IntersectionObserver((es) => {
      if (Date.now() < lockUntil) return;
      const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (v) setChip(v.target.dataset.cat);
    }, { rootMargin: "-190px 0px -60% 0px" });
    $$(".cat").forEach((s) => catObs.observe(s));
  }
  function setChip(id) {
    $$(".cat-chip").forEach((b) => b.classList.toggle("on", b.dataset.go === id));
    const a = $(".cat-chip.on"), bar = $("#cats");
    if (a) { const ar = a.getBoundingClientRect(), br = bar.getBoundingClientRect(); const d = ar.left + ar.width / 2 - (br.left + br.width / 2); if (Math.abs(d) > 4) bar.scrollBy({ left: d, behavior: reduce ? "auto" : "smooth" }); }
  }
  $("#cats").addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]"); if (!b) return;
    if (S.fit || S.q) { S.fit = false; S.q = ""; $("#search").value = ""; $("#fitBtn").setAttribute("aria-pressed", "false"); renderMenu(); }
    lockUntil = Date.now() + 900; setChip(b.dataset.go);
    document.getElementById("c-" + b.dataset.go)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  });
  let qT;
  $("#search").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { S.q = e.target.value; renderMenu(); }, 150); });
  $("#fitBtn").addEventListener("click", (e) => {
    S.fit = !S.fit; e.currentTarget.setAttribute("aria-pressed", String(S.fit)); renderMenu();
    if (S.fit) $("#menu").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  });

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) { e.stopPropagation(); quickAdd(add.dataset.add, add); return; }
    const o = e.target.closest("[data-open]");
    if (o) openDish(o.dataset.open);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches?.(".row")) openDish(e.target.dataset.open); });

  // ---------- Dish sheet ----------
  function optionGroups(i) {
    const g = [];
    if (i.extras.length) g.push({ key: "own", title: t("itemExtras"), list: i.extras });
    if (DIP_CATS.test(i.cat) && S.menu.addons.dips) g.push({ key: "dips", title: t("dips"), list: S.menu.addons.dips });
    if (EXTRA_CATS.test(i.cat) && S.menu.addons.extras) g.push({ key: "extras", title: t("extras"), list: S.menu.addons.extras });
    return g;
  }
  let cur = null, qty = 1;
  function openDish(id) {
    const i = S.items.get(id); if (!i || i.out) return;
    cur = i; qty = 1;
    $("#dishImg").src = i.img;
    $("#dishName").textContent = tidy(i.name);
    $("#dishDesc").textContent = i.desc;
    $("#dishTags").innerHTML = tagsHtml(i).replace(/^<div class="tags">|<\/div>$/g, "");
    $("#dishNotes").value = "";
    $("#dishOpts").innerHTML = optionGroups(i).map((g) => `<div class="opt-block"><div class="opt-title">${esc(g.title)} <small>${esc(t("optional"))}</small></div><div class="opts">
      ${g.list.map((o) => `<label class="opt"><input type="checkbox" value="${esc(o.id)}" data-name="${esc(o.name)}" data-price="${o.price}" /><span>${esc(o.name)} <em>+${money(o.price)}</em></span></label>`).join("")}</div></div>`).join("");
    updDish();
    $("#dish").showModal();
    $(".sheet-body", $("#dish")).scrollTop = 0;
  }
  const picked = () => $$("#dishOpts input:checked").map((x) => ({ id: x.value, name: x.dataset.name, price: +x.dataset.price }));
  function updDish() { const u = cur.price + picked().reduce((s, o) => s + o.price, 0); $("#qOut").textContent = qty; $("#addTotal").textContent = money(u * qty); }
  $("#dishOpts").addEventListener("change", updDish);
  $("#qMinus").addEventListener("click", () => { qty = Math.max(1, qty - 1); updDish(); });
  $("#qPlus").addEventListener("click", () => { qty = Math.min(30, qty + 1); updDish(); });
  $("#dishForm").addEventListener("submit", (e) => { e.preventDefault(); addToCart(cur.id, qty, picked(), $("#dishNotes").value.trim(), $("#addBtn")); closeDlg($("#dish")); });
  function quickAdd(id, btn) { if (!S.items.get(id)?.out) addToCart(id, 1, [], "", btn); }

  // ---------- Cart ----------
  function addToCart(id, n, opts, note, fromEl) {
    const key = [id, opts.map((o) => o.id).sort().join("+"), note].join("|");
    const ex = S.cart.find((l) => l.key === key);
    if (ex) ex.qty = Math.min(30, ex.qty + n); else S.cart.push({ key, id, qty: n, opts, note });
    save("fb.cart", S.cart);
    hearts(fromEl); vibrate(18);
    toast(t("added", tidy(S.items.get(id).name)));
    renderCart(); bumpBar(); refreshRows(id);
  }
  function refreshRows(id) {
    $$(`.row[data-open="${CSS.escape(id)}"]`).forEach((r) => {
      const n = countIn(id); r.classList.toggle("in-cart", n > 0);
      const b = $(".add", r); b.innerHTML = "+" + (n ? `<span class="n">${n}</span>` : "");
    });
  }
  const lineUnit = (l) => S.items.get(l.id).price + l.opts.reduce((s, o) => s + o.price, 0);
  const cartTotal = () => S.cart.reduce((s, l) => s + lineUnit(l) * l.qty, 0);
  function bumpBar() { const b = $("#cartBar"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
  function renderCart() {
    const count = S.cart.reduce((s, l) => s + l.qty, 0);
    $("#cartBar").hidden = !count;
    $("#cbCount").textContent = count; $("#cbTotal").textContent = money(cartTotal());
    $("#cartSub").textContent = count ? t("items", count) : "";
    $("#cartLines").innerHTML = S.cart.length ? S.cart.map((l) => { const i = S.items.get(l.id); return `<div class="cl" data-key="${esc(l.key)}">
        <img src="${esc(i.img)}" alt="" /><div><h4>${esc(tidy(i.name))}</h4><p>${esc([l.opts.map((o) => o.name).join(", "), l.note && "“" + l.note + "”"].filter(Boolean).join(" · ") || money(lineUnit(l)))}</p></div>
        <div class="r"><b>${money(lineUnit(l) * l.qty)}</b><div class="mini"><button type="button" data-d="-1" aria-label="−">−</button><span>${l.qty}</span><button type="button" data-d="1" aria-label="+">+</button></div></div></div>`; }).join("")
      : `<div class="cart-empty"><b>💔</b>${esc(t("emptyCart"))}</div>`;
    $("#cartFoot").hidden = !S.cart.length;
    renderPairs();
    $("#cartTotal").textContent = money(cartTotal());
    $$(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === S.mode));
    $("#addrField").hidden = S.mode !== "delivery";
    $("#branchPick").innerHTML = BRANCHES.map((b) => `<button type="button" data-br="${b.id}" class="${S.branch === b.id ? "on" : ""}">${esc(brName(b))}</button>`).join("");
  }
  // "Complete the date": suggest a side, a drink and a dip the order doesn't have yet.
  function renderPairs() {
    const inCart = S.cart.map((l) => S.items.get(l.id));
    const has = (re) => inCart.some((i) => re.test(i.cat + " " + i.name));
    const mains = has(/burger|zinger|sandwich|platter|fit|loaded/i) && !has(/combo/i);
    const pick = (re) => [...S.items.values()].filter((i) => !i.out && re.test(i.cat + " " + i.name) && !S.cart.some((l) => l.id === i.id));
    const sug = [];
    if (S.cart.length && (mains || has(/combo/i))) {
      if (!has(/fries|wedges|side|starter/i) && !has(/combo/i)) sug.push(pick(/^(starters|.*sides).*(french fries|wedges)/i)[0] || pick(/french fries/i)[0]);
      if (!has(/beverage|drink|ice tea|laban|water/i)) sug.push(pick(/soft drink/i)[0]);
      if (!has(/dessert/i)) sug.push(pick(/brownie point/i)[0] || pick(/dessert/i)[0]);
    }
    const list = sug.filter(Boolean).slice(0, 3);
    $("#pairs").hidden = !list.length;
    $("#pairsRow").innerHTML = list.map((i) => `<button type="button" class="pair" data-pair="${esc(i.id)}"><img src="${esc(i.img)}" alt="" /><span><b>${esc(tidy(i.name))}</b><i>+${money(i.price)}</i></span></button>`).join("");
  }
  $("#pairsRow").addEventListener("click", (e) => { const b = e.target.closest("[data-pair]"); if (b) addToCart(b.dataset.pair, 1, [], "", b); });

  $("#cartLines").addEventListener("click", (e) => {
    const b = e.target.closest("[data-d]"); if (!b) return;
    const row = b.closest(".cl"), l = S.cart.find((x) => x.key === row.dataset.key); if (!l) return;
    l.qty += +b.dataset.d;
    const done = () => { S.cart = S.cart.filter((x) => x.qty > 0); save("fb.cart", S.cart); renderCart(); refreshRows(l.id); renderAgain(); };
    if (l.qty <= 0 && !reduce) { row.classList.add("leaving"); toast(t("ghosted")); setTimeout(done, 380); } else done();
  });
  $$(".seg button").forEach((b) => b.addEventListener("click", () => { S.mode = b.dataset.mode; save("fb.mode", S.mode); renderCart(); }));
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-br]"); if (!b) return;
    S.branch = b.dataset.br; save("fb.branch", S.branch);
    $("#branchName").textContent = brName(branchById(S.branch));
    renderCart(); renderBranchList();
    if (b.closest("#branchSheet")) closeDlg($("#branchSheet"));
  });
  function openCart() { renderCart(); $("#cart").showModal(); }
  $("#cartBar").addEventListener("click", openCart);
  $("#sendBtn").addEventListener("click", () => {
    const b = branchById(S.branch);
    if (!b) { toast(t("pickFirst")); $("#branchPick").animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "none" }], { duration: 300 }); return; }
    const name = $("#cName").value.trim(), addr = $("#cAddr").value.trim();
    if (S.mode === "delivery" && !addr) { toast(t("needAddress")); $("#cAddr").focus(); return; }
    const w = T[S.lang].wa, out = [w.hi, ""];
    S.cart.forEach((l, k) => {
      const i = S.items.get(l.id);
      out.push(`${k + 1}) ${i.name} × ${l.qty} — ${money(lineUnit(l) * l.qty)}`);
      if (l.opts.length) out.push(`   ${w.adds}: ${l.opts.map((o) => o.name).join(", ")}`);
      if (l.note) out.push(`   ${w.note}: ${l.note}`);
    });
    out.push("", `${w.total}: ${money(cartTotal())}`, `${w.type}: ${S.mode === "delivery" ? w.del : w.pick}`, `${w.branch}: ${b.en}`);
    if (name) out.push(`${w.name}: ${name}`);
    if (S.mode === "delivery") out.push(`${w.addr}: ${addr}`);
    save("fb.customer", { name, addr });
    S.last = { lines: S.cart.map((l) => ({ ...l })), branch: S.branch }; save("fb.last", S.last);
    window.open(`https://wa.me/${b.wa}?text=${encodeURIComponent(out.join("\n"))}`, "_blank", "noopener");
  });

  // ---------- Branches ----------
  function renderBranches() {
    $("#branches").innerHTML = BRANCHES.map((b) => `<div class="branch"><b>${esc(brName(b))}</b><small>${esc(S.lang === "ar" ? b.note_ar : b.note_en)}</small>
      <div class="acts">${b.tel ? `<a href="tel:+${b.tel}">${esc(t("call"))}</a>` : ""}<a class="wa" href="https://wa.me/${b.wa}" target="_blank" rel="noopener">${esc(t("whatsapp"))}</a></div></div>`).join("");
    renderBranchList();
  }
  function renderBranchList() {
    $("#branchList").innerHTML = BRANCHES.map((b) => `<button type="button" data-br="${b.id}" class="${S.branch === b.id ? "on" : ""}"><b>${esc(brName(b))}</b><small>${esc(S.lang === "ar" ? b.note_ar : b.note_en)}</small></button>`).join("");
  }
  $("#branchChip").addEventListener("click", () => $("#branchSheet").showModal());

  // ---------- Swipe deck ----------
  const DECK_FILTERS = [["all", () => true], ["combos", (i) => /combo/i.test(i.cat)], ["burgers", (i) => /burger|zinger/i.test(i.cat)], ["fit", (i) => i.protein || FIT_CATS.test(i.cat)], ["sweet", (i) => /dessert/i.test(i.cat)]];
  let deckF = "all", deck = [], deckIdx = 0;
  function openDeck() {
    buildDeck(); $("#deck").showModal();
  }
  function buildDeck() {
    const f = DECK_FILTERS.find(([k]) => k === deckF)[1];
    const pool = [...S.items.values()].filter((i) => i.price > 1 && !i.out && f(i));
    // shuffle, but combos and fan favourites early
    deck = pool.map((i) => [Math.random() - (/combo/i.test(i.cat) ? 0.4 : 0), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    deckIdx = 0;
    $("#deckFilters").innerHTML = DECK_FILTERS.map(([k]) => `<button type="button" data-df="${k}" class="${k === deckF ? "on" : ""}">${esc(t(k))}</button>`).join("");
    drawDeck();
  }
  $("#deckFilters").addEventListener("click", (e) => { const b = e.target.closest("[data-df]"); if (b) { deckF = b.dataset.df; buildDeck(); } });
  function cardHtml(i, behind) {
    return `<div class="dcard ${behind ? "behind" : ""}" data-id="${esc(i.id)}">
      <img src="${esc(i.img)}" alt="" draggable="false" /><span class="dprice">${money(i.price)}</span>
      <span class="stamp yes">Match</span><span class="stamp no">Ghost</span>
      <div class="info"><h3>${esc(tidy(i.name))}</h3>${i.desc ? `<p>${esc(i.desc)}</p>` : ""}${tagsHtml(i)}</div></div>`;
  }
  function drawDeck() {
    const st = $("#deckStack");
    if (deckIdx >= deck.length) {
      st.innerHTML = `<div class="deck-done"><div><b>${esc(t("deckDone"))}</b><p>${esc(t("deckDoneSub"))}</p></div><button class="btn btn-ink" type="button" id="deckAgain">${esc(t("restart"))}</button></div>`;
      $("#deckAgain").onclick = buildDeck; return;
    }
    st.innerHTML = (deck[deckIdx + 1] ? cardHtml(deck[deckIdx + 1], true) : "") + cardHtml(deck[deckIdx], false);
    bindDrag($(".dcard:not(.behind)", st));
  }
  function bindDrag(card) {
    let x0 = 0, y0 = 0, dx = 0, dy = 0, drag = false;
    const yes = $(".stamp.yes", card), no = $(".stamp.no", card);
    card.addEventListener("pointerdown", (e) => { drag = true; x0 = e.clientX; y0 = e.clientY; card.setPointerCapture(e.pointerId); card.style.transition = "none"; });
    card.addEventListener("pointermove", (e) => {
      if (!drag) return;
      dx = e.clientX - x0; dy = e.clientY - y0;
      card.style.transform = `translate(${dx}px, ${dy * 0.3}px) rotate(${dx / 14}deg)`;
      yes.style.opacity = Math.max(0, Math.min(1, dx / 90)); no.style.opacity = Math.max(0, Math.min(1, -dx / 90));
    });
    const end = () => {
      if (!drag) return; drag = false;
      const w = card.parentElement.clientWidth;
      if (Math.abs(dx) > w * 0.28) fling(dx > 0 ? 1 : -1);
      else if (Math.abs(dx) < 6 && Math.abs(dy) < 6) openDish(card.dataset.id);
      else { card.style.transition = "transform .35s cubic-bezier(.34,1.56,.64,1)"; card.style.transform = ""; yes.style.opacity = no.style.opacity = 0; }
      dx = dy = 0;
    };
    card.addEventListener("pointerup", end); card.addEventListener("pointercancel", end);
  }
  function fling(dir) {
    const card = $("#deckStack .dcard:not(.behind)"); if (!card) return;
    const i = deck[deckIdx];
    $(dir > 0 ? ".stamp.yes" : ".stamp.no", card).style.opacity = 1;
    card.style.transition = "transform .4s ease-in";
    card.style.transform = `translate(${dir * 130}vw, -30px) rotate(${dir * 30}deg)`;
    vibrate(dir > 0 ? 25 : 10);
    setTimeout(() => {
      deckIdx++; drawDeck();
      if (dir > 0) {
        addToCart(i.id, 1, [], "", null);
        $("#matchImg").src = i.img; $("#matchName").textContent = tidy(i.name);
        $("#match").hidden = false; hearts($("#matchImg"), 18);
      }
    }, reduce ? 0 : 280);
  }
  $("#likeBtn").addEventListener("click", () => fling(1));
  $("#nopeBtn").addEventListener("click", () => fling(-1));
  $("#infoBtn").addEventListener("click", () => { const i = deck[deckIdx]; if (i) openDish(i.id); });
  $("#keepSwiping").addEventListener("click", () => { $("#match").hidden = true; });
  $("#goCart").addEventListener("click", () => { $("#match").hidden = true; closeDlg($("#deck")); setTimeout(openCart, 280); });
  $("#swipeBtn").addEventListener("click", openDeck);
  document.addEventListener("keydown", (e) => { if (!$("#deck").open || $("#dish").open || !$("#match").hidden) return; if (e.key === "ArrowRight") fling(1); if (e.key === "ArrowLeft") fling(-1); });

  // ---------- Effects ----------
  function hearts(fromEl, n = 8) {
    if (reduce || !fromEl) return;
    const r = fromEl.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    for (let k = 0; k < n; k++) {
      const h = document.createElement("span"); h.className = "heart-burst"; h.textContent = ["♥", "💘", "♥", "🧡"][k % 4];
      h.style.left = x + "px"; h.style.top = y + "px"; h.style.color = ["#e2231a", "#ff9a1a", "#ffc61a"][k % 3];
      document.body.appendChild(h);
      const a = (k / n) * Math.PI * 2, d = 40 + Math.random() * 50;
      h.animate([{ transform: "translate(-50%,-50%) scale(.3)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 30}px)) scale(1.1)`, opacity: 0 }],
        { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.3,1)" }).onfinish = () => h.remove();
    }
  }
  function closeDlg(d) {
    if (!d.open || d.classList.contains("closing")) return;
    if (reduce) { d.close(); return; }
    d.classList.add("closing"); setTimeout(() => { d.classList.remove("closing"); d.close(); }, 240);
  }
  $$("dialog").forEach((d) => {
    d.addEventListener("cancel", (e) => { e.preventDefault(); if (d.id === "deck" && !$("#match").hidden) { $("#match").hidden = true; return; } closeDlg(d); });
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) closeDlg(d); });
  });
  addEventListener("scroll", () => requestAnimationFrame(() => {
    $("#topbar").classList.toggle("solid", scrollY > 30);
    $("#menuBar").classList.toggle("stuck", $("#menuBar").getBoundingClientRect().top <= 72);
  }), { passive: true });

  if ("serviceWorker" in navigator && location.protocol !== "file:") addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  const cust = load("fb.customer", {});
  $("#cName").value = cust.name || ""; $("#cAddr").value = cust.addr || "";
  boot().catch((e) => { console.error(e); $("#menuBody").innerHTML = '<p class="empty">Menu failed to load. Please refresh.</p>'; });
})();
