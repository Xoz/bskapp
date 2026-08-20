import { describe, expect, it } from "vitest";
import { pendingSchemaMigrationIds } from "./schemaMigrations";

describe("schemamigreringar", () => {
  it("returnerar bara migrationer som ännu inte körts", () => {
    expect(pendingSchemaMigrationIds(
      ["0001-baseline", "0002-callups", "0003-index"],
      new Set(["0001-baseline"])
    )).toEqual(["0002-callups", "0003-index"]);
  });

  it("stoppar duplicerade eller felordnade id:n", () => {
    expect(() => pendingSchemaMigrationIds(["0001", "0001"], new Set())).toThrow(/unika/);
    expect(() => pendingSchemaMigrationIds(["0002", "0001"], new Set())).toThrow(/stigande/);
  });

  it("stoppar en databas som ligger på en okänd migrationsgren", () => {
    expect(() => pendingSchemaMigrationIds(["0001"], new Set(["9999-okänd"]))).toThrow(/okänd/);
  });
});
