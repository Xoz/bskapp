// Match times are stored as Swedish local time (Europe/Stockholm).
// This function converts a date string + "HH:MM" time to the correct UTC Date.
export function parseSwedishTime(date: string, startTime: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  const iso = `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  // Treat the string as UTC temporarily, then find Stockholm's offset at that moment.
  const asUTC = new Date(iso + "Z");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(asUTC);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)!.value);
  const offsetMs =
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) -
    asUTC.getTime();
  return new Date(asUTC.getTime() - offsetMs);
}
