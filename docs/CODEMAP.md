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

- **actions.ts** (server actions, ~35 st): all skrivande logik. login/logout, addPlayer(sBulk), updatePlayer, createEvaluation/submitSelfEval, saveMatch, addCup/updateCup/deleteCupMatch/addCupPlayoffMatch, setMatchLevel, saveSquad/saveLineup, deleteMatch, toggleMatchReporting/resetMatch, addManualEvent/deleteMatchEvent, importCalendarMatches, updateSettings, generate/revokeShareLink, generateCoachInvite/acceptInvite, setViewAs.
- **queries.ts** (läsande, typer): `Player`, `Evaluation`, `Match` + getPlayers/getPlayer, getMatches/getMatch/getMatchPlayers/getMatchSquad, getEvaluations/getScores/getPlayerDevelopment, getSeasonStats/getPlayerMatchStats/getTeamMatchStats, getPlayersLevelInfo/getPlayerEvalAverage, cup-helpers (matchTitle/cupRoundLabel/cupMatchCompare/mootMatchIds), share-token-helpers.
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

---

## DB-tabeller (definieras i lib/db.ts)

`settings`, `players`, `evaluations`, `evaluation_scores`, `matches`, `match_players`,
`match_events`, `match_reporters`, `match_squad`, `match_lineup`, `match_subs`,
`player_self_evals`, `player_interviews`, `activity_log`, `login_throttle`.

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
- Större detaljspec finns i `docs/SPEC-matchbetyg.md` (planerad matchbetyg-funktion, ej byggd) och `docs/STAGING.md`.
