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
- logout som återkallar enhetssessionen.

Servern måste ha native auth-migrationen och routesen deployade. Callback-schemat
i Xcode är `se.bsk2014.app`; serverns `NATIVE_APP_REDIRECT_URI` ska vara
`se.bsk2014.app://auth/callback`.

Appen använder filbaserade lokala köer för observationer och matchutvärderingar,
men har ingen generell offline-databas. Verifiering av signerat Release-bygge,
Google-retur och hela flödet på fysisk iPhone/iPad återstår före App Store-släpp.

## Verifierat 2026-08-20

- Debug simulatorbuild passerar för iPhone 17 Pro med iOS 27.
- Debug simulatorbuild passerar för iPad Pro 13 tum (M5) med iPadOS 27.
- Serverns TypeScript-kontroll och samtliga 32 Vitest-tester passerar tillsammans
  med Apple-klientens första build.
- Den responsiva navigeringen och den nya appikonen ingår i den separata
  UI-leveransen; fysisk enhet och verklig Google-retur återstår.
