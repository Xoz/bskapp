# BSK App - Project Context

## Syfte

BSK App ar en Next.js-app for Bollstanas SK F2014 med fokus pa spelarutveckling, matcher, live-rapportering och administration.

## Kallprioritet

1. repots kod och lokala docs
2. `docs/CODEMAP.md`
3. Obsidian-projektsidan `Projects/bsk-app.md`
4. GBrain endast som fallback

## Nuvarande projektlage

- Projektet ar aktivt
- Lokal testmiljo finns for utveckling utan prod-DB
- Flera kanda prioriterade risker finns kring live-idempotens, AI-intervjuer, scope och GDPR
- Utvecklingstrappan (spelarutveckling 7v7->9v9) byggd, integrerad och deployad till VPS 2026-07-09. 12 kategorier, 5 nivaer, individuell checklista per spelare (`/spelare/[id]/utveckling`) och lagvy (`/utveckling`). Se `SPEC-*`-monster saknas har (ingen separat spec skrevs, koden i `lib/skillTrappan.ts` ar kallan).

## Nasta steg

- Hall denna fil och `docs/CODEMAP.md` i sync nar projektets viktiga orienteringspunkter andras
- Spelarens read-only "spelarvy" pa utvecklingstrappan byggd 2026-07-10: `/mitt-utvecklingstrad` (egen route, gated via getPlayerSession, `UtvecklingChecklist` har fatt en `readOnly`-prop). Idé fran anvandaren: eventuellt aterananda samma checklistemonster for sjalva utvarderingen (`utvardera`/SvFF) - inte byggt, endast diskuterat.
- Fraga om att ta bort/flytta pass-/skottstatistik fran spelarniva till lagniva ar medvetet uppskjuten, ror inte utan att anvandaren tar upp det igen
