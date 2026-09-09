import { SKILLS, STATUS_LABEL, type SkillStatus } from "./skillTrappan";

export type TreeRow = {
  skill_id: string;
  status: SkillStatus;
  is_focus: number | boolean;
};
export type TreePreparation = {
  checkpointId: string | null;
  date: string | null;
  summary: string;
  focus: { id: string; title: string; criterion: string; nextStep: string }[];
};

/** Describe explicit tree selections, never infer ability from missing rows. */
export function prepareTreeConversation(
  checkpointId: string | null,
  date: string | null,
  rows: TreeRow[],
): TreePreparation {
  rows = SKILLS.flatMap((skill) => {
    const row = rows.find((item) => item.skill_id === skill.id);
    return row ? [row] : [];
  });
  const focus = rows
    .filter((row) => row.is_focus)
    .flatMap((row) => {
      const skill = SKILLS.find((item) => item.id === row.skill_id);
      return skill
        ? [
            {
              id: skill.id,
              title: skill.title,
              criterion: skill.criterion,
              nextStep: skill.nextStep,
            },
          ]
        : [];
    })
    .slice(0, 2);
  const completed = rows
    .filter((row) => row.status === "done")
    .flatMap((row) => {
      const skill = SKILLS.find((item) => item.id === row.skill_id);
      return skill ? [skill.title] : [];
    });
  const selected = focus.map((item) => {
    const row = rows.find((row) => row.skill_id === item.id)!;
    return `${item.title} — ${STATUS_LABEL[row.status] || "Ej bedömd"}\nKriterium: ${item.criterion}`;
  });
  const summary = [
    date
      ? `Underlag från utvecklingsträdet ${date}.`
      : "Ingen sparad utvecklingsbild ännu.",
    selected.length
      ? `Valt fokus:\n${selected.join("\n\n")}`
      : "Inga fokusfärdigheter valda.",
    completed.length
      ? `Markerat som klart: ${completed.slice(0, 6).join(", ")}${completed.length > 6 ? ` (och ${completed.length - 6} till i trädet)` : ""}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { checkpointId, date, summary, focus };
}

export function realDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
