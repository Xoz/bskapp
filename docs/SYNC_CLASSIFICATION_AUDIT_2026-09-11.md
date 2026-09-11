# Granskning: matchtyp, tävling och spelform i synken

Datum: 2026-09-11. Status: granskning och förslag; ingen ändring av synkkod eller produktionsdata i detta steg.

## Verifierade fynd

- `scripts/svenskalag/collect.ts` läser matchens motståndare, hemma/borta och spelplats men inte tävlingslänken, spelform eller matchlängd. Kalenderns `/match/` klassas som match oavsett tävling; `/aktivitet/` tas bara med när titeln innehåller träning. Cuper/andra aktiviteter där kan därför missas.
- `lib/svenskalag/import.ts` skapar nya matcher utan match_type, cup_name eller perioduppgifter. Databasens standard blir seriespel och 3 × 20 minuter. Befintliga typer lämnas kvar, men rättas inte från källan. Nyckelprefixet sanktan används även för andra matcher och får inte användas som bevis för typ eller bytas utan kompatibilitet.
- Svenska Lags matchlista för Gul 2026 visar tävlingsgrupper med id:n: F2014-2 (383770), F2014-3 (383772), Mini Tiger Cup BSK 1 (396538), BSK 2 (396541), Stockholm Football Cup (393365), Friendly 1 (393366), Friendly 2 (393367), Träningsmatcher (379781), Träningsmatcher 9v9 (400955).
- Hammarby 6 september, källa 21180483/appmatch 211: källsidan anger uttryckligen Träningsmatcher 9v9 och texten 9v9. Produktionsdatabasen har seriespel, tomt cupnamn och 3 × 20 minuter. Användarens regel är 75 minuter för 9v9.
- IF Brommapojkarna 15 augusti, källa 20743740/appmatch 196: källsidan anger Mini Tiger Cup BSK 1. Databasen har seriespel och tomt cupnamn. Alla 16 importerade matcher 15–16 augusti har samma standardklassificering och 60 minuter; alla deras tävlingskopplingar behöver återläsas individuellt. Cuplängden verifierades inte.

Källor: https://www.svenskalag.se/bollstanassk-fotboll-f2014-gul/matcher ; https://www.svenskalag.se/bollstanassk-fotboll-f2014-gul/match/21180483/hammarby-if-2014-7 ; https://www.svenskalag.se/bollstanassk-fotboll-f2014-gul/match/20743740

## Ursprungligt förslag (avgränsat av beslutet nedan)

1. Läs tävlingens stabila id, namn och källänk per match, både Gul och Grön. Separera matchtyp (seriespel/träningsmatch/cup/okänd), tävling, spelform och faktisk matchlängd. Verifiera tävlingsmetadata eller använd granskad mapping per stabilt tävlings-id; behandla inte alla okända tävlingar som Sanktan.
2. Använd uttrycklig 7v7/9v9 i källa före antaganden. 9v9 ska ge 75 minuter enligt användarens regel. Ersätt batteriets tillfälliga slutsats att längden identifierar spelformen med explicit spelform. Cupens verifierade matchlängd går före standard; saknad längd ska markeras.
3. Bevara cupens namn och lagvariant separat. Friendly-grupper inom Stockholm Football Cup ska inte automatiskt bli fristående träningsmatcher på grund av ordet Friendly.
4. Hämta cupevenemang som egna aktiviteter när de saknar individuella matcher, utan att räkna ett cupdygn som en match. Om matcherna finns ska evenemanget inte ge dubbelt batteriavdrag. Preliminära finalalternativ behöver hållas isär från bekräftade spelade matcher.
5. Återläs hela säsongens matchmetadata en gång med jämförelse före skrivning. Behåll stabila match-id:n, historik, närvaro och uttagningar. Fortsätt ordinarie närvarofönster −28/+14; komplettera med säsongsinventering för kommande cuper och matchtyp.
6. Verifiera importerad Sanktan, vanlig träningsmatch, 9v9-träningsmatch, cup med flera lag, Friendly-grupp, kort cupmatch, okänd tävling och oförändrade match-id:n. Rapportera antal per kategori och oklassificerade poster i synkstatus.

Prioritet: tävlingsklassificering + explicit spelform först; därefter historisk rättning och cupdagar utan enskilda matcher. Batteriet påverkas av längd och deltagande, inte av etiketten Sanktan/cup i sig.

## Avgränsning beslutad 2026-09-11

Användaren behöver inte cupstöd nu och vill inte ha historisk cupimport/rättning i denna insats. Nästa synkförbättring gäller Sanktan och träningsmatcher, inklusive spelform och matchlängd. Tidigare förslag om helsäsongsåterläsning omfattande cuper utgår. Cuphantering planeras separat i [CUP_PLAN.md](CUP_PLAN.md), för en kommande cup. Befintliga cupdata påverkas inte av planbeslutet.
