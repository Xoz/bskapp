# Planlinjen

Fristående grund för planering, genomförande och uppföljning av barn- och ungdomsfotboll. Produkten är självständigt formgiven och avsedd att senare integreras med BSK-appen.

## Kör lokalt

```bash
cp .env.example .env.local
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Appen öppnas på `http://localhost:3100`.

## Tillfällig VPS-miljö

För en sökvägsmonterad testmiljö byggs appen med `NEXT_BASE_PATH=/coach` och
proxas som `https://klvr.se/coach/`. Variabeln måste finnas både när `next
build` körs och när appen startas; utan den används roten som vanligt.

## Arkitektur

- `src/domain`: ramverksoberoende domäntyper och regler.
- `src/repositories`: gränsen mellan UI/domän och persistens.
- `src/schemas`: Zod-validering vid tillitsgränser.
- `src/data/demo.ts`: kvarvarande demodata för dashboard, planering och matcher.
- `db/migrations`: normaliserat PostgreSQL-schema. JSONB används bara för diagramobjekt/actions.
- `src/app`: fristående Next.js-skal och produktvyer.

Spelare, övningar, träningspass, planering, matcher och analys läses och skrivs i PostgreSQL via server actions/repositories. Pilotlaget väljs server-side med `PILOT_TEAM_ID`, eller det första laget i den lokala pilotdatabasen. I produktion kräver plattformen HMAC-signerade `x-bsk-coach`-headers och `BSK_SESSION_BRIDGE_SECRET`; lokal demoidentitet finns bara utanför produktion. Separat auth och generell flerlag-RBAC ingår inte i MVP:n.

## Integrationsstrategi

Rekommendation: flytta båda apparna till ett gemensamt monorepo när kärnflödena är verifierade. Lägg domän, schemas och återanvändbara komponenter i interna paket, men behåll separata deploybara appar tills datamigrering och behörigheter är lösta. Separat API är reservvägen om produkterna behöver olika releasecykler.

## Säkerhet och integritet

Minsta möjliga persondata, lagbaserad åtkomst och privata anteckningar är obligatoriska innan produktion. Barnprofiler ska inte vara publika. Versionsmärkt spelarutdrag, begränsning, permanent radering och återställningsprov är byggda. Föreningens rättsliga beslut, retentiontabell och personuppgiftsbiträdesbedömning återstår innan verkliga personuppgifter används; se `../docs/GDPR-GRIND.md`.

## Verifiering

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm audit

# Lokal Docker-pilot
DATABASE_URL=postgres://coach:coach@localhost:5434/coach PG_DOCKER_SERVICE=db npm run db:verify-restore
```
