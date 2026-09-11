# Individuellt matchutrymme

Beslut 2026-09-10: planeringsstöd för kallelser och lån till andra lag.
Kapacitet och aktuell laddning är skilda. Alla börjar på kapacitet 100;
tränare med `manage_squads` och spelaråtkomst kan ställa 50–150 heltalspoäng
på spelarprofilen (exempelvis 80 eller 125). Inga individer har tilldelats
avvikande kapacitet i produktion. Samma återhämtningstakt gäller alla.

## Startvärden v1

- Återhämtning: 20 poäng per faktiskt dygn utanför aktivitetsintervall, högst
  individuell kapacitet. Större batteri ger inte snabbare återhämtning.
- Match: 0,5 poäng per spelminut. Träning: 0,25 poäng per minut.
- Reserv: 40 % av individuell kapacitet. Under reserv eller tidskrock ger
  ”Prioritera vila”. Under 60 % ger ”Begränsat utrymme”; annars ”Gott utrymme”.
- Detta är justerbara kodkonstanter för en första planeringsmodell, inte
  medicinska/fysiologiska mätvärden eller ett prestationsbetyg.

## Underlag och begränsningar

Speltiden för batteriet delas jämnt mellan närvarande utespelare:
7v7 = 6 × 60 / (antal deltagare − 1), 9v9 = 8 × 75 / (antal deltagare − 1).
Målvakten får hela matchtiden. Max är alltid matchens längd. Kortare cupmatcher
behåller registrerad längd och sex utespelarplatser. Appen saknar separat
spelformsfält; exakt 75 minuters registrerad matchlängd identifierar tills vidare
9v9. Övriga längder räknas med sex utespelarplatser.

Detta är batteriets uppskattning även när äldre statistik har ett minutvärde;
statistikens minuter ändras inte. Alla kanoniska deltagare räknas i nämnaren,
även på en enskild spelarprofil och över laggränser. Rättad frånvaro räknas bort.
Målvakt identifieras via närvaroposition, matchplan, uttagningsposition och sist
primär profilposition. Tvetydig/saknad målvakt ger underlagsvarning och en
reserverad målvaktsplats i uppskattningen; ingen godtycklig spelare utses.
Inför matcher baseras fördelningen på ja-svarande. Om inga ja-svar finns ännu
används det planerade underlaget som uppskattning. Vid ett hypotetiskt lån
läggs kandidaten till antalet exakt en gång. Uttagna/obesvarade kandidater
minskar därför inte speltiden för en redan bekräftad trupp.

Planerade matcher hämtas från `match_roster`: accepted/pending eller selected,
men ett explicit declined utesluts även om selected ligger kvar. Inställda
matcher utesluts. Alla spelarens lag räknas, inklusive cupmatcher.

Träning hämtas från development-aktiviteter med registrerad närvaro respektive
kommande kallelse, med 60 minuter som synligt antagande eftersom normaliserade
aktiviteter saknar längd. Dubbletter på spelare/datum/start/grupp reduceras till
en träning; närvaro prioriteras. Saknad matchtid antas vara 12.00 och träningstid
18.00. Svensk tid omvandlas till absoluta ögonblick med befintlig DST-hjälpare.

Historiken börjar 28 dagar före nu (eller före målmatchen om tidigare), med
antaget fullt batteri. Ingen registrerad aktivitet bevisar inte vila; annan
idrott, ofullständig närvaro och äldre kvarstående belastning kan saknas.
Alla vyer beskriver prognosen som uppskattad. Tom historik markeras särskilt
i jämförelsevyn. Ingen automatisk medicinsk individuell kalibrering görs.

## Simulering och gränssnitt

`forecastMatchSpace` går kronologiskt igenom aktiviteterna. Återhämtning sker
inte under aktivitet; intern negativ balans bevaras medan visningen stannar
vid noll. Framtida planer påverkar inte dagens batteri. En tänkt målmatch
ersätter samma match-id och räknas exakt en gång även vid befintlig kallelse.
Minsta marginal från målmatchen genom de följande sju dagarna styr bedömningen.
Tidskrock ger varning även med stort batteri.

- Idag: aktuellt batteri samt lägsta prognos med redan planerade aktiviteter.
- Varje kommande match: `/matcher/[id]/matchutrymme`, även Grön och cuper,
  med lagfilter, kallelsestatus och före/efter-prognos per spelare.
- Speltid kan provas per spelare i jämförelsevyn och SelectionEditor.
  Det är ett osparat scenario och ändrar varken matchplan, trupp eller svar.
- SelectionEditor:s varningar och automatförslag använder den nya prognosen.
  Nya röda kandidater föreslås inte automatiskt; befintliga val/ja-svar bevaras.
  Äldre antalbaserad hjälpare finns kvar för legacy native/API-fallback.
- Kapacitet lagras i befintlig `settings`, `match_space_capacity:<playerId>`.
  Ingen migration krävs. Export och radering av spelaruppgifter omfattar värdet.

## Verifiering

Enhetstest: kapaciteter, dygnsvila, täta/utspridda matcher, framtid kontra nu,
deduplicering, efterföljande egen match, kortare speltid, tidskrock, negativ
balans, träning och svensk sommartid. PostgreSQL-test använder temporära tabeller
för jämnt delad tid, hela deltagarantalet, 7v7/9v9, målvakt, nej/inställt/pending, sparande/återläsning, oförändrade
kallelser samt nekad läs-/skrivåtkomst. Lokalt browserprov med exempelspelare
verifierar sparande, omladdning, scenario och mobilvy.

## Gröns matcher i bakgrunden – 2026-09-11

Synken läser nu även F2014-Grön, enbart matcher. Samma schemalagda arbetare
hämtar kalender, kallelsesvar och uttryckligen registrerad närvaro −28/+14 dagar.
Gröns uppställning läses eller publiceras inte av denna utökning. Käll- och
lagvalidering är explicit per lag; Guls utgående uppställningsflöde är oförändrat.
Stabila kalender-id:n återanvänds så en redan importerad match inte dubbleras.

Spelarens gemensamma batteri läser deltagande i alla lag. Vid verifierad
Svenska Lag-närvaro har den företräde framför bevarade matchstatistikrader,
även om deltagandet senare rättats till frånvaro. Guls matchlista ändras inte.

Grön har egen status i `settings.svenskalag_green_sync_status`. Fel där
stoppar inte Guls synk. Saknad/felaktig status, olösta kopplingar eller en
senaste lyckad hämtning äldre än 26 timmar ger en synlig underlagsvarning.

Aktiverad arbetare: `/opt/bsk/sync-releases/match-space-20260911`, tidigare
`/opt/bsk/sync-releases/person-roles-20260910`. Befintlig timer fortsatt aktiv.
Verifierad första import: 16 matcher, nio med registrerad närvaro; ett
registrerat Ella-deltagande och en kallelse hos Grön hittades. En aktivitet
(20028813) har olöst spelarkoppling. Årskontrollen granskade 36 Grönmatcher
och bekräftade en borttagen match (176), utan övriga kalenderavvikelser.
Återgång: återställ symlänken `/opt/bsk/svenskalag-sync` till föregående release.
Importerad historik bevaras vid återgång.

## Matchutrymme publicerat och verifierat – 2026-09-11

Webbcommit f9178c93a9539e332fc61f8350fe088f3633de72 är publicerad på bsk2014.se.
Godkänd körning: https://github.com/Xoz/bskapp/actions/runs/34536413292.
168 tester med PostgreSQL-integration och produktionsbygge godkända i isolerad
arbetskopia. Inloggad produktionskontroll av Idag, AIK:s matchutrymme och
kapacitetsfältet på spelarprofilen godkänd. Inga verkliga kapaciteter, kallelser
eller uttagningar ändrades vid UI-kontrollen; sparande provades med lokala
exempelspelare och dessa testposter är borttagna.

Gröns bakgrundssynk är aktiv och senaste skarpa körning lyckades. 16 matcher
importerade, nio med sparad närvaro; ett registrerat Ella-deltagande hos Grön
hittat. Inga dubbla stabila käll-id:n i Grön. Aktivitet 20028813 har en olöst
spelarkoppling och ger därför underlagsvarning. Den ersätter inte bekräftade
deltaganden med antaganden. Guls startsida visar fortsatt endast Gulmatcher.

## Jämn speltid publicerad och verifierad – 2026-09-11

Webbcommit 0b365318ef7074a2dfa10b3c40497c2cfd4655d9 publicerad.
Godkänd körning: https://github.com/Xoz/bskapp/actions/runs/34564418443.
178 tester med PostgreSQL och produktionsbygge godkända. Inloggad kontroll:
Adele 100/100 nu; AIK-matchens tio ja-svarande ger Adele 40 minuter och
80/100 efter matchen, Emma 60 minuter som målvakt. Uttagen utan ja räknas som
eget hypotetiskt tillägg och minskar inte speltiden för de ja-svarande.
Historik och prognos använder den nya fördelningen, inklusive Grön.
Appen visar underlagsvarning vid saknad/tvetydig målvakt. 75 minuters
registrerad matchlängd identifierar 9v9 tills ett separat spelformsfält finns.
Ingen ändring av närvaro, statistikminuter, kapacitet eller kallelser gjordes
vid verifieringen. Tillfällig lokal testdatabas borttagen.
