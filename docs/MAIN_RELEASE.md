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
