import { beforeEach, it, expect, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ run: vi.fn(), get: vi.fn() }));
import { getCurrentUser } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { saveTrainingPlan } from "./actions";
import { BANK } from "./model";
const id = "10000000-0000-4000-8000-000000000001",
  document = {
    version: 1,
    title: "Pass",
    date: "",
    blocks: [{ id: "a", minutes: 10, diagram: BANK[0].model }],
  };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: 7,
    permissions: ["manage_evaluations"],
  } as never);
  vi.mocked(run).mockResolvedValue([]);
});
it("checks permission before any database access", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  expect((await saveTrainingPlan(id, 0, document)).error).toBeTruthy();
  expect(run).not.toHaveBeenCalled();
});
it("rejects invalid drawings before persistence", async () => {
  expect(
    (
      await saveTrainingPlan(id, 0, {
        ...document,
        blocks: [{ id: "a", minutes: 10, diagram: {} }],
      })
    ).error,
  ).toBeTruthy();
  expect(run).not.toHaveBeenCalled();
});
it("scopes writes and replay checks to the signed-in owner and exact revision", async () => {
  vi.mocked(get).mockResolvedValue({ revision: 3 });
  expect(await saveTrainingPlan(id, 2, document)).toEqual({ revision: 3 });
  expect(run).toHaveBeenCalledWith(
    expect.stringContaining("AND created_by=? AND revision=?"),
    [JSON.stringify(document), id, 7, 2],
  );
  expect(get).toHaveBeenCalledWith(
    expect.stringContaining("AND document=?::text::jsonb"),
    [id, 7, 3, JSON.stringify(document)],
  );
});
it("reports stale revisions without overwriting the current version", async () => {
  vi.mocked(get).mockResolvedValue(undefined);
  expect((await saveTrainingPlan(id, 2, document)).error).toContain(
    "annan flik",
  );
  expect(run).toHaveBeenCalledTimes(1);
});
