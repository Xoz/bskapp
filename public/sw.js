const CACHE = "bsk-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["/rapportera", "/manifest.webmanifest", "/icon.svg"]))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Next.js-assets — nätverk först. Turbopacks utvecklingsnamn och vissa
  // deploykombinationer är inte säkra att behandla som eviga content-hashar;
  // gammal CSS tillsammans med ny HTML gör gränssnittet helt ostylat.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Rapporteringssidor och GET mot live-API — nätverk först, cache som fallback
  if (
    url.pathname.startsWith("/rapportera") ||
    url.pathname.startsWith("/api/live/")
  ) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
  }
});
