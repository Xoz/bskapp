# Kravspec: Matchgrupper (flera lag i samma app)

Status: **Ej byggd** (planerad 2026-06-16). Inget i koden ännu – se "Faser" nedan.
Implementation (planerad): ny tabell `teams`, `matches.team_id` + `players.team_id`,
gruppväljare (cookie, likt `setViewAs`/`RoleSwitcher`), per-grupp-scoping av översikt,
matchlista, statistik och KPI-rad.

## Mål
Stödja **flera matchgrupper i samma app** med en **delad spelarpool**, så att:
- vi nu kör två grupper – **Gul** (nuvarande lag) och **Grön** – och lånar spelare
  mellan dem,
- och så att samma modell fungerar **efter sammanslagningen nästa år**, då vi ändå
  har flera matchgrupper ur en gemensam trupp.

Kärnprincipen: modellera inte "två lag" utan **N matchgrupper över en delad pool**.
Då krävs **noll schemaändringar** vid sammanslagningen – bara omflyttning av data.

## Beslut (från intervju 2026-06-16)
| Fråga | Beslut |
|---|---|
| Grön-lagets nuläge | Finns bara på **svenskalag.se** idag → ingen DB-migrering, seed tom grupp |
| Statistik-scope | **Per grupp + "Alla grupper"-vy** (aggregat) |
| Lån & speltid | Lånad spelares matcher räknas till **hemgruppen** |
| Tränarbehörighet | Öppen fråga – default: en tränare ser alla grupper, väljaren styr vyn |

## Kärnidé – matchgrupp som förstaklassobjekt
| Begrepp | Modell | Varför det överlever sammanslagningen |
|---|---|---|
| **Matchgrupp** (Gul/Grön) | Ny tabell `teams` (namn, färger, tröjfärger, kalender-url) | Efter merge byter man bara namn/antal grupper – strukturen är redan N-grupper |
| **Spelare** | `players.team_id` = *hemgrupp* (delad pool bakom) | Vid merge flyttas bara hemgrupp; historiken rörs inte |
| **Match** | `matches.team_id` = vilken grupp som spelade | Varje match minns sin grupp för all framtid |
| **Lån** | `match_squad`/`match_lineup` är *redan* per match | En annan grupps spelare kan väljas in i en match – inget extra behövs |

Lån är alltså **gratis i datamodellen**. Det är bara UI som idag antar
"alla aktiva spelare = ett lag". En lånad spelare = `player.team_id ≠ match.team_id`.

## Datamodell (skiss)
- Ny tabell `teams`: `id`, `name`, `color`, `accent_color`, `jersey_color`,
  `jersey_text_color`, `gk_jersey_color`, `gk_jersey_text_color`, `calendar_url`.
  Hit flyttar det som idag ligger platt i `settings` men egentligen är *per lag*.
- Kvar globalt i `settings`: `club_name`, `season`, `coach_code`, `allowed_coach_emails`.
- `matches.team_id INTEGER REFERENCES teams(id)` – backfill befintliga → Gul.
- `players.team_id INTEGER REFERENCES teams(id)` – backfill befintliga → Gul.
- Aktiv grupp hålls i en cookie (lägen: Gul / Grön / **Alla grupper**), satt via en
  gruppväljare byggd som befintliga `setViewAs`/`RoleSwitcher`.

## Faser
- **Fas 1 (grunden, osynligt):** `teams`-tabell, `matches.team_id` + `players.team_id`,
  backfill allt befintligt → Gul, seed tom Grön. Flytta per-lag-inställningar till
  `teams`. Allt fungerar som förut så länge bara en grupp har data.
- **Fas 2 (väljare + scoping):** gruppväljare i cookie (Gul/Grön/Alla), `--primary`
  följer aktiv grupp, och översikt + matchlista + statistik + KPI-rad filtrerar på
  aktiv grupp. Per-grupp svenskalag.se-kalenderimport → Grön får sina matcher in.
- **Fas 3 (lån):** laguttagning kan plocka spelare från andra grupper (markeras
  "lånad" via `team_id`-jämförelse). Deltagande räknar lånematcher till hemgruppen.
- **Fas 4 (sammanslagning, nästa år):** noll schemaändringar – omdöp/skapa grupper,
  flytta `team_id` på spelarna. Gamla matcher behåller sin Gul/Grön-stämpel som historik.

## Öppna frågor / antaganden att bekräfta vid bygge
- **Tränarbehörighet:** ser en tränare alla grupper (default) eller bara sin egen?
  Avskärmning växer Fas 2 (behörighet per grupp) – bekräftas innan Fas 2.
- **Statistik "Alla grupper":** ska lånade matcher dubbelräknas i klubbvyn eller
  räknas en gång per match? (Antagande: en gång per match.)
- **Tröjfärger:** Gul ≈ `#ffd23f`, Grön ≈ `#1f9d57` (dagens GK-färg) – bekräftas.
- **Default-grupp i nav:** öppnar appen i senast valda grupp eller alltid "Alla"?
