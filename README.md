# BSK F2014 – Spelarutveckling

Webbapp för tränare och föräldrar i BSK F2014 (Bollstanäs SK). Byggd enligt SvFF:s
riktlinjer för barn- och ungdomsfotboll, med fokus på utveckling i stället för resultat.

## Funktioner

- **Tränarutvärderingar** enligt SvFF:s spelarutbildningsplan (16 färdigheter i 5 områden,
  fyra utvecklingsnivåer – inga betyg eller rankningar)
- **Utveckling över tid** – radar- och linjediagram per spelare, jämförelse med föregående utvärdering
- **Matchstatistik** – speltid, mål och assist per spelare; föräldrar kan hjälpa till att registrera
- **Jämn speltid** – automatisk varning när spelare ligger under 75 % av lagets snitt (SvFF: alla spelar lika mycket)
- **Roller** – tränarkod ger full åtkomst, föräldrakod ger enbart åtkomst till matchdelen
- **White label** – klubbnamn, lagnamn, färger och koder byts under Inställningar, så appen
  kan säljas in till andra klubbar och lag

## Kom igång

```bash
npm install
npm run dev        # http://localhost:3000
```

Standardkoder (byt under Inställningar):

| Roll | Kod |
| --- | --- |
| Tränare | `TRANARE2014` |
| Förälder | `BSK2014` |

Truppen innehåller exempelspelare vid första start – byt namn eller ta bort dem under **Spelare**.

## Teknik

- Next.js (App Router) + TypeScript + Tailwind CSS
- Databas via `@libsql/client`: **Turso** i produktion, lokal SQLite-fil (`data/bsk.db`) vid utveckling
- Recharts för diagram
- Sessioner via signerad HTTP-only-cookie
- Design: "Dark Mono Dashboard" – Syne + DM Mono, mörk palett, grain-textur

## Produktion (Vercel + Turso)

Sätt följande miljövariabler i Vercel:

| Variabel | Värde |
| --- | --- |
| `TURSO_DATABASE_URL` | `libsql://<din-databas>.turso.io` |
| `TURSO_AUTH_TOKEN` | Token från Turso |
| `SESSION_SECRET` | Lång slumpsträng, t.ex. `openssl rand -hex 32` |

Utan `TURSO_DATABASE_URL` används den lokala filen `data/bsk.db` (utveckling).
Schemat skapas och migreras automatiskt vid första anropet.

Flytta lokal data till Turso:

```bash
sqlite3 data/bsk.db .dump > dump.sql
turso db shell <din-databas> < dump.sql
```

## Integritet

Appen lagrar barns namn och utvecklingsdata. Tänk på att:

- Bara dela tränarkoden med tränarteamet
- Byta koderna om de sprids
- Köra appen bakom HTTPS i produktion
- Inhämta vårdnadshavares samtycke enligt GDPR innan spelare läggs in
