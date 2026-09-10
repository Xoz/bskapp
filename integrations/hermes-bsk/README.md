# BSK i Hermes

Privat, lokalt MCP-gränssnitt till huvudappens PostgreSQL. Hermes svarar i den
befintliga privata chatten. Ingen separat chattmodell, webbroute eller publik
port. Inga skrivverktyg.

## Verktyg

- `aktiviteter`: hitta lagets matcher och träningar inom ett datumintervall.
- `kallelsesvar`: namn för ja/nej/obesvarat och separat uttagen matchtrupp.
- `status`: lag, svensk tid och effektiva läsbehörigheter.
- `hitta_spelare`: aktiva spelare med giltigt medlemskap i anslutna laget.
- `matcher`: datumavgränsade matcher för laget och dess matchgrupper.
- `spelarutveckling`: senaste sparade utvecklingsbild och färdighetsstatus.
- `traningsnarvaro`: deterministisk sammanställning från lagkopplad Svenska
  Lag-webbsynk, med täckning och separat okänd/saknad närvaro.
- `traningspass`: kontots egna sparade pass och deras övningsinstruktioner.

Hermesnamnen är `mcp__bsk__<verktyg>`. Alla har `readOnlyHint=true`.
Spelartexter är data, aldrig instruktioner. Verktygen instruerar Hermes att
inte lägga spelaruppgifter i långtidsminne eller vidarebefordra till andra
kanaler. Detta är en agentinstruktion, inte en teknisk lagringsspärr i Hermes;
vanlig sessionshistorik och modellbehandling gäller även här.

## Åtkomst

`views.sql` skapar endast ett separat integrationsschema och dess behörigheter.
Det ändrar inga verksamhetstabeller. `binding` binder installationen till ett
verifierat BSK-konto och ett uttryckligt lag. Den separata databasrollen får
bara SELECT på en bestämd lista skyddade vyer, ingen åtkomst till bastabeller,
nycklar, användarmejl, delningstokens, hälsoanteckningar eller råa samtal.

Vyerna följer BSK:s rollstandarder och permission-overrides i `lib/auth.ts`
(active, staff, admin, gruppåtkomst och ärvning från föräldragrupp). Även admin
begränsas till integrationslaget. Träningspass kräver `manage_evaluations`
och rätt `created_by`, enligt `lib/training/actions.ts`. Aktuell behörighet
kontrolleras vid varje anrop; ett inaktiverat konto eller borttagen
lagbehörighet slår igenom utan omstart. SQL är parameteriserad och fast.

Ett separat SQL-läslager används eftersom appens befintliga funktioner
förutsätter Next-session och dess databasmodul även kan initiera schema.
Domänfält och behörighetsregler följer huvudappen. När auth eller datamodell
ändras måste denna adapter granskas samtidigt. `skills.json` är en genererad
etikettkarta från `lib/skillTrappan.ts`; regenerera den vid ändrad taxonomi:

```sh
node_modules/.bin/tsx -e 'import {SKILLS} from "./lib/skillTrappan.ts"; console.log(JSON.stringify(Object.fromEntries(SKILLS.map(s=>[s.id,s.title])),null,2))' > integrations/hermes-bsk/skills.json
```

## Närvarons avgränsning

Endast `development_activities.external_source=svenskalag_browser`, träning,
rätt `group_id` och deltagarrader med samma källa. Äldre importer saknar ibland
lagkoppling och kan överlappa. De ingår inte. Svaret redovisar datumintervall,
antal källaktiviteter, senaste källuppdatering, present/absent/unknown och antal
aktiviteter utan deltagarrad. Procent = present / (present + absent). Utan
kända registreringar returneras null. Det är aldrig en ranking eller ett
påstående om komplett historisk närvaro. Framtida närvaro avvisas.

## Installation och verifiering

Kör i en separat stagingkatalog på VPS med egen Python 3.12-miljö. Låsta
beroenden med hashes finns i `requirements.lock`. Återanvänd inte Hermes
Pythonmiljö för serverns beroenden.

1. `uv venv .venv --python 3.12` och `uv pip sync --python .venv/bin/python requirements.lock`.
2. `.venv/bin/python test_integration.py`: isolerad temporär PostgreSQL-databas
   och roll med syntetiskt innehåll. Tolv testfall, inklusive MCP-protokoll,
   nekat lag/ägarskap, återkallad behörighet, SQL-injektion och förbjudna
   databasoperationer även när klientens read-only-inställning slås av.
   Testdatabas, roll och privat anslutningsfil tas bort i `finally`.
3. Verifiera rätt konto/lag i produktion. Kör `install.py --user-id ID --group-id ID`
   som root. Första installationen avbryts om en installation redan finns.
4. `.venv/bin/python smoke.py` provar den verkliga processen som `bsk-hermes`
   och alla verktyg. Den skriver bara antal/status, inga spelaruppgifter.
5. Lägg följande i **enbart privata profilens** `mcp_servers`, med skyddad
   backup och kontroll att övriga konfigurationsvärden bevaras:

```yaml
bsk:
  command: /opt/bsk/hermes-mcp/launch.sh
  timeout: 30
  trust: untrusted
  tools:
    include: [status, hitta_spelare, matcher, spelarutveckling, traningsnarvaro, traningspass, aktiviteter, kallelsesvar]
    resources: false
    prompts: false
```

Kontrollera registrering och anrop genom Hermes egna verktygsregister. Gör
sedan en varsam omstart av bara privata gatewayen (SIGUSR1 till huvudprocessen
använder Hermes dräneringsväg) och verifiera att den är redo och Photon ansluten.
En vanlig fråga via Hermes ska hämta verktygsdata och ge svar, utan att testet
skickar externa meddelanden.

## Drift och återställning

- Aktiv länk: `/opt/bsk/hermes-mcp` → versionskatalog under `hermes-mcp-releases`.
- Process: separat OS-användare `bsk-hermes`, utan inloggningsskal. Startas via
  stdio av Hermes. `env -i` tar bort Hermes miljönycklar före processstart.
- Enda databashemligheten: `/etc/bsk-hermes/connection.json`, root:bsk-hermes,
  0640 i katalog med 0750. Inga hemligheter på Mac, i repo eller anteckningar.
- PostgreSQL: `bsk_hermes_read`, ingen superuser/rolldelegering/BYPASSRLS.
  Standard read-only, fem sekunders frågetimeout. Databasen är redan lokalt bunden.
- Ingen BSK-apprelease, appomstart, schemaläggning eller Discord-ändring krävs.

Uppdatera genom ny versionskatalog och låst miljö, provkör, växla länken
atomiskt och ladda om privata Hermes-gatewayen. Schemaändringar kräver en
separat granskad migration; kör inte första installationsskriptet igen.

Återställning: ta bort enbart `mcp_servers.bsk` från privata konfigurationen,
ladda om privata gatewayen. Detta räcker för att stänga av funktionen. För
full avinstallation, stoppa kvarvarande MCP-processer och kör som databasägare
`DROP SCHEMA bsk_hermes CASCADE; DROP ROLE bsk_hermes_read;` efter verifiering av
beroenden. Ta därefter bort anslutningsfilen och tjänstens egen länk/release.
Inga verksamhetsdata ska raderas och den ordinarie BSK-appen påverkas inte.

## Verifierad installation 2026-09-10

- Release `/opt/bsk/hermes-mcp-releases/20260910T192839Z`, konto 1, Gul (grupp 2).
- Nio isolerade integrationstester godkända. Verklig stdio kontrollerade alla
  sex verktyg: 13 aktiva Gulspelare, sju kommande matcher, åtta källträningar
  under standardperioden och noll egna sparade träningspass vid kontrollen.
- Verksamhetstabellernas antal oförändrade under installationen: 67 spelare,
  144 matcher, noll träningsplaner och en utvecklingscheckpoint. Parallellt
  verksamhetsarbete förekommer; detta är en installationskontroll, inte ett
  löfte om att databasen står still.
- Produktionsrollen verifierad utan SELECT/UPDATE på bastabellen players,
  med SELECT på integrationsvyn. Inga tillfälliga testdatabaser/-roller kvar.
- Hermes registrerade och anropade BSK med `trust: untrusted`. Ett kompatibilitetsfel
  i Hermes läste bara SDK v1-fältet `readOnlyHint`; SDK v2 använder
  `read_only_hint`. Befintliga `mcp_field` används nu för SDK-objekt och båda
  nyckelformerna stöds i cache-dict. Endast boolean true godtas. Saknad/falsk
  märkning kräver fortsatt godkännande. Tolv trust-tester passerade; den nya
  regressionen reproducerade felet före rättningen. Lokal Hermes-commit
  `69ce2950d6f9733a8740b71b557142421eadbca9` på VPS, ingen upstream-push.
  Bevara rättningen vid Hermes-uppdatering tills upstream innehåller motsvarande.
- Privat gateway laddad om och Photon återansluten. Discord-gatewayens PID
  oförändrad och dess profil saknar BSK. Befintlig PeptiQ-konfiguration bevarad.
- Vanlig frågetext genom Hermes CLI:s agent, med BSK först registrerat och
  endast `mcp-bsk` valt, gav rätt nästa match med datum/tid/motståndare/länk
  (kontrollsession `20260910_193832_19a237`). CLI:s explicita dynamiska toolset
  måste registreras före dess flaggval; en första kontroll utan registrering
  hade inga BSK-verktyg och svarade korrekt att uppgiften inte kunde hämtas.
  Gatewayen gör sin MCP-registrering vid start. Inget testmeddelande skickades
  till Photon/Discord; omstarten gav Hermes vanliga startnotis.
- Privat SOUL har BSK-regler för färska uppgifter, källavgränsning och minimering.
  Nya instruktioner följer Hermes vanliga sessions-/promptcachelivscykel.
- Konfigurationsbackup: `/root/backups/hermes-pre-bsk-mcp-20260910T192949Z.yaml`.
  SOUL-backup: `/root/backups/hermes-soul-pre-bsk-20260910.md`.
  Kodbackup före SDK-rättning: `/root/backups/mcp_tool_registration-pre-bsk-sdk2.py`.


## Kallelsesvar – utökning 2026-09-10

Version 1.1.0 har åtta verktyg. `aktiviteter` hittar rätt match/träning;
`kallelsesvar` tar exakt ID (`match:7` eller `training:<aktivitets-id>`).
Flera möjliga aktiviteter ska preciseras, inte väljas godtyckligt.

Matchsvar läses från `match_roster.callup_status`; träningens äldre fältnamn
`development_activity_callups.attendance_status` avser här kallelsesvar:
present→ja, absent→nej, unknown→obesvarat. Faktisk närvaro läses aldrig för
att gissa vilka som kommer. `selection_status=selected` ger en separat lista;
en uttagen spelare som tackat nej visas i båda kategorierna så konflikten syns.

Behörigheten följer den lagavgränsade aktiviteten. En gästande spelares namn
får visas i Guls kallelse, men det ger ingen åtkomst till gästens privata
utvecklingsprofil eller andra lags aktiviteter. Matchgrupper under Gul ingår.
`view_matches` krävs för aktivitetsåtkomst och `view_players` för namn.

Svaret jämför de kopplade namnen med matchens källtotaler eller
`development_activity_callup_summaries`. Saknade totaler, skillnader och
trunkering redovisas. Ingen tom/ofullständig lista får beskrivas som att alla
har svarat eller att ingen kommer. Radändringstid är inte ett löfte om en
helt aktuell synk. Länken leder till matchen eller appens Idag-vy för träning.

`callups.sql` är en additiv migration med två skyddade vyer och SELECT-grants.
Den körs efter `views.sql` även vid första installation. Ingen verksamhetsdata
eller befintlig vy ändras. Release `/opt/bsk/hermes-mcp-releases/20260910T194836Z`.
Tolv isolerade DB-/MCP-tester passerade; verklig stdio och Hermes-dispatch
verifierar match och träning. Alla verktyg är fortsatt skrivskyddade.

Återgång: återställ tidigare kodlänk och ta bort `aktiviteter`/`kallelsesvar`
från endast BSK:s tool-allowlist, ladda om privata gatewayen. De två oanvända
vyerna kan ligga kvar; för full borttagning, släpp `bsk_hermes.callups` först,
sedan `bsk_hermes.events`. Ingen verksamhetsdata berörs. Konfigurationsbackup:
`/root/backups/hermes-pre-bsk-callups-structural-20260910.yaml`.

Vanlig Hermes-fråga om antalet ja-svar till nästa träning verifierades i
kontrollsession `20260910_195043_dce43b`: korrekt antal, datum och tid.


## Automatiska matchrapporter – 2026-09-10

Privata Hermes schemalägger en rapport 24 timmar före varje kommande Gulmatch
(inklusive undergrupper). `schedule_matches.py` läser 60 dagar framåt var femte
minut och skapar Hermes egna engångsjobb. Tiden beräknas i UTC från svensk
avsparkstid; otydlig/saknad tid ger en privat varning när listan ändras.
`match_report.py` hämtar färska BSK-uppgifter vid utskicket och skriver färdig
svensk text. `no_agent=True` levererar texten utan språkmodell; tom stdout är tyst.

Rapporten innehåller sparad formation/startuppställning, övriga uttagna,
ja/nej/obesvarat per uttagen samt alla namngivna kallelsesvar. Placering på planen
kräver sparade x/y-koordinater. Utan sådan data står det att startuppställning
saknas. Uttagna utan ja-svar markeras för kontroll av reservbehov; ingen reserv
kallas automatiskt. Bristande namntäckning/källtotaler redovisas.

`lineups.sql` körs efter `callups.sql` och lägger till två skyddade läsvyer;
matchvyn utesluter nu inställda matcher. Kräver aktuell BSK-databas med
`matches.cancelled`, `formation` och match_roster-fälten för sparad placering.
Ingen verksamhetsdata skrivs av integrationen.

### Privat drift

- Release: `/opt/bsk/hermes-mcp-releases/20260910T204301Z`.
- Hermes-skript: `/root/.hermes/scripts/bsk_match_reconcile.py`, importerar
  `schedule_matches.main` från den aktiva releasen och Hermes installation.
- Skyddad konfiguration: `/root/.hermes/bsk-match-reports/config.json`, mode 0600,
  med `enabled` och privat `deliver`. Mottagaren hämtades från befintlig privat
  morgonbriefing; den finns inte i källkod eller dokumentation.
- Tillstånd: samma katalog, `state.json`, endast match-ID/avspark/jobb-ID.
  Lås och atomisk skrivning skyddar samtidiga uppdateringar.
- Huvudjobb: `f9134f3be3d2`, “BSK – schemalägg matchrapporter”, var femte minut,
  `no_agent=True`, privata `deliver`/`failure_deliver`. Engångsjobben har prefix
  `BSK 24h – ` och egna genererade skript under Hermes scripts-katalog.
- Sju rapporter planerade vid aktivering. Första: 2026-09-11 09:00 Europe/Stockholm.
  Befintlig morgonbriefing och träningskallelse bevarades. Ingen gatewayomstart.

Flyttade/inställda matcher pausas vid nästa kontroll. Rapportskriptet verifierar
avspark och matchstatus igen vid körning; en gammal tid ger ingen text. Matcher
som upptäcks med mindre än 24 timmar kvar får en sen rapport före avspark.
Hermes engångsjobb som aldrig hann köras får motsvarande återhämtning. Jobb med
registrerad körning/okänd leverans upprepas inte blint: Hermes beständiga
leveranskö undviker dubbelsändning men garanterar inte leverans vid alla fel.
Körfel rapporteras privat. Ordinarie tick kan fördröja utskick omkring en minut.

För att stoppa funktionen: sätt `enabled=false` i privat konfiguration, pausa
huvudjobbet och samtliga ännu aktiva jobb med prefix `BSK 24h – ` genom Hermes
jobb-API. Att enbart pausa huvudjobbet stoppar inte redan skapade rapporter.
För kodåtergång, växla även integrationslänken till föregående release
`20260910T194836Z`; läsvyerna kan ligga kvar. Cron-backup före aktivering:
`/root/backups/hermes-cron-pre-bsk-matches-20260910T204345Z.json`.
Återställ inte hela cron-filen över senare ändringar från andra uppgifter.

Verifiering: 13 isolerade DB/MCP-tester och 6 schemaläggnings-/rapporttester
passerade. De senare provar även Hermes riktiga jobb-API i en separat temporär
profil, omplanering, dubblettskydd, sena matcher, sommartid och ofullständig
uppställning. Produktionsförhandsvisning validerad utan testutskick; körning
före rapporttiden gav tom text. Två kontroller skapade inga extra jobb.


### 2026-09-10 – rättad träningsautomatik och gemensam mobilmottagare

Hermes befintliga träningsjobb `aaea810f152f` behölls och rättades på användarens
uppdrag. Det kontrollerar nu alla dagar varje minut och skickar cirka 15 minuter
före den faktiska träningstiden. `training_report.py` använder svensk tidszon,
läser behöriga aktiviteter och kallelsesvar och visar ofullständig namntäckning.
`training_alert.py` hindrar upprepning per aktivitet/starttid med låst, atomiskt
sparat tillstånd utan spelaruppgifter. Flera samtidiga träningar ingår i samma
utskick. Flyttad tid kontrolleras igen före rapportbyggandet; ingen rapport efter
start. Vid kort driftavbrott kan rapporten komma senare inom 15-minutersfönstret.
Saknad/ogiltig starttid kan inte tidsättas och hoppas över.

Tidigare skript hade felkodad emoji (reproducerat UnicodeEncodeError), fast UTC+2,
begränsat vardagsschema och ingen egen historik över rapporterade aktiviteter.
Fem syntetiska regressionstester passerade för UTF-8, helg/udda tider, vintertid,
midnatt, flyttad tid, samtidiga aktiviteter, omstart/dubbletter och trunkering.
Den nya VPS-wrappern verifierades tyst mot produktion utan testmeddelande.

Både träning och match använder nu exakt samma explicita privata Photon-mottagare
som matchrapporterna/morgonbriefingen. Detta är mobilens Meddelanden via iMessage,
inte en separat operatörs-SMS-tjänst. Mottagarvärden finns endast i privat VPS-konfiguration.
Nästa träningsrapport planerad omkring 2026-09-14 kl. 18.15 svensk tid, inför
träning kl. 18.30. Matchrapporterna behåller 24 timmars framförhållning.
Release: `/opt/bsk/hermes-mcp-releases/20260910T205637Z`.
Backup av tidigare träningsskript och jobb:
`/root/backups/bsk-training-before-fix-20260910T205719Z`.

Träningshistorik finns i `/root/.hermes/bsk-training-reports/state.json` och
rensar äldre än sju dagar. Den skrivs före överlämning till Hermes leveranskö:
vid fel exakt däremellan kan rapporten utebli, men okänd leverans upprepas inte
blint. Körfel går till samma privata mottagare. Pausa träningsjobbet för att
stoppa träningsutskick; matchjobben hanteras separat enligt integrationsguiden.
