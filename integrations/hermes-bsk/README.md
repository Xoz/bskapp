# BSK i Hermes

Privat, lokalt MCP-gränssnitt till huvudappens PostgreSQL. Hermes svarar i den
befintliga privata chatten. Ingen separat chattmodell, webbroute eller publik
port. Inga skrivverktyg.

## Verktyg

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
   och roll med syntetiskt innehåll. Nio testfall, inklusive MCP-protokoll,
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
    include: [status, hitta_spelare, matcher, spelarutveckling, traningsnarvaro, traningspass]
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
