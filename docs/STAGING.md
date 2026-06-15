# Staging-miljö

Staging låter dig testa nya funktioner mot en driftsatt app **utan** att röra
produktionsdata. Stacken är redan byggd för det: databasen väljs via
miljövariabler, så staging = en egen branch + Vercels Preview-miljö pekad mot
en separat Turso-databas.

```
main      → Vercel Production → Turso: bsk (produktion)
staging   → Vercel Preview    → Turso: bsk-staging (testdata)
```

Ingen kodändring behövs — `lib/db.ts` läser `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`
och `init()` skapar/migrerar schemat automatiskt vid första anropet. En tom
staging-DB fyller alltså sig själv med tabeller + exempelspelare.

## Engångsuppsättning

### 1. Skapa staging-databasen i Turso
```bash
turso db create bsk-staging
turso db show bsk-staging --url            # → TURSO_DATABASE_URL
turso db tokens create bsk-staging         # → TURSO_AUTH_TOKEN
```

### 2. Sätt miljövariabler i Vercel (scope: **Preview**)
Vercel → Project → Settings → Environment Variables. Lägg till med scope
**Preview** (inte Production), så previews använder staging-DB:n medan
produktionen är orörd:

| Variabel | Värde |
|---|---|
| `TURSO_DATABASE_URL` | staging-DB:ns URL från steg 1 |
| `TURSO_AUTH_TOKEN` | staging-token från steg 1 |
| `SESSION_SECRET` | **egen** hemlighet för staging (`openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` | samma som prod, eller en separat nyckel |
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

# Befordra till produktion när det är testat
git checkout main
git merge staging
git push                 # → Vercel deployar produktion
```

Branchen `staging` får en **stabil** preview-URL (`...-git-staging-...`) som du
kan dela och testa mot. Varje annan feature-branch får också en egen preview
(med samma Preview-env, dvs. staging-DB:n).

## Bra att veta
- **Dataisolering:** Preview använder `bsk-staging`, Production använder `bsk`.
  De delar inga rader. Testa fritt — radera, lägg in testmatcher, öppna
  rapportering osv. utan att påverka riktiga laget.
- **Schema:** staging-DB:n migreras automatiskt. Lägg bara till nya `ALTER`-rader
  i `lib/db.ts` som vanligt; de körs på både prod och staging.
- **Nollställa staging:** `turso db shell bsk-staging` och rensa tabeller, eller
  skapa om databasen och uppdatera env-varen.
