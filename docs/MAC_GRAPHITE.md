# Mac 0.010 – förberedelser, uppföljning och spelarsamtal

## Inriktning

Mac används före och efter träning/match och tillsammans med spelaren under samtal. Mobilen används under aktivitet. Macens gränssnitt har en neutral svart/grå bas, systemtypsnitt, macOS-verktygsfält, kompakt sidofält och delade list-/detaljvyer. Grönt/guld och stora redaktionella rubriker tas bort från appens inramning. Ritningsobjekt behåller sina lagrade färger för begriplighet; själva planen är neutral.

## Arbetsflöden

- Förberedelser: välj kommande match för laguppställning och matchplan, granska eller redigera träningspass, öppna samtalsunderlag och offlinehantering.
- Uppföljning: välj en match från senaste sju dagarna för utvärdering, öppna samtal med uppföljningsdatum som infaller idag eller tidigare, gör utvecklingsavstämningar efter träning.
- Spelarsamtal: sök/välj spelare i en beständig lista och läs profil, tidigare samtal och historik bredvid. Samtalsredigeraren delar underlag och föregående överenskommelse från formuläret. Samtalsläge döljer administrativa uppgifter och prioriterar spelarens ord och nästa steg; det ändrar inte sparade data.
- Bibliotek: träningspass med samlad passöversikt, matcher, spelare och utveckling. Träningslistans tidigare genomförandeläge ersätts av granskning/redigering inför och efter passet.
- Administration, statistik, inställningar och guide använder befintliga klubbverktyg i appens WebKit-vy med lokalt neutral presentation. De är inte nyimplementerade native och kräver fortsatt nät.

## Datagränser

Ändringen omfattar endast `macos/` samt dokumentation. Inga webbkomponenter, server-API:er, databasscheman eller skrivregler ändras. Samma autentisering, behörighetskontroller, krypterade offlinecache, sparutkast, exakta återförsök och konfliktgranskning behålls. Offline kräver nedladdning och verifierad inloggning inom sju dagar. Samtalsunderlag och tidigare samtal läses via samma befintliga behörighetsfiltrerade spelar-API.

## Verifiering

Automatiska Mac-tester, signerat releasebygge och visuell kontroll av huvudflöden, redigerare, sökning, offline och synk genomförs före leverans. Produktionskontroll är läsande; riktiga spelaruppgifter får inte ändras. Skrivande tester använder separat syntetisk databas.


### Resultat 2026-10-12

- 26 Mac-tester och sex WebKit-bryggtester godkända. Releasebygge och lokal signaturkontroll godkända.
- Visuellt kontrollerat mot produktion: tre huvudflöden, spelarsökning, byte av spelare, profilens utveckling/samtal/historik, avstämning, delad samtalsredigerare, samtalsläge, återgång med samma spelare vald, träningsredigerare och övningsbank, matchplan och utvärdering. Inga formulär sparades mot produktion.
- Nedladdad spelarlista/profil och samtalsunderlag öppnade i appens manuella offline-läge. Synkkö 0. Befintliga automatiska tester täcker beständig kryptering, användaravgränsning, exakta återförsök och konfliktsäker datahantering.
- Installerbar version: `outputs/bsk-mac/0.010/BSK-Mac-0.010.zip`; installerad lokal app i `bsk-f2014/macos/dist/BSK.app`. Tidigare 0.009-paket bevarat.
- Server- och webbkod, databas och riktiga spelaruppgifter oförändrade. Native formulärens befintliga sparlogik återanvänds; ingen ny synkmetod införs.
