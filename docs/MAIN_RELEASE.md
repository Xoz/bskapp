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


## Matchkontroll publicerad 2026-09-10

Huvudappen är publicerad från `3ffc3b8c2bafd1a85024e34ec0541cd61f59ac6d`:
https://github.com/Xoz/bskapp/actions/runs/34525351050 (godkänd).
Synkarbetaren är `d4c74436`; full körning 22.10 svensk tid gav 45 aktiviteter och
66 kontrollerade importerade Gulposter, med tre bekräftade borttagningar.
Hammarby 12 september, Vaxholm 30 augusti och gamla Värtan 29 augusti är inaktiva.
Idag och Matcher döljer dem; direktlänken till Hammarby anger borttagen i Svenska Lag.
Idag verifierad i publicerad app: AIK 12 september 09.00 och Örby 16.30, båda med
10 kallade/10 ja, separat från uttagna 8 respektive 6. Kallelsernas läskälla är nu
korrekt även i aktivitetslistan och aktivitetsdetaljen. 143 tester, typkontroll,
produktionsbygge, Playwright-kontroll och publiceringskontroll godkända.
Kompletterande kalenderkontroll av 40 importerade Gulposter från 2025 gav inga
borttagnings- eller datum-/tidsavvikelser. Historiska cupgrupper, cupaktiviteter och
manuella poster återstår att normalisera. Grön är inte inventerat på samma sätt.
Se `docs/MATCH_AUDIT_2026-09-10.md` för resultat och avgränsningar.


## 2026-09-10 – AIK: ja-svar tydligt skilda från laguppställning

Direktkontroll i Svenska Lag gav 10 spelare + 1 ledare som tackat ja till AIK 12 september. Appens källtotal och 10 spelarposter stämmer; 8 avser laguppställningen. Användaren uppfattade startsidans ”8 uttagna”/”8 klara” som fel antal ja. Publicerad rättning `47e44428` visar ”10 har tackat ja i Svenska Lag” främst på Idag och i uttagningsvyn; 8 markerade i laguppställningen visas separat. Varningar anger uttryckligen uppställning respektive ja-svar. Inga val, svar eller kallelser ändrades. Typkontroll, produktionsbygge och inloggad kontroll av båda vyerna godkända. Publicering: https://github.com/Xoz/bskapp/actions/runs/34525751849.


## 2026-09-10 – permanent gemensam matchlogik

På användarens begäran är reglerna nu samlade för befintliga och nya matcher, utan AIK-specifik logik. `activityCallups.ts` delar källräkningen mellan aktivitetssidor, webbens uttagningslista och mobilens match-/uttagningslistor. NULL-total får fallback till match_roster, medan noll behålls som källvärde. Den redundanta överskrivningen i getSelectionWorkspace är borttagen.

`selectionDraftStatements` används av webb och mobil. Äldre trupp-/cupformulär använder samma skydd genom `selectionDraftGuardStatements`. Ja-svar auto-väljer aldrig spelare. Alla utkast, även tomma, skyddas mot synk. Inkommande synk tar matchlåsen i id-ordning före verksamhetsskrivning; browserläsningen sker före transaktionen. Kallelser och faktisk närvaro ändras inte av spelarval. Mobilens listor döljer inaktiva matcher.

Webb/server publicerat från `3e1279e655fa6384bff9cfce4a31f5744b666955`, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34527033441. Synkarbetare `a7ca6f69` körde klart 22.32 svensk tid: 45 aktiviteter, 66 Gulposter granskade, samma tre bekräftade borttagningar och fyra sedan tidigare delvis okopplade träningsaktiviteter. Efter synk: AIK 10 ja/8 i uppställningen, Örby 10 ja/6 i uppställningen. Bekräftat i databasen, publicerad webb och produktionsserverns mobila läsmodeller.

146 tester passerade: flera matcher, noll/saknad källtotal, svar som ändras utan ändrade spelarval, tomt utkast över synk, separata närvarorader samt kompletta mobila SQL-frågor. Typkontroll och webbbygge godkända. iOS-klientens låsta spelarval och otydliga etiketter är rättade och simulatorbygget lyckades; en ny iOS-installation är inte utförd och krävs för klientändringarna. Serverrättningen gäller redan.

## Publicerad spelarstatistik – 2026-09-10

Rättningen är publicerad på https://bsk2014.se/spelare, commit bc1f88a0b3a685892d317da6ba968fe1d980df5f. GitHub Actions https://github.com/Xoz/bskapp/actions/runs/34530853762 godkänd; aktiv release /opt/bsk/releases/bc1f88a0b3a6.MjP2TU. Alla 147 lokala tester godkända. Publiceringen genomförde backup, tester, bygge och hälsokontroller. Inloggad spelarlista verifierad med år 2026, Gul inklusive cupgrupper, och nya räknare för spelade matcher/matchkallelser. Detta ersätter tidigare anteckning om att rättningen inte publicerats.

## Matchplan och design publicerad – 2026-09-10

Publicerad commit 16ebe45b2ab8f3926dfca76b5d765e9890d8fcbb. GitHub Actions https://github.com/Xoz/bskapp/actions/runs/34532385619 godkänd. 152 lokala tester och produktionsbygge godkända. Inloggad AIK-match på https://bsk2014.se/matcher/7 verifierad med ny matchplan, fyra formationer, klubbtröjor, separat målvaktsfärg, lediga positioner, klickbara avbytare och spelidépanel. Ljust läge kontrollerat lokalt och mörkt läge i produktion. Placering från avbytarlistan och sparande provat endast med lokala exempelspelare. Inga riktiga matchplaner eller uttagningar ändrades vid kontrollen. Tidigare anteckning om ej publicerad matchplan är ersatt.

## Ja-svar i matchplan publicerat – 2026-09-10

Commit 7451bdef88adb0f666c03e0e646112c213eb5606 publicerad, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34532750201. Formationsverktygets visning och sparande använder samma urval: accepted ELLER selected i match_roster. Inloggad AIK-match verifierad: 11 tillgängliga i matchplanen, befintlig uttagning fortsatt 8. Rubriken är Spelare att placera. 153 tester och bygge godkända. Matchplanstest verifierar ja utan uttagning, nekade övriga spelare och oförändrade kallelser/uttagning. Inga verksamhetsuppgifter ändrades under produktionskontrollen.

## Endast ja-svar publicerat – 2026-09-10

Commit 09449e2658de70dc9432bd0cd6b06309bce46441 publicerad, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34533040176. Matchplanens urval och sparvalidering använder endast accepted. Tidigare OR selected är borttaget. Inloggad AIK-match verifierad: 10 valbara ja-svarande spelare, spelare med nej-svar saknas i formationsvalet. Befintlig laguppställning och kallelsesvar är orörda. 153 tester och bygge godkända.

## Gemensam terminologi publicerad – 2026-09-10

Commit 1e65ca1fb35224b989ec751fce5c0dfd71bd4d0f publicerad i webbappen, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34533538172. Trupp=ja-svarande; laguppställning/uttagen=planerad; deltog=faktisk närvaro; spelarregister=hela spelarbasen. Matchvyer, uttagning, cup, register, inställningar, guide och API-etiketter är anpassade. AIK verifierad inloggat med separat trupp (10) och laguppställning (8). 153 tester, webbbygge och syntaxkontroll av fyra ändrade Swift-filer godkända. Äldre nativekällans texter uppdaterade; ingen ny nativeapp har distribuerats. Inga kallelser, uttagningar eller närvaroposter ändrade av terminologiarbetet. Definitioner fastställda i AGENTS.md.

## Kompakt placering publicerad – 2026-09-10

Commit e393ef2696bee5b37c06707f059e4c0659e82505 publicerad, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34533764459. Positionens stora ruta med dropdown/återställning borttagen. Spelare att placera visas som mindre knappar med små tröjor och kortnamn; fullständiga namn finns kvar för tillgänglighet. Liten textknapp kan ta vald spelare av planen. Typkontroll och publiceringskontroller godkända, inloggad visuell kontroll av AIK-matchen godkänd. Inga matchplaner eller verksamhetsuppgifter ändrade vid produktionskontrollen.

## Matchplanens sparrättning publicerad – 2026-09-11

Commit 179f056df52ff7e1f8b92169a32a0495eab70115 publicerad via godkänd körning https://github.com/Xoz/bskapp/actions/runs/34566757310. Aktiv release /opt/bsk/releases/179f056df52f.maN76h. 188 tester inklusive PostgreSQL samt lokalt produktionsbygge godkända; deployens tester, bygge och hälsokontroller godkända. Inloggad AIK-sida kontrollerad i separat flik; visar ingen sparad matchplan. Nya API-adressen svarar med behörighetsfel utan session som väntat. Ingen riktig matchplan sparad eller ändrad under kontrollen; användarens eventuella osparade sida har inte laddats om. Gamla öppna klienter behöver en omladdning efter att uppställning/texter tagits till vara.

## Kompakt matchplan publicerad – 2026-09-11

Commit 4dd76baf21411722979c8a4aacd9d1f71032731d publicerad via godkänd körning https://github.com/Xoz/bskapp/actions/runs/34567345585. Typkontroll och deployens tester/bygge/hälsokontroller godkända. AIK:s sparade 1-1-4-1 och alla spelidétexter verifierade i inloggad översikt på dator och 390 px mobilbredd. Redigera → tillfällig textändring → Avbryt återställer originalet. Ingen matchdata skriven i verifieringen. Mobilöversikten har 270 px plan och kompakt löptext; formuläret öppnas separat via Redigera.

## Cupavgränsning publicerad – 2026-09-11

Webbcommit 17096239e72236f17355ed0c368820e722465c73 publicerad via https://github.com/Xoz/bskapp/actions/runs/34569810915 (godkänd). Föregående filterkorrigering 79fd8a01 publicerad via godkänd körning 34569683867. 189 tester inklusive PostgreSQL före slutlig JSON-korrigering, riktade tester efter den samt deployens tester, bygge och hälsokontroller godkända. Produktions-SQL och inloggad spelarlista/profil verifierade: Adele 22 matcher i Gul, 26 alla lag utan cuper; batteriet laddar. Listans hjälptext anger nu att cuper räknas separat. 41 cupmatcher och 21 verifierade äldre felklassade cupmatcher undantas. Historik bevarad. Worker exclude-cups-20260911 (61f7bfcb) aktiverad, timer active. Lokal testdatabas borttagen. Se CUP_EXCLUSION_2026-09-11.md för källor, match-id:n, backup och drift.

## Spelarlistans totaler över alla lag publicerade – 2026-09-11

Commit b0d1fbf2 publicerad via godkänd körning https://github.com/Xoz/bskapp/actions/runs/34570052878. Typkontroll, deployens tester/bygge/hälsokontroller samt skarp SQL och inloggad spelarlista verifierade. Karolina visar nu 7 spelade matcher och 9 matchkallelser även med Gul som spelarfilter. Fem av de sju matcherna hör till Grön. Cuper fortsatt undantagna; statistiken i listan gäller innevarande år. Inga deltaganden, kallelser eller lagkopplingar ändrades.

## Procentbatteri publicerat – 2026-09-11

Commit c4cfdf86 publicerad via godkänd körning https://github.com/Xoz/bskapp/actions/runs/34570684190. Typkontroll, 11 riktade procent-/simuleringstester samt deployens tester, bygge och hälsokontroller godkända. Inloggad Idag-översikt visuellt verifierad med kompakta rader och gemensam grön/guld-stapel; Adele visar 100 % nu och 65 % som lägst. Profilen visar samma värden och hopfälld beräkning/justering. Kapacitet 80/125 verifierad i procenttester utan att ändra spelares inställningar. Befintliga varningar om olösta Grön-kopplingar och otydlig målvakt kvarstår och visas.

## Batteri på en rad publicerat – 2026-09-11

Commit 4c2ba43e publicerad via godkänd körning https://github.com/Xoz/bskapp/actions/runs/34571235679 (föregående f76cea9b via 34571112391). Typkontroll och deployens tester, bygge och hälsokontroller godkända. Inloggad datorvy visuellt kontrollerad. Vid 390 px ryms alla tolv rader utan horisontellt överflöde; höjd 44–45 px mot tidigare 76 px. Namn, stapel och procent ligger på en rad. Grön lägstanivå och dämpade diagonala streck fram till nuläget ersätter guldprognosen. Ingen beräkning eller spelardata ändrad.

## Hermes MCP: låneunderlag aktiverat – 2026-09-11

Privata BSK-MCP har nu nio läsverktyg inklusive laneunderlag. Gul är källag och Grön enda mållag; kandidatens åtaganden över laggränser och samma batteriberäkning som appen läses via separat autentiserad GET-route. Kallelsesvar markerar gäster. Gemensam reader bibehåller webbens behörighetskontroll. Inga bastabellgrants eller privata utvecklingsbehörigheter har utökats. Konto, lag och rättigheter kontrolleras vid varje anrop. Hemligheten finns endast i skyddad VPS-fil /etc/bsk-hermes/loans.json.

Webbrelease 43bdf862: https://github.com/Xoz/bskapp/actions/runs/34573456315 (godkänd). Föregående steg bddebe27 och c0b9b9c1 publicerade med godkända kontroller. 209 lokala tester inklusive PostgreSQL före sista textformatteringen, åtta riktade modellerings-/token-/svarstexttester efter, 13 isolerade DB/MCP-tester och tre Python-bryggtester godkända. Produktionsendpoint och faktisk stdio verifierade med nekad åtkomst utan token och rätt kandidatavgränsning. Separat lokal testdatabas borttagen.

MCP-release /opt/bsk/hermes-mcp-releases/loans-20260911, aktiv via /opt/bsk/hermes-mcp. Den återanvänder den låsta Pythonmiljön i 20260910T205637Z som därför måste bevaras. Privata allowlist och agent.system_prompt/SOUL uppdaterade; privata gatewayen omladdad och Photon återansluten. Discordprocessen oförändrad. Backup: /root/backups/bsk-loans-20260911. Återgång: återställ bara ändrade BSK-fält/instruktioner och tidigare kodlänk; ta bort tokenfilen för att stänga läsroutern.

Modellprov med den konfigurerade kimi-k2.6 och motstridig tidigare assistenthistorik visade att råa data inte räcker: modellen räknade fel antal och beskrev kallelsesvar som faktiskt spelande. Därför formar lib/hermes/loanAnswer.ts nu answerText och categoryCounts. Privata Hermes instrueras att återge answerText, utan omräkning eller omskrivning. Senaste observerade modellsvar använde verktyget och återgav rätt grupper och planerade ja-svar. Ingen testfråga skickades till externa mottagare och inget långtidsminne användes; gatewayens ordinarie startnotis förekommer vid omladdning.

Tidsmarginalen är ett synligt antagande (30 min samling + 30 min resa + 10 min pauser), inte verifierad restid. Underlaget varnar fortsatt för Gröns olösta personkoppling och osäker målvaktsfördelning. Kallelser och matchplaner ändrades inte. Full plan och verifieringsverktyg finns i docs/HERMES_LOAN_AUDIT.md och integrations/hermes-bsk/README.md.

Slutligt modellprov godkänt: faktisk mcp__bsk__laneunderlag-dispatch med målmatch-id verifierad, och modellsvar matchar MCP answerText exakt bortsett från hämtningstid. Provet använde motstridig tidigare assistenthistorik och den ordinarie konfigurerade modellen.
