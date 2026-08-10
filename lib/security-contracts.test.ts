import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("säkerhetskontrakt", () => {
  it("avgränsar matchbetyg till faktiska matchdeltagare", () => {
    const actions = read("lib/actions.ts");
    const start = actions.indexOf("export async function saveMatchRatings");
    const end = actions.indexOf("export async function saveSquad", start);
    const implementation = actions.slice(start, end);
    expect(implementation).toContain("JOIN match_players mp ON mp.player_id = p.id");
    expect(implementation).toContain("WHERE mp.match_id = ?");
  });

  it("kräver capability-token för publik liverapportering", () => {
    const route = read("app/api/live/[id]/route.ts");
    expect(route).toContain("hasReportingCapability");
    expect(route).toContain("Rapporteringslänken är ogiltig");
  });

  it("använder atomisk databasräknare för samtidiga publika rapportörer", () => {
    const limiter = read("lib/liveRateLimit.ts");
    expect(limiter).toContain("ON CONFLICT(match_id, reporter_key) DO UPDATE");
    expect(limiter).toContain("live_rate_limits.event_count < ?");
    expect(limiter).toContain('consume(matchId, "__match__", 60, now)');
  });

  it("kräver utökad behörighet och bekräftelse för permanent spelarradering", () => {
    const actions = read("lib/actions.ts");
    const start = actions.indexOf("export async function erasePlayer");
    const end = actions.indexOf("// ---- Utvärderingar", start);
    const implementation = actions.slice(start, end);
    expect(implementation).toContain('hasPermission("manage_users")');
    expect(implementation).toContain('formData.get("confirmation")');
    expect(implementation).toContain("erasePlayerData");
  });
});
