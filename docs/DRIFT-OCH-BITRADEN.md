# Drift- och biträdesinventering

Status: **måste fyllas i och godkännas av föreningen före verkliga barnuppgifter i Planlinjen**.

Dokumentet är en verifieringslista, inte ett antagande om avtals- eller
kontoinställningar. Ansvarig ska kontrollera uppgifterna i respektive
administratörskonto och länka till föreningens avtal utan att lägga hemligheter i repot.

| Behandling/tjänst | Roll | Region och backupregion | Avtal/underbiträden | Ansvarig/verifierad datum |
| --- | --- | --- | --- | --- |
| VPS + VPS-lokal Postgres för BSK-appen | Drift/biträde beroende på leverantör | Leverantör/region ej verifierad | Databasen lyssnar endast på `127.0.0.1:5433`; avtal, underbiträden och backup saknar beslut | Ej utsedd |
| VPS + Docker/Postgres för Planlinjen | Drift/biträde beroende på leverantör | Leverantör/region ej verifierad | Databasen lyssnar endast på `127.0.0.1:5434`; avtal, underbiträden och backup saknar beslut | Ej utsedd |
| Vercel för framtida BSK-staging | Personuppgiftsbiträde | Ej verifierat | Inga fungerande Preview-deployer eller barnuppgifter; PUB-avtal och underbiträden ej verifierade | Ej utsedd |
| Google OAuth | Inloggningsleverantör/biträde enligt avtal | Ej verifierat | Konfiguration och avtalsroll ej verifierade | Ej utsedd |

## Verifierade tekniska driftfakta 2026-08-10

- VPS: Ubuntu 24.04.4 LTS på KVM, UTC och synkroniserad systemklocka.
- BSK-Postgres kör i containern `bsk-db` och exponeras bara på loopback port
  5433. Planlinjen kör `postgres:17-alpine` i `coach-platform-db-1`, endast på
  loopback port 5434. Apptjänsterna lyssnar också endast lokalt bakom nginx.
- Env-filerna är rootägda med mode 600. Bridge-hemligheten finns i båda
  processerna; utfasade AI-hemligheter är borttagna från VPS och Vercel.
- Planlinjens återställningsprov kördes mot den verkliga VPS-databasen och
  godkändes: dump, temporär återställningsdatabas och identiska radantal i 27
  tabeller. Den temporära databasen och dumpen togs bort av kontrollen.
- Ingen BSK-/Planlinjen-backuptimer, cron-konfiguration eller backupfil hittades.
  Endast operativsystemets paketdatabastimer fanns. Detta är en öppen
  produktionsrisk tills backupfrekvens, kryptering, mål, retention och extern
  lagringsplats är beslutade och implementerade.
- Fail-closed backupverktyg finns i `scripts/backup-vps-databases.sh` och
  `deploy/backup/`. Det kräver en separat `/mnt/bsk-backup`-mount, rootägd
  AES-nyckel samt explicit intervall och retention. Varje snapshot återställs
  till isolerade testdatabaser och tabellantal jämförs innan den publiceras.
  Tjänsten är inte aktiverad eftersom mount, policy och biträde inte är valda.
- UFW rapporterar `inactive`. Databaserna skyddas av loopback-bindning, men
  leverantörens externa brandvägg och övriga publika VPS-tjänster är inte
  verifierade i den här inventeringen. Aktivera inte hostbrandvägg utan en
  granskad regeluppsättning som bevarar SSH-åtkomst.

## Måste beslutas och provas

- Integritetskontakt och incidentväg, inklusive vem som anmäler och informerar.
- Åtkomstlista för tränare, borttagning när uppdrag upphör och regelbunden kontroll.
- Backupfrekvens, kryptering, lagringstid, återställningsmål (RPO/RTO) och region.
- Register över underbiträden och godkända överföringsmekanismer utanför EU/EES.
- Retentiontabell per behandling; först därefter får ett gallringsjobb aktiveras.
- Aktivera den byggda schemalagda och krypterade backupen i den verkliga
  driftmiljön med beslutad
  retention. Planlinjens faktiska VPS-återställningsprov är grönt via
  `npm run db:verify-restore` med `PG_DOCKER_SERVICE=db`, men kontrollens
  temporära dump är inte en beständig backup.
