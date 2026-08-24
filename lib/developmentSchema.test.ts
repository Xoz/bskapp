import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const coreActions = readFileSync(new URL("./coreActions.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const mobileDevelopment = readFileSync(new URL("./services/development.ts", import.meta.url), "utf8");
const mobileDevelopmentRoute = readFileSync(new URL("../app/api/mobile/v1/players/[id]/development/route.ts", import.meta.url), "utf8");
const mobileMatchEvaluation = readFileSync(new URL("./services/matchEvaluationMobile.ts", import.meta.url), "utf8");
const mobileLive = readFileSync(new URL("./services/mobileLive.ts", import.meta.url), "utf8");
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
    expect(mobileDevelopment).toContain("windowMatchCount: recentMatches.length +");
    expect(nativeActivityViews).toContain('Text("Belastning ±7 dagar")');
    expect(nativeActivityViews).not.toContain('Text("\\(player.capacity) %")');
  });

  it("samlar veckans operativa signaler på Idag-vyn", () => {
    for (const label of ["Underbemannade", "Inväntar svar", "Hög belastning", "Att göra"]) {
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
    expect(mobileDevelopment).toContain('currentCallupStatus === "accepted" ? "selected"');
    const saveStart = mobileDevelopment.indexOf("export async function saveMobileSelection");
    const saveEnd = mobileDevelopment.indexOf("function validateCommand", saveStart);
    expect(mobileDevelopment.slice(saveStart, saveEnd)).not.toContain("INSERT INTO development_activity_participation");
    expect(nativeMainSplitView).toContain("match.hasConfirmedSquad ? match.squadCount : match.acceptedCallupCount");
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
    expect(nativeMainSplitView).toContain(".filter { !$0.evaluationReady }");
    expect(nativeMainSplitView).toContain(".filter(\\.evaluationReady)");
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
