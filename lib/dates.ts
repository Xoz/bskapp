// Datumhjälp – ALLA "idag"-jämförelser ska ske mot svensk kalenderdag.
// Vercel kör servern i UTC, så new Date().toISOString() ger UTC-datum vilket
// blir fel mellan svensk midnatt och UTC-midnatt (sommartid 00:00–02:00).
// sv-SE-formatet ger YYYY-MM-DD; timeZone styr vilken kalenderdag som menas.

const TZ = "Europe/Stockholm";

// Dagens datum i svensk tid, "YYYY-MM-DD".
export function swedishToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

// Kalenderdagen (svensk tid) för ett givet tidsögonblick, "YYYY-MM-DD".
export function swedishDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

// Dagens datum i svensk tid förskjutet med ett antal dagar, "YYYY-MM-DD".
export function swedishDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return swedishDate(d);
}

// Antal hela kalenderdagar mellan ett "YYYY-MM-DD"-datum och svensk idag.
// 0 = idag, 1 = igår osv. Båda tolkas som kalenderdagar (UTC-midnatt) så att
// sommartid inte påverkar diffen.
export function daysSince(date: string): number {
  const then = Date.parse(`${date}T00:00:00Z`);
  const today = Date.parse(`${swedishToday()}T00:00:00Z`);
  return Math.round((today - then) / 86_400_000);
}

// "Idag" / "Igår" / "N dagar sedan" för ett "YYYY-MM-DD"-datum.
export function daysSinceLabel(date: string): string {
  const d = daysSince(date);
  if (d <= 0) return "Idag";
  if (d === 1) return "Igår";
  return `${d} dagar sedan`;
}

// Minuter sedan midnatt i svensk tid (0–1439). Används för att jämföra
// avsparktider utan att blanda in UTC-offset.
export function swedishMinutesSinceMidnight(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

// Europe/Stockholm-offset (ms) vid ett givet ögonblick – +1h vinter, +2h sommar.
function stockholmOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = Number(p.value);
  // 24:00 normaliseras till 0 av vissa motorer; håll det robust.
  const asUTC = Date.UTC(m.year, m.month - 1, m.day, m.hour % 24, m.minute, m.second);
  return asUTC - at.getTime();
}

// Gör om en svensk väggklocka (date "YYYY-MM-DD" + time "HH:MM") till absolut
// epoch-ms, DST-säkert. Ersätter hårdkodad "+02:00" som blir fel på vintern.
export function swedishWallClockToEpoch(date: string, time: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = stockholmOffsetMs(new Date(utcGuess));
  let epoch = utcGuess - offset;
  // Räkna om vid själva ögonblicket ifall vi snubblade över en DST-gräns.
  const offset2 = stockholmOffsetMs(new Date(epoch));
  if (offset2 !== offset) epoch = utcGuess - offset2;
  return epoch;
}

// Hur många minuter före avspark som föräldrarapporteringen öppnar automatiskt.
export const AUTO_OPEN_MINUTES_BEFORE = 60;

// Är liverapporteringen automatiskt öppen just nu för en match?
// Öppnar AUTO_OPEN_MINUTES_BEFORE min före avspark och hålls öppen matchdagen
// ut (svensk tid). date = "YYYY-MM-DD", startTime = "HH:MM" (svensk lokaltid).
// Returnerar false om matchen inte är idag eller saknar avsparktid – då gäller
// bara tränarens manuella report_open-flagga.
export function reportingAutoOpen(date: string, startTime: string | null): boolean {
  if (!startTime || date !== swedishToday()) return false;
  const [h, m] = startTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  return swedishMinutesSinceMidnight() >= h * 60 + m - AUTO_OPEN_MINUTES_BEFORE;
}
