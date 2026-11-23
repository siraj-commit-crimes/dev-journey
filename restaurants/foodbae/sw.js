// Offline support: the app shell and menu are cached; menu data refreshes from the network when online.
const CACHE = "foodbae-v1";
const SHELL = ["./", "index.html", "styles.css", "app.js", "data/menu.json", "data/promo.json", "img/hero-dish.webp", "img/hero-burger.webp", "img/icon-192.png"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // network first for our own files (fresh prices), cache as fallback; cache first for dish photos
  if (u.origin === location.origin) {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
  }
});
