# BSK för Mac

Gemensam macOS-app för BSK och Spelarutveckling. SwiftUI-fönster med WebKit
visar den aktuella produktionen på `https://bsk2014.se`. BSK öppnar `/idag`,
Spelarutveckling öppnar `/utveckling/` (serverns nuvarande redirect gäller).
Den äldre separata Development-databasen slås inte ihop med huvudappens databas.

## Bygga och öppna

Kräver Xcode med Swift 6 och macOS 14 eller senare. Kör `./macos/build.sh`
från repositoryt. Öppna sedan `macos/dist/BSK.app`; zip finns i samma katalog.
Bygget riktar sig till byggdatorns arkitektur (här Apple Silicon).
Appen är lokalt ad hoc-signerad och sandboxad, inte notariserad för distribution.
För andra datorer krävs separat Developer ID-signering och notarisation.

## Data och inloggning

- Inga databasnycklar, anslutningssträngar eller kopierade spelarregister finns i appen.
- Läsning och skrivning går via samma HTTPS-server och behörigheter som webben.
- Ett beständigt WebKit-datalager delas mellan båda ingångarna.
- Google öppnas via `ASWebAuthenticationSession`, aldrig i en inbäddad Google-vy.
- Befintlig native-start och OAuth-callback används med S256-PKCE. Callback är
  `se.bsk2014.app://auth/callback`, samma som den befintliga Apple-klienten.
- Ny POST `/api/auth/desktop/exchange` förbrukar den kortlivade engångskoden och
  ger ordinarie Secure/HttpOnly-webbcookies. Koden eller verifieraren läggs
  aldrig i en URL, logg eller fil. Ingen extra refresh-token skapas.
- Cookies överförs direkt till WebKits cookie store, aldrig via JavaScript.
- Logga ut med webbens befintliga kontomeny. Det gäller båda ingångarna.
- `⌘R` uppdaterar. `⌘1–4` öppnar Idag, Spelare, Matcher och Träning; `⌘5` öppnar Utveckling.
- Detta är en uppkopplad app, ingen ny generell offlinesynk eller konflikthantering.
  Webbens befintliga funktioner och eventuella offlineköer gäller oförändrade.

## Serverkrav och verifiering

Serverstödet i `app/api/auth/desktop/exchange/route.ts` och
`exchangeDesktopAuthCode` i `lib/mobileAuth.ts` måste publiceras innan
Mac-inloggningen fungerar. Den befintliga native auth-migrationen måste redan
vara installerad. Ingen ny migration eller miljövariabel tillkommer.

Verifiera efter serverpublicering: Google-inloggning, växling mellan ingångar,
att en godkänd ändring syns i vanlig webbläsare, filimport/export, omstart med
bevarad session samt utloggning. Skapa inte testuppgifter för riktiga spelare.
Inloggad läsning och bevarad session är verifierade; skrivprov och filöverföring återstår.

Säkerhetstester: `npm test -- --run lib/desktopAuth.test.ts lib/mobileAuth.test.ts`.

## Publicerat och verifierat 2026-10-11

Serverstödet publicerades som `5d956eee9c3f6684fcf97e3cd32e4a5dbe0e1dd8`.
GitHub Actions körning `38137023264` passerade: 241 tester, produktionsbygge,
datamodellsgranskning, backup och hälsokontroller. 35 DB-tester hoppades över.
Produktionskontroll: login 200, ogiltig kod 401 utan cookies, fel innehållstyp
415 utan cookies, native Google-start 200 med rätt Google-domän.
Mac-appen visade inloggad Idag och Utvecklingsträd med samma session efter
omstart. Inga spelaruppgifter ändrades vid kontrollen. Filimport/export och
fullständigt skrivprov mellan klienter återstår.

Mac-klienten aktiverar sitt fönster före inloggningen och använder en separat
systemstyrd webbläsarsession för Google. Den sparade BSK-sessionen finns kvar
i WebKit mellan appstarter.

## Design 0.002 — Clubhouse

Helt omarbetad Mac-layout med skogsgrön sidomeny, varma pappersytor,
guldaccenter och redaktionell typografi. Navigationen grupperas i Arbeta,
Följ upp och Klubben och följer serverns synliga behörigheter. Konto,
verktyg och utloggning nås längst ned. Ljust och mörkt utseende följer
appens befintliga inställning.

`DesktopShell.swift` äger den inbyggda navigationen och fönstret.
`DesktopTheme.css` ger befintliga webbsidor ett gemensamt Mac-utseende.
`DesktopBridge.js` skickar enbart begränsad navigationsmetadata till Swift;
inget formulärinnehåll, inga cookies eller spelarregister läses av bryggan.
Serverns formulär, kontroller och datalagring används fortsatt.

Verifiering: Release-bygge och lokal signering passerade, fem syntetiska
bryggtester passerade (`node --test macos/bridge-tests/bridge.test.mjs`). Visuell
kontroll av Idag, Spelare, Utveckling, Statistik, kontomeny och befintlig
verktygsdialog. Ljust och mörkt läge kontrollerade. Ingen verksamhetsdata
ändrad. Fullständig kontroll av varje formulär och import/export återstår.

## Kvalitetskontroll 0.003

Dialoger, återöppning, återförsök och filhämtning rättade. Huvudvyer och centrala skrivflöden provade i riktig Mac-app mot separat syntetisk databas. Se `../docs/MAC_QA_2026-10-11.md` för testmatris, resultat och kvarvarande externa kontroller. Inga riktiga spelaruppgifter ändrades.

## Native arbetsflöde 0.004

Mac får ett eget SwiftUI-arbetsbord med verklig sparstatus och kvarvarande matchuppföljningar. Matchens native-steg Förbered/Genomför/Följ upp binder ihop befintliga formulär. Webbens upplevelse utvecklas separat och ändras inte av detta steg. Läsunderlag via sessionsskyddad `/api/desktop/workspace`, samma databas och behörigheter. Se `../docs/MAC_WORKFLOW.md` för arkitektur, tester och avgränsning.
