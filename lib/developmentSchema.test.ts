import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const coreActions = readFileSync(new URL("./coreActions.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const mobileDevelopment = readFileSync(new URL("./services/development.ts", import.meta.url), "utf8");
const mobileDevelopmentRoute = readFileSync(new URL("../app/api/mobile/v1/players/[id]/development/route.ts", import.meta.url), "utf8");
const mobileConversationsRoute = readFileSync(new URL("../app/api/mobile/v1/players/[id]/conversations/route.ts", import.meta.url), "utf8");
const mobileMatchEvaluation = readFileSync(new URL("./services/matchEvaluationMobile.ts", import.meta.url), "utf8");
const mobileLive = readFileSync(new URL("./services/mobileLive.ts", import.meta.url), "utf8");
const matchRoster = readFileSync(new URL("./matchRoster.ts", import.meta.url), "utf8");
const developmentCore = readFileSync(new URL("./developmentCore.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
const nativeActivityViews = readFileSync(new URL("../ios/BSK/Views/ActivityViews.swift", import.meta.url), "utf8");
const nativeMainSplitView = readFileSync(new URL("../ios/BSK/Views/MainSplitView.swift", import.meta.url), "utf8");
const nativeAppModel = readFileSync(new URL("../ios/BSK/AppModel.swift", import.meta.url), "utf8");
const nativePlayerViews = readFileSync(new URL("../ios/BSK/Views/PlayerViews.swift", import.meta.url), "utf8");
const nativeLiveActivity = readFileSync(new URL("../ios/BSK/MatchLiveActivityManager.swift", import.meta.url), "utf8");
const todayPage = readFileSync(new URL("../app/(skyddad)/idag/page.tsx", import.meta.url), "utf8");
const playerPage = readFileSync(new URL("../app/(skyddad)/spelare/[id]/page.tsx", import.meta.url), "utf8");

describe("utvecklingskärnans kontrakt", () => {
  it("har alla fyra beständiga kärnobjekt och pilotmätning", () => {
    for (const table of [
      "development_activities",
      "player_development_goals",
      "development_activity_participation",
      "development_observations",
      "development_selection_decisions",
      "development_pilot_events",
    ]) {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("begränsar spelaren till två aktiva mål genom slots och unikt index", () => {
    expect(schema).toContain("CHECK (slot IN (1, 2))");
    expect(schema).toContain("idx_development_goals_active_slot");
    expect(schema).toContain("WHERE status = 'active'");
  });

  it("exponerar samma samlade utvecklingsbild i native utan direkta snabbändringar", () => {
    expect(mobileDevelopmentRoute).toContain("export async function GET");
    expect(mobileDevelopmentRoute).toContain("export async function PUT");
    expect(mobileDevelopment).toContain("export async function getMobilePlayerDevelopment");
    expect(mobileDevelopment).toContain("export async function updateMobilePlayerDevelopment");
    expect(mobileDevelopment).toContain("development_checkpoints");
    expect(mobileDevelopment).toContain("development_checkpoint_skills");
    expect(mobileDevelopment).toContain("focusIds.length > 2");
    expect(nativePlayerViews).toContain("PlayerDevelopmentUpdateSheet");
    expect(nativePlayerViews).not.toContain("setSkillStatus");
    expect(nativePlayerViews).toContain("Välj status för färdigheterna och spara allt samlat.");
    expect(nativePlayerViews).toContain("statuses[skill.id] = status");
    expect(nativePlayerViews).not.toContain(".pickerStyle(.menu)");
  });

  it("sparar spelarsamtal separat från utvecklingsträdets historik", () => {
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS player_conversations");
    expect(schema).toContain("0016-player-conversations");
    expect(queries).toContain("export async function getPlayerConversations");
    expect(coreActions).toContain("export async function createPlayerConversation");
    expect(mobileConversationsRoute).toContain("export async function POST");
    expect(mobileDevelopment).toContain("export async function createMobilePlayerConversation");
    expect(mobileDevelopment).toContain("Skriv minst en samtalsanteckning.");
    expect(playerPage).toContain("Spara spelarsamtal");
    expect(playerPage).toContain("Samtalet sparas separat från utvecklingsträdet.");
    expect(nativePlayerViews).toContain("NewConversationSheet");
    expect(nativePlayerViews).toContain('SectionTitle("Spelarsamtal")');
    expect(nativePlayerViews).toContain("isSaving || isEmpty");
  });

  it("skyddar osynkat native-arbete och blockerar falska sparningar", () => {
    expect(nativeAppModel).toContain("guard !hasPendingOfflineWork else");
    expect(nativeAppModel).not.toContain("queuedObservations = []");
    expect(nativeAppModel).not.toContain("queuedMatchEvaluations = []");
    expect(nativeMainSplitView).toContain('alert("Synkning krävs"');
    expect(nativePlayerViews).toContain("isSaving || !hasChanges");
    expect(mobileDevelopment).toContain("if (!hasChanges) return getMobilePlayerDevelopment");
    expect(nativeActivityViews).toContain("isSaving || !currentAnswerIsComplete");
    expect(nativeActivityViews).toContain('savedMessage = "\\(incompleteIndices.count) spelare kvar"');
    expect(mobileMatchEvaluation).toContain("hasPartialAssessment");
  });

  it("upprätthåller utvecklingsträdets ordning i både native och server", () => {
    expect(nativePlayerViews).toContain('isUnlocked: index == 0 || statuses[category.skills[index - 1].id] == "done"');
    expect(nativePlayerViews).toContain('Label("Slutför föregående steg först", systemImage: "lock.fill")');
    expect(nativePlayerViews).toContain('statuses[dependentID] = "not_started"');
    expect(mobileDevelopment).toContain("statusOf(next, skill.id) !== \"not_started\" && !isUnlocked(skill, next)");
    expect(mobileDevelopment).toContain("En låst färdighet kan inte väljas som fokus.");
  });

  it("kräver minst en spelare i uttagningen på både telefon och bred layout", () => {
    expect(nativeMainSplitView.match(/disabled\(isSaving \|\| selectedCount == 0\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(nativeActivityViews).toContain("disabled(isSaving || selectedCount == 0)");
  });

  it("visar beständiga fellägen med återförsök i native", () => {
    expect(nativeAppModel).toContain("attempts >= 3");
    expect(nativeAppModel).toContain("restoreError = error.localizedDescription");
    expect(nativeMainSplitView).toContain('Label("Kunde inte läsa uttagningen"');
    expect(nativeMainSplitView).toContain('Button("Försök igen") { Task { await load() } }');
    expect(nativeActivityViews).toContain('Label("Kunde inte hämta matchtruppen"');
    expect(nativeActivityViews).toContain('Label("Kunde inte hämta laguppställningen"');
    expect(nativeActivityViews).toContain('Label("Kunde inte öppna Matchcenter"');
    expect(nativeActivityViews).toContain('Label("Kunde inte läsa utvärderingen"');
    expect(nativeActivityViews).toContain("guard loadError == nil else");
  });

  it("har konsekvent terminologi, behörighet och visuella native-kontroller", () => {
    expect(nativeMainSplitView).toContain("case matches");
    expect(nativeMainSplitView).not.toContain("case observe");
    expect(nativeMainSplitView).toContain('return user.permissions.contains("view_matches")');
    expect(nativeMainSplitView).toContain('case .evaluate: return "Att utvärdera"');
    expect(nativePlayerViews).toContain('TextField("Sök spelare", text: $searchText)');
    expect(nativePlayerViews).not.toContain('.searchable(text: $searchText');
    expect(nativePlayerViews).toContain('team == "Gul" ? BSKTheme.teamYellow');
    expect(nativePlayerViews).toContain('Toggle("Planera uppföljning"');
    expect(nativePlayerViews).toContain("Inga observationer registrerade ännu.");
    expect(nativeActivityViews).toContain('permissions.contains("report_matches")');
    expect(nativeActivityViews).toContain('Text("Matcher att följa upp")');
  });

  it("låter sista kortet rullas helt ovanför den dockade native-menyn", () => {
    const nativeTheme = readFileSync(new URL("../ios/BSK/BSKApp.swift", import.meta.url), "utf8");
    expect(nativeMainSplitView).toContain(".safeAreaInset(edge: .bottom, spacing: 0) { compactNavigation }");
    expect(nativeMainSplitView).toContain(".background(.ultraThinMaterial)");
    expect(nativeTheme).toContain("BSKCompactTabClearance");
    expect(nativeTheme).toContain("horizontalSizeClass == .compact ? 88 : 0");
    expect(nativePlayerViews).toContain(".bskCompactTabClearance()");
    expect(nativeActivityViews.match(/\.bskCompactTabClearance\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(nativeMainSplitView.match(/\.bskCompactTabClearance\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("öppnar alla native-matchingångar i ett gemensamt matchnav", () => {
    expect(nativeActivityViews).toContain("enum MatchWorkspaceSection");
    expect(nativeActivityViews).toContain("struct MatchWorkspaceView");
    expect(nativeActivityViews).toContain('case .overview: return "Översikt"');
    expect(nativeActivityViews).toContain('case .roster: return "Trupp"');
    expect(nativeActivityViews).toContain('case .matchCenter: return "Matchcenter"');
    expect(nativeActivityViews).toContain('case .evaluation: return "Utvärdera"');
    expect(nativeActivityViews).toContain("if activity.evaluationReady,");
    expect(nativeActivityViews).toContain("dismissOnComplete: false");
    expect(nativeActivityViews).toContain("PremiumSelectionDetail(match: selectionMatch)");
    expect(nativeMainSplitView.match(/MatchWorkspaceView\(/g)?.length).toBeGreaterThanOrEqual(5);
    expect(nativeMainSplitView).toContain("shouldStartEvaluation(activity) ? .evaluation : .overview");
    expect(nativeMainSplitView).toContain("initialSection: .roster");
    expect(nativeMainSplitView).toContain("await model.reload()");
  });

  it("ger native spelarlistan lagmedlemskap och startar filtret med Gul", () => {
    expect(mobileDevelopment).toContain("AS team_names");
    expect(mobileDevelopment).toContain("teamNames: player.team_names");
    expect(nativePlayerViews).toContain('@State private var selectedTeam = "Gul"');
    expect(nativePlayerViews).toContain('selectTeam("Gul")');
    expect(nativePlayerViews).toContain("player.teamNames.contains(selectedTeam)");
    expect(mobileDevelopment.match(/g\.group_type = 'subgroup'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(nativePlayerViews).not.toMatch(/\bcom\b|\bcomp\b|\bfriendly\b/i);
  });

  it("sparar tränarens explicita beslut i stället för automatval", () => {
    expect(coreActions).toContain('formData.getAll("selected_player")');
    expect(coreActions).toContain('decision === "selected" ? 1 : 0');
    expect(coreActions).not.toMatch(/auto.?select|automatic.?selection/i);
  });

  it("skriver inte till aktivitetsregistret när native-listor läses", () => {
    const activitiesStart = mobileDevelopment.indexOf("export async function listMobileActivities");
    const selectionStart = mobileDevelopment.indexOf("export async function listMobileSelectionMatches", activitiesStart);
    const workspaceStart = mobileDevelopment.indexOf("export async function getMobileSelectionWorkspace", selectionStart);

    expect(mobileDevelopment.slice(activitiesStart, selectionStart)).not.toContain("await run(");
    expect(mobileDevelopment.slice(selectionStart, workspaceStart)).not.toContain("await run(");
    expect(mobileDevelopment).not.toContain("ensureManualMatchActivities");
    expect(mobileDevelopment.slice(activitiesStart, selectionStart)).toContain("JOIN matches linked_match ON linked_match.id = da.match_id");
  });

  it("visar canonical Gul- och Grönmatcher och gör upsert på match-id", () => {
    const saveMatchStart = actions.indexOf("export async function saveMatch");
    const cupStart = actions.indexOf("// ---- Cup-hantering", saveMatchStart);
    const saveMatch = actions.slice(saveMatchStart, cupStart);

    expect(mobileDevelopment).toContain("match_group.name IN ('Gul', 'Grön')");
    expect(mobileDevelopment).toContain("loaned_player_names");
    expect(mobileDevelopment).toContain("callup.attendance_status IN ('present', 'unknown')");
    expect(saveMatch).toContain("ON CONFLICT (match_id) WHERE match_id IS NOT NULL DO UPDATE SET");
    expect(saveMatch).toContain("external_source = excluded.external_source");
    expect(actions).toContain("UPDATE development_activities existing_activity");
    expect(actions).toContain("SET match_id = NULL");
  });

  it("använder matches och match_players som enda produktkälla för spelade matcher", () => {
    expect(mobileDevelopment).not.toContain("player_competition_match_players");
    expect(mobileDevelopment).not.toContain("player_competition_match_counts");
    expect(developmentCore).not.toContain("player_competition_match_players");
    expect(developmentCore).not.toContain("player_competition_match_counts");
    expect(mobileDevelopment).toContain("FROM match_players mp");
    expect(developmentCore).toContain("FROM match_players mp");
    expect(schema).toContain('id: "0007-canonical-played-matches"');
    expect(schema).toContain('id: "0009-correct-erikslund-group"');
    expect(schema).toContain("INSERT INTO match_players (match_id, player_id)");
  });

  it("läser normaliserad närvaro i spelarstatistik", () => {
    const attendanceStart = queries.indexOf("export async function getPlayerAttendanceOverview");
    const attendanceEnd = queries.indexOf("export async function getLatestSelfEval", attendanceStart);
    const attendanceQueries = queries.slice(attendanceStart, attendanceEnd);

    expect(attendanceQueries).toContain("FROM development_activity_participation dap");
    expect(attendanceQueries).not.toContain("FROM attendance_events");
    expect(attendanceQueries).not.toContain("FROM attendance_imports");
  });

  it("räknar belastning som matcher sju dagar före och efter målmatchen", () => {
    for (const source of [developmentCore, mobileDevelopment]) {
      expect(source).toContain("INTERVAL '7 days'");
      expect(source).toContain("window_match_count");
      expect(source).toContain("FROM match_players played");
      expect(source).toContain("FROM match_squad squad");
    }
    expect(schema).toContain('id: "0010-canonical-coach-assessment"');
    expect(schema).toContain("players_assessed_level_check");
  });

  it("visar mobil belastning som antal spelade och planerade matcher ±7 dagar", () => {
    expect(mobileDevelopment).toContain("const windowEnd = swedishDateOffset(7)");
    expect(mobileDevelopment).toContain("da.activity_date >= ? AND da.activity_date <= ?");
    expect(mobileDevelopment).toContain("const load = assessMatchLoad(recentMatches.length, upcomingMatches.length)");
    expect(mobileDevelopment).toContain("windowMatchCount: load.totalMatchCount");
    expect(mobileDevelopment).toContain("loadLevel: load.level");
    expect(nativeActivityViews).toContain('Text("Belastning ±7 dagar")');
    expect(nativeActivityViews).not.toContain('Text("\\(player.capacity) %")');
  });

  it("samlar veckans operativa signaler på Idag-vyn", () => {
    for (const label of ["Underbemannade", "Inväntar svar", "Vid maxgränsen", "För hög belastning", "Att göra"]) {
      expect(todayPage).toContain(label);
    }
    expect(todayPage).toContain("activity.has_confirmed_squad ? Number(activity.squad_count)");
    expect(mobileDevelopment).toContain("acceptedCallupCount: Number(row.accepted_callup_count)");
    expect(nativeActivityViews).toContain('Text("VECKANS LÄGE")');
    expect(nativeActivityViews).toContain("activity.hasConfirmedSquad ? activity.squadCount : activity.acceptedCallupCount");
    expect(nativeActivityViews).toContain('$0.sourceTeam == "Gul" || $0.sourceTeam == "Grön"');
    expect(todayPage).toContain('row.activity.source_team === "Gul"');
    expect(nativeActivityViews).toContain('guard activity.sourceTeam == "Gul" else { return false }');
  });

  it("refererar inte den borttagna ELO-tabellen", () => {
    expect(queries).not.toContain("FROM match_ratings");
  });

  it("städar bort oanvända framtida kalendermatcher som försvunnit ur källan", () => {
    expect(actions).toContain("m.external_uid NOT IN (${marks})");
    expect(actions).toContain("m.source = 'calendar'");
    expect(actions).toContain("NOT EXISTS (SELECT 1 FROM match_squad");
    expect(actions).toContain("DELETE FROM development_activities da");
    expect(schema).toContain('id: "0011-remove-stale-erikslund-calendar-match"');
    expect(schema).toContain('id: "0012-svenskalag-file-imports"');
  });

  it("normaliserar matchkortens nivå och visar tom nivå som öppen klass", () => {
    expect(mobileDevelopment).toContain("THEN 'Extra svår'");
    expect(mobileDevelopment).toContain("THEN 'Svår'");
    expect(mobileDevelopment).toContain("THEN 'Medel'");
    expect(mobileDevelopment).toContain("THEN 'Lätt'");
    expect(mobileDevelopment).toContain("ELSE 'Öppen klass'");
    expect(nativeActivityViews).toContain("Text(activity.matchLevel)");
  });

  it("färgkodar Gul och Grön på matchkorten", () => {
    expect(nativeMainSplitView).toContain('team == "Gul" ? BSKTheme.teamYellow : BSKTheme.accent');
    expect(nativeActivityViews).toContain('activity.sourceTeam == "Gul" ? BSKTheme.teamYellow : BSKTheme.accent');
  });

  it("använder match_squad som facit efter bekräftad uttagning", () => {
    expect(mobileDevelopment).toContain("FROM match_squad squad WHERE squad.match_id = m.id");
    expect(mobileDevelopment).toContain("hasConfirmedSquad: row.has_confirmed_squad");
    expect(mobileDevelopment).toContain('currentCallupStatus === "accepted"\n          ? "selected"');
    const saveStart = mobileDevelopment.indexOf("export async function saveMobileSelection");
    const saveEnd = mobileDevelopment.indexOf("function validateCommand", saveStart);
    expect(mobileDevelopment.slice(saveStart, saveEnd)).not.toContain("INSERT INTO development_activity_participation");
    expect(nativeMainSplitView).toContain("match.hasConfirmedSquad ? match.squadCount : match.acceptedCallupCount");
  });

  it("använder samma truppkälla i matchkort, observation, Matchcenter och utvärdering", () => {
    expect(mobileDevelopment).toContain("resolveMatchRosters");
    expect(mobileDevelopment).toContain("resolveMatchRoster(target.match_id)");
    expect(mobileLive).toContain("resolveMatchRoster(matchId)");
    expect(matchRoster).toContain("const PLAYED_PRIORITY");
    expect(matchRoster).toContain('"played",');
    expect(matchRoster).toContain('"confirmed",');
    expect(matchRoster).toContain('"accepted",');
    expect(matchRoster).toContain("callup.attendance_status = 'unknown'");
    expect(matchRoster).toContain("callup_match.date >= to_char(now() AT TIME ZONE 'Europe/Stockholm'");
    expect(nativeActivityViews).toContain("activity.rosterPlayerNames");
    expect(nativeMainSplitView).toContain("activity.rosterLabel");
  });

  it("visar truppen på Gul- och Grönkort men håller Uttagning till Gul", () => {
    const activitiesStart = mobileDevelopment.indexOf("export async function listMobileActivities");
    const selectionStart = mobileDevelopment.indexOf("export async function listMobileSelectionMatches");
    const workspaceStart = mobileDevelopment.indexOf("export async function getMobileSelectionWorkspace", selectionStart);
    const activities = mobileDevelopment.slice(activitiesStart, selectionStart);
    expect(activities).toContain("match_group.name IN ('Gul', 'Grön')");
    expect(activities).toContain("squad_player_names");
    expect(activities).toContain("accepted_player_names");
    expect(mobileDevelopment.slice(selectionStart, workspaceStart)).toContain("g.name = 'Gul'");
    expect(nativeMainSplitView).toContain('activity.squadPlayerNames.isEmpty ? "Tackat ja" : "Trupp"');
    expect(nativeMainSplitView).toContain("activity.acceptedPlayerNames");
    expect(todayPage).toContain('row.activity.source_team === "Gul"');
    expect(nativeActivityViews).toContain('guard activity.sourceTeam == "Gul" else { return false }');
  });

  it("sparar manuellt slutresultat och AI-redo tränarkommentar i utvärderingen", () => {
    expect(schema).toContain('id: "0013-match-evaluation-context"');
    expect(schema).toContain("evaluation_comment TEXT NOT NULL DEFAULT ''");
    expect(mobileMatchEvaluation).toContain("m.clock_offset > 0 OR m.clock_started_at IS NOT NULL");
    expect(mobileMatchEvaluation).toContain("Resultatet kommer från Matchcenter och kan inte ändras här.");
    expect(mobileMatchEvaluation).toContain("SET our_score = ?, opponent_score = ?, evaluation_comment = ?");
    expect(nativeActivityViews).toContain('Text("Manuellt slutresultat")');
    expect(nativeActivityViews).toContain('TextField("Tränarkommentar för matchanalys…"');
    expect(nativeActivityViews).toContain('Label("Spara matchinfo"');
  });

  it("flyttar matchen från kommande till utvärdering efter 90 minuter", () => {
    expect(mobileDevelopment.match(/INTERVAL '90 minutes'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(mobileMatchEvaluation).toContain("m.finished = 1");
    expect(mobileMatchEvaluation).toContain("INTERVAL '90 minutes'");
    expect(developmentCore.match(/INTERVAL '90 minutes'/g)?.length).toBe(2);
    expect(nativeMainSplitView).toContain(".filter(needsEvaluation)");
    expect(nativeMainSplitView).toContain('case .evaluate: return "Att utvärdera"');
  });

  it("samlar utvärderingen under Matcher och använder huvudfliken för Träningar", () => {
    expect(nativeMainSplitView).toContain('case .trainings: return "Träningar"');
    expect(nativeMainSplitView).not.toContain('case .evaluate: return "Utvärdera"');
    expect(nativeMainSplitView).toContain('case .completed: return "Klart"');
    expect(nativeMainSplitView).toContain("TrainingWorkspaceList(selection:");
    expect(nativeMainSplitView).toContain("activity.evaluationCompleted");
    expect(mobileDevelopment).toContain("export async function listMobileTrainings");
    expect(mobileDevelopment).toContain("da.activity_type = 'training'");
    expect(mobileDevelopment).toContain("da.activity_date >= to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD')");
    expect(nativeMainSplitView).not.toContain('trainingSection(title: "Genomförda"');
    expect(mobileDevelopment).toContain("acceptedPlayerNames");
    expect(nativeMainSplitView).toContain('Label("Tackat ja"');
    expect(mobileDevelopment).toContain("linked_match.evaluation_closed_at IS NOT NULL AS evaluation_completed");
  });

  it("behandlar Grön som skrivskyddad information utan Live Activity", () => {
    expect(nativeAppModel).toContain('activity.sourceTeam == "Gul"');
    expect(nativeAppModel).toContain("MatchLiveActivityManager.end(matchID: matchID)");
    expect(nativeLiveActivity).toContain("guard isEnabled else");
    expect(nativeActivityViews).toContain('Label("Endast information"');
    expect(nativeActivityViews).toContain('if activity.sourceTeam != "Grön"');
    expect(mobileLive).toContain('row?.team_name !== "Gul"');
    expect(mobileLive).toContain("Grönmatcher är endast information och kan inte hanteras här.");
  });

  it("är kompatibel med PostgreSQL på Idag och spelarprofilen", () => {
    expect(developmentCore).toContain("GROUP BY da.id, m.id, m.level, g.group_type, g.name");
    expect(playerPage).not.toContain("level_assessed_at.slice");
    expect(playerPage).toContain("formatMatchDate(summary.player.level_assessed_at)");
  });
});
