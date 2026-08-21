# Kanonisk datamodell

Status: beslutad och verifierad 2026-08-21.

## Grundregel

Externa system är importkällor, aldrig produktens läskälla. Svenska Lag-data
landar först i spårbara importtabeller och normaliseras därefter till samma egna
tabeller som manuellt skapad data. Produktvyer, API:er och statistik läser bara
de kanoniska tabellerna. Importadministration får läsa staging för att redovisa
och felsöka själva filimporten.

## Facit per domän

| Domän | Kanoniskt facit | Betydelse |
|---|---|---|
| Spelare | `players` | En identitet per spelare |
| Organisation | `groups`, `player_group_memberships` | Lag och aktuell grupptillhörighet |
| Match | `matches` | En match oavsett om den skapats manuellt, via kalender eller import |
| Planerad trupp | `match_squad` | Publicerat uttagningsbeslut, inte bevis på deltagande |
| Faktiskt matchspel | `match_players` | En rad betyder att spelaren spelade; all matchräkning utgår härifrån |
| Matchlogg | `match_events` | Händelser i tidsordning; statistikaggregat ligger i `match_players` |
| Utvecklingsaktivitet | `development_activities` | Kontext för mål, observation och uttagning; match länkas med `match_id` |
| Kallelse | `development_activity_callups` | Tillgänglighet/svar, inte uttagning eller deltagande |
| Uttagningsutkast | `development_selection_decisions` | Tränarens arbetsbeslut; bekräftelse publicerar `match_squad` |
| Träning/närvaro | `development_activity_participation` | Närvaro och exponering för generella aktiviteter |
| Matchutvärdering | `match_player_evaluations` | Bedömarens svar per match och spelare |

## Importtabeller

`attendance_imports`, `attendance_events`, `player_competition_match_counts`,
`player_competition_matches` och `player_competition_match_players` är staging
och importjournal. De får användas för validering, spårbarhet och idempotent
normalisering men inte av produktvyer eller statistik.

Svenska Lag-normaliseringen gör följande:

1. matchidentiteten återanvänds eller skapas i `matches`;
2. Svenska Lag-aktiviteten länkas till matchen där länken är entydig;
3. faktisk närvaro skrivs idempotent till `match_players`;
4. statistik och mobil-API läser därefter samma tabeller som manuella matcher.

## Avsiktliga skillnader

- `match_squad` och `match_players` får skilja sig: en uttagen spelare kan utebli
  och en sen ersättare kan spela.
- `match_events` och `match_players` är logg respektive aktuellt aggregat.
  Manuella efterhandskorrigeringar kan därför göra att loggen avviker;
  dataauditen synliggör detta utan att använda loggen som facit.
- Cupplatshållare kan vara stängda utan deltagare när en slutspelsgren inte ska
  spelas. De räknas aldrig som spelade eftersom de saknar `match_players`.

## Driftkontroll

`npm run db:audit` körs efter varje VPS-build. Kritiska avvikelser stoppar
deployen, bland annat dubbla matchidentiteter, importerade deltagare utan
`match_players`, olänkade Svenska Lag-matcher och utvärderingar utanför matchen.
Historiska men icke-blockerande avvikelser rapporteras som varningar.

Tabellen `player_interviews` är äldre, frikopplad historik från den borttagna
AI-prototypen. Den används inte av applikationen och raderas inte utan ett
separat uttryckligt gallringsbeslut.
