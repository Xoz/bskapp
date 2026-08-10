import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("server action-behörighet", () => {
  it("kräver verifierad tränaridentitet i varje exporterad mutation", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/app/actions.ts"), "utf8");
    const actions = [...source.matchAll(/export async function\s+(\w+)/g)];
    expect(actions.length).toBeGreaterThan(0);

    for (const [index, action] of actions.entries()) {
      const start = action.index ?? 0;
      const end = actions[index + 1]?.index ?? source.length;
      expect(source.slice(start, end), `${action[1]} saknar auth-spärr`).toMatch(/await require(?:Head)?CoachIdentity\(\)/);
    }
  });
});
