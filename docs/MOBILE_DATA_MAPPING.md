# Datamappning för BSK native

Status: parkerad framtidsreferens, 2026-08-20.

## Beslut 2026-08-20

Planlinjen ignoreras i nuvarande nativearbete. Ingen data, kod, autentisering
eller runtime därifrån ska migreras eller kopplas till iPhone/iPad-versionen.
Första nativeversionen använder endast huvudappens BSK-data och API.

Dokumentet nedan bevaras enbart som framtida analysunderlag. Om motsvarande
funktioner senare prioriteras ska de byggas direkt i BSK:s gemensamma modell;
en eventuell historikimport blir då ett separat beslut och projekt.

## Princip

BSK:s PostgreSQL är facit för nativeappen. Planlinjen är en migreringskälla och
UX-referens, inte en parallell backend. Ingen automatisk produktionsmigrering
ska köras innan identitetsmappning och återställningsprov har godkänts.

## Mappning

| Planlinjen | BSK | Regel |
|---|---|---|
| `organizations` | Ingen ny tabell i v1 | BSK-installationen representerar föreningskontexten. |
| `teams` | `groups` | Mappa lag och undergrupper explicit; skapa inte från fritext automatiskt. |
| `players` (UUID) | `players` (integer) | BSK-id behålls. Matcha via manuellt granskad rapport, aldrig enbart namn. |
| `players.team_id` | `player_group_memberships` | En spelare kan tillhöra flera grupper och ha en primär grupp. |
| `development_goals` | `player_development_goals` | Högst två aktiva mål per BSK-spelare; övriga importeras pausade eller arkiveras efter beslut. |
| `development_goal_skills` | Målens text/evidens + framtida skill-mappning | Planlinjens UUID-skills får inte skrivas direkt till BSK:s statiska skill-id. |
| `training_sessions` | `development_activities` | Använd stabil `external_key` och typ `training`. |
| `training_session_attendance` | `development_activity_participation` | `present`/`absent` mappas direkt; övriga statusar kräver beslutad förlustfri regel. |
| `matches` | `matches` + `development_activities` | BSK-matchen behålls som matchfacit; utvecklingsaktiviteten refererar via `match_id`. |
| `match_observations` | `development_observations` | Observationen måste knytas till BSK-aktivitet och granskad spelaridentitet. |
| `match_observation_skills` | Ingen direkt import | Kräver separat skill-taxonomirapport och manuellt godkänd mappning. |
| `player_skill_assessments` | `development_checkpoints` och `development_checkpoint_skills` | Importeras endast om nivåskalan kan översättas utan att historiken förvanskas. |
| coach bridge-identitet | `users`, `user_roles`, `user_group_access` | Native använder samma BSK-användare; Planlinjens demo-/coach-id blir inte konto-id. |

## Observationer

BSK:s `development_observations` används direkt av första nativevertikalen.
Klienten skapar ett UUID som både kommando-id och observationens primärnyckel.
Återspelning med samma innehåll ger samma observation; samma UUID med ändrat
innehåll ger konflikt. Skapande observationer behöver därför ingen generell
synkmotor eller `baseVersion`.

Planlinjens sentiment kräver en granskad översättning:

| Planlinjen | Föreslagen BSK-evidens |
|---|---|
| `positive` | `shown` |
| `develop` | `practicing` eller `revisit`, väljs vid migreringsgranskning |
| `neutral` | Ingen automatisk mappning |

## Möjlig framtida migreringsordning, ej aktiv

1. Exportera Planlinjen read-only med käll-id och radantal.
2. Skapa en granskningsrapport för lag, spelare och skills.
3. Godkänn en explicit `planlinjen_player_id -> bsk_player_id`-tabell.
4. Provmigrera aktiviteter, mål och observationer i isolerad databas.
5. Jämför radantal, främmande nycklar, aktiva mål och ett urval historik.
6. Testa restore innan produktionsskrivning.
7. Kör additiv import med proveniens och idempotensnycklar.
8. Låt Planlinjen vara read-only under pilot och avveckla först efter sign-off.

## Öppna beslut före migration

- Hur `late`, `partial` och `trial` ska bevaras i BSK:s närvaromodell.
- Vilka Planlinjen-skills som motsvarar BSK:s utvecklingsträd.
- Om äldre mål utöver två ska importeras som `paused` eller endast arkiveras.
- Retention och rättslig grund för historiska pilotdata om barn.
