/* Demo layer injected into pitch links only (never into the real sites).
 * - "Demo by <name>" strip at the bottom of every page
 * - ordering/WhatsApp turned off: shows a demo notice instead of messaging the restaurant
 * - no offline/service worker in demo links (so nothing keeps working after the link expires)
 */
(() => {
  const CFG = window.__DEMO__ || {};
  const ar = () => document.documentElement.lang === "ar";
  const txt = {
    strip: () => (ar() ? `نسخة تجريبية من ${CFG.nameAr || CFG.name} · ليست للاستخدام العام` : `Demo by ${CFG.name} · not for public use`),
    title: () => (ar() ? "هذه نسخة تجريبية" : "This is a demo"),
    body: () => (ar() ? `الطلبات بتشتغل بعد إطلاق الموقع. صمّمه ${CFG.nameAr || CFG.name}.` : `Ordering goes live once the site launches. Designed by ${CFG.name}.`),
    ok: () => (ar() ? "تمام" : "Got it"),
  };

  // 1) strip
  const strip = document.createElement("div");
  strip.className = "__demo-strip";
  strip.setAttribute("role", "note");
  const paint = () => { strip.textContent = txt.strip(); };
  paint();
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(strip));
  if (document.body) document.body.appendChild(strip);

  // 2) ordering off
  function notice() {
    let d = document.querySelector(".__demo-modal");
    if (!d) {
      d = document.createElement("div");
      d.className = "__demo-modal";
      d.innerHTML = '<div class="__demo-card" role="dialog" aria-modal="true"><b></b><p></p><button type="button"></button></div>';
      d.addEventListener("click", (e) => { if (e.target === d || e.target.tagName === "BUTTON") d.remove(); });
    }
    d.querySelector("b").textContent = txt.title();
    d.querySelector("p").textContent = txt.body();
    d.querySelector("button").textContent = txt.ok();
    (document.querySelector("dialog[open]") || document.body).appendChild(d);
  }
  const isOrderLink = (u) => /wa\.me|whatsapp\.com|^tel:/i.test(String(u || ""));
  const realOpen = window.open;
  window.open = function (u, ...rest) { if (isOrderLink(u)) { notice(); return null; } return realOpen.call(window, u, ...rest); };
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (a && isOrderLink(a.getAttribute("href"))) { e.preventDefault(); e.stopPropagation(); notice(); }
  }, true);

  // 3) no service worker in demo links
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register = () => Promise.reject(new Error("disabled in demo"));
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
    }
  } catch { /* ignore */ }
})();
