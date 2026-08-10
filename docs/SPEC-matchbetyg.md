# Kravspec: Matchbetyg med ELO-form

Status: **Fas 1–2 byggda** (verifierat 2026-08-10). Formlista finns på Översikt och bästa form visas i cupkort.
Implementation: `lib/rating.ts`, tabell `match_ratings` + `players.form_rating`,
`saveMatchRatings`, betygssektion på matchsidan, form-band + trend på spelarprofilen.

## Mål
Låta tränaren betygsätta spelare **per match**, där betyget tolkas i kontext av
nivåskillnaden mellan spelare och match, och bygger ett **löpande form-tal (ELO)**
per spelare som utvecklas över tid och kan föreslå nivåjusteringar.

## Beslut (från intervju)
| Fråga | Beslut |
|---|---|
| Rating-typ | **Löpande ELO-tal** per spelare (ackumulerar) |
| Nivåkoppling | **Föreslå** nivåändring – tränaren beslutar (ingen auto) |
| Avancerat läge | **SvFF:s 5 områden** (delas med periodiska utvärderingen) |
| Statistik | **Föreslår ett betyg** från stats + nivå, tränaren justerar |
| Inmatning (snabb) | **Mot förväntan** (under / som väntat / över) |
| Visning | **Vänligt band + trend** (form-pil + nivåband, ej naket tal) |
| Var betygsätts | **Matchsidan efter match** ("Betygsätt spelare"-sektion) |
| Syns/matar | Spelarprofil, regelbaserade nivåförslag, översikt, cupkort |

## Kärnidé – "mot förväntan" + ELO
Tränaren bedömer inte ett abstrakt 1–5, utan **hur spelaren presterade mot
förväntan** – där förväntan redan är nivåjusterad av appen. En "lätt" spelare i
en "svår" match har låg förväntan; att klara sig blir då "över förväntan" och
höjer formen mer. Att överprestera i en lätt match höjer lite.

### Skala (mot förväntan)
5 steg: `långt under (−−) · under (−) · som väntat (0) · över (+) · långt över (++)`.
(3-stegs fallback möjlig om det känns för fingranigt – bekräftas vid bygge.)

### ELO-modell (skiss)
- Varje aktiv spelare har `form_rating` (heltal), **seedat från nivå**:
  extra lätt ≈ 800, lätt ≈ 900, medel ≈ 1000, svår ≈ 1100, extra svår ≈ 1200.
- Per betygsatt match: `delta = K(matchnivå) × utfall`
  - `utfall ∈ {−2,−1,0,+1,+2}` från "mot förväntan"-steget.
  - `K(matchnivå)` är större för svårare matcher → överprestation i svår match
    rör formen mer än i lätt match (det är så nivån "tas hänsyn till").
- `form_rating += delta`, loggas per match så trenden kan ritas.
- **Avancerat läge:** samma "mot förväntan" per de 5 SvFF-områdena; matchens
  utfall = snittet av områdesutfallen (och områdesdeltan kan visas separat).

### Statistik → förslag
När tränaren öppnar betygssättningen förväljs ett "mot förväntan"-steg utifrån
spelarens matchstatistik vägd mot position och nivå (t.ex. ren nolla för back i
svår match → "över förväntan"; få mål för anfallare i lätt match → "under").
Tränaren bekräftar/justerar det regelbaserade förslaget.

### Nivåförslag
När `form_rating` konsekvent ligger i ett annat nivåband än spelarens satta nivå
(t.ex. 3+ matcher klart över), flaggas ett förslag: "Adele presterar över sin
nivå – flytta upp till Svår?" Tränaren beslutar (kopplar till befintlig nivå).

## Datamodell (förslag)
- `match_ratings(match_id, player_id, overall TEXT, scores TEXT/json, suggested TEXT,
  delta INTEGER, created_at)` – ett betyg per spelare/match.
- `players.form_rating INTEGER` (+ ev. `form_rating_seeded`).
- Trend = härleds ur `match_ratings.delta` i ordning, eller snapshot per match.
- **Kom ihåg: bumpa `SCHEMA_VERSION` i lib/db.ts** vid nya kolumner/tabeller.

## Inmatning (UX)
Matchsidan (`/matcher/[id]`), tränarläge, ny sektion **"Betygsätt spelare"**:
- Lista över spelare som spelade (från match_players / lineup).
- **Snabb:** en rad per spelare med 5 "mot förväntan"-knappar; förvalt förslag.
- **Avancerat:** fäll ut spelaren → 5 SvFF-områden var för sig.
- Visar spelarens matchstatistik + nivå inline som referens.

## Visning (de fyra ytorna)
1. **Spelarprofil:** form-band + trendkurva över matcher (delta över tid).
2. **Regelbaserat nivåförslag:** väg in senaste matchform som signal.
3. **Översikt:** form-topplista / "i form"-kort.
4. **Cupkort:** bästa form i cupen (utöver dagens skytteliga).

## Faser
- **Fas 1 (kärna):** datamodell, inmatning på matchsidan (snabb + avancerat),
  ELO-uppdatering, statistik-förslag, spelarprofil-trend.
- **Fas 2 (integrationer):** nivåförslag, översikt, cupkort.

## Öppna frågor / antaganden att bekräfta vid bygge
- Exakt K-värde per nivå och seed-tal (kalibreras).
- 5-stegs vs 3-stegs "mot förväntan".
- Hur många matcher i rad som krävs för ett nivåförslag.
- Om formen ska "förfalla" mot nivåbandet vid inaktivitet (likt ELO-decay).
