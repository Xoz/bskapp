# Filfri Svenska Lag-synk för Gul

Beslut 2026-09-10: Playwright läser webbens kalender, kallelselistor och sparad
närvaro direkt. Inga Excel-exporter eller filnedladdningar ingår i transporten.
Endast sessionen sparas som en skyddad lokal autentiseringsfil.

## Delar

- `scripts/svenskalag/collect.ts`: läser Guls kalender -28/+14 dagar (även över
  månads- och årsskifte), varje svarsflik och uttryckligen sparad närvaro.
  Läsningen gör inga formulärinlämningar. Ej GET/HEAD blockeras i arbetaren.
- `lib/svenskalag/model.ts`: källa, dataintervall, identiteter och totalsummor
  måste vara giltiga. Ingen tom/partiell lista godtas.
- `lib/svenskalag/import.ts`: transaktion, återkörbar uppdatering. Befintliga
  match-id:n kopplas via `sanktan:<id>`. Saknade matchkopplingar granskas; inga
  matcher skapas genom namnlikhet. Träningar får stabilt käll-id. Äldre träningar
  kan bara kopplas vid en entydig tid inom Gul. Tvetydiga spelarnamn stoppar
  uppdateringen av just aktiviteten.
- `scripts/svenskalag/run.ts`: databaslås, högst tre försök, inga personuppgifter
  eller browserfel i logg. Status/senaste tio körningar i befintlig `settings`.
- `components/SvenskaLagSyncStatus.tsx`: status, granskningspunkter, Hämta nu.
  `lib/svenskalag/actions.ts` kräver `manage_settings`. Kön läses varje minut;
  vanliga hämtningar sker cirka varje timme 06–22 samt 03 (Stockholm).
- `deploy/svenskalag/`: separat systemd-tjänst/användare, 15 min tidsgräns,
  1 GB minnesgräns. Timern aktiveras först efter verifierad provkörning.

## Ägarskap

Kallelsesvar uppdaterar aldrig `selection_status`, `selected_position` eller
coachens truppkälla. Ett ja är aldrig faktisk närvaro. Registrerad närvaro går
till `development_activity_participation`; manuella korrigeringar respekteras.
Matchstatistik raderas inte. Inställda/borttagna aktiviteter raderas inte genom
frånvaro i hämtningen. Automatiskt skapande av nya matcher och fullständig
avstämning av inställda matcher ingår inte i denna första version.

## Drift

Miljöfil `/etc/bsk-sync/sync.env`, root:bsk-sync 640:
`DATABASE_URL` för en separat begränsad DB-roll och `SVENSKALAG_STATE_FILE`
(`/var/lib/bsk-sync/state.json`, 600). Inga värden i Git eller anteckningar.

Tjänsten använder användarnamn/lösenord i `/etc/bsk-sync/credentials.env`
(root:bsk-sync, 640). `auth.ts` återanvänder sessionen och loggar annars in en
gång med de angivna uppgifterna. Inloggningsformuläret är verifierat mot Svenska
Lag. Endast under detta steg tillåts POST till Svenska Lag. Därefter används en
ny kontext som blockerar skrivande anrop. Sessionen sparas atomiskt med 600.
Felaktig inloggning eller extra verifiering ger `login_required`; inga ändlösa
inloggningsförsök eller lösenord i loggen. Interaktiv inloggning finns som fallback.

Använd en egen releasekatalog i `/opt/bsk/sync-releases/`, kör `install.sh`,
provkör `run.ts --now --dry-run` med rätt miljö och användare. Kontrollera
kopplingar/antal. Kör sedan en skarp synk och aktivera timern. Stoppa med
`systemctl disable --now bsk-svenskalag-sync.timer` och stoppa eventuell tjänst.

Webbappen och synktjänsten delar datamodell men kör separat. Vid framtida
schemaändring måste synkens kompatibilitet kontrolleras; den kör inga migrationer.
Browser- och sessionsfiler ska inte exponeras genom webbservern. En ny
Playwright-version kräver motsvarande browserinstallation.

## Verifiering

`npm test` kör valideringstester. Sätt `BSK_SYNC_TEST_DATABASE_URL` till lokal
testdatabas för transaktionstestet; det använder temporära tabeller på en enda
anslutning och testar bevarad uttagning, provkörning, återförsök och ogiltig data.
Komplettera med riktig filfri provhämtning och jämför källans totaler före drift.

## Aktuell status 2026-09-10

Automatisk inloggning och filfri hämtning är verifierade. Huvudappen publicerad
via PR #9, commit `6f0b6ace146f4f35c2e563ac20dd7dfe099eb09d`, godkänd körning
https://github.com/Xoz/bskapp/actions/runs/34517570292.
Arbetare `/opt/bsk/sync-releases/0b48e23f`; timern är enabled/active.
Första skarpa synken klar 2026-09-10 21:04 Stockholm: 45 kalenderposter lästa
för 13 augusti–24 september, 23 uppdaterade (9 matcher, 14 träningar), 22 lämnade
orörda. 18 matchposter saknar koppling: 16 den 15–16 augusti, Hammarby 6 september
och Värtan 20 september. Fyra träningar (17, 18, 19 och 31 augusti) har olöst
spelarkoppling. Preliminära final-/bronsmatcher ingår i kalenderantalet; 45 är
inte ett antal säkert genomförda aktiviteter. Dessa kopplingar återstår.
67 spelare, 144 matcher och 0 träningsplaner efter synk; uttagningarnas checksumma
oförändrad. 14 träningsaktiviteter har källan svenskalag_browser.
138 lokala tester inklusive DB-integration godkända; 137 + 1 överhoppat i CI.
Produktionsbygge, datagranskning och hälsokontroller godkända.
Aktiv huvudrelease `/opt/bsk/releases/6f0b6ace146f.KvECoy`; backup före import
`/opt/bsk/backups/main-6f0b6ace146f.8eOL7p`.
Inloggningsuppgifter finns endast i privat VPS-miljöfil, inga värden i dokumentation.
