import { describe, expect, it } from "vitest";
import {
  normalizeMatchName,
  parseSvenskaLagCallupRows,
  workbookOpponent,
} from "./callupWorkbook";
import { canImportPlayedAttendance, canImportUpcomingTraining } from "./services/callupWorkbookImport";

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
      isTraining: false,
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

  it("importerar endast träningar från idag till 14 dagar framåt", () => {
    expect(canImportUpcomingTraining("2026-08-21", "2026-08-21")).toBe(true);
    expect(canImportUpcomingTraining("2026-09-04", "2026-08-21")).toBe(true);
    expect(canImportUpcomingTraining("2026-09-05", "2026-08-21")).toBe(false);
    expect(canImportUpcomingTraining("2026-08-20", "2026-08-21")).toBe(false);
  });

  it("tolkar träningens kallelser och svar", () => {
    const rows = exampleRows();
    rows[11][2] = "Lördag 22 aug, 10:00 - 11:30\nTräning Bromstens IP";
    const parsed = parseSvenskaLagCallupRows(rows, "gul.xlsx");
    expect(parsed.activities[0]).toMatchObject({
      date: "2026-08-22",
      title: "Träning Bromstens IP",
      isMatch: false,
      isTraining: true,
    });
    expect(parsed.activities[0].people.map((person) => ({ name: person.name, called: person.called, accepted: person.accepted, declined: person.declined }))).toEqual([
      { name: "Ada Andersson", called: true, accepted: true, declined: false },
      { name: "Bea Berg", called: true, accepted: false, declined: true },
    ]);
  });

  it("accepterar Svenska Lags nya terminsformat", () => {
    const rows = exampleRows();
    rows[3][1] = "HT 2026";
    rows[4][0] = "Lag/Grupper";
    rows[4][1] = "F2014-Gul";
    expect(parseSvenskaLagCallupRows(rows, "gul.xlsx").period).toBe("2026");
  });
});
