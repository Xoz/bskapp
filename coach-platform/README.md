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

## Arkitektur

- `src/domain`: ramverksoberoende domäntyper och regler.
- `src/repositories`: gränsen mellan UI/domän och persistens.
- `src/schemas`: Zod-validering vid tillitsgränser.
- `src/data/demo.ts`: realistisk läsmodell för den första körbara produktvertikalen.
- `db/migrations`: normaliserat PostgreSQL-schema. JSONB används bara för diagramobjekt/actions.
- `src/app`: fristående Next.js-skal och produktvyer.

Nuvarande vertikal visar dashboard, 14 fiktiva spelare, 25 övningar, 10 träningspass, säsongsperioder och matchobservation→träningsfokus. Skrivande UI använder ännu demo-läsmodellen; nästa milstolpe kopplar repositories till PostgreSQL och inför riktig auth/RBAC.

## Integrationsstrategi

Rekommendation: flytta båda apparna till ett gemensamt monorepo när kärnflödena är verifierade. Lägg domän, schemas och återanvändbara komponenter i interna paket, men behåll separata deploybara appar tills datamigrering och behörigheter är lösta. Separat API är reservvägen om produkterna behöver olika releasecykler.

## Säkerhet och integritet

Minsta möjliga persondata, lagbaserad åtkomst och privata anteckningar är obligatoriska innan produktion. Barnprofiler ska inte vara publika. Full GDPR-bedömning, gallringspolicy, registerutdrag och personuppgiftsbiträdesbedömning återstår innan verkliga personuppgifter används.

## Verifiering

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
