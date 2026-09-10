# Huvudappens publicering

## Publicerad ändring 2026-09-09

`deploy/main-vps.sh` ersätter den kopplade publiceringen av huvudapp och Coach.
GitHub Actions skickar exakt main-SHA. Servern verifierar SHA mot origin/main och tar ett exklusivt deploylås.
Den tar en komplett databasdump (privat backupkatalog, pg_restore-listkontroll), arkiverar koden i en ny releasekatalog, installerar låsta beroenden, kör tester, bygger och granskar datamodellen.
Först efter godkända kontroller ändras tjänsten via ett systemd-tillägg och `/opt/bsk/current`.
Tidigare kod/build och miljöfil lämnas kvar. Sessionshemligheten måste vara explicit konfigurerad och återanvänds.

Nginx återlämnar exakt `/utveckling` till huvudappens lagträd. `/utveckling/` omdirigerar till denna ingång med 307. Development-API, gamla underadresser/tillgångar och databas finns kvar för senare migrering. Inga gamla uppgifter raderas.
Coach, dess databas och sessionsbrygga ändras inte. Framtida Coach-publicering kräver ett separat, uttryckligt driftsteg tills funktionerna integrerats.

Vid fel efter växling återställs föregående systemd-tillägg, releaselänk och nginx-konfiguration automatiskt. Databasen återställs inte automatiskt; framtida schemaändringar måste ha en egen kompatibilitets-/återställningsplan. Denna release ändrar inget schema.
Backuper och releasekataloger behålls för återställning; ingen automatisk utrensning införs.

## Kontroll efter publicering

- Login svarar, testlogin är 404 i produktion.
- Befintlig användarsession fungerar med samma hemlighet.
- Spelare → utvecklingsträd → samtalsunderlag visas i huvudappen.
- /utveckling och /utveckling/ landar på huvudappens träd.
- Inga testbedömningar eller testsamtal skapas för riktiga spelare.
- Datamängder före/efter kontrolleras. Hela skrivflödet verifieras med exempeldata lokalt.

Vercel Preview saknar separat Postgres enligt STAGING.md och är inte denna produktionsmålmiljö. VPS-build och tester är releasekontrollerna.

## Releaseprotokoll

- PR #6 mergad; produktionscommit `1bc7424411ec724421b6ee67e764ff1a22d61ef7`.
- GitHub Actions: https://github.com/Xoz/bskapp/actions/runs/34342194060 — godkänd.
- Aktiv release: `/opt/bsk/releases/1bc7424411ec.7akujQ`; `/opt/bsk/current` pekar dit.
- Backup: `/opt/bsk/backups/main-1bc7424411ec.rwSNkf/bsk.dump`, filrättighet 600. Återläst till en separat tillfällig databas, 67 spelare/144 matcher verifierade; kontrolldatabasen därefter borttagen. Backupen behålls.
- Föregående tjänst finns i `/opt/bsk/bsk-f2014` på commit 21d995b7. Den checkouten används nu som Git-källa; aktiv huvudappskod finns i releasekatalogen. Återställning sker genom att återställa tidigare systemd-konfiguration och nginx från backupen, inte genom att bara starta om tjänsten.
- 117 tester och produktionsbygge godkända på VPS före växling. Datamodellsgranskning utan blockerande fel.
- Befintliga datavarningar: 9 aktiva spelare saknar primär grupp; en skillnad mellan målhändelser och matchresultat. Dessa data ändrades inte av publiceringen och kräver separat verksamhetskontroll.
- Befintlig Chrome-session fungerade efter release. Huvudappens lagträd, spelarprofil, nya samtalsformulär och fokusformulär verifierade på bsk2014.se.
- Oförändrat före/efter: 67 spelare, 144 matcher, 0 samtal, 0 checkpoints och 2 färdighetsstatusposter. Inga testsamtal eller testbedömningar skapades i produktion.
- Coach och Development-processerna fortsatt aktiva; Coach-databasen fortfarande stoppad och orörd.
- Dokumentationsuppföljningen använder `[skip ci]` för att undvika ett nytt bygge utan kodändring. Ovanstående SHA är den publicerade koden.


## Webbdesign publicerad 2026-09-09

Efter användarens instruktion publicerades designen på https://bsk2014.se, commit `9eacc854d18f3e0e93b6a2e65dd6d11b41c5dfc7`. GitHub Actions https://github.com/Xoz/bskapp/actions/runs/34344433886 passerade tester, produktionsbygge, datagranskning och hälsokontroller. Aktiv release `/opt/bsk/releases/9eacc854d18f.aedBpv`; backup `/opt/bsk/backups/main-9eacc854d18f.yN4Yzv`.

Inloggad Idag-vy och originalmärke verifierade visuellt i produktion. 67 spelare, 144 matcher och 0 samtal efter publicering, samma antal som före ändringen. Inga verksamhetsuppgifter skrivna under kontrollen. iOS fortsatt pausad.

## Gul-flödet publicerat 2026-09-09

PR #8 publicerad på bsk2014.se, commit `1c14f9255b64b42e3a3c686e4036b7d65b54fac4`.
GitHub Actions: https://github.com/Xoz/bskapp/actions/runs/34355120448 — godkänd.
Aktiv release `/opt/bsk/releases/1c14f9255b64.bvLcVu`; backup
`/opt/bsk/backups/main-1c14f9255b64.okXSFY`.
132 tester, produktionsbygge, datagranskning och hälsokontroller godkända.
Befintlig Chrome-session fungerar. Fyra huvudingångar, Gul-förvald matchlista,
matchens nästa steg och uttagningen under matchen verifierade i produktion.
67 spelare, 144 matcher och 0 träningspass före/efter. Inga testuttagningar
eller andra verksamhetsuppgifter skrivna i produktion vid kontrollen.
Träningspassens faktiska lagkoppling återstår; pass är fortfarande personliga.


## 2026-09-10 – Svenska Lag-synk i drift (ersätter tidigare väntestatus)

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
