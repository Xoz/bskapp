# BSK för iPhone och iPad

Öppna `BSK.xcodeproj` i Xcode. Projektet är universellt (`TARGETED_DEVICE_FAMILY
= 1,2`) och kräver iOS/iPadOS 17 eller senare.

Första skalet innehåller:

- adaptiv `NavigationSplitView` för iPhone och iPad,
- Google OAuth genom `ASWebAuthenticationSession` och S256-PKCE,
- access- och refresh-token i Keychain med this-device-only-skydd,
- automatisk tokenrefresh,
- trupp, spelardetalj och aktiviteter från `/api/mobile/v1`,
- logout som återkallar enhetssessionen.

Servern måste ha native auth-migrationen och routesen deployade. Callback-schemat
i Xcode är `se.bsk2014.app`; serverns `NATIVE_APP_REDIRECT_URI` ska vara
`se.bsk2014.app://auth/callback`.

Appen har ännu ingen offline-DB eller skrivande observationsvy. Det är nästa
vertikal efter att login och adaptiv navigation har verifierats på simulator och
fysisk iPhone/iPad.

## Verifierat 2026-08-20

- Debug simulatorbuild passerar för iPhone 17 Pro med iOS 27.
- Debug simulatorbuild passerar för iPad Pro 13 tum (M5) med iPadOS 27.
- Serverns TypeScript-kontroll och samtliga 32 Vitest-tester passerar tillsammans
  med Apple-klientens första build.
- Fysisk enhet, verklig Google-retur och visuellt beteende återstår tills
  servermigrationen och native auth-routesen är deployade.
