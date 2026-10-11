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
- `⌘R` hämtar aktuella uppgifter; `⌘1` och `⌘2` växlar ingång.
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
Fullständigt inloggat produktionsflöde är ännu inte verifierat.

Säkerhetstester: `npm test -- --run lib/desktopAuth.test.ts lib/mobileAuth.test.ts`.
