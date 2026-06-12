// Hämtar och tolkar iCal-kalendern från svenskalag.se (eller annan iCal-källa)
// och plockar ut matchhändelser.

export interface CalendarMatch {
  uid: string;
  date: string; // YYYY-MM-DD
  summary: string;
  opponent: string;
  homeAway: "home" | "away";
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
    else if (key === "DTSTART") current.date = parseDate(value.trim()) ?? "";
    else if (key === "LOCATION") current.location = decodeText(value);
  }
  return events;
}

// Plockar ut motståndare ur en matchrubrik, t.ex.
// "Match: Bollstanäs SK F2014 - Väsby IK" eller "BSK F2014 vs Täby FK"
function extractOpponent(
  summary: string,
  ownNames: string[]
): { opponent: string; homeAway: "home" | "away" } {
  let s = summary.replace(/^(match|sammandrag|seriespel|cup)[:\s]*/i, "").trim();
  const parts = s.split(/\s+-\s+|\s+–\s+|\s+vs\.?\s+/i).map((p) => p.trim()).filter(Boolean);

  const isOwn = (part: string) =>
    ownNames.some((n) => n && part.toLowerCase().includes(n.toLowerCase()));

  if (parts.length >= 2) {
    if (isOwn(parts[0])) return { opponent: parts[1], homeAway: "home" };
    if (isOwn(parts[1])) return { opponent: parts[0], homeAway: "away" };
    return { opponent: parts.join(" – "), homeAway: "home" };
  }
  // Kunde inte dela upp – ta bort egna lagnamn ur texten
  for (const n of ownNames) {
    if (n) s = s.replace(new RegExp(n, "ig"), "").trim();
  }
  return { opponent: s.replace(/^[-–\s]+|[-–\s]+$/g, "") || summary, homeAway: "home" };
}

export function extractMatches(ics: string, ownNames: string[]): CalendarMatch[] {
  return parseEvents(ics)
    .filter((e) => /match|seriespel|sammandrag|cup/i.test(e.summary))
    .map((e) => {
      const { opponent, homeAway } = extractOpponent(e.summary, ownNames);
      return { uid: e.uid, date: e.date, summary: e.summary, opponent, homeAway };
    });
}

export async function fetchCalendar(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/calendar, text/plain, */*" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Kalendern svarade ${res.status}`);
  return res.text();
}
