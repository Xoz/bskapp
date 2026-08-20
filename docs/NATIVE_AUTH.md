# Native autentisering

Status: servergrund implementerad 2026-08-20.

## Flöde

1. Appen skapar en slumpad PKCE verifier och dess S256 challenge.
2. `POST /api/mobile/v1/auth/google/start` registrerar challengen och returnerar
   Googles authorization URL med ett serverlagrat, hashat state.
3. Appen öppnar URL:en i systemets autentiseringssession.
4. Google återvänder till BSK:s befintliga HTTPS-callback. Samma `users`, roller,
   permissions och gruppscope används som på webben.
5. Servern skickar en 60 sekunder giltig engångskod till
   `se.bsk2014.app://auth/callback` eller `NATIVE_APP_REDIRECT_URI`.
6. Appen bevisar PKCE verifiern via `/auth/exchange` och skickar ett beständigt
   enhets-UUID samt visningsnamn.
7. Access-token gäller 15 minuter. Roterande refresh-token gäller 30 dagar.
   Båda lagras endast hashade på servern och ska lagras med this-device-only
   Keychain-skydd i appen.

Webbens httpOnly-cookieflöde är oförändrat. Mobile API accepterar bearer-token
och behåller cookie som tillfällig utvecklingsväg i webbläsaren.

## Säkerhetsregler

- OAuth state, engångskod, access-token och refresh-token lagras endast hashade.
- Engångskoden kan konsumeras en gång och kräver matchande S256 verifier.
- Refresh roteras atomiskt. Återanvändning av föregående refresh-token återkallar
  enhetssessionen.
- Varje användare har en session per enhets-UUID; ny inloggning på samma enhet
  ersätter tidigare tokens.
- Logout återkallar hela enhetssessionen.
- Nativeflödet skapar ingen separat användare och kopierar ingen profildata.
- Sign in with Apple återstår före publik App Store-distribution om Google är
  fortsatt tillgängligt som inloggningsalternativ.

## Miljö och Apple-konfiguration

- Provisoriskt callback-schema: `se.bsk2014.app://auth/callback`.
- Produktionsvärdet kan sättas med `NATIVE_APP_REDIRECT_URI`.
- Xcode-targeten måste registrera samma URL scheme.
- Bundle-ID, associated domains och slutligt App Store-team beslutas när
  SwiftUI-projektet skapas.
