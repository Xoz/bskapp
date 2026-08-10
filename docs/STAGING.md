# Staging-miljö

> **Läge 2026-08-10:** produktionen kör på VPS med dess lokala Postgres och
> deployas av GitHub Actions. Vercel är endast avsett för Preview/staging;
> automatiska Vercel-deployer från `main` är avstängda i `vercel.json` så att
> VPS och Vercel inte konkurrerar som produktionsmål. Preview saknar fortfarande
> en separat Postgres-`DATABASE_URL`. De oanvända AI- och Turso-hemligheterna är
> borttagna från Vercel. Ett separat Supabase/Postgres-projekt (`bsk-staging`)
> och Google OAuth-redirect kräver fortfarande kontoägarens budget- och
> administratörsbeslut.

Staging låter dig testa nya funktioner mot en driftsatt app **utan** att röra
produktionsdata. Stacken är byggd för det: databasen väljs via
miljövariabler, så staging = en egen branch + Vercels Preview-miljö pekad mot
en separat Supabase-databas.

```
main      → GitHub Actions → VPS/Postgres (produktion)
staging   → Vercel Preview → separat Postgres: bsk-staging (ej skapad än)
```

Ingen kodändring behövs — `lib/db.ts` läser `DATABASE_URL` och `init()`
skapar/migrerar schemat automatiskt vid första anropet. En tom staging-DB
fyller alltså sig själv med tabeller + exempelspelare.

## Engångsuppsättning

### 1. Skapa staging-projektet i Supabase
Supabase Dashboard → New project → `bsk-staging`. Hämta sedan:
Project Settings → Database → Connection string → **Transaction pooler**
(port 6543) → `DATABASE_URL`.

### 2. Sätt miljövariabler i Vercel (scope: **Preview**)
Vercel → Project → Settings → Environment Variables. Lägg till med scope
**Preview** (inte Production), så previews använder staging-DB:n medan
produktionen är orörd:

| Variabel | Värde |
|---|---|
| `DATABASE_URL` | staging-projektets connection string från steg 1 |
| `SESSION_SECRET` | **egen** hemlighet för staging (`openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | samma som prod |

### 3. Vitlista staging-domänen för Google-login
Redirect-URI:n byggs från request-domänen, så staging-domänen måste läggas till
i Google Cloud Console → Credentials → OAuth-klienten → *Authorized redirect URIs*:

```
https://bskapp-git-staging-<ditt-vercel-scope>.vercel.app/api/auth/callback/google
```

(Stabil alias för `staging`-branchen. Hittas i Vercel-deployen under "Domains".)

## Arbetsflöde

```bash
# Jobba mot staging
git checkout staging
git merge main           # eller utveckla direkt på staging
git push                 # → Vercel bygger preview-deploy automatiskt

# Befordra till VPS-produktion när det är testat
git checkout main
git merge staging
git push                 # → GitHub Actions deployar VPS-produktion
```

Branchen `staging` får en **stabil** preview-URL (`...-git-staging-...`) som du
kan dela och testa mot. Varje annan feature-branch får också en egen preview
(med samma Preview-env, dvs. staging-DB:n).

## Bra att veta
- **Dataisolering:** Preview använder `bsk-staging`, Production använder
  `bsk-prod`. De delar inga rader. Testa fritt — radera, lägg in testmatcher,
  öppna rapportering osv. utan att påverka riktiga laget.
- **Schema:** staging-DB:n migreras automatiskt vid första anropet. När du lägger
  till en ny tabell/kolumn/`ALTER` i `lib/db.ts` måste du **bumpa `SCHEMA_VERSION`**
  i samma fil – annars hoppar cold-start-grinden över migrationerna och kolumnen
  skapas aldrig.
- **Nollställa staging:** Supabase Dashboard → SQL Editor → `TRUNCATE` relevanta
  tabeller, eller skapa om projektet och uppdatera `DATABASE_URL`.
