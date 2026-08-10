# Drift- och biträdesinventering

Status: **måste fyllas i och godkännas av föreningen före verkliga barnuppgifter i Planlinjen**.

Dokumentet är en verifieringslista, inte ett antagande om avtals- eller
kontoinställningar. Ansvarig ska kontrollera uppgifterna i respektive
administratörskonto och länka till föreningens avtal utan att lägga hemligheter i repot.

| Behandling/tjänst | Roll | Region och backupregion | Avtal/underbiträden | Ansvarig/verifierad datum |
| --- | --- | --- | --- | --- |
| Supabase/Postgres för BSK-appen | Personuppgiftsbiträde | Ej verifierat | PUB-avtal och underbiträden ej verifierade | Ej utsedd |
| VPS/Postgres för Planlinjen | Drift/biträde beroende på leverantör | Ej verifierat | Leverantör, backup och åtkomstlista ej dokumenterade | Ej utsedd |
| Vercel för BSK-webb | Personuppgiftsbiträde | Ej verifierat | PUB-avtal och underbiträden ej verifierade | Ej utsedd |
| Google OAuth | Inloggningsleverantör/biträde enligt avtal | Ej verifierat | Konfiguration och avtalsroll ej verifierade | Ej utsedd |

## Måste beslutas och provas

- Integritetskontakt och incidentväg, inklusive vem som anmäler och informerar.
- Åtkomstlista för tränare, borttagning när uppdrag upphör och regelbunden kontroll.
- Backupfrekvens, kryptering, lagringstid, återställningsmål (RPO/RTO) och region.
- Register över underbiträden och godkända överföringsmekanismer utanför EU/EES.
- Retentiontabell per behandling; först därefter får ett gallringsjobb aktiveras.
- Återställningsprov i den verkliga driftmiljön. Lokalt Planlinjen-prov är grönt
  via `npm run db:verify-restore` (sätt `PG_DOCKER_SERVICE=db` för Docker-piloten).
