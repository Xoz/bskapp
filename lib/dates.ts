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
