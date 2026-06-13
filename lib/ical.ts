// Hämtar och tolkar iCal-kalendern från svenskalag.se (eller annan iCal-källa)
// och plockar ut matchhändelser.
//
// Svenskalag-format på matchrubriker:
//   "Match: Sollentuna FK 2 - Bollstanäs SK 3 (F2014- 3) // F2014-Gul - Bollstanäs SK FB"
//   "Stockholm Football Cup // F2014-Gul - Bollstanäs SK FB"
//   "Träning // ..." (ska INTE importeras)

import { levelFromSvenskalag } from "./levels";

export interface CalendarMatch {
  uid: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM avspark
  summary: string;
  opponent: string;
  homeAway: "home" | "away";
  location: string;
  series: string | null;
  level: string; // nivå-id, härlett ur serieparentesen (kan vara "")
  matchType: "seriespel" | "cup" | "traningsmatch";
}

// Sista siffran i serieparentesen anger nivån, t.ex. "(F2014- 3)" → 3 (medel).
// Svenskalag: 1 = svårast … 5 = lättast.
function levelFromSeries(series: string | null): string {
  if (!series) return "";
  const nums = series.match(/\d+/g);
  if (!nums) return "";
  const last = Number(nums[nums.length - 1]);
  return levelFromSvenskalag(last)?.id ?? "";
}

// Viker upp rader enligt RFC 5545 (fortsättningsrader inleds med blanksteg/tab)
function unfold(ics: string): string[] {
  const lines = ics.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseDate(value: string): string | null {
  // 20260815T100000Z, 20260815T100000 eller 20260815
  const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseTime(value: string): string | null {
  const m = value.match(/T(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

function decodeText(value: string): string {
  return value
    .replace(/\\n/g, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

interface RawEvent {
  uid: string;
  summary: string;
  date: string;
  time: string | null;
  location: string;
}

export function parseEvents(ics: string): RawEvent[] {
  const lines = unfold(ics);
  const events: RawEvent[] = [];
  let current: Partial<RawEvent> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.uid && current.summary && current.date) {
        events.push({
          uid: current.uid,
          summary: current.summary,
          date: current.date,
          time: current.time ?? null,
          location: current.location ?? "",
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const keyPart = line.slice(0, idx); // kan innehålla parametrar, t.ex. DTSTART;TZID=...
    const value = line.slice(idx + 1);
    const key = keyPart.split(";")[0].toUpperCase();

    if (key === "UID") current.uid = value.trim();
    else if (key === "SUMMARY") current.summary = decodeText(value);
    else if (key === "DTSTART") {
      current.date = parseDate(value.trim()) ?? "";
      current.time = parseTime(value.trim());
    } else if (key === "LOCATION") current.location = decodeText(value);
  }
  return events;
}

function cleanTeamName(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s{2,}/g, " ").trim();
}

// Plockar ut motståndare ur en matchrubrik
function extractOpponent(
  summary: string,
  ownNames: string[]
): { opponent: string; homeAway: "home" | "away"; series: string | null } {
  // Klipp bort svenskalags lagsuffix: "... // F2014-Gul - Bollstanäs SK FB"
  let s = summary.split("//")[0].trim();
  s = s.replace(/^(match|sammandrag|seriespel|cup|träningsmatch)[:\s]+/i, "").trim();

  const series = s.match(/\(([^)]+)\)/)?.[1]?.replace(/\s+/g, " ").trim() ?? null;

  const parts = s
    .split(/\s+-\s+|\s+–\s+|\s+vs\.?\s+/i)
    .map((p) => cleanTeamName(p))
    .filter(Boolean);

  const isOwn = (part: string) =>
    ownNames.some((n) => n && part.toLowerCase().includes(n.toLowerCase()));

  if (parts.length >= 2) {
    if (isOwn(parts[0])) return { opponent: parts[1], homeAway: "home", series };
    if (isOwn(parts[1])) return { opponent: parts[0], homeAway: "away", series };
    return { opponent: parts.join(" – "), homeAway: "home", series };
  }
  // Kunde inte dela upp (t.ex. cupdagar) – ta bort egna lagnamn ur texten
  for (const n of ownNames) {
    if (n) s = s.replace(new RegExp(n, "ig"), "").trim();
  }
  const opponent = cleanTeamName(s.replace(/^[-–\s]+|[-–\s]+$/g, "")) || cleanTeamName(summary.split("//")[0]);
  return { opponent, homeAway: "home", series };
}

const VERSUS_SPLIT = /\s+-\s+|\s+–\s+|\s+vs\.?\s+/i;

export function extractMatches(ics: string, ownNames: string[]): CalendarMatch[] {
  const isOwn = (part: string) =>
    ownNames.some((n) => n && part.toLowerCase().includes(n.toLowerCase()));

  return parseEvents(ics)
    .filter((e) => {
      const head = e.summary.split("//")[0];
      // "match" täcker även "Träningsmatch" – men inte "Träning"/"Träningspass"
      if (/match|seriespel|sammandrag|cup/i.test(head)) return true;
      // "LagA - LagB" där vårt lag ingår är också en match, även utan nyckelord
      // (t.ex. cupmatcher som "Mariebergs IK Vit - Bollstanäs SK")
      const parts = head.split(VERSUS_SPLIT).map((p) => p.trim());
      return parts.length >= 2 && parts.some(isOwn);
    })
    .map((e) => {
      const { opponent, homeAway, series } = extractOpponent(e.summary, ownNames);
      const head = e.summary.split("//")[0];
      const matchType: CalendarMatch["matchType"] = /träningsmatch/i.test(head)
        ? "traningsmatch"
        : /cup/i.test(head)
          ? "cup"
          : /match|seriespel|sammandrag/i.test(head)
            ? "seriespel"
            : // Ren "LagA - LagB"-rubrik utan nyckelord – troligen tränings-/cupmatch
              "traningsmatch";
      return {
        uid: e.uid,
        date: e.date,
        time: e.time,
        summary: e.summary,
        opponent,
        homeAway,
        location: e.location,
        series,
        level: matchType === "seriespel" ? levelFromSeries(series) : "",
        matchType,
      };
    });
}

export async function fetchCalendar(url: string): Promise<string> {
  // webcal:// är bara https:// med annat namn
  const httpUrl = url.replace(/^webcal:\/\//i, "https://");
  const res = await fetch(httpUrl, {
    headers: { Accept: "text/calendar, text/plain, */*" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Kalendern svarade ${res.status}`);
  return res.text();
}
