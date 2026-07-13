# CODEMAP — var bor vad i BSK F2014

> Läs den här filen + de 1–2 filer den pekar på innan du ändrar kod.
> Öppna **inte** hela `lib/` eller `components/` för att leta. Uppdatera kartan när du
> lägger till en fil, route, tabell eller exportfunktion.

Stack: Next.js 16 (App Router, server actions), React 19, Supabase/Postgres (via `postgres`-paketet), Anthropic SDK, Recharts, Tailwind v4.
OBS: Next.js-versionen har breaking changes — se `AGENTS.md` / `node_modules/next/dist/docs/`.

Fristående tränarplattform: `coach-platform/` är en separat Next.js/PostgreSQL-produkt med egen README, domänmodell, demovertikal och migrationsschema. `coach-platform/src/repositories/postgres.ts` avgränsar databasfrågor till pilotlaget och `coach-platform/src/app/actions.ts` innehåller server-side CRUD för spelare, övningar, träningspass, övningsdiagram, säsongsperioder och träningsblock. `coach-platform/next.config.ts` kan montera appen under en sökväg med `NEXT_BASE_PATH` (temporärt `/coach` på klvr.se). Genomförandeplanen finns i `IMPLEMENTATION_PLAN.md`. Övningsritare (milstolpe 4): serialiserbart diagramformat i `coach-platform/src/domain/diagram.ts` (Zod-validerat), Zustand-store med undo/redo i `coach-platform/src/components/diagram/diagramStore.ts`, klientredigerare i `coach-platform/src/components/diagram/ExerciseEditor.tsx`, route `coach-platform/src/app/ovningar/[id]/ritare/`. Persistence mot `exercise_diagrams` (objects+actions jsonb, width_ratio) — ingen migration. Säsongsplanering (`/planering`): DB-backade perioder i `coach-platform/src/app/planering/page.tsx` mot `season_periods`; säsong skapas lat och 3 demoperioder bootstrappas vid tom säsong. Perioder länkas till riktiga färdigheter via `season_period_skills` (checkbox-multi-select i formuläret, chips per period); skills bootstrap:as lat i `coach-platform/src/repositories/postgres.ts` (`ensureSkills`/`listSkills`) mot `skill_categories`+`skills` när tabellen är tom. Träningsbyggare (del av milstolpe 5): `coach-platform/src/app/traningspass/[id]/page.tsx` — lägg till/redigera/ta bort/ordna övningsblock (minuter + coachsteg) per pass mot `training_session_blocks`; listan på `/traningspass` länkar varje pass hit. Närvaro + genomförande (del av milstolpe 5): samma sida — närvarosektion med en `<select>` per spelare mot `training_session_attendance` (`attendance_status`-enum: present/absent/late/partial/injured/trial), "Markera genomfört"-knapp som sätter `training_sessions.status='completed'` via `completeSessionAction`; status-badge i header (utkast/planerat/genomfört). Repo: `listAttendance`/`saveAttendance`/`setSessionStatus` i `coach-platform/src/repositories/postgres.ts`; actions `saveAttendanceAction`/`completeSessionAction` i `coach-platform/src/app/actions.ts`. Kalender (del av milstolpe 5): `coach-platform/src/app/kalender/page.tsx` — månadsvy (måndag-start, 42 celler) med träningspass inhängade och färgade efter status, förra/nästa/idag-navigation via `?m=YYYY-MM`; svensk tid via `toLocaleDateString("sv-SE",{timeZone:"Europe/Stockholm"})`. Länkad från nav (`AppShell.tsx`). Träningsläge (sista delen av milstolpe 5): `coach-platform/src/app/traningspass/[id]/kor/page.tsx` — förenklat genomförandegränssnitt ute på planen; server-komponent laddar pass + block-meta + övningsbibliotek + spelare + närvaro + alla blockens diagram (via `getDiagram`), renderar klientkomponenten `coach-platform/src/components/ConductSession.tsx` (nedräknande timer, stora snabbknappar, svårighetsbedömning, byt övning, närvaropanel, reflektionsformulär). Läs-bara rendering av diagram delas i `coach-platform/src/components/diagram/diagramRender.tsx` (TEAM_COLOR/ARROW_COLOR/ARROW_DASH/resolve/H/pitchMarkings/arrowMarkers — används även av `ExerciseEditor.tsx`) + `coach-platform/src/components/diagram/DiagramView.tsx` (ren serverkomponent, statisk SVG). "Starta träningsläge"-knapp på `/traningspass/[id]`. Genomfört pass sparas separat via `saveConductAction` i `coach-platform/src/app/actions.ts` → `saveConductedSession` i `coach-platform/src/repositories/postgres.ts` mot `conducted_sessions`+`conducted_session_blocks` (migration `002_conducted.sql`); sätter sessionens status till `completed`. Block-meta (coach/area/equipment/group_name) lagras på `training_session_blocks` och editeras i blockbyggaren. Övningsbibliotek (`/ovningar`): klientkomponent `coach-platform/src/components/ExerciseGrid.tsx` filtrerar övningar efter namn/tema. Övningsritarens spelarverktyg har team-väljare (att/def/gk) — klicka befintlig spelare för att byta team (`setObjectTeam` i diagramStore).

---

## Feature → filer

| Vill ändra | Läs dessa filer |
| --- | --- |
| **Live-matchrapportering** (klocka, mål, byten, händelser) | `components/LiveTracker.tsx`, `lib/live.ts`, `lib/liveTypes.ts`, `app/api/live/[id]/route.ts`, `app/(skyddad)/matcher/[id]/live/page.tsx` |
| **Live-publik vy / förälderrapport** | `components/LiveFeed.tsx`, `components/LiveScoreboard.tsx`, `components/LiveClock.tsx` (tickande svensk tid överst), `app/live/[id]/`, `lib/live.ts` |
| **Match: skapa/redigera/ta bort, cup, nivå** | `lib/actions.ts` (save/delete/updateCup/setMatchLevel…), `components/MatchForm.tsx`, `app/(skyddad)/matcher/` |
| **Laguttagning / trupp / formation** | `components/SquadBoard.tsx`, `lib/formations.ts`, `lib/positions.ts`, `lib/actions.ts` (saveSquad/saveLineup) |
| **Cupgemensam laguttagning** (uttagna till cupen, default per match) | `components/CupSquadPicker.tsx`, `lib/actions.ts` (saveCupSquad → matchgruppens `player_group_memberships`), `lib/queries.ts` (getGroupMemberIds), `app/(skyddad)/matcher/cup/[slug]/page.tsx` + `…/matcher/[id]/laguttagning/page.tsx` (förväljer cupens trupp) |
| **Spelarutvärdering (SvFF-färdigheter)** | `components/SkillRadar.tsx`, `components/SelfEvalForm.tsx`, `lib/svff.ts`, `lib/actions.ts` (createEvaluation/submitSelfEval), `app/(skyddad)/spelare/[id]/utvardera/` |
| **Utvecklingsträd (checklista 7v7→9v9, 12 kategorier × nivå 1–5)** | `lib/skillTrappan.ts` (kategorier/färdigheter + statuslogik: upplåsning/prioritering/nästa steg), `components/UtvecklingChecklist.tsx` (`readOnly`-prop för spelarens läsvy), `lib/queries.ts` (getPlayerSkillStatuses/getPlayerSkillNote/getTeamSkillOverview), `lib/actions.ts` (setSkillStatus/setSkillNote – anropas direkt från klienten, inte via `<form>`), `app/(skyddad)/spelare/[id]/utveckling/` (tränarens fulla, redigerbara vy), `app/(skyddad)/utveckling/` (lagets snitt per kategori), `app/mitt-utvecklingstrad/` (spelarens egna, låsta läsvy via `getPlayerSession`, länkad från `/min-profil`) |
| **Matchbetyg / form (ELO)** | `lib/rating.ts`, `lib/actions.ts` (saveMatchRatings), `lib/queries.ts` (getMatchRatings/getPlayerFormTrend), `components/MatchRatings.tsx`, `components/FormTrendChart.tsx`, monteras i `app/(skyddad)/matcher/[id]/page.tsx` + `app/(skyddad)/spelare/[id]/page.tsx` |
| **Utveckling över tid / diagram** | `components/DevelopmentChart.tsx`, `components/ParticipationChart.tsx`, `lib/queries.ts` (getPlayerDevelopment) |
| **Närvaroimport / närvarotrend** | `lib/attendance.ts`, `lib/actions.ts` (importAttendanceWorkbook), `lib/queries.ts` (getLatestAttendanceImportSummary/getPlayerAttendance*), `components/AttendanceTrendChart.tsx`, `app/(skyddad)/installningar/page.tsx`, `app/(skyddad)/spelare/[id]/page.tsx` |
| **Statistik (säsong/spelare/lag)** | `lib/stats.ts`, `lib/queries.ts` (getSeasonStats/getPlayerMatchStats/getTeamMatchStats), `components/StatsFields.tsx`, `app/(skyddad)/statistik/` |
| **Nivåer / matchning spelare↔match** | `lib/levels.ts`, `lib/queries.ts` (getPlayersLevelInfo) |
| **Kalender / SvFF-import** | `lib/ical.ts`, `lib/svff.ts`, `lib/actions.ts` (importCalendarMatches) |
| **Cup-import via iCal-länk** | `app/(skyddad)/matcher/importera-cup/page.tsx`, `lib/actions.ts` (previewCupImport/importCupMatches), `lib/ical.ts` (calendarName) |
| **Spelarkort (delningslänk)** | `app/spelarkort/[token]/`, `lib/queries.ts` (getPlayerByShareToken/share*), `lib/actions.ts` (generateShareLink) |
| **AI: spelarkortstext, förslag, intervju** | `lib/ai.ts`, `app/api/ai/`, `components/InterviewChat.tsx`, `components/AISuggestButton.tsx` |
| **Spelarsamtal (intervjuer) – tränarvy** | `app/(skyddad)/spelare/intervjuer/page.tsx` (samlad lista, flik under Spelare), `components/IntervjuCard.tsx` (delat kort), `components/SpelareTabs.tsx` (flikrad Spelare\|Samtal), `lib/queries.ts` (getIntervjuer/getPlayerInterviews), monteras även på `app/(skyddad)/spelare/[id]/page.tsx` + i Att-göra på `oversikt`. Gammal `/intervjuer` → redirect i `next.config.ts` |
| **Inloggning / roller / inbjudan** | `lib/auth.ts`, `lib/organization.ts`, `lib/actions.ts` (playerLogin/acceptInvite/setViewAs + administration), `app/login/`, `app/invite/`, `app/(skyddad)/administration/`, `components/RoleSwitcher.tsx` |
| **Lag, undergrupper och matchgrupper** | `lib/organization.ts`, `lib/db.ts`, `lib/actions.ts` (createGroup/saveGroup), `app/(skyddad)/administration/`, `docs/SPEC-roller-och-grupper.md` |
| **Inställningar / white label** | `lib/actions.ts` (updateSettings), `lib/db.ts` (getSetting/setSetting), `components/Settings*.tsx`, `app/(skyddad)/installningar/` |
| **Branding / logga & tema** | `components/Logo90.tsx` (Logo90Mark + Logo90-lockup, "Stopptidsringen"), `public/{icon,icon-light,logo-mark}.svg`, `app/globals.css` (design-tokens dark+light, grain), `app/page.tsx` (landning), `components/Navbar.tsx` |
| **Datum / tid (svensk tid!)** | `lib/dates.ts` — använd ALLTID denna, aldrig `toISOString`-datum |
| **DB-access (lågnivå)** | `lib/db.ts` (all/get/run/batch) |

---

## lib/ — exports per fil

- **actions.ts** (server actions, ~39 st): all skrivande logik. login/logout, addPlayer(sBulk), updatePlayer, createEvaluation/submitSelfEval, saveMatch (inkl. location), addCup/updateCup/deleteCupMatch/deleteCup/addCupPlayoffMatch, saveCupSquad (cupens uttagna trupp), setMatchLevel, saveSquad/saveLineup, saveMatchRatings, setPlayerLevel (bekräfta nivåförslag från form), deleteMatch, toggleMatchReporting/resetMatch, addManualEvent/deleteMatchEvent, importCalendarMatches (fyller start_time + location från kalender), previewCupImport/importCupMatches (cup-import via iCal), importAttendanceWorkbook (Svenska Lag Excel), updateSettings, resetColors (återställ klubb-/tröjfärger till `DEFAULT_COLORS`), generate/revokeShareLink, generateCoachInvite/acceptInvite, setViewAs.
- **queries.ts** (läsande, typer): `Player`, `Evaluation`, `Match` + getPlayers/getPlayer, getMatches/getMatch/getMatchPlayers/getMatchSquad, getEvaluations/getScores/getPlayerDevelopment, getGroupMemberIds (gruppens spelar-id, t.ex. cupens uttagna trupp), getSeasonStats/getPlayerMatchStats/getTeamMatchStats, getMatchRatings/getPlayerFormTrend/getMatchScorers/getFormOverview, attendance-läsning (`getLatestAttendanceImportSummary`, `getPlayerAttendanceOverview`, `getPlayerAttendanceByCategory`, `getPlayerAttendanceTrend`), getIntervjuer/getPlayerInterviews (spelarsamtal, alla resp. per spelare), getPlayersLevelInfo/getPlayerEvalAverage, cup-helpers (matchTitle/cupRoundLabel/cupMatchCompare/mootMatchIds), share-token-helpers.
- **attendance.ts**: parser för Svenska Lag-filen `Närvarotillfällen per aktivitet & person`, inklusive datumtolkning, kategorisering och namnnormalisering.
- **db.ts**: postgres.js-klient (Supabase) + `all/get/run/batch`, `getSetting/setSetting/getAllSettings`, `logActivity/getRecentActivity`, `DEFAULT_COLORS` (standardfärger – källa för seed + reset). **Schema (CREATE TABLE) bor här.**
- **live.ts**: getLiveState (publik eller rapporteringsdetaljer), recordEvent/undoLastEvent (egen ångra via reporter_key), recordSub/undoLastSub, setClock, togglePlayed, claimStats, finishMatch, clockSeconds.
- **liveTypes.ts**: typer för live (`LiveState`, `LiveEvent`, `LivePlayer`, `LiveAction`…), formatClock/formatEventTime, OPPONENT_GOAL.
- **auth.ts**: sex roller, funktionsrättigheter, användarsession, grupp-/spelarscope och kompatibilitetslagret getRole.
- **organization.ts**: läsmodeller för användare, roller, grupper och medlemskap till administrationsvyn.
- **svff.ts**: SvFF-färdigheter — `CATEGORIES`/`ALL_SKILLS`/`SVFF_PRINCIPLES`, skillById/categoryById.
- **skillTrappan.ts**: Utvecklingsträdet — `CATEGORIES`/`SKILLS`/`LEVEL_INFO` (12 kategorier × nivå 1–5), skillsByCategory/skill, statuslogik: isUnlocked/categoryProgress/allCategoryProgress/totalProgress/priorityAreas/nextRecommendedSkill/filterSkills, `SkillStatus`/`StatusMap`/`STATUS_LABEL`/`STATUS_COLOR`.
- **stats.ts**: `STAT_FIELDS`/`CARD_FIELDS`/`LIVE_COUNT_IDS` (definition av vilka stats som finns).
- **levels.ts**: `LEVELS`, level/levelByRank/suggestLevel, fit() (matchar spelarnivå mot matchnivå).
- **formations.ts**: `FORMATIONS`, formation(), positionRole(). **positions.ts**: `POSITIONS`, positionLabel/positionFocus.
- **ical.ts**: parseEvents/extractMatches/fetchCalendar/calendarName/calendarGroup, `CalendarMatch`.
- **ai.ts**: callAnthropic/callAnthropicChat, generatePlayerCardText.
- **dates.ts**: swedishToday/swedishDate/swedishDateOffset, swedishMinutesSinceMidnight, reportingAutoOpen (föräldrarapportering öppnar auto 60 min före avspark) + `AUTO_OPEN_MINUTES_BEFORE`, swedishWallClockToEpoch (svensk väggklocka→epoch, DST-säkert).
- **rating.ts**: matchbetyg/ELO-form — `EXPECTATION_STEPS`/`RATING_AREAS`, seedRating/kFactor/computeDelta, ratingBand, levelSuggestion (form vs satt nivå → nivåförslag), suggestOutcome (stats→förslag), outcomeFromAreas, stepByKey/stepByOutcome.

---

## DB-tabeller (definieras i lib/db.ts)

`settings`, `players`, `evaluations`, `evaluation_scores`, `matches` (inkl. `location`), `match_players`,
`match_events` (inkl. lokal `reporter_key` för egen ångra + `idempotency_key` för offline-replay-skydd), `match_reporters`, `match_squad`, `match_lineup`, `match_subs` (inkl. `idempotency_key`), `match_ratings`,
`player_self_evals`, `player_interviews`, `activity_log`, `login_throttle`, `users`, `user_roles`,
`user_permissions`, `groups`, `player_group_memberships`, `user_group_access`, `user_player_links`, `attendance_imports`, `attendance_events`,
`player_skill_status` (utvecklingsträdet, PK player_id+skill_id), `player_skill_notes`.
(`players.form_rating` = löpande ELO-form-tal, sätts av matchbetygen.)

---

## Routes (app/)

Skyddade (kräver inloggning) under `app/(skyddad)/`: oversikt, matcher (+ `[id]`, laguttagning, live, cup, ny, ny-cup, importera-cup), spelare (+ `[id]`, utvardera, utveckling, intervjuer), utveckling (lagets snitt), statistik, installningar, administration och mina-spelare.
Publika: `/login`, `/invite`, `/guide`, `/intervju`, `/min-profil`, `/mitt-utvecklingstrad`, `/spelare/login`, `/live/[id]` (+ rapportera), `/spelarkort/[token]`.
API: `app/api/ai/{intervju,intervju/spara,suggest}`, `app/api/auth/{google,callback/google,dev}`, `app/api/live/[id]`. `auth/dev` är DEV-ONLY (404 i prod): loggar in utan Google för lokal testning.

Lokal testmiljö: `.env.development.local` pekar `DATABASE_URL` på en lokal Postgres (`bskdev`) i stället för prod. `scripts/seed-dev.mjs` seedar en testmatch idag (trupp + startelva). `scripts/reset-dev-match.mjs` återställer testmatchen till rent pågående tillstånd (behåller trupp/startelva). `scripts/test-live.sh` kör hela end-to-end-testprotokollet för liverapportering (se `docs/TESTPROTOKOLL-live.md`). Alla tre vägrar köra mot icke-lokal DB. Se `projects/bsk-app` i GBrain för uppsättning.

---

## Konventioner

- **Design "Dark Mono v2"**: allt går via CSS-variabler i `app/globals.css` (dark `:root` + `[data-theme="light"]`). Accenten är `--primary` (dynamisk per klubb, sätts på `<body>` i `layout.tsx`); möter ytor via `--primary-wash`/`--primary-line` (color-mix), aldrig stor solid yta. `--live` är fast signal, grain styrs av `--grain-blend`/`--grain-opacity`. Inga skuggor — djup via nivåer (`--bg`/`--bg2`/`--bg3`) + borders (`--line`/`--line-2`).
- **Svensk tid**: använd `lib/dates.ts`. Vercel kör UTC — aldrig råa `toISOString`-datum.
- **Skriv = server action i actions.ts**, **läs = queries.ts**. Lågnivå-SQL via `lib/db.ts` (`all/get/run/batch`).
- **Git**: `git push` direkt efter commit.
- Öppna punkter samlas i `docs/BACKLOG.md`. Större detaljspec finns i `docs/SPEC-matchbetyg.md` (Fas 1 byggd – Fas 2-integrationer kvar), `docs/SPEC-matchgrupper.md` (flera lag/grupper med delad pool – ej byggd) och `docs/STAGING.md`.

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
