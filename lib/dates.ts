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
