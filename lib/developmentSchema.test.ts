import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const coreActions = readFileSync(new URL("./coreActions.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const mobileDevelopment = readFileSync(new URL("./services/development.ts", import.meta.url), "utf8");

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
  });

  it("återanvänder äldre manuella matchaktiviteter och gör upsert på match-id", () => {
    const saveMatchStart = actions.indexOf("export async function saveMatch");
    const cupStart = actions.indexOf("// ---- Cup-hantering", saveMatchStart);
    const saveMatch = actions.slice(saveMatchStart, cupStart);

    expect(mobileDevelopment).toContain("da.external_source IN ('manual', 'manual_match')");
    expect(saveMatch).toContain("ON CONFLICT (match_id) WHERE match_id IS NOT NULL DO UPDATE SET");
    expect(saveMatch).toContain("external_source = excluded.external_source");
  });
});
