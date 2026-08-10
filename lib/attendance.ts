import { readSheet } from "read-excel-file/node";

export type AttendanceCategory =
  | "training"
  | "match"
  | "cup"
  | "competition"
  | "meeting"
  | "education"
  | "work"
  | "other";

export interface AttendanceActivity {
  sourceColumn: number;
  sourceLabel: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  title: string;
  category: AttendanceCategory;
}

export interface AttendancePlayerRow {
  name: string;
  birthDate: string | null;
  attendanceByColumn: Map<number, boolean>;
}

export interface AttendanceWorkbook {
  exportedAt: string | null;
  period: string | null;
  teamName: string | null;
  activities: AttendanceActivity[];
  players: AttendancePlayerRow[];
}

const SUMMARY_HEADERS = new Set([
  "Matcher",
  "Träningar",
  "Tävlingar",
  "Cuper",
  "Möten",
  "Utbildningar",
  "Övrigt",
  "Arbetspass",
  "Totalt",
]);

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  maj: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  okt: "10",
  nov: "11",
  dec: "12",
};

function cleanCell(value: unknown): string {
  return String(value ?? "").replace(/\r/g, "").trim();
}

export function normalizePersonName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseBirthDate(value: unknown): string | null {
  const raw = cleanCell(value).replace(/[^0-9]/g, "");
  if (raw.length < 8) return null;
  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return null;
  return `${year}-${month}-${day}`;
}

export function inferAttendanceCategory(title: string): AttendanceCategory {
  const value = title.toLowerCase();
  if (value.includes("träning")) return "training";
  if (value.includes("match")) return "match";
  if (value.includes("cup")) return "cup";
  if (value.includes("möte")) return "meeting";
  if (value.includes("utbild")) return "education";
  if (value.includes("arbetspass") || value.includes("bemanning") || value.includes("bollkall")) return "work";
  if (value.includes("tävling") || value.includes("tiokamp")) return "competition";
  return "other";
}

function parseActivityHeader(label: string, fallbackYear: string | null): AttendanceActivity | null {
  const lines = label
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const dateMatch = lines[0].match(/^[A-Za-zÅÄÖåäö]+\s+(\d{1,2})\s+([A-Za-zÅÄÖåäö]{3})/);
  const year = fallbackYear && /^\d{4}$/.test(fallbackYear) ? fallbackYear : null;
  const monthKey = dateMatch ? dateMatch[2].toLowerCase() : "";
  const month = MONTHS[monthKey] ?? null;
  const day = dateMatch ? String(dateMatch[1]).padStart(2, "0") : null;
  const date = year && month && day ? `${year}-${month}-${day}` : null;

  const timeMatch = (lines[1] ?? "").match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  const title = lines.slice(timeMatch ? 2 : 1).join(" ").trim() || lines[lines.length - 1];

  return {
    sourceColumn: -1,
    sourceLabel: label,
    date,
    startTime: timeMatch?.[1] ?? null,
    endTime: timeMatch?.[2] ?? null,
    title,
    category: inferAttendanceCategory(title),
  };
}

export async function parseAttendanceWorkbook(buffer: ArrayBuffer): Promise<AttendanceWorkbook> {
  const rows = await readSheet(Buffer.from(buffer));
  if (rows.length < 8) throw new Error("Excel-filen har inte det förväntade Svenska Lag-formatet.");

  const exportedAt = cleanCell(rows[2]?.[1]) || null;
  const period = cleanCell(rows[3]?.[1]) || null;
  const teamName = cleanCell(rows[4]?.[1]) || null;
  const headerRow = rows[6] ?? [];

  const activities: AttendanceActivity[] = [];
  for (let col = 2; col < headerRow.length; col++) {
    const header = cleanCell(headerRow[col]);
    if (!header) continue;
    if (SUMMARY_HEADERS.has(header)) break;
    const parsed = parseActivityHeader(header, period);
    if (!parsed) continue;
    parsed.sourceColumn = col;
    activities.push(parsed);
  }
  if (activities.length === 0) throw new Error("Inga aktivitetstillfällen hittades i Excel-filen.");

  const players: AttendancePlayerRow[] = [];
  for (let rowIndex = 7; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const name = cleanCell(row[0]);
    if (!name) continue;
    const attendanceByColumn = new Map<number, boolean>();
    for (const activity of activities) {
      const value = row[activity.sourceColumn];
      attendanceByColumn.set(activity.sourceColumn, Number(value ?? 0) > 0);
    }
    players.push({
      name,
      birthDate: parseBirthDate(row[1]),
      attendanceByColumn,
    });
  }
  if (players.length === 0) throw new Error("Inga spelarrader hittades i Excel-filen.");

  return { exportedAt, period, teamName, activities, players };
}
