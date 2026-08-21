import { zipSync, unzipSync } from "fflate";
import { readSheet } from "read-excel-file/node";

export type SvenskaLagWorkbookPerson = {
  name: string;
  birthDate: string | null;
  called: boolean;
  accepted: boolean;
  declined: boolean;
  attended: boolean;
};

export type SvenskaLagWorkbookActivity = {
  date: string;
  startTime: string | null;
  endTime: string | null;
  title: string;
  isMatch: boolean;
  people: SvenskaLagWorkbookPerson[];
};

export type SvenskaLagCallupWorkbook = {
  fileName: string;
  exportedAt: string | null;
  period: string;
  teamName: string;
  sourceTeam: "Gul" | "Grön";
  activities: SvenskaLagWorkbookActivity[];
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", maj: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", okt: "10", nov: "11", dec: "12",
};
const SUMMARY_LABELS = new Set([
  "Matcher", "Träningar", "Tävlingar", "Cuper", "Möten",
  "Utbildningar", "Övrigt", "Arbetspass", "Totalt",
]);

function clean(value: unknown): string {
  return String(value ?? "").replace(/\r/g, "").trim();
}

function marked(value: unknown): boolean {
  return clean(value).toLowerCase() === "x";
}

function birthDate(value: unknown): string | null {
  const digits = clean(value).replace(/[^0-9]/g, "");
  if (!/^\d{8}$/.test(digits)) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function sourceTeam(teamName: string): "Gul" | "Grön" {
  const normalized = teamName.normalize("NFKC").toLowerCase();
  if (normalized.includes("grön")) return "Grön";
  if (normalized.includes("gul")) return "Gul";
  throw new Error("Filen måste vara exporterad för F2014-Gul eller F2014-Grön.");
}

function parseActivityLabel(label: string, year: string): Omit<SvenskaLagWorkbookActivity, "people"> {
  const lines = label.split("\n").map((line) => line.trim()).filter(Boolean);
  const match = lines[0]?.match(/^[A-Za-zÅÄÖåäö]+\s+(\d{1,2})\s+([A-Za-zÅÄÖåäö]{3}),\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  const month = match ? MONTHS[match[2].toLowerCase()] : null;
  if (!match || !month || !/^\d{4}$/.test(year)) throw new Error(`Ogiltig aktivitetsrubrik: ${label}`);
  const title = lines.slice(1).join(" ").trim();
  if (!title) throw new Error(`Aktiviteten saknar titel: ${label}`);
  return {
    date: `${year}-${month}-${String(match[1]).padStart(2, "0")}`,
    startTime: match[3],
    endTime: match[4],
    title,
    isMatch: title.toLowerCase().includes("match"),
  };
}

/**
 * Svenska Lags export använder ZIP data descriptors som unzipper-esm inte
 * accepterar. fflate läser den giltiga filen och packar om den i minnet innan
 * read-excel-file tolkar kalkylbladet.
 */
function normalizeXlsx(buffer: ArrayBuffer): Buffer {
  const files = unzipSync(new Uint8Array(buffer));
  return Buffer.from(zipSync(files, { level: 6 }));
}

export async function parseSvenskaLagCallupWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<SvenskaLagCallupWorkbook> {
  const rows = await readSheet(normalizeXlsx(buffer));
  return parseSvenskaLagCallupRows(rows, fileName);
}

/** Exporterad för tester: själva formatvalideringen är oberoende av XLSX-avkodningen. */
export function parseSvenskaLagCallupRows(
  rows: unknown[][],
  fileName: string,
): SvenskaLagCallupWorkbook {
  if (clean(rows[0]?.[0]) !== "Kallelser, svar & närvaro") {
    throw new Error("Fel Svenska Lag-export. Använd Kallelser, svar & närvaro.");
  }
  const exportedAt = clean(rows[2]?.[1]) || null;
  const period = clean(rows[3]?.[1]);
  const teamName = clean(rows[4]?.[1]);
  if (!/^\d{4}$/.test(period) || !teamName) throw new Error("Filen saknar period eller lag.");

  const header = rows[11] ?? [];
  const subheader = rows[12] ?? [];
  const playerRows = rows.slice(13).filter((row) => clean(row[0]));
  if (playerRows.length === 0) throw new Error("Filen saknar personrader.");

  const activities: SvenskaLagWorkbookActivity[] = [];
  for (let column = 2; column < header.length; column += 4) {
    const label = clean(header[column]);
    if (!label) continue;
    if (SUMMARY_LABELS.has(label)) break;
    const columns = subheader.slice(column, column + 4).map(clean);
    if (columns.join("|") !== "K|SJ|SN|N") {
      throw new Error(`Oväntade kolumner för ${label}: ${columns.join(", ")}`);
    }
    const activity = parseActivityLabel(label, period);
    const people = playerRows.map((row) => {
      const accepted = marked(row[column + 1]);
      const declined = marked(row[column + 2]);
      if (accepted && declined) throw new Error(`${clean(row[0])} har både ja och nej för ${label}.`);
      return {
        name: clean(row[0]),
        birthDate: birthDate(row[1]),
        called: marked(row[column]) || accepted || declined,
        accepted,
        declined,
        attended: marked(row[column + 3]),
      };
    });
    activities.push({ ...activity, people });
  }
  if (activities.length === 0) throw new Error("Filen saknar aktiviteter.");
  return { fileName, exportedAt, period, teamName, sourceTeam: sourceTeam(teamName), activities };
}

export function workbookOpponent(title: string): string | null {
  const value = title
    .replace(/^Träningsmatch\s+mot\s+/i, "")
    .replace(/^Match\s+mot\s+/i, "")
    .trim();
  return value === title.trim() ? null : value;
}

export function normalizeMatchName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^mot\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
