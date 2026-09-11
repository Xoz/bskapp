import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { level } from "./levels";
import { matchCompetitionLevelSql, sanktanLevelLabel } from "./sanktanLevel";

const cases = [
  ["extra_svar", "1", "Extra svår"],
  ["svar", "2", "Svår"],
  ["medel", "3", "Medel"],
  ["latt", "4", "Lätt"],
  ["extra_latt", "5", "Extra lätt"],
] as const;

describe("gemensam matchnivå", () => {
  it.each(cases)("visar %s och %s som %s", (id, number, label) => {
    expect(level(id)?.label).toBe(label);
    expect(level(number)?.label).toBe(label);
    expect(sanktanLevelLabel(Number(number))).toBe(label);
  });
  it("ger ingen matchnivå för saknade eller ogiltiga värden", () => {
    for (const value of [null, undefined, "", "0", "6", "2.5", "okänd"]) {
      expect(level(value)).toBeNull();
    }
  });
  it.skipIf(!process.env.BSK_SYNC_TEST_DATABASE_URL)("Idags databasläsning och Matcher visar samma nivå för båda lagringsformaten", async () => {
    const sql = postgres(process.env.BSK_SYNC_TEST_DATABASE_URL!, { max: 1 });
    try {
      for (const [id, number, label] of cases) {
        for (const value of [id, number]) {
          const [row] = await sql.unsafe(`SELECT ${matchCompetitionLevelSql} AS competition_level FROM (SELECT $1::text AS level) m`, [value]);
          expect(row.competition_level).toBe(Number(number));
          expect(sanktanLevelLabel(row.competition_level)).toBe(label);
          expect(sanktanLevelLabel(row.competition_level)).toBe(level(value)?.label);
        }
      }
      for (const value of [null, "", "0", "6", "okänd", "999999999999999999999"]) {
        const [row] = await sql.unsafe(`SELECT ${matchCompetitionLevelSql} AS competition_level FROM (SELECT $1::text AS level) m`, [value]);
        expect(row.competition_level).toBeNull();
      }
    } finally {
      await sql.end();
    }
  });
});
