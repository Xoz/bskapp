# Kravspec: enkel matchutvärdering

Status: byggd 2026-08-20. Den tidigare ELO-prototypen användes aldrig och är borttagen.

## Mål

Ge coacher ett så snabbt efter-match-flöde att det faktiskt används, samtidigt som
resultaten kan följas över tid utan att presenteras som exakta spelarpoäng.

## Inmatning

Varje deltagande spelare får två obligatoriska trestegsval:

1. Jämfört med sin vanliga nivå: `Sämre`, `Som vanligt`, `Bättre`.
2. På den här matchnivån: `Hade svårt`, `Hängde med`, `Påverkade matchen`.

En frivillig orsakstagg kan vara beslut, försvar, anfall, arbetsinsats eller
självförtroende. Minuter och positionsjämförelser används inte. Motståndarnivå
antas vara samma som matchnivån.

## Kontext och historik

Spelarens nivå och matchnivån sparas som ögonblicksbilder vid varje bedömning.
Spelarprofilen visar de senaste sex matcherna och räknar bättre/som vanligt/sämre.
En återkommande trend får föreslå att nivån ses över men ändrar den aldrig.

Flera bedömare sparas separat. Spelarens trend räknar varje match en gång genom
medianen på respektive axel. Stor spridning markeras som `Olika bild`.

## Åtkomst

Inloggade coacher utvärderar under `/matcher/[id]/utvardera`. En coach kan skapa
en separat publik länk per extern bedömare. Token lagras hashad, gäller i sju dagar,
kan återkallas och ger endast åtkomst till matchmetadata, deltagarnamn och frågorna.

## Datamodell

- `match_evaluation_invites`: match, etikett, token-hash, giltighet och återkallning.
- `match_player_evaluations`: match, spelare, bedömare, båda valen, orsakstagg och nivåögonblick.

Den tidigare `match_ratings`-tabellen, `players.form_rating`, ELO-beräkningar,
statistikbaserade förslag och formdiagram finns inte kvar.
