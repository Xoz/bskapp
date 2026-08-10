# GDPR-grind för barnuppgifter

Status: **obligatorisk produktionsgrind – tekniska utdrags-, raderings-, auth- och återställningsgrindar är byggda; föreningsbeslut, driftinventering och beslutad gallring återstår**.

Detta är ett tekniskt beslutsunderlag, inte juridisk rådgivning. Bollstanäs SK är
personuppgiftsansvarig och måste fastställa ändamål, rättslig grund och
lagringstid innan verkliga barnuppgifter används i den fristående
tränarplattformen.

## Källstyrda utgångspunkter

- Riksidrottsförbundet anger att behandling inom barns medlemskap normalt kan
  vila på medlemsavtalet och att vårdnadshavaren alltid ska informeras:
  <https://www.rf.se/bidrag-och-stod/personuppgifter/hur-paverkas-idrotten/barns-personuppgifter>.
- Varje behandling behöver egen giltig grund, tydligt ändamål, minimerade
  uppgifter och bestämd lagringstid:
  <https://www.rf.se/bidrag-och-stod/personuppgifter/grundprinciper>.
- Externa drift- och systemleverantörer är tredje parter/personuppgiftsbiträden;
  biträdesavtal och ansvarsfördelning måste finnas:
  <https://www.rf.se/bidrag-och-stod/personuppgifter/hur-paverkas-idrotten/att-dela-uppgifter>.
- RF betonar särskilt skydd mot otillbörlig åtkomst för barns personuppgifter.
  Uppgifter om skada kan vara hälsouppgifter och kräver separat bedömning:
  <https://www.rf.se/bidrag-och-stod/personuppgifter/hur-paverkas-idrotten/sarskilda-fragor>.

## Beslut som föreningen måste protokollföra

| Behandling | Föreslaget minimalt ändamål | Beslut krävs |
| --- | --- | --- |
| Spelarregister och lagkoppling | Administrera medlemskap och lagverksamhet | Bekräfta avtal och informationsplikt |
| Närvaro | Planera verksamhet och uppföljning | Grund, mottagare och lagringstid |
| Utvecklingsmål och tränaranteckningar | Individuellt träningsstöd | Dokumenterad nödvändighet, grund och åtkomst |
| Matchbetyg och form | Tränarens planeringsstöd | Om funktionen ska användas alls för barn |
| Självskattning och fritext | Spelarens återkoppling till tränare | Grund, frivillighet och särskild gallring |
| `injured`/skadeuppgift | Anpassa deltagande | Bedömning av känslig hälsouppgift eller ta bort fältet |
| Publik Livescore | Informera följare om match | Exakt vilken persondata som får vara publik |

Samtycke ska inte användas som universell reservgrund. Om föreningen väljer
samtycke för en avgränsad frivillig behandling måste det vara informerat,
specifikt, dokumenterat och lika enkelt att återkalla som att lämna. Vad som
händer med redan insamlade uppgifter vid återkallelse ska beslutas innan kod.

## Tekniska acceptanskriterier

1. Alla privata sidor, repositories, server actions och exporter har server-side
   auth och lag-/spelarscope. Automatiska negativa tester finns.
2. Integritetsinformation visar ansvarig förening, ändamål, rättslig grund,
   mottagare/biträden, lagringstid, rättigheter och kontaktväg.
3. Administratör kan exportera alla uppgifter för en spelare i ett läsbart,
   versionsmärkt format och åtgärden auditloggas utan känslig fritext.
4. Rättelse, avaktivering, begränsning och radering har separata, bekräftade
   arbetsflöden. Radering omfattar alla beroende tabeller och verifieras i test.
5. Schemalagd gallring använder en beslutad retentiontabell, har dry-run,
   auditresultat och återställningsprov. Ingen generell tvåsäsongsregel införs
   utan föreningens dokumenterade beslut.
6. Driftregion, backupregion, underbiträden, biträdesavtal, incidentväg och
   återställningsmål är dokumenterade för databas, VPS och inloggning.
7. Fritext minimeras. Skade-/hälsouppgifter är borttagna eller separat godkända
   och strikt behörighetsstyrda.
8. Publika länkar är återkallbara, tids- eller matchbegränsade capabilities och
   läcker inte trupp, intern statistik eller rapportörsidentitet.

## Teknisk status 2026-08-10

- Båda apparna har versionsmärkta spelarutdrag och permanent radering av
  spelaranknutna tabeller. Huvudappen kräver `manage_users`; Planlinjen kräver
  signerad huvudtränaridentitet. Namnmatchad bekräftelse krävs.
- Avaktivering/begränsning är separat från permanent radering.
- Export och radering auditloggas med internt spelar-id, utan barnets namn eller
  fritext i auditposten.
- Planlinjens backup återställdes i en isolerad temporär databas; 27 tabellers
  radantal matchade och testdatabasen togs bort efter verifieringen.
- Dependency-audit är ren i båda apparna.
- Gallring är medvetet inte schemalagd: retentionvärden saknar ännu ett
  protokollfört föreningsbeslut.

## Rekommenderad implementeringsordning

1. Föreningsbeslut om behandlingstabellen ovan samt ansvarig kontakt.
2. Datainventering och biträdes-/regionkontroll.
3. Informationssida och versionerad policyacceptans/kvittens där det behövs.
4. Registerutdrag + spelaromfattande raderingsjobb med dry-run.
5. Retentionjobb och återställningsprov.
6. Först därefter eventuell vårdnadshavarvy för en behandling där samtycke
   faktiskt är vald rättslig grund.

## Produktionsregel

Inga riktiga barnuppgifter får importeras till `coach-platform` innan punkterna
1–2 ovan är beslutade och auth-, export-, raderings- och återställningsgrindarna
är verifierade. Syntetisk pilotdata får användas under tiden.
