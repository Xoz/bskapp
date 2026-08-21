# BSK för iPhone och iPad

Öppna `BSK.xcodeproj` i Xcode. Projektet är universellt (`TARGETED_DEVICE_FAMILY
= 1,2`) och kräver iOS/iPadOS 17 eller senare.

Appen innehåller:

- adaptiv `NavigationSplitView` för iPhone och iPad,
- Google OAuth genom `ASWebAuthenticationSession` och S256-PKCE,
- access- och refresh-token i Keychain med this-device-only-skydd,
- automatisk tokenrefresh,
- adaptiva arbetsytor för Idag, Observera, Utvärdera, Spelare och Uttagning,
- trupp, spelardetalj, utvecklingsmål och aktiviteter från `/api/mobile/v1`,
- skrivande observationer med lokal kö vid nätverksavbrott,
- matchutvärderingar med lokal kö och transparent uttagningsstöd,
- serverstyrt matchcenter med periodklocka, mål, målskytt, ångra och laguppställning,
- Live Activity för samling, avsparksnedräkning och pågående match,
- logout som återkallar enhetssessionen.

Servern måste ha native auth-migrationen och routesen deployade. Callback-schemat
i Xcode är `se.bsk2014.app`; serverns `NATIVE_APP_REDIRECT_URI` ska vara
`se.bsk2014.app://auth/callback`.

Appen använder filbaserade lokala köer för observationer och matchutvärderingar,
men har ingen generell offline-databas. Verifiering av signerat Release-bygge,
Google-retur och hela flödet på fysisk iPhone/iPad återstår före App Store-släpp.

## Versionsnumrering

- Första deploybara nativeversionen är `v0.001` med buildnummer `1`.
- Varje faktisk installation/deploy höjer båda värdena: `v0.002`/build `2`,
  `v0.003`/build `3` och så vidare.
- Simulatorbyggen utan installation räknas inte som deploy.
- Version och build visas under Konto i appen.

## Matchcenter och Live Activity

- Live Activity kan startas när appen öppnas eller synkar inom 45 minuter före
  avspark. Den visar då `SAMLING` och räknar ned till matchstart.
- När matchcentret är öppet hämtas serverns läge var tionde sekund, så ändringar
  från en annan tränare når denna enhets matchcenter och Live Activity.
- Periodklockan fortsätter efter ordinarie periodtid tills tränaren pausar den;
  domarens tilläggstid kapas aldrig automatiskt. I sista perioden avslutas
  matchen uttryckligen med `Avsluta match`.
- När matchen avslutas försvinner den direkt från Idag och visas under
  Utvärdera för spelarbedömning.
- Utvärderingen använder synliga kryssval för nivå, matchpåverkan och orsak;
  inga dropdown-menyer behövs i spelarflödet.
- `Nästa spelare` går alltid att använda; ett ofullständigt svar ligger kvar i
  utkastet och kan slutföras när tränaren går tillbaka.
- Nästa spelare öppnas direkt medan utkastet sparas; klienten blockerar inte
  längre navigeringen utifrån sin lokala bedömning av svarets fullständighet.
- Spelarkortet har egna tydliga åtgärder för `Spara och nästa spelare` och
  `Hoppa över och gå vidare`; båda sparar statusen och öppnar nästa spelare.
- Appen använder ännu inte APNs push-token för Live Activity. Därför kan iOS
  inte garantera exakt automatisk start eller fjärruppdatering om appen är helt
  stängd. Det är ett separat framtida driftsteg.

## Verifierat 2026-08-20

- Debug simulatorbuild passerar för iPhone 17 Pro med iOS 27.
- Debug simulatorbuild passerar för iPad Pro 13 tum (M5) med iPadOS 27.
- Serverns TypeScript-kontroll och samtliga 32 Vitest-tester passerar tillsammans
  med Apple-klientens första build.
- Den responsiva navigeringen och den nya appikonen ingår i den separata
  UI-leveransen; fysisk enhet och verklig Google-retur återstår.
