# Matchkontroll 10 september 2026

Kontroll mot inloggade Svenska Lag: Guls samtliga tolv månadskalendrar för 2026, alla 66 importerade Gulposter med käll-id, separata detaljsidor för 18 poster som inte var matchlänkar i kalendern, samt alla sju återstående matcher. Kommande matchers datum, tid, motståndare, hemma/borta och plats överensstämmer. Inga kallelser skickades eller uppgifter ändrades i Svenska Lag.

## Bekräftat fel och rättning

| Lokal match | Felaktig post | Svenska Lags besked |
| --- | --- | --- |
| 6 / 20024470 | Hammarby IF FF 7 Vit, 12 september 10.15 | Aktiviteten är borttagen |
| 10 / 20024468 | IFK Vaxholm 3, 30 augusti | Aktiviteten är borttagen |
| 151 / 20519670 | Värtans IK, 29 augusti 16.30 | Aktiviteten är borttagen |

Direktlänkar: https://www.svenskalag.se/bollstanassk-fotboll-f2014-gul/match/20024470, /match/20024468 och /match/20519670 under samma lag. Sidorna returnerar HTTP 200, men rubriken bekräftar borttagningen. Kalenderfrånvaro eller HTTP-status räcker därför inte som bevis.

Orsak: browserimporten uppdaterade bara de aktiviteter som fortfarande fanns i sitt rullande fönster. Den avvecklade inte försvunna poster. Idag-vyn saknade dessutom filtret för avvecklade matcher.

Rättningen markerar bekräftat borttagna poster inaktiva med befintligt `cancelled`-fält, bevarar historik/trupp och lagrar separat verifierad borttagningsorsak i `svenskalag_removed:{id}`. Matchdetaljen skiljer borttagen från inställd. En senare vanlig import av samma käll-id återaktiverar matchen och tar bort borttagningsmarkören.

Automatisk årskontroll körs efter inkommande synk, avgränsad till Gul och aktuellt kalenderår. Den inventerar även vanliga aktivitetslänkar och ignorerar andra lags föreningsaktiviteter. Bara ett uttryckligt borttagningsbesked på rätt källa kan avveckla en post. Datum-/tidsavvikelser utanför den vanliga synkens fönster rapporteras för granskning. Kontrollen ersätter inte den vanliga importen och skapar inte nya historiska matcher.

## Rätt kommande kalender

| Datum | Tid | Motståndare | Plats |
| --- | --- | --- | --- |
| 12 september | 09.00 | AIK FF 2 | Råsunda IP 11 |
| 12 september | 16.30 | Örby IS Blå från Medel | Bollstanäs IP 21 |
| 18 september | 17.30 | Djurgårdens IF FF 11 Röd | Bollstanäs IP 21 |
| 18 september | 18.45 | Österåker United FK 2 Rosa | Bollstanäs IP 21 |
| 20 september | 11.00 | Värtans IK Vit 1 från Extra Svår | Bollstanäs IP 21 |
| 27 september | 09.45 | Enskede IK 2 | Enskede IP 32 |
| 27 september | 10.15 | Sollentuna FK 2 | Norrvikens IP 11 |

September- och oktoberkalendrarna innehåller inga ytterligare kommande Gulmatcher vid kontrollen. Hammarby den 6 september är en separat träningsmatch (21180483); inget bevis för att det är samma match som den borttagna den 12:e.

## Historiska avvikelser — inte automatiskt omklassade

Före rättning fanns 70 lokala Gulposter för 2026: 66 importerade och fyra manuella. Kalendern innehåller 64 uttryckliga matchlänkar. Skillnaden beror på mer än borttagningar:

- 15 av de äldre importerade Gulposterna är fortfarande befintliga vanliga aktiviteter i Svenska Lag: nio individuella tränings-/cupmatcher och sex övergripande cupaktiviteter. De får inte behandlas som borttagna bara för att deras länkar heter `/aktivitet/`.
- Elva riktiga junimatcher finns lokalt under cupgrupperna Comp/Friendly 1/Friendly 2. De saknas därför i en strikt Guljämförelse. Käll-id:n finns; inga nya dubbletter ska skapas för dem.
- Fem matchlänkar den 28 juni saknar direkt lokal käll-id-koppling. Fem närvaroimporterade matcher med motsvarande motståndare och datum finns utan laggrupp. Kopplingen behöver verifieras innan sammanslagning, särskilt de två Brommapojkarnamatcherna samma dag.
- Fyra manuella Gulposter saknar käll-id: 98 Rönninge Salem Svart och 99 TBD den 15 juni samt testposterna 152 och 194 i augusti.
- De sex övergripande cupaktiviteterna bör skiljas från individuella matcher innan historisk matchstatistik betraktas som ren.

En kompletterande kontroll av 2025 omfattade dess 40 importerade Gulposter: inga bekräftade borttagningar och inga datum-/tidsavvikelser. Denna komplettering granskar källkoppling, datum och tid; den intygar inte historisk matchklassificering, inställd-status eller statistik. Grön har inte genomgått samma årskontroll i denna ändring. Kallelser/närvaro utanför det vanliga synkfönstret har inte nyimporterats. Kommande Gulmatcher är verifierade, men det är inte ett friskintyg för all historisk statistik.

## Verifiering

143 tester passerade, inklusive transaktionell återställning vid fel källkoppling, provkörning utan skrivning, bevarad trupp, upprepad avveckling och återaktivering. Separat Playwright-kontroll testar explicit borttagning, kvarvarande sida, kalenderfel, utloggning och befintlig kalenderpost. TypeScript-kontroll och produktionsbygge passerade. Liveprov av årskontrollen: 66 kontrollerade importerade Gulposter, exakt tre bekräftade borttagningar, inga datum-/tidsvarningar. Backup före datarättning: `/opt/bsk/backups/match-audit-20260910/bsk.dump`.


Publiceringskontrollen avslöjade dessutom två falska dubblettgrupper: Mini Tiger Cups samtidiga slutspelsmatcher 20744498/20744294 och finalplatshållare 20744318/20744552. Källan skiljer dem åt som BSK 1 och BSK 2. Dubblettkontrollen använder nu stabila normaliserade käll-id:n (även över äldre kalenderformat); datum/tid/namn är fallback när käll-id saknas. Samma käll-id på olika datum fångas också. Inaktiva poster undantas. Separat DB-test verifierar dessa fall.


Slutkontrollen av publicerad Idag-vy upptäckte att kallelsesvar för matcher lästes från träningarnas aktivitetstabeller. Det gav ”Ingen kallelse registrerad ännu” trots tio ja på AIK-matchen. Gemensamma läsfragment i `lib/activityCallups.ts` hämtar nu matchtotaler från matches och namn/svar från match_roster, medan träningskällan behålls. Tillämpat både i aktivitetslistan och aktivitetsdetaljen. Testet verifierar att äldre aktivitetssvar inte övertrumfar matchens källa och att enbart uttagen inte räknas som kallad.

Slutpublicering: `3ffc3b8c`, godkänd körning https://github.com/Xoz/bskapp/actions/runs/34525351050. Inloggad produktionskontroll bekräftade sju kommande Gulmatcher, korrekt borttagningsbesked på `/matcher/6`, samt AIK/Örby med 10 kallade och 10 ja vardera på Idag. Uttagen trupp visas separat (8/6). Automatisk synkarbetare `d4c74436` och timer aktiva.

## Förtydligande efter användarens AIK-fråga

Ny direktkontroll: Svenska Lag visar `Kommer10+1` (10 spelare och 1 ledare). Appens källtotal och tio spelarposter med ja-svar stämmer. Åtta är markerade i laguppställningen; startsidans dominerande ”8 uttagna” och ”8 klara” skapade en missvisande bild. Ja-svaren lyfts nu främst på Idag och i uttagningsvyn, med separat uttrycklig markering av laguppställningen. Varningar anger om de gäller uppställningen eller ja-svaren. Inga svar eller spelarval ändrades. Typkontroll och produktionsbygge godkända.
