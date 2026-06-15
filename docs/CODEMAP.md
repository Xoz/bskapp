# CODEMAP — var bor vad i BSK F2014

> Läs den här filen + de 1–2 filer den pekar på innan du ändrar kod.
> Öppna **inte** hela `lib/` eller `components/` för att leta. Uppdatera kartan när du
> lägger till en fil, route, tabell eller exportfunktion.

Stack: Next.js 16 (App Router, server actions), React 19, Turso/libSQL, Anthropic SDK, Recharts, Tailwind v4.
OBS: Next.js-versionen har breaking changes — se `AGENTS.md` / `node_modules/next/dist/docs/`.

---

## Feature → filer

| Vill ändra | Läs dessa filer |
| --- | --- |
| **Live-matchrapportering** (klocka, mål, byten, händelser) | `components/LiveTracker.tsx`, `lib/live.ts`, `lib/liveTypes.ts`, `app/api/live/[id]/route.ts`, `app/(skyddad)/matcher/[id]/live/page.tsx` |
| **Live-publik vy / förälderrapport** | `components/LiveFeed.tsx`, `components/LiveScoreboard.tsx`, `app/live/[id]/`, `lib/live.ts` |
| **Match: skapa/redigera/ta bort, cup, nivå** | `lib/actions.ts` (save/delete/updateCup/setMatchLevel…), `components/MatchForm.tsx`, `app/(skyddad)/matcher/` |
| **Laguttagning / trupp / formation** | `components/SquadBoard.tsx`, `lib/formations.ts`, `lib/positions.ts`, `lib/actions.ts` (saveSquad/saveLineup) |
| **Spelarutvärdering (SvFF-färdigheter)** | `components/SkillRadar.tsx`, `components/SelfEvalForm.tsx`, `lib/svff.ts`, `lib/actions.ts` (createEvaluation/submitSelfEval), `app/(skyddad)/spelare/[id]/utvardera/` |
| **Matchbetyg / form (ELO)** | `lib/rating.ts`, `lib/actions.ts` (saveMatchRatings), `lib/queries.ts` (getMatchRatings/getPlayerFormTrend), `components/MatchRatings.tsx`, `components/FormTrendChart.tsx`, monteras i `app/(skyddad)/matcher/[id]/page.tsx` + `app/(skyddad)/spelare/[id]/page.tsx` |
| **Utveckling över tid / diagram** | `components/DevelopmentChart.tsx`, `components/ParticipationChart.tsx`, `lib/queries.ts` (getPlayerDevelopment) |
| **Statistik (säsong/spelare/lag)** | `lib/stats.ts`, `lib/queries.ts` (getSeasonStats/getPlayerMatchStats/getTeamMatchStats), `components/StatsFields.tsx`, `app/(skyddad)/statistik/` |
| **Nivåer / matchning spelare↔match** | `lib/levels.ts`, `lib/queries.ts` (getPlayersLevelInfo) |
| **Kalender / SvFF-import** | `lib/ical.ts`, `lib/svff.ts`, `lib/actions.ts` (importCalendarMatches) |
| **Spelarkort (delningslänk)** | `app/spelarkort/[token]/`, `lib/queries.ts` (getPlayerByShareToken/share*), `lib/actions.ts` (generateShareLink) |
| **AI: spelarkortstext, förslag, intervju** | `lib/ai.ts`, `app/api/ai/`, `components/InterviewChat.tsx`, `components/AISuggestButton.tsx` |
| **Inloggning / roller / inbjudan** | `lib/auth.ts`, `lib/actions.ts` (playerLogin/acceptInvite/setViewAs), `app/login/`, `app/invite/`, `components/RoleSwitcher.tsx` |
| **Inställningar / white label** | `lib/actions.ts` (updateSettings), `lib/db.ts` (getSetting/setSetting), `components/Settings*.tsx`, `app/(skyddad)/installningar/` |
| **Datum / tid (svensk tid!)** | `lib/dates.ts` — använd ALLTID denna, aldrig `toISOString`-datum |
| **DB-access (lågnivå)** | `lib/db.ts` (all/get/run/batch) |

---

## lib/ — exports per fil

- **actions.ts** (server actions, ~35 st): all skrivande logik. login/logout, addPlayer(sBulk), updatePlayer, createEvaluation/submitSelfEval, saveMatch, addCup/updateCup/deleteCupMatch/addCupPlayoffMatch, setMatchLevel, saveSquad/saveLineup, saveMatchRatings, deleteMatch, toggleMatchReporting/resetMatch, addManualEvent/deleteMatchEvent, importCalendarMatches, updateSettings, generate/revokeShareLink, generateCoachInvite/acceptInvite, setViewAs.
- **queries.ts** (läsande, typer): `Player`, `Evaluation`, `Match` + getPlayers/getPlayer, getMatches/getMatch/getMatchPlayers/getMatchSquad, getEvaluations/getScores/getPlayerDevelopment, getSeasonStats/getPlayerMatchStats/getTeamMatchStats, getMatchRatings/getPlayerFormTrend, getPlayersLevelInfo/getPlayerEvalAverage, cup-helpers (matchTitle/cupRoundLabel/cupMatchCompare/mootMatchIds), share-token-helpers.
- **db.ts**: libSQL-klient + `all/get/run/batch`, `getSetting/setSetting/getAllSettings`, `logActivity/getRecentActivity`. **Schema (CREATE TABLE) bor här.**
- **live.ts**: getLiveState, recordEvent/undoLastEvent, recordSub/undoLastSub, setClock, togglePlayed, claimStats, finishMatch, clockSeconds.
- **liveTypes.ts**: typer för live (`LiveState`, `LiveEvent`, `LivePlayer`, `LiveAction`…), formatClock/formatEventTime, OPPONENT_GOAL.
- **auth.ts**: roller (`Role`/`ViewRole`), session-tokens, getRole/getViewRole/getRealRole, getPlayerSession, getCoachEmail/getCoachName.
- **svff.ts**: SvFF-färdigheter — `CATEGORIES`/`ALL_SKILLS`/`SVFF_PRINCIPLES`, skillById/categoryById.
- **stats.ts**: `STAT_FIELDS`/`CARD_FIELDS`/`LIVE_COUNT_IDS` (definition av vilka stats som finns).
- **levels.ts**: `LEVELS`, level/levelByRank/suggestLevel, fit() (matchar spelarnivå mot matchnivå).
- **formations.ts**: `FORMATIONS`, formation(), positionRole(). **positions.ts**: `POSITIONS`, positionLabel/positionFocus.
- **ical.ts**: parseEvents/extractMatches/fetchCalendar, `CalendarMatch`.
- **ai.ts**: callAnthropic/callAnthropicChat, generatePlayerCardText.
- **dates.ts**: swedishToday/swedishDate/swedishDateOffset.
- **rating.ts**: matchbetyg/ELO-form — `EXPECTATION_STEPS`/`RATING_AREAS`, seedRating/kFactor/computeDelta, ratingBand, suggestOutcome (stats→förslag), outcomeFromAreas, stepByKey/stepByOutcome.

---

## DB-tabeller (definieras i lib/db.ts)

`settings`, `players`, `evaluations`, `evaluation_scores`, `matches`, `match_players`,
`match_events`, `match_reporters`, `match_squad`, `match_lineup`, `match_subs`, `match_ratings`,
`player_self_evals`, `player_interviews`, `activity_log`, `login_throttle`.
(`players.form_rating` = löpande ELO-form-tal, sätts av matchbetygen.)

---

## Routes (app/)

Skyddade (kräver inloggning) under `app/(skyddad)/`: oversikt, matcher (+ `[id]`, laguttagning, live, cup, ny, ny-cup), spelare (+ `[id]`, utvardera), statistik, intervjuer, installningar.
Publika: `/login`, `/invite`, `/guide`, `/intervju`, `/min-profil`, `/spelare/login`, `/live/[id]` (+ rapportera), `/spelarkort/[token]`.
API: `app/api/ai/{intervju,intervju/spara,suggest}`, `app/api/auth/{google,callback/google}`, `app/api/live/[id]`.

---

## Konventioner

- **Svensk tid**: använd `lib/dates.ts`. Vercel kör UTC — aldrig råa `toISOString`-datum.
- **Skriv = server action i actions.ts**, **läs = queries.ts**. Lågnivå-SQL via `lib/db.ts` (`all/get/run/batch`).
- **Git**: `git push` direkt efter commit.
- Större detaljspec finns i `docs/SPEC-matchbetyg.md` (Fas 1 byggd – Fas 2-integrationer kvar) och `docs/STAGING.md`.

---

## Underhåll av denna fil

Uppdatera CODEMAP i **samma ändring** som du rör strukturen — inte efteråt. Annars ruttnar kartan
och nästa session läser fel filer. Vad som triggar en uppdatering och vart det ska in:

| Du gör detta | Uppdatera i CODEMAP |
| --- | --- |
| Ny **exportfunktion** i en `lib/`-fil | Lägg till i "lib/ — exports per fil" under rätt fil |
| Ny **lib-fil** | Ny rad i "lib/ — exports per fil" + ev. rad i "Feature → filer" |
| Ny **komponent** kopplad till en feature | Lägg till filen i rätt rad i "Feature → filer" |
| Ny **route** (page.tsx / route.ts) | Lägg till under "Routes (app/)" |
| Ny/ändrad **DB-tabell** (`CREATE TABLE` i db.ts) | Lägg till i "DB-tabeller" |
| Nytt **feature-område** | Ny rad i "Feature → filer"-tabellen |
| Ny **konvention** (mönster som ska följas överallt) | Lägg till under "Konventioner" |

Regler för att hålla filen billig att läsa:
- **En rad per fil/funktion** — beskriv *vad den gör*, inte *hur*. Ingen kod, ingen logik. Detaljerna bor i koden.
- **Lista bara det som hjälper navigering.** Interna hjälpfunktioner som ingen söker efter behöver inte vara med.
- **Ta bort rader** när du raderar/flyttar filer — en felaktig karta är värre än ingen.
- Sikta på att filen håller sig under ~200 rader. Växer ett område mycket: överväg en egen `docs/<område>.md` och länka från tabellen.

Snabb sanity-check (kör vid behov) att kartan inte tappat något:
```bash
# Nya lib-exports som ev. saknas i kartan:
grep -rhoE "^export (async )?(function|const) [a-zA-Z0-9_]+" lib/*.ts | sort
# Alla routes:
find app -name "page.tsx" -o -name "route.ts" | sort
# Alla tabeller:
grep -E "CREATE TABLE" lib/db.ts
```
