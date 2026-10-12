# Native arbetsdag och offline · mål 2026-10-12

## Omfattning

1. Sammanhängande native spelarprofil: utveckling, samtal, historik och nästa uppföljning.
2. Native matcharbete: uttagning, matchplan, trupp och utvärdering.
3. Mac-interaktion: dra övningsordning, ångra/gör om, tangentbordsnavigation och kommandopalett.
4. Spar-/synkstatus: hämtningstid, lokala utkast och begripliga konflikter.
5. Designpolering: mindre fönster, fokus, tomlägen och långa formulär.
6. Användartillägg: offlinearbete på träning/match. Förbered/nedladda underlag före avfärd, arbeta utan nät, beständig kö med exakt sparförsök, återanslutning och konfliktgranskning före ersättning av senare data. Visa tillgänglighet offline och väntande synk tydligt.

Samma databas och oförändrat webbgränssnitt. Inga riktiga spelaruppgifter ändras under tester. Lokal cache avgränsas till inloggad användare; utloggning låser privat offlineunderlag. Offlineskrivningar återanvänder befintliga rättigheter och färsk serverkontroll vid synk. Återförsök får inte skapa dubbletter. Ingen automatisk extern publicering eller utskick från offlinekö.

## Status

Implementation klar på isolerad gren `codex/native-workday`, baserad på publicerad PR #14. Release 0.008. Produktionspublicering återstår.

## Arbetssätt

Öppna **Offline och synk** (⇧⌘O) medan du är ansluten och välj **Ladda ned arbetsunderlag**. Spelarprofiler med historik, behöriga avstämnings-/samtalsunderlag, träningspass, övningsbank och arbetsveckans matcher förbereds. Listan visar vad som laddats ned. Underlag som aldrig laddats ned kräver nät.

Appen kan därefter startas utan nät. Native träning, avstämning, samtal, laguppställning, matchplan och utvärdering sparar lokalt. Synkstatus visar väntande antal. Exakt sparförsök skrivs beständigt innan appen bekräftar lokal sparning. Köade formulär låses; andra arbetssteg kan fortsätta. Ångra/gör om finns före sparandet. Kommandopaletten (⌘K) öppnar spelare, matcher och pass via tangentbord.

Återanslutning försöks automatiskt, eller via **Synka väntande ändringar**. Samma HttpOnly-session används; ingen kopiering av inloggningscookies. Servern kontrollerar dagens rättigheter, gruppåtkomst, matchsteg, spelare, revisionsnummer och aktuellt underlag. Separata versioner för uttagning, plan och utvärdering låter oberoende steg synkas utan falska konflikter. Identiska återförsök ger kvitto och inga dubbletter.

Vid konflikt visas lokalt och aktuellt underlag. Användaren väljer uttryckligen att lämna det lokala försöket eller behålla det efter granskning. Nya samtidiga ändringar stoppar sparandet igen. Fältfel kan återgå till redigerbart lokalt utkast. Oklart transportresultat hålls låst för exakt återförsök.

Cache, utkast och kö krypteras med AES-GCM; lokal nyckelfil har 0600 och lagringsmappen 0700. Lagringen är separerad per app, server och användare. Offlineåtkomst kräver en verifierad session från senaste sju dagarna. Utloggning låser åtkomst tills samma användare loggar in igen. Osynkade ändringar bevaras även efter sju dagar, men kräver ny inloggning före åtkomst/synk.

Offline gäller dessa native arbetsflöden. Matchcenter/liveklocka, externa kallelser, import och administration kräver nät. Offlineuttagning ändrar endast tränarens val/positioner, aldrig ja-svar eller faktisk närvaro och skickar inga kallelser. Inga webbkomponenter eller befintliga databasregler har ändrats. Nytt additivt API `/api/desktop/workday` återanvänder befintliga kommandon och tabeller.

## Verifiering 2026-10-12

- 286 servertester godkända; 35 separata tester överhoppade. Typkontroll och produktionsbygge med webpack mot lokal syntetisk databas godkända.
- 23 Mac-tester godkända: användaravgränsning, krypterad cache/kö efter omstart, exakt återförsök, routes, dokumentroundtrip, ångra/gör om och bevarande av äldre matchbedömningar.
- Sex befintliga bryggtester godkända.
- Verkliga API-roundtrip mot localhost: profil, matchplan, uttagning, utvärdering, revisionskonflikt och identiska/ändrade återförsök.
- Visuellt i separat QA-app: nedladdning, helt offline omstart med avstängd server, tangentbordsökning, profil/historik, avstämning, träningsskapande, samtalsfält/uppföljning/ångra/gör om, matchplansdragning, uttagningsposition och utvärdering.
- Fem lokala sparförsök synkades vid återanslutning. Databasåterläsning visade exakt ett träningspass och ett samtal, bevarade accepted/pending-svar och korrekt matchreflektion. Ett separat återanslutningsprov efter offlineomstart/toggling gav tom kö. Konfliktgranskning provad med uttryckligt val och lyckad synk.
- Alla skrivningar avser syntetiska `QA`-spelare/matcher i lokal testdatabas. Inga riktiga spelaruppgifter ändrades. Produktionsappen 0.007 lämnades orörd.
