# Nativeplan för iPhone och iPad

Status: föreslagen plan, 2026-08-20.

## Rekommendation

Bygg en gemensam SwiftUI-app för iOS och iPadOS med samma PostgreSQL-data och
serverregler som BSK-webben. Börja med tränarens kärnloop och spelarens egen vy,
inte med full funktionsparitet mot webbappens samtliga routes.

Webben fortsätter under övergången som administrations- och specialverktyg för
bland annat import, avancerad cuphantering och drift. Planlinjen ignoreras i
denna fas och är varken datakälla, backend eller migreringsberoende. Funktioner
som senare bedöms värdefulla byggs då direkt i BSK:s gemensamma domän,
spelarregister och nativeapp.

## Lärdomar från FORM/Fitness och KLVR

### Återanvänd från FORM/Fitness

- Samma produktionskonto och data på webb och Apple-enheter.
- OAuth med state, S256-PKCE och en kortlivad engångskod.
- Bearer-session i Keychain för native, medan webben behåller httpOnly-cookie.
- Deep links köas tills appen är autentiserad och redo.
- Nativefunktioner hålls separata från webbens PWA-funktioner.
- Fysiska enheter och verkliga behörighetslägen ingår i releasegrinden.
- Lokala assets och inga renderblockerande externa typsnitt vid kallstart.

FORM:s Capacitor-upplägg kan inte kopieras rakt av. FORM har en Vite/React-bundle,
medan BSK använder Next-sidor, serverkomponenter och server actions. Att paketera
BSK som en fjärrladdad WebView skulle ge svag offlinefunktion, sämre iPad-UX och
ett fortsatt beroende av webbens navigationsstruktur.

### Återanvänd från KLVR

- SwiftUI och adaptiv Apple-navigation som produktgrund.
- GRDB/SQLite bakom ett eget `SyncEngine`-gränssnitt.
- PostgreSQL och servern förblir facit.
- Lokala ändringar får UUID, basversion och idempotensnyckel.
- Konflikter bevarar båda avsikterna; generell last-write-wins används inte.
- Keychain, Data Protection och återkallningsbara enhetssessioner.
- Ett komplett vertikalt flöde byggs och provas före bred funktionsmigrering.

PowerSync behövs inte i första BSK-versionen. Börja med GRDB, cache och en smal
kommando-/outbox-API. Eftersom synken ligger bakom `SyncEngine` kan PowerSync
införas senare om verklig användning visar att egen kö och förändringsfeed inte
räcker.

## Produktomfång för version 1

### Tränare

- Idag: nästa träning/match, uppföljningar och osynkade observationer.
- Träning: se plan, markera närvaro och registrera observationer.
- Spelare: trupp, sökning, högst två aktiva fokus och daterad historik.
- Match: trupp och relevant utvecklingskontext; detaljerad cup/live-funktion
  kan öppnas på webben i första versionen.
- Notiser och deep links till exakt träning, match, spelare eller uppföljning.

### Spelare och förälder

- Egen profil, aktuella fokus och begriplig utvecklingshistorik.
- Kommande aktiviteter och enkel närvaro-/kallelsestatus när serverstödet finns.
- Notiser och länkar endast inom den egna behörigheten.

### Kvar på webben i version 1

- Användar-, roll- och gruppadministration.
- Excelimport, massoperationer och datakvalitetsverktyg.
- Full cupadministration, avancerad live/statistik och GDPR-administration.
- Sällan använda inställningar och rapporter.

## iPhone och iPad som två användningslägen

Appen har en kodbas och gemensam domän, men separata informationsarkitekturer
för kompakt och reguljär bredd.

### iPhone

- `TabView` med Idag, Träning, Spelare och Mer.
- En kolumn, stora tryckytor och snabb registrering med en hand.
- Aktiv träning får fokuserat läge där sekundär navigation döljs.
- Snabb observation och närvaro ska fungera offline vid sidlinjen.

### iPad

- `NavigationSplitView`, inte en uppskalad iPhone-tabbar.
- Sidebar för huvudområden, innehållslista i mitten och detalj/inspektör till
  höger när bredden tillåter.
- Träningsplan: passlista bredvid vald plan, med övnings- och fokusdetaljer.
- Spelare: trupp bredvid spelarprofil, fokus och observationshistorik.
- Match: trupp och spelardetalj samtidigt, särskilt i liggande läge.
- Formulär visas som sheets eller popovers med rimlig maxbredd.
- Stöd för stående och liggande läge, Stage Manager och delad skärm.
- Tangentbordskommandon för sök, ny observation, spara och navigering.
- Pointer, hover, kontextmenyer och minst 44 punkters interaktionsytor.
- Dra och släpp kan införas senare för övnings- och truppordning, efter att
  samma operation har ett säkert serverkommando.

## Teknisk målbild

```text
iPhone/iPad SwiftUI
  |-- GRDB: lokal läscache, outbox och synkstatus
  |-- Keychain: access/refresh-token och enhetshemlighet
  |-- APNs/lokala notiser, Universal Links och App Intents
  |
  +-- HTTPS /api/mobile/v1
          |-- auth och enhetsregistrering
          |-- typade queries och idempotenta commands
          |-- behörighet, validering, versioner och audit
          |
          +-- BSK:s kanoniska PostgreSQL

BSK Next-webb ---------------------+
Planlinjens UX/domän migreras -----+
```

Skapa inte API:et som en tunn spegling av varje webbsida. Kontraktet ska följa
domänoperationer som `recordObservation`, `setAttendance`, `updatePlayerFocus`
och `selectMatchSquad`. Server actions kan använda samma servicefunktioner, men
nativeklienten anropar versionsmärkta JSON-endpoints.

## Genomförande

### Fas 0: produkt- och datagrind, 1-2 veckor

- Lås version 1 till kärnloopen: välj fokus, observera, följ upp och använd
  historiken inför nästa aktivitet.
- Bestäm BSK som enda spelarregister och kanonisk datakälla.
- Håll Planlinjens runtime, databas och flöden utanför nativeleveransen.
- Hasha spelar-PIN och sluta visa aktiv PIN innan extern nativebeta.
- Besluta bundle-ID, App Store-ägare, lägsta iOS/iPadOS-version och juridiska
  svar för barnuppgifter, privacy labels och kontoradering.

Leveransgrind: ett beslutat scope, ett spelarregister och inga öppna kritiska
säkerhetsfynd.

### Fas 1: mobile API och autentisering, 2 veckor

- Inför `/api/mobile/v1` med OpenAPI eller motsvarande maskinläsbart kontrakt.
- Lägg servicelager mellan Next-routes/server actions och databasen så webb och
  native använder samma behörighets- och domänregler.
- Implementera Google OAuth med PKCE, engångskod och native callback.
- Lägg till Sign in with Apple före publik distribution om Google-login finns.
- Utfärda kort access-token och roterande refresh-token per enhet; lagra endast
  tokenhash server-side och stöd återkallelse.

Leveransgrind: samma användare och gruppscope ger samma data på webb, iPhone
och iPad, inklusive negativa behörighetstest.

### Fas 2: Apple-skal och första vertikal, 2 veckor

- Skapa ett Swift Package för API-modeller, domänkommandon och testsupport.
- Bygg SwiftUI-skal med adaptiv iPhone/iPad-navigation från första commit.
- Implementera inloggning, Idag, trupp, spelarprofil och registrera observation.
- Lägg GRDB-cache och outbox bakom `SyncEngine`.
- Visa synkstatus: väntar, synkad, behöver granskas och avvisad.

Leveransgrind: en tränare kan välja spelare, registrera en observation offline,
starta om appen och synka den exakt en gång.

### Fas 3: träning, närvaro och uppföljning, 2 veckor

- Lägg till träningsöversikt, passdetalj, närvaro och spelarens två fokus.
- Gör iPadens planerings- och observationsvyer till riktiga master-detail-vyer.
- Inför serverversioner, preconditions och synlig konflikthantering.
- Lägg Universal Links och APNs till exakta objekt.

Leveransgrind: två enheter kan ändra samma betydelsefulla fält utan tyst
överskrivning och tränaren kan slutföra ett pass med kort nätavbrott.

### Fas 4: roller, polish och TestFlight, 1-2 veckor

- Lägg spelar-/föräldervyer med strikt egen scope.
- Slutför VoiceOver, Dynamic Type, reduced motion och kontrast.
- Prova iPhone och iPad fysiskt i nätverksväxling, offline, rotation, delad
  skärm, Stage Manager, tangentbord och kallstart.
- Lägg crashrapportering utan barnnamn, fritext eller andra känsliga payloads.
- Kör intern TestFlight-pilot med fyra tränare i två veckor.

Leveransgrind: kärnloopen används i verkliga träningar, inga blockerande
dataförluster finns och App Store-kraven är dokumenterade.

### Fas 5: successiv migrering

- Flytta endast webbfunktioner som piloten faktiskt behöver ofta.
- Behåll administration på webben tills nativeflödet har tydlig nytta.
- Utvärdera PowerSync först när mätdata visar problem med latens, bakgrundssynk,
  datamängd eller fler samtidiga redigerare.
- Utvärdera senare vilka Planlinjen-liknande funktioner som ska byggas direkt i
  BSK; detta är ny funktionalitet och inte en förutsättning för nativeappen.

## Testmatris

- Minst en liten och en stor iPhone.
- Minst en 11-tums och en 13-tums iPad-layout, plus en fysisk iPad.
- iPad stående, liggande, 1/2 och 1/3 split view samt Stage Manager.
- Touch, pointer, hårdvarutangentbord, Dynamic Type och VoiceOver.
- Kallstart online/offline, nätverksbyte, utgången token och återkallad enhet.
- Dubbeltryck, retry och återspelning av samma kommando utan dubblett.
- Samtidig ändring från webb, iPhone och iPad med begripligt konfliktutfall.
- Nekad notisbehörighet och deep link genom utloggat läge.
- Negativa roll-, grupp-, förälder/barn- och delningslänkstest.

## Grov insats

Med en erfaren iOS/backend-utvecklare är en intern, fokuserad TestFlight-version
rimlig på cirka 9-12 veckor efter att fas 0-besluten är tagna. Två utvecklare
kan parallellisera SwiftUI/iPad och API/auth, men produkt- och datakonsolidering
är fortfarande den kritiska vägen.

Full paritet med dagens webb och Planlinjen bör inte vara ett v1-mål. Den mäts
efter pilotens faktiska användning och planeras som separata vertikaler.

## Nästa konkreta beslut

1. Bekräfta SwiftUI som målklient och att version 1 inte kräver full webbparitet.
2. Bekräfta vilka fyra huvudflöden som ska ingå i tränarpiloten.
3. Bekräfta BSK:s spelarregister som facit; Planlinjen lämnas utanför projektet.
4. Välj bundle-ID, Apple-team, lägsta OS-version och fysisk iPad för QA.
5. Starta fas 0 med API-inventering och datamappning, utan att bygga UI först.
