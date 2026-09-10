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
  1536 MiB minnesgräns. Timern aktiveras först efter verifierad provkörning.

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

## Nytt kontrakt 2026-09-10 – två riktningar (ersätter tidigare ägarskap)

Användaren har bestämt att Svenska Lag är master för matcher, kallelser och närvaro.
Appen äger ett separat uttagningsutkast. Spara utkast skickar inget; Skicka till
Svenska Lag köar exakt den valda uppställningen. Spelarna kallas därefter i Svenska
Lag via länken i uttagningsvyn. Inga kallelser eller påminnelser skickas av arbetaren.

Inkommande: nya matcher skapas via stabilt id, datum/tid/motståndare/hemma-borta/spelplats
och inställd status uppdateras. Kallelsesvar styr aldrig uttagningskryssrutor.
Kända spelare och källans totaler importeras även om andra spelarkopplingar saknas;
olösta kopplingar rapporteras. Registrerad närvaro har företräde även framför lokal
korrigering. Historiska matchstatistikrader bevaras, men truppvyn använder källnärvaron.
Framtida laguppställning läses separat från närvaro och speglas så länge inget lokalt
utkast pågår. Webbens matchformulär kan inte ändra/radera källstyrda matcher.

Utgående: beständig kö i settings, behörighet och gruppscope på servern, kontroll
av källversionen som visades när formuläret öppnades, matchspecifikt lås, aktuell
uttagning och matchdatum kontrolleras före överföring. Endast före avspark.
Redigeraren ändrar spelare och bevarar ledare/övriga fält; hela källgruppen läses om
precis före sparande. Endast den verifierade adressen för att spara laguppställning
tillåter ett POST-anrop. Resultatet läses tillbaka. Identiskt resultat ger ingen
ny skrivning. Osäker skrivning upprepas inte automatiskt. Svenska Lag erbjuder
ingen atomisk versionskontroll: en ändring mellan sista kontroll och sparande
kan fortfarande ske. Köstatus visar konflikt/fel i stället för att gissa.

Täckning: Guls kalender, fyra veckor bakåt/två framåt. Borttagna kalenderposter
raderas inte automatiskt ur appen; inställd status som syns i kalendern speglas.
Spelaridentitet kräver entydiga namn; flytt till permanenta Svenska Lag-person-id:n
är kvarvarande förbättring. Positioner/formation överförs inte i denna version.

Drift: uppgradera huvudappen (migration 0022), ge bsk_sync INSERT på matches samt
sekvensrättighet och SELECT/INSERT på match_players, installera därefter samma
versions arbetare. Tvåvägskoden testas på feat/svenskalag-bidirectional före drift.


## 2026-09-10 – tvåvägssynk publicerad

Huvudapp: PR #10, commit `13eef7232d06585d92bd4449d216d1b60ac6d0ce`.
GitHub Actions https://github.com/Xoz/bskapp/actions/runs/34520670229 godkänd.
Release `/opt/bsk/releases/13eef7232d06.aE56jI`; backup före import
`/opt/bsk/backups/main-13eef7232d06.e3IFii/bsk.dump`.
Migration 0022 (matches.cancelled) och begränsade DB-rättigheter verifierade.

Aktiv arbetare `/opt/bsk/sync-releases/e9b054d5`, via `/opt/bsk/svenskalag-sync`.
Den använder oförändrade beroenden via node_modules i release 860d763c, som ska
behållas tills beroendena installeras fristående vid nästa uppgradering.
Workerfixar 76a05da4/f02ad5f9/3ac48260/e9b054d5 är separat publicerade efter lokal verifiering;
webbpaketet är fortfarande 13eef723. Timern är enabled/active, körkö avläses varje
minut och ordinarie inläsning cirka varje timme 06–22 samt 03, svensk tid.

Skarp masterinläsning 21:34–21:35 Stockholm: 45 aktiviteter (27 matcher, 18 träningar),
18 nya matcher; matchantal 144 → 162, spelare oförändrat 67. Fem framtida
laguppställningar hämtade. AIK-matchens åtta spelare visas i appen, separat från
tio ja-svar. Fyra historiska träningar har kvar några olösta spelarnamn (17,18,19,31
augusti), men aktivitet, totaler och kända spelare uppdateras.

Första försöket nådde 1 GB-gränsen och avbröts före transaktionscommit. Åtgärdat:
en ny sida per aktivitet, inga bilder/media/typsnitt, ingen bakåtcachning och
begränsat antal renderprocesser. Lyckad körning nådde ca 402 MiB; tak 1536 MiB.
Vid första spegling av tomma tidigare manuella rader ändrades sex ägarmarkeringar
för AIK-matchen till Svenska Lag. Backupkontrollen visade noll manuellt uttagna
före synk och bevarade positioner; ingen tidigare uttagning togs bort.

141 tester inklusive Postgres-integration, typkontroll, produktionsbygge och två
Playwright-prov godkända. Riktiga Svenska Lag-redigeraren verifierad fram till
sparsteget med tillägg/borttagning, utan externa ändringar. Produktionsvyn visar
Spara utkast, Skicka till Svenska Lag och länk till kallelser. Hela köflödet provat i produktion 21:45: appknapp → beständig kö → arbetare →
Svenska Lag-kontroll → synligt lyckat kvitto. Uppställningen var identisk med
källan och krävde därför ingen skrivning till Svenska Lag. Inga kallelser skickades.
Testet fångade och löste äldre iCal-id:n: utgående mål kopplas nu via den kanoniska
utvecklingsaktivitetens Svenska Lag-id. Skarp skrivning av en ändrad uppställning
är ännu inte utförd; den ändrande skrivvägen är verifierad i Playwright-testmiljö.

Svenska Lag är master för matchuppgifter, svar och registrerad närvaro; appen äger
utkast tills publicering. Kallelser skickas i Svenska Lag. Positions-/formations-
överföring, permanenta person-id:n och full avstämning av borttagna poster utanför
kalenderfönstret ingår inte ännu. Ingen atomisk versionskontroll finns på källans
spara-adress; en liten samtidighetsrisk mellan sista kontroll och sparande kvarstår.

### Matchkontroll 2026-09-10

Efter inkommande import körs nu kontroll av Guls befintliga importerade matcher mot hela aktuella årets kalender. Försvunna kalenderposter måste dessutom ha källrubriken ”Aktiviteten är borttagen” innan de döljs. `svenskalag_match_audit` innehåller senaste resultatet; `svenskalag_removed:{id}` anger verifierad borttagning. Historiken bevaras. Idag filtrerar nu samma inaktiva matcher som Matcher. Se `MATCH_AUDIT_2026-09-10.md` för omfattning och kvarvarande historiska kopplingsproblem.
