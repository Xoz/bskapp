# Plan för framtida cuphantering

Beslut 2026-09-11: cupimplementation och import/rättning av historiska cuper ingår inte nu. Aktuell synkförbättring avgränsas till Sanktan och träningsmatcher, inklusive explicit 7v7/9v9 och matchlängd. Detta dokument är en plan, inte en implementerad funktion. Uppdaterat beslut: cuper hanteras enskilt och undantas från ordinarie matchantal, matchkallelser och batteriberäkning. Befintliga cupuppgifter bevaras.

## Modell och flöde

1. **Cup som samling.** En cup har namn, datum, källa och ett eller flera deltagande BSK-lag. Enskilda matcher knyts till rätt cup och lag. En cuprubrik/kallelse är inte i sig en spelad match.
2. **Tidigt planeringsunderlag.** Innan spelschemat finns anger tränaren uppskattat antal matcher per dag, matchlängd, spelform och planerade deltagare. Batteriet visar ett tydligt preliminärt scenario/intervall. Saknade uppgifter visas som okänt underlag, inte som noll belastning eller garanterat fullt batteri. Exakt återhämtning och tidskrock kan inte beräknas utan matchtider.
3. **När spelschemat finns.** Hämta från Svenska Lag där enskilda matcher finns; komplettera manuellt om de saknas. Annan cuptjänst utvärderas separat när en faktisk cup behöver den. Spara avspark, längd, spelform och deltagare per match. Verifiera källans identitet så att samma match inte skapas igen.
4. **Jämn speltid.** Med en målvakt hela matchen får utespelare (antal utespelarplatser × matchlängd)/(antal deltagare − 1), högst full matchtid. Målvakten får matchlängden. Sex platser i 7v7, åtta i 9v9. Cupens egen längd används; spelform får inte härledas ur antalet minuter. Vid målvaktsbyte behövs fördelning per period eller manuellt scenario.
5. **Cupdagar i batteriet.** Räkna matcherna kronologiskt och återhämtning mellan dem enligt den gemensamma modellen. När riktiga matcher blir kända ersätter de motsvarande preliminära matcher; kvarvarande osäkra matcher står kvar som scenario. Cuphändelsen får aldrig ett extra avdrag ovanpå matcherna.
6. **Slutspel.** Möjliga finaler/bronsmatcher är alternativa scenarier, inte flera samtidiga säkra matcher. Tränaren ser vilka antaganden prognosen bygger på. Faktiskt slutspelsval ersätter alternativen.
7. **Deltagande och lån.** Ett ja till cupen är planerad medverkan, inte bevis för varje match. Per match används planerad trupp före spel och registrerad närvaro efteråt. Cupens deltagande och planering hålls separat från det ordinarie batteriet för Gul och Grön. Identiska matcher räknas en gång även om de återfinns via flera lag.
8. **Efterregistrering.** Senare inlagd närvaro och rättningar ersätter preliminära deltagaruppgifter och räknar om speltid/batteri. Okänd närvaro ska vara synlig. Ändringar av schema och inställda matcher uppdaterar samma poster.

## Genomförande när en kommande cup blir aktuell

- Steg 1: Enkel cupregistrering, lag, spelform, längd och preliminärt matchantal per dag.
- Steg 2: Enskilda matcher från Svenska Lag eller manuell komplettering, med ersättning av preliminära antaganden utan dubbelräkning.
- Steg 3: Närvaro, rättningar och slutspelsalternativ. Utvärdera eventuell extern cuptjänst mot den aktuella cupen.

Verifiering före aktivering: korta matcher, två BSK-lag, lån mellan lagen, varierande deltagarantal, målvaktsbyte, saknade tider, inställd match, alternativa finaler, sent registrerad närvaro och samma match från två källor. Prova med exempeldata. Ingen historisk cupimport behövs för att aktivera stöd för en framtida cup.
