"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { all, get, run, batch, getSetting, setSetting, logActivity, DEFAULT_COLORS } from "./db";
import { renewShareToken, revokeShareToken } from "./queries";
import { generatePlayerCardText } from "./ai";
import { sessionToken, playerSessionToken, getRole, getRealRole, Role, getCoachName } from "./auth";
import { ALL_SKILLS } from "./svff";
import { STAT_IDS, LIVE_COUNT_IDS } from "./stats";
import { OPPONENT_GOAL } from "./liveTypes";
import { fetchCalendar, extractMatches, calendarName, calendarGroup } from "./ical";
import { swedishToday } from "./dates";
import {
  stepByKey,
  stepByOutcome,
  outcomeFromAreas,
  computeDelta,
  seedRating,
  RATING_AREAS,
} from "./rating";

async function requireRole(allowed: Role[]): Promise<Role> {
  const role = await getRole();
  if (!role || !allowed.includes(role)) redirect("/login");
  return role;
}

// ---- Auth ----
export async function logout() {
  const store = await cookies();
  store.delete("bsk_session");
  store.delete("bsk_view");
  store.delete("bsk_coach_email");
  store.delete("bsk_coach_name");
  redirect("/login");
}

export async function updateCoachProfile(formData: FormData) {
  await requireRole(["coach"]);
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return;
  const store = await cookies();
  store.set("bsk_coach_name", name, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
  redirect("/installningar?sparad=1");
}

export async function addCoachEmail(formData: FormData) {
  await requireRole(["coach"]);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const current = await getSetting("allowed_coach_emails");
  const list = current.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!list.includes(email)) list.push(email);
  await setSetting("allowed_coach_emails", list.join(","));
  revalidatePath("/installningar");
}

export async function removeCoachEmail(formData: FormData) {
  await requireRole(["coach"]);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const current = await getSetting("allowed_coach_emails");
  const list = current.split(",").map((e) => e.trim().toLowerCase()).filter((e) => e && e !== email);
  await setSetting("allowed_coach_emails", list.join(","));
  revalidatePath("/installningar");
}

// Brute-force-spärr per IP: 6-siffrig PIN (1M kombinationer) får inte gissas
// fritt. Max felförsök inom ett fönster → tillfällig låsning. Generöst nog för
// legitima användare bakom samma WiFi, men gör massgissning ogenomförbar.
const PIN_MAX_FAILS = 10;
const PIN_WINDOW_SEC = 10 * 60;
const PIN_LOCKOUT_SEC = 10 * 60;

export async function playerLogin(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const now = Math.floor(Date.now() / 1000);
  const throttle = await get<{ fails: number; window_start: number; blocked_until: number }>(
    "SELECT fails, window_start, blocked_until FROM login_throttle WHERE ip = ?",
    [ip]
  );

  if (throttle && throttle.blocked_until > now) {
    const mins = Math.ceil((throttle.blocked_until - now) / 60);
    return { error: `För många försök. Försök igen om ${mins} ${mins === 1 ? "minut" : "minuter"}.` };
  }

  const pin = String(formData.get("pin") ?? "").trim();
  if (!/^\d{6}$/.test(pin)) return { error: "PIN-koden består av 6 siffror." };
  const player = await get<{ id: number }>(
    "SELECT id FROM players WHERE pin = ? AND active = 1",
    [pin]
  );

  if (!player) {
    // Registrera felförsök inom rullande fönster; lås vid taket.
    const inWindow = throttle && now - throttle.window_start < PIN_WINDOW_SEC;
    let fails = inWindow ? throttle!.fails + 1 : 1;
    let windowStart = inWindow ? throttle!.window_start : now;
    let blockedUntil = 0;
    if (fails >= PIN_MAX_FAILS) {
      blockedUntil = now + PIN_LOCKOUT_SEC;
      fails = 0;
      windowStart = now;
    }
    await run(
      `INSERT INTO login_throttle (ip, fails, window_start, blocked_until) VALUES (?, ?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET fails = excluded.fails, window_start = excluded.window_start, blocked_until = excluded.blocked_until`,
      [ip, fails, windowStart, blockedUntil]
    );
    return { error: "Fel PIN-kod. Kontrollera med tränaren." };
  }

  // Lyckad inloggning – nollställ spärren för IP:n.
  if (throttle) await run("DELETE FROM login_throttle WHERE ip = ?", [ip]);

  const store = await cookies();
  store.set("bsk_player_session", playerSessionToken(player.id), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/min-profil");
}

export async function playerLogout() {
  (await cookies()).delete("bsk_player_session");
  redirect("/");
}

export async function generatePlayerPin(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("player_id"));
  if (!id) return;
  // Generera unik 6-siffrig PIN
  let pin: string;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (await get("SELECT 1 FROM players WHERE pin = ? AND active = 1", [pin]));
  await run("UPDATE players SET pin = ? WHERE id = ?", [pin, id]);
  revalidatePath("/installningar");
}

export async function generateCoachInvite() {
  await requireRole(["coach"]);
  const token = crypto.randomUUID().replace(/-/g, "");
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await setSetting("coach_invite_token", token);
  await setSetting("coach_invite_expires", expires);
  revalidatePath("/installningar");
}

export async function acceptInvite(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const token = String(formData.get("token") ?? "").trim();
  const stored = (await getSetting("coach_invite_token")).trim();
  const expires = (await getSetting("coach_invite_expires")).trim();
  if (!stored || token !== stored || !expires || new Date(expires) < new Date()) {
    return { error: "Inbjudningslänken är ogiltig eller har gått ut." };
  }
  // Single-use: rensa direkt
  await setSetting("coach_invite_token", "");
  await setSetting("coach_invite_expires", "");
  const store = await cookies();
  store.set("bsk_session", sessionToken("coach"), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
  redirect("/oversikt");
}

// Växla visningsroll. En tränare kan förhandsvisa som förälder/spelare (sätter
// bsk_view) och växla tillbaka. Övriga roller dirigeras till rätt vy/inloggning.
export async function setViewAs(formData: FormData) {
  const real = await getRealRole();
  const target = String(formData.get("view") ?? "");
  const store = await cookies();

  if (real === "coach") {
    if (target === "player") {
      store.set("bsk_view", "player", {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      redirect("/matcher");
    }
    store.delete("bsk_view");
    redirect("/oversikt");
  }

  redirect("/login");
}

// ---- Spelare ----
export async function addPlayer(formData: FormData) {
  await requireRole(["coach"]);
  const name = String(formData.get("name") ?? "").trim();
  const jersey = formData.get("jersey_number");
  if (!name) return;
  await run("INSERT INTO players (name, jersey_number) VALUES (?, ?)", [
    name,
    jersey ? Number(jersey) : null,
  ]);
  revalidatePath("/spelare");
}

// Klistra in truppen från svenskalag.se – ett namn per rad
export async function addPlayersBulk(formData: FormData) {
  await requireRole(["coach"]);
  const raw = String(formData.get("names") ?? "");
  const existingRows = await all<{ name: string }>("SELECT name FROM players WHERE active = 1");
  const existing = new Set(existingRows.map((r) => r.name.toLowerCase()));

  const stmts: { sql: string; args: (string | number | null)[] }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    // Plocka ev. tröjnummer: "7 Alva Svensson", "Alva Svensson 7" eller "#7 Alva"
    let name = line.replace(/\s+/g, " ").trim();
    if (!name) continue;
    let jersey: number | null = null;
    const lead = name.match(/^#?(\d{1,2})[.\s]+(.+)$/);
    const trail = name.match(/^(.+?)[\s#]+(\d{1,2})$/);
    if (lead) {
      jersey = Number(lead[1]);
      name = lead[2].trim();
    } else if (trail) {
      jersey = Number(trail[2]);
      name = trail[1].trim();
    }
    if (!name || existing.has(name.toLowerCase())) continue;
    stmts.push({
      sql: "INSERT INTO players (name, jersey_number) VALUES (?, ?)",
      args: [name, jersey],
    });
    existing.add(name.toLowerCase());
  }
  await batch(stmts);
  revalidatePath("/spelare");
  redirect("/spelare");
}

// Tar bort alla exempelspelare i ett klick (mjuk borttagning)
export async function removeDemoPlayers() {
  await requireRole(["coach"]);
  await run("UPDATE players SET active = 0 WHERE name LIKE 'Exempel:%'");
  revalidatePath("/spelare");
  redirect("/spelare");
}

export async function updatePlayer(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const jersey = formData.get("jersey_number");
  const notes = String(formData.get("notes") ?? "");
  const position = String(formData.get("position") ?? "");
  const level = String(formData.get("level") ?? "");
  if (!id || !name) return;
  await run("UPDATE players SET name = ?, jersey_number = ?, notes = ?, position = ?, level = ? WHERE id = ?", [
    name,
    jersey ? Number(jersey) : null,
    notes,
    position,
    level,
    id,
  ]);
  revalidatePath(`/spelare/${id}`);
  revalidatePath("/spelare");
}

// Sätter spelarens nivå direkt (t.ex. när tränaren bekräftar ett nivåförslag
// från matchformen). Kopplar till samma `players.level` som laguttagningen läser.
export async function setPlayerLevel(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  const level = String(formData.get("level") ?? "");
  if (!id || !level) return;
  await run("UPDATE players SET level = ? WHERE id = ?", [level, id]);
  revalidatePath(`/spelare/${id}`);
  revalidatePath("/spelare");
}

// Skapa/förnya spelarens delningslänk (gäller 48h) inför ett spelarsamtal.
// Genererar samtidigt en peppande AI-text riktad till spelaren.
export async function generateShareLink(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  if (!id) return;
  await renewShareToken(id);
  const summary = await generatePlayerCardText(id);
  await run("UPDATE players SET share_summary = ? WHERE id = ?", [summary, id]);
  revalidatePath(`/spelare/${id}`);
}

// Återkalla länken direkt
export async function revokeShareLink(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  if (!id) return;
  await revokeShareToken(id);
  revalidatePath(`/spelare/${id}`);
}

export async function removePlayer(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  if (!id) return;
  // Mjuk borttagning – historiken finns kvar
  await run("UPDATE players SET active = 0 WHERE id = ?", [id]);
  revalidatePath("/spelare");
  redirect("/spelare");
}

// ---- Utvärderingar ----
export async function createEvaluation(formData: FormData) {
  await requireRole(["coach"]);
  const playerId = Number(formData.get("player_id"));
  const date = String(formData.get("date") ?? "").slice(0, 10);
  const strengths = String(formData.get("strengths") ?? "");
  const goals = String(formData.get("development_goals") ?? "");
  const coachName = String(formData.get("coach_name") ?? "");
  if (!playerId || !date) return;

  const scores: { skillId: string; level: number }[] = [];
  for (const skill of ALL_SKILLS) {
    const raw = formData.get(`skill_${skill.id}`);
    if (raw) {
      const level = Number(raw);
      if (level >= 1 && level <= 4) scores.push({ skillId: skill.id, level });
    }
  }
  if (scores.length === 0) return;

  const res = await run(
    "INSERT INTO evaluations (player_id, date, strengths, development_goals, coach_name) VALUES (?, ?, ?, ?, ?)",
    [playerId, date, strengths, goals, coachName]
  );
  const evalId = Number(res.lastInsertRowid);
  await batch(
    scores.map((s) => ({
      sql: "INSERT INTO evaluation_scores (evaluation_id, skill_id, level) VALUES (?, ?, ?)",
      args: [evalId, s.skillId, s.level],
    }))
  );

  const player = await get<{ name: string }>("SELECT name FROM players WHERE id = ?", [playerId]);
  const logName = (await getCoachName()) ?? (coachName || "Tränare");
  if (player) await logActivity(logName, "Utvärderade", player.name);

  revalidatePath(`/spelare/${playerId}`);
  redirect(`/spelare/${playerId}`);
}

export async function deleteEvaluation(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  const playerId = Number(formData.get("player_id"));
  if (!id) return;
  await run("DELETE FROM evaluations WHERE id = ?", [id]);
  await run("DELETE FROM evaluation_scores WHERE evaluation_id = ?", [id]);
  revalidatePath(`/spelare/${playerId}`);
}

// ---- Matchstatistik (tränarens korrigeringsformulär) ----
async function savePlayerStats(matchId: number, formData: FormData) {
  const players = await all<{ id: number }>("SELECT id FROM players WHERE active = 1");
  const statCols = STAT_IDS.join(", ");
  const statPlaceholders = STAT_IDS.map(() => "?").join(", ");
  const statUpdates = STAT_IDS.map((c) => `${c} = excluded.${c}`).join(", ");

  const stmts: { sql: string; args: (string | number | null)[] }[] = [];
  for (const p of players) {
    const played = formData.get(`played_${p.id}`);
    if (!played) {
      stmts.push({
        sql: "DELETE FROM match_players WHERE match_id = ? AND player_id = ?",
        args: [matchId, p.id],
      });
      continue;
    }
    const values = STAT_IDS.map((c) => {
      const v = Number(formData.get(`${c}_${p.id}`) ?? 0);
      return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    });
    stmts.push({
      sql: `INSERT INTO match_players (match_id, player_id, ${statCols}) VALUES (?, ?, ${statPlaceholders})
            ON CONFLICT(match_id, player_id) DO UPDATE SET ${statUpdates}`,
      args: [matchId, p.id, ...values],
    });
  }
  await batch(stmts);
}

// ---- Matcher (tränare) ----
export async function saveMatch(formData: FormData) {
  await requireRole(["coach"]);
  const id = formData.get("id") ? Number(formData.get("id")) : null;
  const date = String(formData.get("date") ?? "").slice(0, 10);
  const opponent = String(formData.get("opponent") ?? "").trim();
  const homeAway = formData.get("home_away") === "away" ? "away" : "home";
  const matchType = String(formData.get("match_type") ?? "seriespel");
  const ourScoreRaw = formData.get("our_score");
  const oppScoreRaw = formData.get("opponent_score");
  const notes = String(formData.get("notes") ?? "");
  const startTimeRaw = String(formData.get("start_time") ?? "").trim();
  const startTime = /^\d{2}:\d{2}$/.test(startTimeRaw) ? startTimeRaw : null;
  const periodsRaw = Number(formData.get("periods") ?? 3);
  const periods = [2, 3, 4].includes(periodsRaw) ? periodsRaw : 3;
  const periodMinutesRaw = Number(formData.get("period_minutes") ?? 20);
  const periodMinutes = periodMinutesRaw > 0 && periodMinutesRaw <= 60 ? periodMinutesRaw : 20;
  const level = String(formData.get("level") ?? "");
  const cupName = String(formData.get("cup_name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  if (!date || !opponent) return;

  const ourScore = ourScoreRaw !== null && ourScoreRaw !== "" ? Number(ourScoreRaw) : null;
  const oppScore = oppScoreRaw !== null && oppScoreRaw !== "" ? Number(oppScoreRaw) : null;

  let matchId: number;
  if (id) {
    await run(
      "UPDATE matches SET date = ?, start_time = ?, periods = ?, period_minutes = ?, opponent = ?, home_away = ?, match_type = ?, our_score = ?, opponent_score = ?, notes = ?, level = ?, cup_name = ?, location = ? WHERE id = ?",
      [date, startTime, periods, periodMinutes, opponent, homeAway, matchType, ourScore, oppScore, notes, level, cupName, location, id]
    );
    matchId = id;
  } else {
    const res = await run(
      "INSERT INTO matches (date, start_time, periods, period_minutes, opponent, home_away, match_type, our_score, opponent_score, notes, level, cup_name, location, created_by_role, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'coach', 'manual')",
      [date, startTime, periods, periodMinutes, opponent, homeAway, matchType, ourScore, oppScore, notes, level, cupName, location]
    );
    matchId = Number(res.lastInsertRowid);
  }

  await savePlayerStats(matchId, formData);

  const logName = (await getCoachName()) ?? "Tränare";
  await logActivity(logName, id ? "Uppdaterade match" : "Lade till match", opponent);

  revalidatePath("/matcher");
  revalidatePath("/statistik");
  redirect(`/matcher/${matchId}`);
}

// ---- Cup-hantering ----

export async function updateCup(formData: FormData) {
  await requireRole(["coach"]);
  const originalName = String(formData.get("original_cup_name") ?? "").trim();
  const originalGroup = String(formData.get("original_cup_group") ?? "").trim();
  const newName = String(formData.get("new_cup_name") ?? "").trim();
  if (!originalName || !newName) return;

  // Byt cup-namn om det ändrats – bara matcher i denna grupp påverkas.
  if (newName !== originalName) {
    await run(
      "UPDATE matches SET cup_name = ? WHERE cup_name = ? AND cup_group = ?",
      [newName, originalName, originalGroup]
    );
    revalidatePath(`/matcher/cup/${encodeURIComponent(originalName)}`);
  }

  const cupName = newName;
  const level = String(formData.get("level") ?? "");
  const cupGroup = String(formData.get("cup_group") ?? "").trim();
  const periods = Math.min(9, Math.max(1, Number(formData.get("periods")) || 3));
  const periodMinutes = Math.min(90, Math.max(1, Number(formData.get("period_minutes")) || 20));
  await run(
    "UPDATE matches SET level = ?, periods = ?, period_minutes = ?, cup_group = ? WHERE cup_name = ? AND cup_group = ?",
    [level, periods, periodMinutes, cupGroup, cupName, originalGroup]
  );

  const ids = String(formData.get("match_ids") ?? "").split(",").map(Number).filter(Boolean);
  for (const id of ids) {
    const date = String(formData.get(`date_${id}`) ?? "").trim();
    const time = String(formData.get(`time_${id}`) ?? "").trim();
    const opponent = String(formData.get(`opponent_${id}`) ?? "").trim();
    const homeAway = String(formData.get(`home_away_${id}`) ?? "home");
    const phase = String(formData.get(`phase_${id}`) ?? "group");
    const round = formData.get(`round_${id}`) as string | null;
    const isPlayoff = phase === "playoff";
    if (!date) continue;
    if (!isPlayoff && !opponent) continue;
    const finalOpponent = opponent || (isPlayoff ? "TBD" : opponent);
    await run(
      "UPDATE matches SET date = ?, start_time = ?, opponent = ?, home_away = ?, cup_phase = ?, cup_round = ? WHERE id = ? AND cup_name = ?",
      [date, time || null, finalOpponent, homeAway, phase, round || null, id, cupName]
    );
  }

  revalidatePath("/matcher");
  revalidatePath("/matcher", "layout");
  const grp = cupGroup ? `&grupp=${encodeURIComponent(cupGroup)}` : "";
  redirect(`/matcher/cup/${encodeURIComponent(cupName)}?sparad=1${grp}`);
}

export async function deleteCupMatch(id: number, cupName: string, cupGroup: string) {
  await requireRole(["coach"]);
  if (!id) return;
  await batch([
    { sql: "DELETE FROM match_events WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_players WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_squad WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_lineup WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_subs WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM matches WHERE id = ?", args: [id] },
  ]);
  revalidatePath("/matcher");

  // Finns inga matcher kvar i denna cup+grupp? Tillbaka till matchlistan.
  const remaining = await get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM matches WHERE cup_name = ? AND cup_group = ?",
    [cupName, cupGroup]
  );
  if (!remaining || Number(remaining.c) === 0) redirect("/matcher");
  const grp = cupGroup ? `?grupp=${encodeURIComponent(cupGroup)}` : "";
  redirect(`/matcher/cup/${encodeURIComponent(cupName)}${grp}`);
}

export async function deleteCup(cupName: string, cupGroup: string) {
  await requireRole(["coach"]);
  if (!cupName) return;
  // Hämta alla match-id:n i denna cup+grupp för att rensa relaterade tabeller.
  const ids = await all<{ id: number }>(
    "SELECT id FROM matches WHERE cup_name = ? AND cup_group = ?",
    [cupName, cupGroup]
  );
  if (ids.length > 0) {
    const idList = ids.map((r) => r.id);
    await batch([
      ...idList.map((id) => ({ sql: "DELETE FROM match_events WHERE match_id = ?", args: [id] })),
      ...idList.map((id) => ({ sql: "DELETE FROM match_players WHERE match_id = ?", args: [id] })),
      ...idList.map((id) => ({ sql: "DELETE FROM match_squad WHERE match_id = ?", args: [id] })),
      ...idList.map((id) => ({ sql: "DELETE FROM match_lineup WHERE match_id = ?", args: [id] })),
      ...idList.map((id) => ({ sql: "DELETE FROM match_subs WHERE match_id = ?", args: [id] })),
      ...idList.map((id) => ({ sql: "DELETE FROM match_ratings WHERE match_id = ?", args: [id] })),
      { sql: "DELETE FROM matches WHERE cup_name = ? AND cup_group = ?", args: [cupName, cupGroup] },
    ]);
  }
  const logName = (await getCoachName()) ?? "Tränare";
  await logActivity(logName, "Raderade cup", cupGroup ? `${cupName} · ${cupGroup}` : cupName);
  revalidatePath("/matcher");
  redirect("/matcher");
}

export async function addCupPlayoffMatch(formData: FormData) {
  await requireRole(["coach"]);
  const cupName = String(formData.get("cup_name") ?? "").trim();
  const cupGroup = String(formData.get("cup_group") ?? "").trim();
  if (!cupName) return;
  // Ärver datum och speltidsformat från cupens befintliga matcher.
  const existing = await get<{ date: string; periods: number; period_minutes: number; level: string }>(
    "SELECT date, periods, period_minutes, level FROM matches WHERE cup_name = ? AND cup_group = ? ORDER BY date DESC, start_time DESC LIMIT 1",
    [cupName, cupGroup]
  );
  await run(
    "INSERT INTO matches (date, opponent, home_away, match_type, cup_name, cup_group, cup_phase, periods, period_minutes, level) VALUES (?, ?, 'home', 'cup', ?, ?, 'playoff', ?, ?, ?)",
    [
      existing?.date ?? swedishToday(),
      "TBD",
      cupName,
      cupGroup,
      existing?.periods ?? 3,
      existing?.period_minutes ?? 20,
      existing?.level ?? "",
    ]
  );
  revalidatePath("/matcher");
  const grp = cupGroup ? `?grupp=${encodeURIComponent(cupGroup)}` : "";
  redirect(`/matcher/cup/${encodeURIComponent(cupName)}${grp}`);
}

export async function addCup(formData: FormData) {
  await requireRole(["coach"]);
  const cupName = String(formData.get("cup_name") ?? "").trim();
  const level = String(formData.get("level") ?? "");
  if (!cupName) return;

  const matchCount = Number(formData.get("match_count") ?? 0);
  for (let i = 0; i < matchCount; i++) {
    const opponent = String(formData.get(`opponent_${i}`) ?? "").trim();
    const date = String(formData.get(`date_${i}`) ?? "").trim();
    const time = String(formData.get(`time_${i}`) ?? "").trim();
    const homeAway = String(formData.get(`home_away_${i}`) ?? "home");
    if (!opponent || !date) continue;
    await run(
      "INSERT INTO matches (date, start_time, opponent, home_away, match_type, level, cup_name, cup_phase) VALUES (?, ?, ?, ?, 'cup', ?, ?, 'group')",
      [date, time || null, opponent, homeAway, level, cupName]
    );
  }

  const logName = (await getCoachName()) ?? "Tränare";
  await logActivity(logName, "Skapade cup", cupName);
  revalidatePath("/matcher");
  redirect(`/matcher/cup/${encodeURIComponent(cupName)}`);
}

// Sätt/ändra matchens svårighetsnivå. Med "apply_cup" sätts samma nivå på alla
// matcher i cupen (matcherna i en cup spelas på samma nivå).
export async function setMatchLevel(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  const level = String(formData.get("level") ?? "");
  if (!id) return;

  const applyCup = formData.get("apply_cup") === "on";
  if (applyCup) {
    const m = await get<{ cup_name: string }>("SELECT cup_name FROM matches WHERE id = ?", [id]);
    if (m?.cup_name) {
      await run("UPDATE matches SET level = ? WHERE cup_name = ?", [level, m.cup_name]);
      revalidatePath(`/matcher/${id}/laguttagning`);
      revalidatePath(`/matcher/${id}`);
      revalidatePath("/matcher");
      return;
    }
  }
  await run("UPDATE matches SET level = ? WHERE id = ?", [level, id]);
  revalidatePath(`/matcher/${id}/laguttagning`);
  revalidatePath(`/matcher/${id}`);
  revalidatePath("/matcher");
}

// ---- Matchbetyg (ELO-form) ----
// Sparar tränarens betyg per spelare för en match och uppdaterar varje spelares
// löpande form-tal. Idempotent: betygsätter man om matchen ångras det förra
// betygets delta först, så form-talet inte dubbelräknas. Se lib/rating.ts.
export async function saveMatchRatings(formData: FormData) {
  await requireRole(["coach"]);
  const matchId = Number(formData.get("match_id"));
  if (!matchId) return;

  const match = await get<{ level: string; opponent: string }>(
    "SELECT level, opponent FROM matches WHERE id = ?",
    [matchId]
  );
  if (!match) return;

  const players = await all<{ id: number; level: string; form_rating: number | null }>(
    "SELECT id, level, form_rating FROM players WHERE active = 1"
  );
  const prevRatings = await all<{ player_id: number; delta: number }>(
    "SELECT player_id, delta FROM match_ratings WHERE match_id = ?",
    [matchId]
  );
  const prevDelta = new Map(prevRatings.map((r) => [r.player_id, r.delta]));

  const stmts: { sql: string; args: (string | number | null)[] }[] = [];
  let rated = 0;
  for (const p of players) {
    const advUsed = formData.get(`adv_${p.id}`) === "1";
    let overallKey: string;
    let outcome: number;
    const scores: Record<string, number> = {};

    if (advUsed) {
      const areaOutcomes: number[] = [];
      for (const area of RATING_AREAS) {
        const step = stepByKey(formData.get(`area_${p.id}_${area.id}`)?.toString());
        if (step) {
          scores[area.id] = step.outcome;
          areaOutcomes.push(step.outcome);
        }
      }
      if (areaOutcomes.length === 0) continue;
      outcome = outcomeFromAreas(areaOutcomes);
      overallKey = stepByOutcome(outcome).key;
    } else {
      const step = stepByKey(formData.get(`overall_${p.id}`)?.toString());
      if (!step) continue;
      overallKey = step.key;
      outcome = step.outcome;
    }

    const suggested = String(formData.get(`suggested_${p.id}`) ?? "");
    const delta = computeDelta(match.level, outcome);

    // Bas = nuvarande form-tal (seedat från nivå om spelaren aldrig betygsatts),
    // minus ett ev. tidigare betyg för just denna match.
    let base = p.form_rating ?? seedRating(p.level);
    const prev = prevDelta.get(p.id);
    if (prev != null) base -= prev;
    const newRating = base + delta;

    stmts.push({
      sql: `INSERT INTO match_ratings (match_id, player_id, overall, scores, suggested, delta)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(match_id, player_id) DO UPDATE SET
              overall = excluded.overall, scores = excluded.scores,
              suggested = excluded.suggested, delta = excluded.delta`,
      args: [matchId, p.id, overallKey, JSON.stringify(scores), suggested, delta],
    });
    stmts.push({
      sql: "UPDATE players SET form_rating = ? WHERE id = ?",
      args: [newRating, p.id],
    });
    rated++;
  }

  if (stmts.length === 0) return;
  await batch(stmts);

  const logName = (await getCoachName()) ?? "Tränare";
  await logActivity(logName, "Betygsatte spelare", `${rated} st mot ${match.opponent}`);

  revalidatePath(`/matcher/${matchId}`);
  revalidatePath("/spelare");
  revalidatePath("/oversikt");
}

// Spara uttagen trupp för en match (ersätter tidigare urval). Om "apply_cup"
// är satt och matchen ingår i en cup appliceras truppen på alla matcher i cupen.
export async function saveSquad(formData: FormData) {
  await requireRole(["coach"]);
  const matchId = Number(formData.get("match_id"));
  if (!matchId) return;
  const ids = formData.getAll("player_id").map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const applyCup = formData.get("apply_cup") === "on";

  let targetIds = [matchId];
  if (applyCup) {
    const m = await get<{ cup_name: string }>("SELECT cup_name FROM matches WHERE id = ?", [matchId]);
    if (m?.cup_name) {
      const rows = await all<{ id: number }>("SELECT id FROM matches WHERE cup_name = ?", [m.cup_name]);
      if (rows.length > 0) targetIds = rows.map((r) => r.id);
    }
  }

  const stmts: { sql: string; args?: (string | number | null)[] }[] = [];
  for (const mid of targetIds) {
    stmts.push({ sql: "DELETE FROM match_squad WHERE match_id = ?", args: [mid] });
    for (const pid of ids) {
      stmts.push({
        sql: "INSERT OR IGNORE INTO match_squad (match_id, player_id) VALUES (?, ?)",
        args: [mid, pid],
      });
    }
    revalidatePath(`/matcher/${mid}/laguttagning`);
    revalidatePath(`/matcher/${mid}`);
  }
  await batch(stmts);

  const squadMatch = await get<{ opponent: string; date: string }>("SELECT opponent, date FROM matches WHERE id = ?", [matchId]);
  const squadLogName = (await getCoachName()) ?? "Tränare";
  if (squadMatch) await logActivity(squadLogName, "Tog ut trupp", `${squadMatch.opponent} · ${squadMatch.date}`);

  redirect(`/matcher/${matchId}`);
}

// Spara laguttagning: kallad trupp + formation + utplacerade spelare (startelva).
// Truppen kan appliceras på hela cupen; utplaceringen sparas bara för matchen.
export async function saveLineup(formData: FormData) {
  await requireRole(["coach"]);
  const matchId = Number(formData.get("match_id"));
  if (!matchId) return;

  const squadIds = formData.getAll("player_id").map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const formation = String(formData.get("formation") ?? "");
  const applyCup = formData.get("apply_cup") === "on";

  let positions: { id: number; x: number; y: number }[] = [];
  try {
    const raw = JSON.parse(String(formData.get("positions") ?? "[]"));
    if (Array.isArray(raw)) {
      const clamp = (v: number) => Math.min(0.97, Math.max(0.03, Number(v)));
      positions = raw
        .filter((p) => squadIds.includes(Number(p.id)) && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
        .map((p) => ({ id: Number(p.id), x: clamp(p.x), y: clamp(p.y) }));
    }
  } catch {
    positions = [];
  }

  // Trupp + formation: gäller matchen, eller hela cupen om valt
  let squadTargets = [matchId];
  if (applyCup) {
    const m = await get<{ cup_name: string }>("SELECT cup_name FROM matches WHERE id = ?", [matchId]);
    if (m?.cup_name) {
      const rows = await all<{ id: number }>("SELECT id FROM matches WHERE cup_name = ?", [m.cup_name]);
      if (rows.length > 0) squadTargets = rows.map((r) => r.id);
    }
  }

  const stmts: { sql: string; args?: (string | number | null)[] }[] = [];
  for (const mid of squadTargets) {
    stmts.push({ sql: "DELETE FROM match_squad WHERE match_id = ?", args: [mid] });
    for (const pid of squadIds) {
      stmts.push({ sql: "INSERT OR IGNORE INTO match_squad (match_id, player_id) VALUES (?, ?)", args: [mid, pid] });
    }
    stmts.push({ sql: "UPDATE matches SET formation = ? WHERE id = ?", args: [formation, mid] });
    revalidatePath(`/matcher/${mid}/laguttagning`);
    revalidatePath(`/matcher/${mid}`);
  }
  // Utplacering (positioner) sparas bara för den här matchen
  stmts.push({ sql: "DELETE FROM match_lineup WHERE match_id = ?", args: [matchId] });
  for (const p of positions) {
    stmts.push({
      sql: "INSERT OR IGNORE INTO match_lineup (match_id, player_id, x, y) VALUES (?, ?, ?, ?)",
      args: [matchId, p.id, p.x, p.y],
    });
  }

  await batch(stmts);

  const lineupMatch = await get<{ opponent: string; date: string }>("SELECT opponent, date FROM matches WHERE id = ?", [matchId]);
  const lineupLogName = (await getCoachName()) ?? "Tränare";
  if (lineupMatch) await logActivity(lineupLogName, "Satte startelva", `${lineupMatch.opponent} · ${lineupMatch.date}`);

  redirect(`/matcher/${matchId}`);
}

export async function deleteMatch(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  if (!id) return;
  await batch([
    { sql: "DELETE FROM match_events WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_players WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_squad WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_lineup WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_subs WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM matches WHERE id = ?", args: [id] },
  ]);
  revalidatePath("/matcher");
  redirect("/matcher");
}

// Öppnar/stänger föräldrarapportering för en match (tränar-toggle).
export async function toggleMatchReporting(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  if (!id) return;
  const open = formData.get("open") === "1";
  await run("UPDATE matches SET report_open = ? WHERE id = ?", [open ? 1 : 0, id]);
  revalidatePath(`/matcher/${id}`);
}

export async function resetMatch(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  if (!id) return;
  await batch([
    { sql: "DELETE FROM match_events WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_players WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_reporters WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_subs WHERE match_id = ?", args: [id] },
    {
      sql: "UPDATE matches SET our_score = NULL, opponent_score = NULL, clock_running = 0, clock_offset = 0, clock_started_at = NULL, clock_period = 1 WHERE id = ?",
      args: [id],
    },
  ]);
  revalidatePath(`/matcher/${id}`);
  revalidatePath("/matcher");
  revalidatePath("/statistik");
  redirect(`/matcher/${id}`);
}

export async function addManualEvent(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  await requireRole(["coach"]);
  const matchId = Number(formData.get("match_id"));
  const playerId = formData.get("player_id") === "opponent" ? null : Number(formData.get("player_id")) || null;
  const statId = String(formData.get("stat_id") ?? "");
  const period = Number(formData.get("period")) || null;
  const minutes = Number(formData.get("minutes") ?? 0);
  const seconds = Number(formData.get("seconds") ?? 0);
  const matchSecond = (minutes > 0 || seconds > 0) ? minutes * 60 + seconds : null;
  const isOpponentGoal = formData.get("player_id") === "opponent";

  if (!matchId || !statId) return { error: "Ogiltiga värden" };

  const ENSURE_ROW = "INSERT INTO match_players (match_id, player_id) VALUES (?, ?) ON CONFLICT(match_id, player_id) DO NOTHING";

  const stmts: { sql: string; args?: (string | number | null)[] }[] = [
    {
      sql: "INSERT INTO match_events (match_id, player_id, stat_id, match_second, period) VALUES (?, ?, ?, ?, ?)",
      args: [matchId, playerId, statId, matchSecond, period],
    },
  ];

  if (isOpponentGoal) {
    stmts.push({ sql: "UPDATE matches SET opponent_score = COALESCE(opponent_score, 0) + 1 WHERE id = ?", args: [matchId] });
  } else if (playerId != null && STAT_IDS.includes(statId)) {
    stmts.push({ sql: ENSURE_ROW, args: [matchId, playerId] });
    stmts.push({ sql: `UPDATE match_players SET ${statId} = ${statId} + 1 WHERE match_id = ? AND player_id = ?`, args: [matchId, playerId] });
    if (statId === "goals") {
      stmts.push({ sql: "UPDATE matches SET our_score = COALESCE(our_score, 0) + 1 WHERE id = ?", args: [matchId] });
    }
  }

  await batch(stmts);
  revalidatePath(`/matcher/${matchId}`);
  return { ok: true };
}

// Ta bort en enskild felaktig händelse ur matchflödet och justera räknarna
export async function deleteMatchEvent(formData: FormData) {
  await requireRole(["coach"]);
  const eventId = Number(formData.get("event_id"));
  const matchId = Number(formData.get("match_id"));
  if (!eventId || !matchId) return;

  const ev = await get<{ id: number; player_id: number | null; stat_id: string }>(
    "SELECT id, player_id, stat_id FROM match_events WHERE id = ? AND match_id = ?",
    [eventId, matchId]
  );
  if (!ev) return;

  const stmts: { sql: string; args?: (string | number | null)[] }[] = [
    { sql: "DELETE FROM match_events WHERE id = ?", args: [ev.id] },
  ];

  if (ev.stat_id === OPPONENT_GOAL) {
    stmts.push({
      sql: "UPDATE matches SET opponent_score = MAX(COALESCE(opponent_score, 0) - 1, 0) WHERE id = ?",
      args: [matchId],
    });
  } else if (ev.player_id != null && LIVE_COUNT_IDS.includes(ev.stat_id)) {
    stmts.push({
      sql: `UPDATE match_players SET ${ev.stat_id} = MAX(${ev.stat_id} - 1, 0) WHERE match_id = ? AND player_id = ?`,
      args: [matchId, ev.player_id],
    });
    if (ev.stat_id === "goals") {
      stmts.push({
        sql: "UPDATE matches SET our_score = MAX(COALESCE(our_score, 0) - 1, 0) WHERE id = ?",
        args: [matchId],
      });
    }
  }

  await batch(stmts);
  revalidatePath(`/matcher/${matchId}`);
}

// ---- Kalenderimport (svenskalag.se m.fl.) ----
export async function importCalendarMatches() {
  await requireRole(["coach"]);
  const url = (await getSetting("calendar_url")).trim();
  if (!url) redirect("/installningar?kalender=saknas");

  let imported = 0;
  try {
    const ics = await fetchCalendar(url);
    const ownNames = [await getSetting("team_name"), await getSetting("club_name")].filter(Boolean);
    const matches = extractMatches(ics, ownNames);

    for (const m of matches) {
      if (!m.date) continue;
      const exists = await get<{ 1: number }>("SELECT 1 FROM matches WHERE external_uid = ?", [
        m.uid,
      ]);
      if (exists) {
        // Fyll i nivå/cup/tid/plats på redan importerade matcher som saknar det
        if (m.level) {
          await run(
            "UPDATE matches SET level = ? WHERE external_uid = ? AND (level IS NULL OR level = '')",
            [m.level, m.uid]
          );
        }
        if (m.cupName) {
          await run(
            "UPDATE matches SET cup_name = ? WHERE external_uid = ? AND (cup_name IS NULL OR cup_name = '')",
            [m.cupName, m.uid]
          );
        }
        if (m.time) {
          await run(
            "UPDATE matches SET start_time = ? WHERE external_uid = ? AND (start_time IS NULL OR start_time = '')",
            [m.time, m.uid]
          );
        }
        if (m.location) {
          await run(
            "UPDATE matches SET location = ? WHERE external_uid = ? AND (location IS NULL OR location = '')",
            [m.location, m.uid]
          );
        }
        continue;
      }
      const notes = m.series ? `Serie: ${m.series}` : "";
      await run(
        "INSERT INTO matches (date, start_time, opponent, home_away, match_type, notes, level, cup_name, location, created_by_role, source, external_uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'coach', 'calendar', ?)",
        [m.date, m.time, m.opponent, m.homeAway, m.matchType, notes, m.level, m.cupName, m.location, m.uid]
      );
      imported++;
    }
  } catch {
    redirect("/installningar?kalender=fel");
  }

  revalidatePath("/matcher");
  redirect(`/installningar?kalender=${imported}`);
}

// ---- Cup-import via iCal-länk ----
// Två steg: previewCupImport (returnerar data, redirectar ej) → importCupMatches (skriver).
// Cup-feeds (Profixio/CupManager m.fl.) levererar standard-iCal men utan svenskalags
// "// Lag"-suffix; vi läser motståndare via extractMatches generiska gren och tvingar cup.

export interface CupPreviewMatch {
  uid: string;
  date: string;
  time: string | null;
  opponent: string;
  homeAway: "home" | "away";
  location: string;
}
export type CupPreviewState =
  | { ok: true; url: string; cupName: string; matches: CupPreviewMatch[] }
  | { ok: false; error: string }
  | null;

export async function previewCupImport(
  _prev: CupPreviewState,
  formData: FormData
): Promise<CupPreviewState> {
  await requireRole(["coach"]);
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { ok: false, error: "Klistra in en iCal-länk." };

  let ics: string;
  try {
    ics = await fetchCalendar(url);
  } catch {
    return { ok: false, error: "Kunde inte hämta kalendern. Kontrollera länken." };
  }

  const ownNames = [await getSetting("team_name"), await getSetting("club_name")].filter(Boolean);
  const matches = extractMatches(ics, ownNames)
    .filter((m) => m.date)
    .map((m) => ({
      uid: m.uid,
      date: m.date,
      time: m.time,
      opponent: m.opponent,
      homeAway: m.homeAway,
      location: m.location,
    }));

  if (matches.length === 0)
    return { ok: false, error: "Inga matcher hittades i kalendern." };

  matches.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  const baseName = calendarName(ics) ?? "";
  const group = calendarGroup(ics);
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const cupName = group ? `${baseName} - ${capitalize(group)}` : baseName;
  return { ok: true, url, cupName, matches };
}

export async function importCupMatches(formData: FormData) {
  await requireRole(["coach"]);
  const url = String(formData.get("url") ?? "").trim();
  const cupName = String(formData.get("cup_name") ?? "").trim();
  const level = String(formData.get("level") ?? "");
  if (!url || !cupName) redirect("/matcher/importera-cup?fel=saknas");

  let imported = 0;
  try {
    const ics = await fetchCalendar(url);
    const ownNames = [await getSetting("team_name"), await getSetting("club_name")].filter(Boolean);
    const matches = extractMatches(ics, ownNames);

    for (const m of matches) {
      if (!m.date) continue;
      const exists = await get<{ 1: number }>("SELECT 1 FROM matches WHERE external_uid = ?", [
        m.uid,
      ]);
      if (exists) continue;
      const notes = [m.time && `Avspark ${m.time}`, m.location && `Plats: ${m.location}`]
        .filter(Boolean)
        .join(" · ");
      await run(
        "INSERT INTO matches (date, start_time, opponent, home_away, match_type, cup_phase, notes, level, cup_name, created_by_role, source, external_uid) VALUES (?, ?, ?, ?, 'cup', 'group', ?, ?, ?, 'coach', 'calendar', ?)",
        [m.date, m.time, m.opponent, m.homeAway, notes, level, cupName, m.uid]
      );
      imported++;
    }
  } catch {
    redirect("/matcher/importera-cup?fel=hamta");
  }

  const logName = (await getCoachName()) ?? "Tränare";
  await logActivity(logName, "Importerade cup", cupName);
  revalidatePath("/matcher");
  redirect(`/matcher/cup/${encodeURIComponent(cupName)}`);
}

// ---- Inställningar ----
export async function updateSettings(formData: FormData) {
  await requireRole(["coach"]);
  const keys = [
    "club_name",
    "team_name",
    "primary_color",
    "accent_color",
    "jersey_color",
    "jersey_text_color",
    "gk_jersey_color",
    "gk_jersey_text_color",
    "season",
  ];
  for (const key of keys) {
    const value = formData.get(key);
    if (value !== null && String(value).trim() !== "") await setSetting(key, String(value).trim());
  }
  // Kalender-URL får vara tom (rensar kopplingen)
  const cal = formData.get("calendar_url");
  if (cal !== null) await setSetting("calendar_url", String(cal).trim());

  revalidatePath("/", "layout");
  redirect("/installningar?sparad=1");
}

export async function resetColors() {
  await requireRole(["coach"]);
  for (const [key, value] of Object.entries(DEFAULT_COLORS)) {
    await setSetting(key, value);
  }
  revalidatePath("/", "layout");
  redirect("/installningar?sparad=1#laget");
}

export async function submitSelfEval(
  _prev: { done?: boolean; error?: string } | null,
  formData: FormData
): Promise<{ done?: boolean; error?: string }> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Ogiltig länk." };

  const player = await get<{ id: number; share_expires: number | null }>(
    "SELECT id, share_expires FROM players WHERE share_token = ?",
    [token]
  );
  if (!player || !player.share_expires || player.share_expires < Date.now())
    return { error: "Länken har gått ut." };

  const fun = Math.max(1, Math.min(3, Number(formData.get("fun_rating")) || 2));
  const progress = Math.max(1, Math.min(3, Number(formData.get("progress_rating")) || 2));
  const team = Math.max(1, Math.min(3, Number(formData.get("team_rating")) || 2));
  const bestAt = String(formData.get("best_at") ?? "").slice(0, 500).trim();
  const wantToImprove = String(formData.get("want_to_improve") ?? "").slice(0, 500).trim();
  const noteToCoach = String(formData.get("note_to_coach") ?? "").slice(0, 500).trim();

  await run(
    `INSERT INTO player_self_evals (player_id, fun_rating, progress_rating, team_rating, best_at, want_to_improve, note_to_coach)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [player.id, fun, progress, team, bestAt, wantToImprove, noteToCoach]
  );
  return { done: true };
}
