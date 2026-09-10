// Network-first: con conexion siempre coge la version mas nueva al momento
// (y va guardando copia); sin conexion cae a esa copia guardada, para que
// Cutfy siga funcionando en el gym sin señal. Los datos reales viven en
// IndexedDB, no aqui.

const CACHE_NAME = "cutfy-cache-v22";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/db.js",
  "./js/util.js",
  "./js/seed.js",
  "./js/days.js",
  "./js/theme.js",
  "./js/timer.js",
  "./js/exercise-options.js",
  "./js/workout.js",
  "./js/history.js",
  "./js/settings.js",
  "./js/weight.js",
  "./js/back-nav.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
