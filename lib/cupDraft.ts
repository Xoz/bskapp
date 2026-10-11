export type CupDraftMatch = { opponent: string; date: string; time: string; homeAway: "home" | "away" };

/** Validate the entire request before creating a group or any matches. */
export function parseCupDraft(form: FormData):
  | { error: string }
  | { cupName: string; matches: CupDraftMatch[] } {
  const cupName = String(form.get("cup_name") ?? "").trim();
  if (!cupName || cupName.length > 160) return { error: "Ange ett cupnamn på högst 160 tecken." };
  const count = Number(form.get("match_count"));
  if (!Number.isInteger(count) || count < 1 || count > 50) return { error: "Lägg till mellan 1 och 50 matcher." };
  const matches: CupDraftMatch[] = [];
  for (let i = 0; i < count; i++) {
    const opponent = String(form.get(`opponent_${i}`) ?? "").trim();
    const date = String(form.get(`date_${i}`) ?? "").trim();
    const time = String(form.get(`time_${i}`) ?? "").trim();
    const homeAway = String(form.get(`home_away_${i}`) ?? "home");
    const day = new Date(`${date}T12:00:00Z`);
    if (!opponent || opponent.length > 200 || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) {
      return { error: `Match ${i + 1}: ange motståndare och ett giltigt datum.` };
    }
    if ((time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) || !["home", "away"].includes(homeAway)) {
      return { error: `Match ${i + 1}: kontrollera avsparktid och hemma/borta.` };
    }
    matches.push({ opponent, date, time, homeAway: homeAway as "home" | "away" });
  }
  return { cupName, matches };
}
