import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./auth", () => ({
  getCurrentUser: vi.fn(),
  canAccessPlayer: vi.fn(),
}));
vi.mock("./db", () => ({ all: vi.fn(), get: vi.fn(), run: vi.fn() }));
import { getCurrentUser, canAccessPlayer } from "./auth";
import { all, get, run } from "./db";
import { saveTreeConversation } from "./treeConversationActions";
import { SKILLS } from "./skillTrappan";
let stored: Record<string, unknown> | undefined;
function form() {
  const f = new FormData();
  Object.entries({
    command_id: "10000000-0000-4000-8000-000000000012",
    conversation_date: "2026-09-09",
    checkpoint_id: "checkpoint",
    outcome: "continue",
  }).forEach(([k, v]) => f.set(k, v));
  return f;
}
beforeEach(() => {
  vi.resetAllMocks();
  stored = undefined;
  vi.mocked(getCurrentUser).mockResolvedValue({
    name: "Test",
    permissions: ["manage_evaluations", "view_private_player_data"],
  } as never);
  vi.mocked(canAccessPlayer).mockResolvedValue(true);
  vi.mocked(all).mockResolvedValue([
    { skill_id: SKILLS[0].id, status: "training", is_focus: 1 },
  ]);
  vi.mocked(get).mockImplementation(async (sql) =>
    sql.includes("FROM development_checkpoints")
      ? { id: "checkpoint", date: "2026-09-08" }
      : (stored as never),
  );
  vi.mocked(run).mockImplementation(async (_sql, args) => {
    if (!stored) {
      const a = args!;
      stored = {
        player_id: a[1],
        conversation_date: a[2],
        coach_summary: a[4],
        player_perspective: a[5],
        agreed_actions: a[6],
        follow_up_on: a[7] || null,
        development_checkpoint_id: a[8],
      };
    }
    return [] as never;
  });
});
describe("save tree conversation", () => {
  it("saves explicit focus agreement with no manual text and safely replays", async () => {
    expect(await saveTreeConversation(12, form())).toEqual({ saved: true });
    const original = { ...stored };
    expect(await saveTreeConversation(12, form())).toEqual({ saved: true });
    expect(stored).toEqual(original);
  });
  it("does not overwrite a saved command with changed content", async () => {
    await saveTreeConversation(12, form());
    const f = form();
    f.set("note", "Changed");
    expect((await saveTreeConversation(12, f)).error).toBeTruthy();
    expect(stored?.coach_summary).not.toContain("Changed");
  });
  it("rejects inaccessible players before database access", async () => {
    vi.mocked(canAccessPlayer).mockResolvedValue(false);
    expect((await saveTreeConversation(12, form())).error).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
  it("rejects a checkpoint belonging to another player", async () => {
    vi.mocked(get).mockResolvedValue(undefined);
    expect((await saveTreeConversation(12, form())).error).toBeTruthy();
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("AND player_id = ?"),
      ["checkpoint", 12],
    );
    expect(run).not.toHaveBeenCalled();
  });
  it("does not claim agreement on focus when no focus exists", async () => {
    vi.mocked(all).mockResolvedValue([]);
    expect((await saveTreeConversation(12, form())).error).toBeTruthy();
    expect(run).not.toHaveBeenCalled();
  });
  it("allows a conversation without a new agreement or free text", async () => {
    const f = form();
    f.set("checkpoint_id", "");
    f.set("outcome", "none");
    expect(await saveTreeConversation(12, f)).toEqual({ saved: true });
  });
});
