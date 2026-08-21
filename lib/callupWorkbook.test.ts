import { describe, expect, it } from "vitest";
import {
  normalizeMatchName,
  parseSvenskaLagCallupRows,
  workbookOpponent,
} from "./callupWorkbook";
import { canImportPlayedAttendance } from "./services/callupWorkbookImport";

function exampleRows(): unknown[][] {
  const rows = Array.from({ length: 15 }, () => [] as unknown[]);
  rows[0] = ["Kallelser, svar & närvaro"];
  rows[2] = ["Exporterad", "2026-08-21 22:47"];
  rows[3] = ["Period", "2026"];
  rows[4] = ["Lag", "Bromstens IK F2014-Gul"];
  rows[11] = ["Namn", "Födelsedatum", "Lördag 22 aug, 10:00 - 11:30\nMatch mot Ängby IF"];
  rows[12] = ["", "", "K", "SJ", "SN", "N"];
  rows[13] = ["Ada Andersson", "20140102", "x", "x", "", "x"];
  rows[14] = ["Bea Berg", "20140304", "x", "", "x", ""];
  return rows;
}

describe("Svenska Lag-kallelsefil", () => {
  it("tolkar match, svar och närvaro", () => {
    const parsed = parseSvenskaLagCallupRows(exampleRows(), "gul.xlsx");
    expect(parsed.sourceTeam).toBe("Gul");
    expect(parsed.activities[0]).toMatchObject({
      date: "2026-08-22",
      startTime: "10:00",
      title: "Match mot Ängby IF",
      isMatch: true,
    });
    expect(parsed.activities[0].people).toEqual([
      { name: "Ada Andersson", birthDate: "2014-01-02", called: true, accepted: true, declined: false, attended: true },
      { name: "Bea Berg", birthDate: "2014-03-04", called: true, accepted: false, declined: true, attended: false },
    ]);
  });

  it("avvisar dubbla svar", () => {
    const rows = exampleRows();
    rows[13][4] = "x";
    expect(() => parseSvenskaLagCallupRows(rows, "gul.xlsx")).toThrow(/både ja och nej/);
  });

  it("normaliserar motståndare utan att tappa bokstäver", () => {
    expect(workbookOpponent("Träningsmatch mot Erikslunds KF")).toBe("Erikslunds KF");
    expect(normalizeMatchName("FC Café – Öst")).toBe("fc café öst");
  });

  it("importerar aldrig faktiskt deltagande för framtida matcher", () => {
    expect(canImportPlayedAttendance("2026-08-21", "2026-08-21")).toBe(true);
    expect(canImportPlayedAttendance("2026-08-22", "2026-08-21")).toBe(false);
  });
});
