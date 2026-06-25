# Testprotokoll — liverapportering (livescore + statistikinsamling)

Detta protokoll verifierar hela live-flödet: att matchen kan startas, att
livescore och statistikinsamling fungerar, att byten/speltid räknas, att
föräldrar kan hjälpa till att rapportera, och att behörighetsstyrningen håller.

Körs mot den **lokala dev-databasen** `bskdev` (aldrig produktion).

## Förutsättningar

1. **Lokal Postgres** kör på `localhost:5432` med databasen `bskdev`.
2. **Dev-servern** körs mot bskdev:
   ```bash
   npm run dev          # http://localhost:3000
   ```
   `.env.development.local` pekar dev-servern mot `bskdev` (högre prioritet än
   `.env.local` i utvecklingsläge). Schemat skapas automatiskt vid första anrop
   (`lib/db.ts init()`).
3. Schemat + demospelare finns (dev-servern har startat minst en gång).

## Snabbast: kör det automatiserade protokollet

```bash
bash scripts/test-live.sh
```

Skriptet:
- kontrollerar att dev-servern svarar,
- seedar (`scripts/seed-dev.mjs`) och återställer (`scripts/reset-dev-match.mjs`)
  testmatchen "Dev Testmatch" till ett rent pågående tillstånd,
- loggar in som coach via dev-genvägen `/api/auth/dev?role=coach` (404 i produktion),
- kör alla steg A–N nedan och jämför faktiska värden mot förväntade,
- återställer matchen efteråt (idempotent — kan köras om).

Förväntad utslag: **28 passerade, 0 misslyckade**.

## Manuella steg (samma som skriptet)

Alla anrop går mot `http://localhost:3000/api/live/<id>`. Testmatchens id hämtas
från `seed-dev.mjs`-utskriften (vanligtvis `1`).

### A. Publikt livescore (ingen inloggning)
`GET /api/live/<id>` → returnerar `ourScore`, `oppScore`, `events`, `finished`
men **inte** `players`, `counts`, `subs`, `reporters` (publika lämnar inga
interna detaljer).

### B. Coach-rapportering
`GET /api/auth/dev?role=coach` sätter coach-cookie. `GET ...?reporter=1` returnerar
trupp (10), `hasLineup=true`, 7 på plan, `reportOpen=true`.

### C–K. Coachens matchflöde (POST, JSON-kropp)
| Steg | Åtgärd | Förväntat |
|---|---|---|
| C | `clock start` | `clockRunning=true` |
| D | `event` p1 `goals` | `ourScore=1`, `counts[p1].goals=1` |
| E | `event` p2 `assists` | `counts[p2].assists=1` (ourScore oförändrad) |
| F | `opponent_goal` | `oppScore=1`, ourScore oförändrad |
| G | `sub` p2 ut → bänk in | 7 på plan; bänk in, p2 ut, p1 kvar |
| H | `clock next_period` | `period=2` |
| I | `event` bänk `goals` | `ourScore=2` |
| J | `undo` | `ourScore=1`, `counts[bänk].goals=0` |
| K | `finish_match` | `finished=true`, `clockRunning=false` |

### L. Säkerhet — föräldrarapportör nekas tränaråtgärder
Utan cookie, med `reporterId`: `clock pause`, `finish_match`, `sub` ska alla ge
`403 "Åtgärden kräver tränarbehörighet"`. (Måste köras innan `finish_match`,
annars nekas föräldern redan vid "Rapportering ej öppen".)

### M. Föräldrarapportör — egen registrering + egen ångra
Utan cookie, med `reporterId`: `event` mål → `ourScore` ökar; `undo` med samma
`reporterId` → ångrar **bara den egna** senaste händelsen (scopat per
`reporter_key`).

### N. Rate-limit
40 distinkta händelser (olika spelare+stat) från samma `reporterId` inom 10 s →
max 30 accepterade (HTTP 200), resten `429`. (Identiska händelser within 8 s
slås ihop av fettfinger-dedup, så använd distinkta kombos för att testa just
rate-limit.)

## Bugghistorik (fixade 2026-06-25, commit 346fba2)

Alla tre skulle ha gjort att live-rapporteringen inte fungerade på matchdag:

1. **`reporter_key`-kolumn saknades i prod** — `SCHEMA_VERSION` ej bumpad när
   kolumnen lades till, så `init()` hoppade över migrationen. Varje händelse
   misslyckades (INSERT refererar kolumnen). Fix: bumpa `SCHEMA_VERSION`.
2. **`player_id IS ?` / `reporter IS ?`** i dedup-frågan — SQL:s `IS` tar ingen
   parameter → syntax-fel. Fix: `IS NOT DISTINCT FROM ?`.
3. **`MAX(x, 0)`** i `undoLastEvent`/`deleteMatchEvent` — SQLite-ism, finns ej i
   Postgres. Fix: `GREATEST(x, 0)`.
4. **Tidsbaserat auto-avslut i `getLiveState()`** borttaget — en publik läsning
   kunde annars avsluta en pågående match vid försening/förlängning. Match avslutas
   nu bara via tränarens explicita `finishMatch()`.

## Viktigt vid driftsättning

Prod-DB behöver kolumnen `reporter_key` (läggs till av `init()` när
`SCHEMA_VERSION` är uppdaterad). Den **distribuerade koden** måste deployas till
Vercel för att `IS NOT DISTINCT FROM`/`GREATEST`-fixarna ska gälla — kolumnen
ensam räcker inte.