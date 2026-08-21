# CODEMAP — var bor vad i BSK F2014

> Läs den här filen + de 1–2 filer den pekar på innan du ändrar kod.
> Öppna **inte** hela `lib/` eller `components/` för att leta. Uppdatera kartan när du
> lägger till en fil, route, tabell eller exportfunktion.

Stack: Next.js 16 (App Router, server actions), React 19, Supabase/Postgres (via `postgres`-paketet), Recharts, Tailwind v4.

Primär produktkärna sedan 2026-08-18: `/idag`, `/observera`, `/spelare` och
`/uttagning`. Svenska Lag äger kalender/kallelser/närvaro; appen speglar bara
aktivitetsreferenser och äger utvecklingsmål, målkopplad evidens, exponering och
tränarens explicita uttagningsbeslut. Äldre match-, statistik- och Planlinjen-flöden
är sekundära och får inte styra huvudnavigationen.

Drift: `main` deployas till VPS av `.github/workflows/deploy.yml`. `vercel.json`
stänger av Vercels automatiska `main`-byggen; Vercel är reserverat för Preview
när en separat staging-Postgres finns. Se `docs/STAGING.md`.

Coach-plattform, milstolpe 6–8: `/matcher` sparar matcher och observationer med färdighetsfokus, `/spelare` hanterar individuella utvecklingsmål och `/analys` visar sammanställning plus audit-händelser. Team- och spelarutdrag finns under `coach-platform/src/app/api/export/`; spelarvyn har separat begränsning, återaktivering och namnverifierad permanent radering. `app/api/auth/coach-bridge/route.ts` signerar en kortlivad BSK-identitet via `lib/coachBridge.ts`; `coach-platform/src/lib/bridge-auth.ts` validerar den och `coach-platform/src/proxy.ts` avvisar osignerade produktionsanrop tidigt. Nginx-mall finns i `coach-platform/deploy/`. Root layout och alla server actions verifierar identiteten igen. `coach-platform/db/migrate.ts` versionshanterar migrationer och `db/verify-restore.ts` provar backup/restore. Playwright-flöden finns i `coach-platform/e2e/`.
OBS: Next.js-versionen har breaking changes — se `AGENTS.md` / `node_modules/next/dist/docs/`.

Fristående tränarplattform: `coach-platform/` är en separat Next.js/PostgreSQL-produkt med egen README, domänmodell, demovertikal och migrationsschema. `coach-platform/src/repositories/postgres.ts` avgränsar databasfrågor till pilotlaget och `coach-platform/src/app/actions.ts` innehåller server-side CRUD för spelare, övningar, träningspass, övningsdiagram, säsongsperioder och träningsblock. `coach-platform/next.config.ts` monterar produktionen under `/coach` på `bsk2014.se` med `NEXT_BASE_PATH`; den gamla `klvr.se/coach`-adressen omdirigeras dit. Genomförandeplanen finns i `IMPLEMENTATION_PLAN.md`. Övningsritare (milstolpe 4): serialiserbart diagramformat i `coach-platform/src/domain/diagram.ts` (Zod-validerat), Zustand-store med undo/redo i `coach-platform/src/components/diagram/diagramStore.ts`, klientredigerare i `coach-platform/src/components/diagram/ExerciseEditor.tsx`, route `coach-platform/src/app/ovningar/[id]/ritare/`. Pilar skapas med tryck–dra–släpp och snäpper mot objekt; `diagramRender.tsx` delar SVG-rendering och bollinterpolering för uppspelning med `DiagramView.tsx`. Persistence mot `exercise_diagrams` (objects+actions jsonb, width_ratio) — ingen migration. Säsongsplanering (`/planering`): DB-backade perioder i `coach-platform/src/app/planering/page.tsx` mot `season_periods`; säsong skapas lat och 3 demoperioder bootstrappas vid tom säsong. Perioder länkas till riktiga färdigheter via `season_period_skills` (checkbox-multi-select i formuläret, chips per period); skills bootstrap:as lat i `coach-platform/src/repositories/postgres.ts` (`ensureSkills`/`listSkills`) mot `skill_categories`+`skills` när tabellen är tom. Träningsbyggare (del av milstolpe 5): `coach-platform/src/app/traningspass/[id]/page.tsx` — lägg till/redigera/ta bort/ordna övningsblock (minuter + coachsteg) per pass mot `training_session_blocks`; listan på `/traningspass` länkar varje pass hit. Närvaro + genomförande (del av milstolpe 5): samma sida — närvarosektion med en `<select>` per spelare mot `training_session_attendance` (`attendance_status`-enum: present/absent/late/partial/trial; migration `004_remove_injury_status.sql` omklassar äldre `injured`-värden till frånvaro och tar bort hälsostatusen), "Markera genomfört"-knapp som sätter `training_sessions.status='completed'` via `completeSessionAction`; status-badge i header (utkast/planerat/genomfört). Repo: `listAttendance`/`saveAttendance`/`setSessionStatus` i `coach-platform/src/repositories/postgres.ts`; actions `saveAttendanceAction`/`completeSessionAction` i `coach-platform/src/app/actions.ts`. Kalender (del av milstolpe 5): `coach-platform/src/app/kalender/page.tsx` — månadsvy (måndag-start, 42 celler) med träningspass inhängade och färgade efter status, förra/nästa/idag-navigation via `?m=YYYY-MM`; svensk tid via `toLocaleDateString("sv-SE",{timeZone:"Europe/Stockholm"})`. Länkad från nav (`AppShell.tsx`). Träningsläge (sista delen av milstolpe 5): `coach-platform/src/app/traningspass/[id]/kor/page.tsx` — förenklat genomförandegränssnitt ute på planen; server-komponent laddar pass + block-meta + övningsbibliotek + spelare + närvaro + alla blockens diagram (via `getDiagram`), renderar klientkomponenten `coach-platform/src/components/ConductSession.tsx` (nedräknande timer, stora snabbknappar, svårighetsbedömning, byt övning, närvaropanel, reflektionsformulär). Läs-bara rendering av diagram delas i `coach-platform/src/components/diagram/diagramRender.tsx` (TEAM_COLOR/ARROW_COLOR/ARROW_DASH/resolve/H/pitchMarkings/arrowMarkers — används även av `ExerciseEditor.tsx`) + `coach-platform/src/components/diagram/DiagramView.tsx` (ren serverkomponent, statisk SVG). "Starta träningsläge"-knapp på `/traningspass/[id]`. Genomfört pass sparas separat via `saveConductAction` i `coach-platform/src/app/actions.ts` → `saveConductedSession` i `coach-platform/src/repositories/postgres.ts` mot `conducted_sessions`+`conducted_session_blocks` (migration `002_conducted.sql`); sätter sessionens status till `completed`. Block-meta (coach/area/equipment/group_name) lagras på `training_session_blocks` och editeras i blockbyggaren. Övningsbibliotek (`/ovningar`): klientkomponent `coach-platform/src/components/ExerciseGrid.tsx` filtrerar övningar efter namn/tema. Övningsritarens spelarverktyg har team-väljare (att/def/gk) — klicka befintlig spelare för att byta team (`setObjectTeam` i diagramStore).

> Uppdatering 2026-07-13: övningsritaren är nu statisk; sekvensspelaren och bollinterpoleringen är borttagna. Den har planmallar, separata färgverktyg för spelare/motståndare/målvakt, boll, koner, pinnar, stora mål/minimål, zoner, text och skilda linjer för passning/löpning/dribbling. Spelare och boll har samma visuella storlek. Pilar skapas med två klick eller dra–släpp och får en större osynlig träffyta i markeringsläget. `saveDiagram` använder `sql.json` för `objects` och `actions`.

---

## Feature → filer

| Vill ändra | Läs dessa filer |
| --- | --- |
| **Primär utvecklingsloop** (Idag → mål → observation → historik) | `lib/developmentCore.ts`, `lib/coreActions.ts`, `lib/developmentSync.ts`, `app/(skyddad)/{idag,observera,spelare}/`, `components/{CoreActivityCard,PilotStartField}.tsx` |
| **Transparent uttagningsstöd** (Gul-rättvisa över all Sanktanexponering, rättvisa Gul-lån till Grön, möjligheter och varningar; inget automatval) | `lib/selectionSupport.ts`, `lib/developmentCore.ts` (getSelectionWorkspace), `lib/coreActions.ts` (saveDevelopmentSelection), `app/(skyddad)/uttagning/` |
| **Live-matchrapportering** (klocka, mål, byten, händelser) | `components/LiveTracker.tsx`, `lib/live.ts`, `lib/liveTypes.ts`, `lib/services/mobileLive.ts`, `app/api/live/[id]/route.ts`, `app/api/mobile/v1/matches/[id]/live/route.ts`, `app/(skyddad)/matcher/[id]/live/page.tsx`, native `ios/BSK/{Views/ActivityViews,MatchLiveActivityManager,MatchLiveActivityAttributes}.swift` + `ios/BSKLiveActivity/` |
| **Publik rapporteringscapability** | `lib/liveAccess.ts` (konstanttidsjämförelse), `lib/liveRateLimit.ts` (atomisk match-/rapportörsgräns), `app/api/live/[id]/route.ts`, `app/live/[id]/rapportera/page.tsx`, `components/LiveTracker.tsx`; tränaren kopierar tokenlänken från matchsidan |
| **Live-publik vy / förälderrapport** | `components/LiveFeed.tsx`, `components/LiveScoreboard.tsx`, `components/LiveClock.tsx` (tickande svensk tid överst), `app/live/[id]/`, `lib/live.ts` |
| **Match: skapa/redigera/ta bort, cup, nivå** | `lib/actions.ts` (save/delete/updateCup/setMatchLevel…), `components/MatchForm.tsx`, `app/(skyddad)/matcher/` |
| **Laguttagning / trupp / formation** | `components/SquadBoard.tsx`, `lib/formations.ts`, `lib/positions.ts`, `lib/actions.ts` (saveSquad/saveLineup) |
| **Cupgemensam laguttagning** (uttagna till cupen, default per match) | `components/CupSquadPicker.tsx`, `lib/actions.ts` (saveCupSquad → matchgruppens `player_group_memberships`), `lib/queries.ts` (getGroupMemberIds), `app/(skyddad)/matcher/cup/[slug]/page.tsx` + `…/matcher/[id]/laguttagning/page.tsx` (förväljer cupens trupp) |
| **Spelarutveckling + avstämningar** | `lib/skillTrappan.ts` (gemensam färdighetsmodell), `components/UtvecklingChecklist.tsx` (aktuellt träd), `components/DevelopmentCheckinForm.tsx` (daterad avstämning), `lib/queries.ts` (getPlayerSkillStatuses/getDevelopmentCheckpoints/getLatestDevelopmentCheckpoint), `lib/actions.ts` (setSkillStatus/setSkillNote/createDevelopmentCheckpoint), `app/(skyddad)/spelare/[id]/utveckling/` (översikt + träd + historik), `…/utveckling/avstamning/` (ny avstämning), `…/utvardera/` (kompatibilitetsredirect), `app/(skyddad)/utveckling/` (lagvy), `app/mitt-utvecklingstrad/` (spelarens låsta läsvy) |
| **Äldre SvFF-utvärderingar / självskattning** | `components/SkillRadar.tsx`, `components/DevelopmentChart.tsx`, `components/SelfEvalForm.tsx`, `lib/svff.ts`, `lib/actions.ts` (createEvaluation/submitSelfEval). Befintliga 1–4-utvärderingar visas som äldre historik på spelarprofilen och översätts inte automatiskt till trädet. |
| **Matchutvärdering / utveckling över tid** | `lib/matchEvaluation.ts`, `lib/actions.ts` (saveCoachMatchEvaluations/createMatchEvaluationInvite/savePublicMatchEvaluations), `components/{MatchEvaluationForm,MatchEvaluationTrend}.tsx`, `app/(skyddad)/matcher/[id]/utvardera/`, publik `app/matchutvardering/[token]/`, status på matchsidan och `/idag`, trend på spelarprofilen |
| **Utveckling över tid / diagram** | `components/DevelopmentChart.tsx`, `components/ParticipationChart.tsx`, `lib/queries.ts` (getPlayerDevelopment) |
| **Närvaroimport / närvarotrend** | `lib/attendance.ts`, `lib/actions.ts` (importAttendanceWorkbook), `lib/queries.ts` (getLatestAttendanceImportSummary/getPlayerAttendance*), `components/AttendanceTrendChart.tsx`, `app/(skyddad)/installningar/page.tsx`, `app/(skyddad)/spelare/[id]/page.tsx` |
| **Spelarutdrag och permanent radering** | `lib/playerPrivacy.ts`, `app/api/export/player/[id]/route.ts`, `lib/actions.ts` (erasePlayer), `app/(skyddad)/spelare/[id]/page.tsx`, `docs/GDPR-GRIND.md` |
| **Statistik (säsong/spelare/lag)** | `lib/stats.ts`, `lib/queries.ts` (getSeasonStats/getPlayerMatchStats/getTeamMatchStats), `components/StatsFields.tsx`, `app/(skyddad)/statistik/` |
| **Nivåer / matchning spelare↔match** | `lib/levels.ts`, `lib/queries.ts` (getPlayersLevelInfo) |
| **Kalender / SvFF-import** | `lib/ical.ts`, `lib/svff.ts`, `lib/actions.ts` (importCalendarMatches) |
| **Cup-import via iCal-länk** | `app/(skyddad)/matcher/importera-cup/page.tsx`, `lib/actions.ts` (previewCupImport/importCupMatches), `lib/ical.ts` (calendarName) |
| **Spelarkort (delningslänk)** | `app/spelarkort/[token]/`, `lib/queries.ts` (getPlayerByShareToken/share*), `lib/actions.ts` (generateShareLink) |
| **Inloggning / roller / inbjudan** | `lib/auth.ts`, `lib/organization.ts`, `lib/actions.ts` (playerLogin/acceptInvite/setViewAs + administration), `app/login/`, `app/invite/`, `app/(skyddad)/administration/`, `components/RoleSwitcher.tsx` |
| **BSK → Planlinjen sessionsbrygga och VPS-deploy** | `app/api/auth/coach-bridge/route.ts`, `lib/coachBridge.ts`, `coach-platform/src/lib/{bridge-auth,coach-session}.ts`, `coach-platform/src/proxy.ts`, `coach-platform/deploy/{configure-vps.sh,nginx-bsk2014.conf,nginx-klvr-redirect.conf}`, `.github/workflows/deploy.yml` |
| **Krypterad VPS-databasbackup** | `scripts/backup-vps-databases.sh`, `deploy/backup/{README.md,backup.env.example,bsk-database-backup.service,bsk-database-backup.timer,install-vps-backup.sh}`, `docs/DRIFT-OCH-BITRADEN.md` |
| **Lag, undergrupper och matchgrupper** | `lib/organization.ts`, `lib/db.ts`, `lib/actions.ts` (createGroup/saveGroup), `app/(skyddad)/administration/`, `docs/SPEC-roller-och-grupper.md` |
| **Inställningar / white label** | `lib/actions.ts` (updateSettings), `lib/db.ts` (getSetting/setSetting), `components/Settings*.tsx`, `app/(skyddad)/installningar/` |
| **Branding / logga & tema** | `components/Logo90.tsx` (Logo90Mark + Logo90-lockup, "Stopptidsringen"), `public/{icon,icon-light,logo-mark}.svg`, `app/globals.css` (design-tokens dark+light samt `core-*` för primärvyerna), `app/page.tsx` (landning), `components/Navbar.tsx` |
| **PWA-cache / service worker** | `public/sw.js` (versionsmärkt cache; nätverk först för Next-assets), `components/ServiceWorkerRegistration.tsx` (endast produktion) |
| **Datum / tid (svensk tid!)** | `lib/dates.ts` — använd ALLTID denna, aldrig `toISOString`-datum |
| **DB-access (lågnivå)** | `lib/db.ts` (all/get/run/batch) |

---

## lib/ — exports per fil

- **actions.ts** (server actions): all skrivande logik. Bl.a. login/logout, spelare, `createDevelopmentCheckpoint` + setSkillStatus/setSkillNote, äldre createEvaluation/submitSelfEval, matcher/cuper/laguttagning/live/matchutvärdering, närvaroimport, Sanktan-match- och kallelsehistorik, inställningar, delningslänkar och administration.
- **coreActions.ts**: behörighetskontrollerade skrivflöden för källsynk, aktivitetsfokus, högst två utvecklingsmål, snabba observationer, uttagningsbeslut och pilotmätning.
- **developmentCore.ts**: läsmodeller för de fyra primära vyerna, spelarens mål/evidens/exponering, kallelsesvar härledda från individuella kallelser samt uttagningsarbetsytan och 28-dagars pilotmått.
- **developmentSync.ts**: idempotent spegling från befintliga matcher och senaste Svenska Lag-närvaroimport till utvecklingsaktiviteter/deltagande.
- **selectionSupport.ts**: rena, testade möjlighets-/varningsmeningar samt `recommendYellowSelection`, en deterministisk och osparad rekommendation som rättvisejämför spelare med primärt lag Gul; på Gulmatch används F15/Grön som utfyllnad och på Grönmatch föreslås bara rättvist fördelade Gul-lån.
- **callupSync.ts**: ren validering och statusräkning för kommande Svenska Lag-kallelser; fullständiga korttotaler kan omfatta kallade som saknar aktiv spelarprofil medan individuell rättvisehistorik bara kopplas till kända spelare.
- **queries.ts** (läsande, typer): `Player`, `Evaluation`, `DevelopmentCheckpoint`, `Match` + spelar-/match-/cup-/statistik-/närvarohelpers. Utvecklingshistorik läses via getDevelopmentCheckpoints/getDevelopmentCheckpointSkills/getLatestDevelopmentCheckpoint.
- **attendance.ts**: parser för Svenska Lag-filen `Närvarotillfällen per aktivitet & person`, inklusive datumtolkning, kategorisering och namnnormalisering.
- **db.ts**: postgres.js-klient (Supabase) + ordnad migrationsrunner, `all/get/run/batch`, `getSetting/setSetting/getAllSettings`, `logActivity/getRecentActivity`, `DEFAULT_COLORS` (standardfärger – källa för seed + reset). Baslinjeschema och nya numrerade migrationer bor här.
- **schemaMigrations.ts**: ren validering av migrationsordning och beräkning av vilka migrations-id:n som återstår; används av `db.ts` och testas separat.
- **live.ts**: getLiveState (publik eller rapporteringsdetaljer), recordEvent/undoLastEvent (egen ångra via reporter_key), recordSub/undoLastSub, setClock, togglePlayed, claimStats, finishMatch, clockSeconds.
- **liveTypes.ts**: typer för live (`LiveState`, `LiveEvent`, `LivePlayer`, `LiveAction`…), formatClock/formatEventTime, OPPONENT_GOAL.
- **liveAccess.ts**: validerar den matchspecifika capability-token som krävs för publik rapporteringsläsning och skrivning.
- **liveRateLimit.ts**: atomisk databasräknare för publik liverapportering, max per match och rapportör.
- **playerPrivacy.ts**: versionsmärkt spelarutdrag och transaktionell permanent radering med audit utan barnets namn.
- **coachBridge.ts**: base64url/HMAC-signering av kortlivad tränaridentitet för Planlinjens betrodda proxy.
- **auth.ts**: sex roller, funktionsrättigheter, användarsession, grupp-/spelarscope och kompatibilitetslagret getRole.
- **organization.ts**: läsmodeller för användare, roller, grupper och medlemskap till administrationsvyn.
- **svff.ts**: SvFF-färdigheter — `CATEGORIES`/`ALL_SKILLS`/`SVFF_PRINCIPLES`, skillById/categoryById.
- **skillTrappan.ts**: Utvecklingsträdet — `CATEGORIES`/`SKILLS`/`LEVEL_INFO` (12 kategorier × nivå 1–5), skillsByCategory/skill, statuslogik: isUnlocked/categoryProgress/allCategoryProgress/totalProgress/priorityAreas/nextRecommendedSkill/filterSkills, `SkillStatus`/`StatusMap`/`STATUS_LABEL`/`STATUS_COLOR`.
- **stats.ts**: `STAT_FIELDS`/`CARD_FIELDS`/`LIVE_COUNT_IDS` (definition av vilka stats som finns).
- **levels.ts**: `LEVELS`, level/levelByRank/suggestLevel, fit() (matchar spelarnivå mot matchnivå).
- **formations.ts**: `FORMATIONS`, formation(), positionRole(). **positions.ts**: `POSITIONS`, positionLabel/positionFocus.
- **ical.ts**: parseEvents/extractMatches/fetchCalendar/calendarName/calendarGroup, `CalendarMatch`.
- **dates.ts**: swedishToday/swedishDate/swedishDateOffset, swedishMinutesSinceMidnight, reportingAutoOpen (föräldrarapportering öppnar auto 60 min före avspark) + `AUTO_OPEN_MINUTES_BEFORE`, swedishWallClockToEpoch (svensk väggklocka→epoch, DST-säkert).
- **matchEvaluation.ts**: tvåaxlig matchutvärdering, publika capability-länkar, matchstatus, `matchEvaluationIsOpen` (öppnar 75 minuter efter avspark), konsensus/avvikelse och spelartrend utan poäng eller ELO.

---

## DB-tabeller (definieras i lib/db.ts)

`schema_migrations` (journal över exakt en gång körda schemamigrationer), `settings`, `players` (inkl. `selection_eligible` för generell tillgänglighet i automatiska uttagningsförslag), `evaluations`, `evaluation_scores`, `matches` (inkl. `location`, `report_token`), `match_players`,
`match_events` (inkl. lokal `reporter_key` för egen ångra + `idempotency_key` för offline-replay-skydd), `match_reporters`, `live_rate_limits`, `match_squad`, `match_lineup`, `match_subs` (inkl. `idempotency_key`), `match_evaluation_invites`, `match_player_evaluations`,
`player_self_evals`, `activity_log`, `login_throttle`, `users`, `user_roles`,
`user_permissions`, `groups`, `player_group_memberships`, `user_group_access`, `user_player_links`, `attendance_imports`, `attendance_events`,
`player_skill_status` (aktuellt utvecklingsträd, PK player_id+skill_id), `player_skill_notes`, `development_checkpoints` (daterad avstämning), `development_checkpoint_skills` (snapshot + föregående status + fokus per färdighet).
Utvecklingskärnan använder `development_activities`, `player_development_goals` (max två aktiva slots),
`development_activity_participation`, `development_observations`, `development_selection_decisions`
och `development_pilot_events`. `development_activity_callups` håller Svenska Lag-kallelser separat från faktiskt matchdeltagande.

---

## Routes (app/)

Skyddade primärvyer under `app/(skyddad)/`: `idag`, `observera`, `spelare` (+ `[id]`) och `uttagning`. `oversikt` omdirigerar till `idag`. Sekundära skyddade vyer: matcher (+ `[id]`, laguttagning, live, cup, ny, ny-cup, importera-cup), äldre spelarutvärdering/utveckling, statistik, installningar, administration och mina-spelare.
Publika: `/login`, `/invite`, `/guide`, `/min-profil`, `/mitt-utvecklingstrad`, `/spelare/login`, `/live/[id]` (+ rapportera), `/spelarkort/[token]`, `/matchutvardering/[token]`.
API: `app/api/auth/{google,callback/google,dev,coach-bridge}`, `app/api/live/[id]`, `app/api/export/player/[id]`. `auth/dev` är DEV-ONLY (404 i prod): loggar in utan Google för lokal testning.

Lokal testmiljö: `.env.development.local` pekar `DATABASE_URL` på en lokal Postgres (`bskdev`) i stället för prod. `scripts/seed-dev.mjs` seedar en testmatch idag (trupp + startelva). `scripts/reset-dev-match.mjs` återställer testmatchen till rent pågående tillstånd (behåller trupp/startelva). `scripts/test-live.sh` kör hela end-to-end-testprotokollet för liverapportering (se `docs/TESTPROTOKOLL-live.md`). Alla tre vägrar köra mot icke-lokal DB. Se `projects/bsk-app` i GBrain för uppsättning.

---

## Konventioner

- **Design "Dark Mono v2"**: allt går via CSS-variabler i `app/globals.css` (dark `:root` + `[data-theme="light"]`). Accenten är `--primary` (dynamisk per klubb, sätts på `<body>` i `layout.tsx`); möter ytor via `--primary-wash`/`--primary-line` (color-mix), aldrig stor solid yta. `--live` är fast signal, grain styrs av `--grain-blend`/`--grain-opacity`. Inga skuggor — djup via nivåer (`--bg`/`--bg2`/`--bg3`) + borders (`--line`/`--line-2`).
- **Svensk tid**: använd `lib/dates.ts`. Vercel kör UTC — aldrig råa `toISOString`-datum.
- **Skriv = server action i actions.ts**, **läs = queries.ts**. Lågnivå-SQL via `lib/db.ts` (`all/get/run/batch`).
- **Schemaändring**: ändra aldrig en redan driftsatt baslinje. Lägg ett nytt, stigande id sist i `SCHEMA_MIGRATIONS`; journalen kör varje migration exakt en gång.
- **Primärt lag**: en aktiv spelare med exakt ett aktivt medlemskap i en ordinarie undergrupp får detta medlemskap primärmarkerat av migration `0002`; cup- och matchgrupper är alltid sekundära.
- **Git**: `git push` direkt efter commit.
- Öppna punkter samlas i `docs/BACKLOG.md`. GDPR-produktionsgrinden finns i `docs/GDPR-GRIND.md`. Större detaljspec finns i `docs/SPEC-matchbetyg.md`, `docs/SPEC-matchgrupper.md` (ersatt av den byggda gruppmodellen) och `docs/STAGING.md`.

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
## Mobile API och nativegrund

- `lib/services/development.ts` är transportoberoende servicelager för den
  första nativevertikalen. Det äger gruppscope, permissions, läsmodeller,
  observationsvalidering, idempotens och audit.
- `lib/mobileApi.ts` formar versionsmärkta JSON-svar och löser tills vidare
  både BSK:s befintliga webbsession och native bearer-session.
- `lib/mobileAuth.ts` äger OAuth state, S256-PKCE, engångskod, access-token,
  roterande refresh-token och återkallningsbara enhetssessioner. Flödet och
  Keychain-kontraktet finns i `docs/NATIVE_AUTH.md`.
- `app/api/mobile/v1/players/` och `app/api/mobile/v1/activities/` exponerar
  trupp, spelardetalj, aktiviteter och skrivning av observationer.
- `lib/services/mobileLive.ts` och `app/api/mobile/v1/matches/[id]/live/`
  exponerar behörighetsstyrd matchklocka, mål och ångra för nativeklienten.
- API-kontraktet finns i `docs/MOBILE_API_V1.yaml`. Planlinjen är uttryckligen
  utanför nuvarande scope; `docs/MOBILE_DATA_MAPPING.md` är endast en parkerad
  framtidsreferens.
- `ios/BSK.xcodeproj` är den universella SwiftUI-klienten för iPhone och iPad.
  `ios/BSK/Auth` innehåller ASWebAuthenticationSession, PKCE och Keychain;
  `ios/BSK/Networking` innehåller tokenrefresh och Mobile API-modeller; vyerna
  använder separata adaptiva flöden för kompakt navigation och
  `NavigationSplitView`. Appikonen ligger i `ios/BSK/Assets.xcassets` med
  redigerbart original i `ios/Design`. Kör- och konfigurationsnoter finns i
  `ios/README.md`. Nativeversioner börjar på `v0.001`/build `1` och räknas upp
  ett steg vid varje faktisk installation eller distribution, inte vid rena
  simulatorbyggen. Live Activity startas när appen körs inom 45 minuter före
  avspark, visar samling/nedräkning och uppdateras från matchcentret; exakt start
  med helt stängd app kräver framtida APNs-stöd.
