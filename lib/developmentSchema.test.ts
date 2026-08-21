import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const coreActions = readFileSync(new URL("./coreActions.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const mobileDevelopment = readFileSync(new URL("./services/development.ts", import.meta.url), "utf8");
const developmentCore = readFileSync(new URL("./developmentCore.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
const nativeActivityViews = readFileSync(new URL("../ios/BSK/Views/ActivityViews.swift", import.meta.url), "utf8");

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
    expect(mobileDevelopment.slice(activitiesStart, selectionStart)).toContain("da.match_id IS NOT NULL");
  });

  it("visar canonical Gul-matcher och gör upsert på match-id", () => {
    const saveMatchStart = actions.indexOf("export async function saveMatch");
    const cupStart = actions.indexOf("// ---- Cup-hantering", saveMatchStart);
    const saveMatch = actions.slice(saveMatchStart, cupStart);

    expect(mobileDevelopment).toContain("EXISTS (SELECT 1 FROM groups g WHERE g.id = da.group_id AND g.name = 'Gul')");
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

  it("refererar inte den borttagna ELO-tabellen", () => {
    expect(queries).not.toContain("FROM match_ratings");
  });
});
