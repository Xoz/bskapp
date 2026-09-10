/** Filfri transport. Endast data som behövs i lagappen följer med. */
export const TEAM_PATH = "/bollstanassk-fotboll-f2014-gul";
export const ORIGIN = "https://www.svenskalag.se";
export type Reply = "accepted" | "declined" | "pending";
export type ActivitySnapshot = {
  sourceId: string; url: string; date: string; time: string; title: string;
  kind: "match" | "training";
  callups: { name: string; status: Reply }[];
  totals: Record<Reply, number>;
  // null betyder att närvaro inte har kontrollerats. Ja-svar är aldrig närvaro.
  attendance: string[] | null;
};
export const nameKey = (name: string) => name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
export function dayOffset(today: string, days: number): string {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function sourceUrl(url: string): string {
  const parsed = new URL(url, ORIGIN);
  if (parsed.origin !== ORIGIN || !parsed.pathname.startsWith(`${TEAM_PATH}/`) || parsed.username || parsed.password) throw new Error("Fel källa eller lag");
  return parsed.href;
}
export function validateSnapshot(items: ActivitySnapshot[], today: string): void {
  if (!Array.isArray(items) || items.length === 0 || items.length > 150) throw new Error("Tom eller orimlig hämtning");
  const ids = new Set<string>();
  for (const a of items) {
    if (!/^\d+$/.test(a.sourceId) || ids.has(a.sourceId)) throw new Error("Ogiltigt eller dubbelt aktivitets-id");
    ids.add(a.sourceId);
    if (!sourceUrl(a.url).match(new RegExp(`/(?:match|aktivitet)/${a.sourceId}(?:/|$)`))) throw new Error("Fel aktivitetslänk");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date) || !Number.isFinite(Date.parse(`${a.date}T12:00:00Z`)) || new Date(`${a.date}T12:00:00Z`).toISOString().slice(0,10) !== a.date || a.date < dayOffset(today, -28) || a.date > dayOffset(today, 14) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(a.time)) throw new Error("Datum utanför synkfönstret");
    if (!a.title?.trim() || a.title.length > 300 || !["match", "training"].includes(a.kind)) throw new Error("Okänd aktivitet");
    if (!Array.isArray(a.callups) || a.callups.length > 200) throw new Error("Ogiltiga kallelser");
    const names = new Set<string>();
    for (const person of a.callups) {
      if (!person.name?.trim() || person.name.length > 150 || names.has(nameKey(person.name)) || !["accepted", "declined", "pending"].includes(person.status)) throw new Error("Tvetydiga kallelsesvar");
      names.add(nameKey(person.name));
    }
    for (const status of ["accepted", "declined", "pending"] as const) {
      if (!Number.isInteger(a.totals[status]) || a.totals[status] < 0 || a.totals[status] > 200 || a.callups.filter(p => p.status === status).length !== a.totals[status]) throw new Error("Ofullständig kallelselista");
    }
    if (a.attendance !== null && (a.date >= today || !Array.isArray(a.attendance) || a.attendance.length > 200 || a.attendance.some(n => !n.trim() || n.length > 150) || new Set(a.attendance.map(nameKey)).size !== a.attendance.length)) throw new Error("Ogiltig närvaro");
  }
}
export type SyncStatus = {
  state: "running" | "ok" | "error" | "login_required";
  startedAt: string; finishedAt?: string; lastSuccess?: string;
  message: string; activities?: number; unmatched?: string[];
};
export const STATUS_KEY = "svenskalag_sync_status";
export const REQUEST_KEY = "svenskalag_sync_request";
export const HISTORY_KEY = "svenskalag_sync_history";
