---
name: project-pwa
description: PWA-implementation för offline-rapportering under match
metadata:
  type: project
---

Appen är konfigurerad som PWA (Progressive Web App) för offline-användning på plan med dålig signal.

**Filer tillagda:**
- `app/manifest.ts` — dynamisk PWA-manifest (hämtar teamnamn/accentfärg ur DB)
- `public/sw.js` — service worker: cache-first för `/_next/static/`, network-first med cache-fallback för `/rapportera/*` och `/api/live/*`
- `public/icon.svg` — app-ikon (fotboll, gul på mörk bakgrund)
- `components/ServiceWorkerRegistration.tsx` — client-komponent som registrerar SW

**Filer modifierade:**
- `app/layout.tsx` — lägger till manifest-länk, Apple Web App meta och SW-registrering
- `next.config.ts` — no-cache-header för `/sw.js`
- `components/LiveTracker.tsx` — offline-kö (localStorage `live-offline-{code}`), flushas automatiskt vid online-event

**Offline-kö (LiveTracker):**
- Vid nätverksfel (TypeError: Failed to fetch) läggs action i `offlineQueue.current` och persisteras i localStorage
- `flushOfflineQueue()` anropas vid `online`-event och vid uppstart
- UI visar röd banner i sticky-headern + "Offline · N i kö" i bottenbaren

**Why:** Appen används på fotbollsplan med sämre signal — händelser fick inte tappas bort.
**How to apply:** Om service worker-cachen ska invalideras: bump `CACHE`-versionen i `public/sw.js` (t.ex. `bsk-v2`).
