import { LEVELS, levelFromSvenskalag } from "./levels";

// Samma nivåskala i aktivitetsvyer och matchlistan. Endast fasta värden
// från LEVELS används i SQL; matchens lagrade nivå ändras inte.
export const matchCompetitionLevelSql = `CASE m.level ${LEVELS.map((level) => {
  const number = 6 - level.rank;
  return `WHEN '${level.id}' THEN ${number} WHEN '${number}' THEN ${number}`;
}).join(" ")} END`;

export function sanktanLevelLabel(level: number | null | undefined): string {
  if (!level) return "";
  return levelFromSvenskalag(level)?.label ?? `Nivå ${level}`;
}
