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

### Gemensam regel för alla matcher, 2026-09-10

Ja/nej/inväntar hämtas från Svenska Lags källtotaler, med match_roster som fallback när totalen saknas (NULL; noll är ett riktigt källvärde). Samma läsregel används i aktivitetssidor, uttagningslistor och mobilens matchlistor. Ja-svar väljer aldrig automatiskt en spelare i laguppställningen. Laguppställning sparas genom selectionDraftStatements för både webb och mobil, alltid med utkastmarkör även när den är tom. Inkommande synk och sparande använder samma matchlås innan utkastkontroll/uppställningsändring, så att en synk inte skriver över ett samtidigt spelarval. Faktisk närvaro förblir separat. Ingen matchspecifik regel eller match-id är hårdkodat i denna logik.

Den äldre mobilens serverkod valde automatiskt ja-svar och skyddade inte tomma utkast; detta är rättat. iOS-källkodens låsta spelarväljare och otydliga ”klara” är uppdaterade; de klientändringarna kräver en ny appinstallation och publiceras inte genom webbdeploy.

## Matchnärvaro 2026-09-10

Orsak till noll spelade matcher: collect letade bara efter ”Fyll i närvaro”.
Matcher använder ”Fyll i laguppställning” och en `.memberlist.match` utan
träningens gruppflikar. Båda varianterna stöds nu, fortsatt endast med uttrycklig
markör för sparad närvaro och kontroll av komplett antal inklusive ledare.
Spelarlistan utesluter ledare; ja-svar används inte som spelad match.
Playwright-fixturer verifierar båda sidvarianterna och avvisar ofullständiga svar.

Återhämtning genomförd: 45 aktiviteter importerade. Källan har 10 registrerade
spelare mot Årsta 4/9, 7 mot Rotebro 4/9 och 15 mot Hammarby 6/9.
Efter import har tio av tolv aktiva Gulspelare 1–3 registrerade spelade matcher
senaste sju dagarna; två saknar registrerat deltagande i detta fönster.
Sju aktiviteter har några namn utan entydig profilkoppling, inklusive Hammarby;
dessa hoppas över. Inga kallelser skickades och ingen närvaro ändrades i källan.
Automatisk worker använder d6d5c35d via match-presence-20260910, timer aktiv.

## Bekräftade personroller 2026-09-10

Användaren bekräftar att Patrick Bretschneider är ledare och att Liv Sehlberg
samt Aliyana Kundi har slutat. De två spelarna är redan active=0. Importen
ignorerar kända inaktiva namn (om ingen aktiv namne finns) samt uttryckligen
bekräftade ledarnamn i settings.svenskalag_non_player_names. Okända namn ger
fortsatt varning. Ingen återaktivering eller borttagning av historik görs.

Produktionsverifiering 2026-09-10 23:06 svensk tid: worker 39b228aa körde färdigt, 45 aktiviteter och unmatched=[] (inga olösta namn). Ledarkonfigurationen är skriven i produktionsdatabasen. Typkontroll, integrationstest och VPS-publicering godkända.

## Gröns matcher i bakgrunden – 2026-09-11

Synken läser nu även F2014-Grön, enbart matcher. Samma schemalagda arbetare
hämtar kalender, kallelsesvar och uttryckligen registrerad närvaro −28/+14 dagar.
Gröns uppställning läses eller publiceras inte av denna utökning. Käll- och
lagvalidering är explicit per lag; Guls utgående uppställningsflöde är oförändrat.
Stabila kalender-id:n återanvänds så en redan importerad match inte dubbleras.

Spelarens gemensamma batteri läser deltagande i alla lag. Vid verifierad
Svenska Lag-närvaro har den företräde framför bevarade matchstatistikrader,
även om deltagandet senare rättats till frånvaro. Guls matchlista ändras inte.

Grön har egen status i `settings.svenskalag_green_sync_status`. Fel där
stoppar inte Guls synk. Saknad/felaktig status, olösta kopplingar eller en
senaste lyckad hämtning äldre än 26 timmar ger en synlig underlagsvarning.

Aktiverad arbetare: `/opt/bsk/sync-releases/match-space-20260911`, tidigare
`/opt/bsk/sync-releases/person-roles-20260910`. Befintlig timer fortsatt aktiv.
Verifierad första import: 16 matcher, nio med registrerad närvaro; ett
registrerat Ella-deltagande och en kallelse hos Grön hittades. En aktivitet
(20028813) har olöst spelarkoppling. Årskontrollen granskade 36 Grönmatcher
och bekräftade en borttagen match (176), utan övriga kalenderavvikelser.
Återgång: återställ symlänken `/opt/bsk/svenskalag-sync` till föregående release.
Importerad historik bevaras vid återgång.

## Synk av Sanktan/träningsmatch och spelform – 2026-09-11

Användaren godkänner genomförande inom Sanktan och träningsmatcher. Collector läser tävlingslänkens stabila id/namn och explicit 7v7/9v9 i namn eller matchbeskrivning. Fem verifierade Sanktan-id:n för Gul/Grön 2026 stöds; nya/okända tävlingar och motstridig spelform flaggas och lämnas orörda. Träningsmatch identifieras från tävlingsnamnet. Utan explicit spelform används lagets standard 7v7, märkt default. Matchtyp och 3 × 20/25 min uppdateras på befintliga match-id:n enligt användarens 60/75-minutersregel. Tävlingsmetadata sparas i settings och batteriet använder explicit format före äldre längdfallback.

Identifierade cuper hoppas över helt i denna hämtning: ingen historisk cupimport eller cupklassificering. Befintliga cupdata raderas inte. Namn med Cup/Cupen prioriteras före Friendly/träningsmatch. Okända namn får aldrig automatiskt Sanktan. Ordinarie synkfönster −28/+14 dagar kvarstår; ingen bred säsongsimport. Verifiering: 183 tester med PostgreSQL, Playwright-fixturer för båda lagen och produktionsbygge godkända. Skarp provhämtning och driftsättning verifieras separat.

## Matchtyp och spelform publicerade och verifierade – 2026-09-11

Webbcommit ac1bbafb5fc6f6f841b1130423b267219ebd439c publicerad, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34566095318. Synkarbetaren kör 630345ca i /opt/bsk/sync-releases/match-types-20260911; tidigare /opt/bsk/sync-releases/match-space-20260911 behålls inklusive dess node_modules som den nya releasen länkar till. Timern är aktiv. Återgång av worker: återställ symlänken till föregående release; nya metadata/rättad matchtyp bevaras.

Skarp synk klar 07.27 Stockholm: Gul 29 aktiviteter, 16 cupmatcher överhoppade, noll okända tävlingar eller olösta namn. Grön 16 matcher, tidigare olöst spelarkoppling i aktivitet 20028813 kvar. Hammarby 6/9, app-id 211, behåller id och är nu traningsmatch, explicit format 9, 3 × 25 min. AIK id 7 är fortsatt seriespel, format 7 (lagets default), 3 × 20 min. Cupmatch id 196 är oförändrad och har ingen ny metadata. Inloggad Hammarbysida visar Träningsmatch · 9 mot 9 · 75 min (3 × 25). Sjumannaformuläret visas inte på verifierade niomannamatcher; formationsplanering för 9v9 är ännu inte byggd.

183 tester med PostgreSQL, Playwright-källfixturer, produktionsbygge, skarp provhämtning och produktionskontroll godkända. Tillfällig lokal testdatabas borttagen. Cupplanen är fortsatt separat, ingen historisk cupimport/rättning utförd. Nuvarande batteri kan fortfarande innehålla redan befintliga historiska cupuppgifter; dessa har inte raderats eller omklassats av denna leverans.
