// Hämtar och tolkar iCal-kalendern från svenskalag.se (eller annan iCal-källa)
// och plockar ut matchhändelser.
//
// Stödda format:
//   Svenskalag: "Match: LagA - LagB (F2014- 3) // F2014-Gul - Bollstanäs SK FB"
//   CupManager: "G2014 competition: match mot LagB"
//              + DESCRIPTION "... mellan LagA och LagB." för hemma/borta
//              + UTC-timestamps (DTSTART:...Z) → omvandlas till svensk tid
//   Profixio:   "LagA - LagB" eller "Cup Name // ..."

import { levelFromSvenskalag } from "./levels";

const TZ = "Europe/Stockholm";

export interface CalendarMatch {
  uid: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM avspark (svensk tid)
  summary: string;
  opponent: string;
  homeAway: "home" | "away";
  location: string;
  series: string | null;
  level: string; // nivå-id, härlett ur serieparentesen (kan vara "")
  cupName: string; // cup/turneringsnamn för gruppering (bara cup-matcher)
  matchType: "seriespel" | "cup" | "traningsmatch";
}

// Sista siffran (1–5) i en text anger nivån. Svenskalag: 1 = svårast … 5 = lättast.
function levelFromLastNumber(s: string | null): string {
  if (!s) return "";
  const nums = s.match(/\d+/g);
  if (!nums) return "";
  const last = Number(nums[nums.length - 1]);
  return levelFromSvenskalag(last)?.id ?? "";
}

// Härleder nivån. Helst ur serieparentesen "(F2014- 3)". För sammandrag som
// saknar parentes ligger nivån sist i rubriken ("Sammandrag F2014- 3 // …") –
// vi läser den bara när rubriken inte är en "LagA - LagB"-uppställning, så att
// vi inte råkar tolka ett lagsuffixnummer (t.ex. "Bollstanäs SK 3") som nivå.
function deriveLevel(summary: string, series: string | null): string {
  const fromSeries = levelFromLastNumber(series);
  if (fromSeries) return fromSeries;

  let head = summary.split("//")[0];
  head = head.replace(/^(match|sammandrag|seriespel|cup|träningsmatch)[:\s]+/i, "").trim();
  // Ta bort ev. parentes så den inte stör – den hanterades redan via series
  head = head.replace(/\([^)]*\)/g, "").trim();
  if (VERSUS_SPLIT.test(head)) return ""; // två lag → nivån ska komma från parentes
  return levelFromLastNumber(head);
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

// Extraherar grupp/kategori-info från DESCRIPTION, t.ex. "competition Grupp A"
// eller "friendly Grupp X". CupManager skriver "Match i Girls 2014 competition, Grupp A mellan…"
// Används för att skilja flera lag/grupper i samma cup åt vid import.
export function calendarGroup(ics: string): string | null {
  const lines = unfold(ics);
  let inEvent = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { inEvent = true; continue; }
    if (line === "END:VEVENT") { inEvent = false; continue; }
    if (!inEvent) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    if (line.slice(0, idx).split(";")[0].toUpperCase() !== "DESCRIPTION") continue;
    const desc = decodeText(line.slice(idx + 1));
    // "Match i Girls 2014 competition, Grupp A mellan X och Y"
    const m = desc.match(/\b(competition|friendly|träningsmatch|mix)\b[^.]*?\b(grupp\s+\w+)/i);
    if (m) return `${m[1]} ${m[2]}`.replace(/\s+/g, " ").trim();
    const g = desc.match(/\bgrupp\s+\w+/i);
    if (g) return g[0];
    break; // Titta bara på första eventet
  }
  return null;
}

// Cup-namnet ur kalenderhuvudet (X-WR-CALNAME / NAME).
// Fallback för CupManager (Stockholm Football Cup 2026): läs ur DESCRIPTION-prefixet
// som har formatet "Cup Name:\n\nMatch i ...".
export function calendarName(ics: string): string | null {
  const lines = unfold(ics);
  let inEvent = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { inEvent = true; continue; }
    if (line === "END:VEVENT") { inEvent = false; continue; }
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).split(";")[0].toUpperCase();
    if (!inEvent && (key === "X-WR-CALNAME" || key === "NAME")) {
      const name = decodeText(line.slice(idx + 1));
      if (name) return name;
    }
    // CupManager: DESCRIPTION börjar med "Cup Name:\n\n..."
    if (inEvent && key === "DESCRIPTION") {
      const raw = line.slice(idx + 1);
      const nlIdx = raw.indexOf("\\n");
      if (nlIdx > 0) {
        const candidate = decodeText(raw.slice(0, nlIdx).replace(/:$/, ""));
        if (candidate.length > 3) return candidate;
      }
    }
  }
  return null;
}

// UTC-timestamp (med Z-suffix) → datum + tid i svensk tid.
function parseDateTimeUTC(value: string): { date: string; time: string } {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (!m) return { date: "", time: "" };
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  const date = d.toLocaleDateString("sv-SE", { timeZone: TZ });
  const time = d.toLocaleTimeString("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  return { date, time };
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
  description: string;
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
          description: current.description ?? "",
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
    else if (key === "DESCRIPTION") current.description = decodeText(value);
    else if (key === "DTSTART") {
      const v = value.trim();
      if (v.endsWith("Z") && v.includes("T")) {
        // UTC-timestamp → omvandla till svensk tid
        const { date, time } = parseDateTimeUTC(v);
        current.date = date;
        current.time = time || null;
      } else {
        current.date = parseDate(v) ?? "";
        current.time = parseTime(v);
      }
    } else if (key === "LOCATION") current.location = decodeText(value);
  }
  return events;
}

function cleanTeamName(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s{2,}/g, " ").trim();
}

// Plockar ut motståndare ur en matchrubrik (och DESCRIPTION för CupManager-format).
function extractOpponent(
  summary: string,
  description: string,
  ownNames: string[]
): { opponent: string; homeAway: "home" | "away"; series: string | null } {
  const isOwn = (part: string) =>
    ownNames.some((n) => n && part.toLowerCase().includes(n.toLowerCase()));

  // CupManager-format: "G2014 competition: match mot Motståndare"
  // Hemma/borta finns i DESCRIPTION: "... mellan LagA och LagB."
  const matchMotM = summary.match(/\bmatch mot (.+)$/i);
  if (matchMotM) {
    const opponent = cleanTeamName(matchMotM[1]);
    let homeAway: "home" | "away" = "home";
    const mellanM = description.match(/mellan (.+?) och (.+?)(?:[.,]|$)/i);
    if (mellanM) {
      homeAway = isOwn(mellanM[1].trim()) ? "home" : "away";
    }
    return { opponent, homeAway, series: null };
  }

  // Standardformat: "LagA - LagB" (ev. med "Match: " prefix och "// suffix" från Svenskalag)
  let s = summary.split("//")[0].trim();
  s = s.replace(/^(match|sammandrag|seriespel|cup|träningsmatch)[:\s]+/i, "").trim();

  const series = s.match(/\(([^)]+)\)/)?.[1]?.replace(/\s+/g, " ").trim() ?? null;

  const parts = s
    .split(/\s+-\s+|\s+–\s+|\s+vs\.?\s+/i)
    .map((p) => cleanTeamName(p))
    .filter(Boolean);

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
      // "match" täcker även "Träningsmatch" och "match mot X" – men inte "Träning"/"Träningspass"
      if (/match|seriespel|sammandrag|cup/i.test(head)) return true;
      // "LagA - LagB" där vårt lag ingår är också en match, även utan nyckelord
      // (t.ex. cupmatcher som "Mariebergs IK Vit - Bollstanäs SK")
      const parts = head.split(VERSUS_SPLIT).map((p) => p.trim());
      return parts.length >= 2 && parts.some(isOwn);
    })
    .map((e) => {
      const { opponent, homeAway, series } = extractOpponent(e.summary, e.description, ownNames);
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
        level: matchType === "seriespel" ? deriveLevel(e.summary, series) : "",
        cupName: matchType === "cup" ? opponent : "",
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
