# Huvudappens publicering

## Förberedd ändring 2026-09-09

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
