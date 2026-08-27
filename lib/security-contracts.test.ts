import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("säkerhetskontrakt", () => {
  it("avgränsar matchutvärderingar till matchens trupp och deltagare", () => {
    const actions = read("lib/actions.ts");
    const evaluation = read("lib/matchEvaluation.ts");
    const roster = read("lib/matchRoster.ts");
    const start = actions.indexOf("async function persistMatchEvaluations");
    const end = actions.indexOf("export async function saveCoachMatchEvaluations", start);
    const implementation = actions.slice(start, end);
    expect(implementation).toContain("getMatchEvaluationWorkspace(matchId, contributorType, contributorId)");
    expect(evaluation).toContain("resolveMatchRoster(matchId)");
    expect(evaluation).toContain("p.id IN (${marks})");
    expect(roster).toContain("FROM match_roster roster");
    expect(roster).toContain("FROM match_players mp");
    expect(roster).toContain("roster.selection_status = 'selected'");
    expect(roster).toContain('"played",');
    expect(roster).toContain('"confirmed",');
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

  it("samordnar native token-refresh och loggar inte ut vid tillfälliga fel", () => {
    const client = read("ios/BSK/Networking/APIClient.swift");
    const appModel = read("ios/BSK/AppModel.swift");
    const keychain = read("ios/BSK/Auth/KeychainStore.swift");
    expect(client).toContain("private var refreshTask: Task<TokenPair, Error>?");
    expect(client).toContain("if let refreshTask");
    expect(client).toContain("self.rotateRefreshToken()");
    expect(client).toContain("current.accessToken != failedAccessToken");
    expect(client).toContain("refresh(afterUsing: accessToken)");
    expect(appModel).toContain("if case APIClientError.unauthorized = error");
    expect(appModel).toContain("guard phase == .loading, !isRestoringSession else { return }");
    expect(appModel).toContain("Ett tillfälligt nät-, server- eller Keychain-fel är inte en");
    expect(keychain).toContain("kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly");
  });
});
