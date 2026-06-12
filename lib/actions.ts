"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { all, get, run, batch, getSetting, setSetting, generateMatchCode } from "./db";
import { sessionToken, getRole, Role } from "./auth";
import { ALL_SKILLS } from "./svff";
import { STAT_IDS } from "./stats";
import { fetchCalendar, extractMatches } from "./ical";

async function requireRole(allowed: Role[]): Promise<Role> {
  const role = await getRole();
  if (!role || !allowed.includes(role)) redirect("/login");
  return role;
}

// ---- Auth ----
export async function login(_prev: { error?: string } | null, formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  let role: Role | null = null;
  if (code === (await getSetting("coach_code")).toUpperCase()) role = "coach";
  else if (code === (await getSetting("parent_code")).toUpperCase()) role = "parent";

  if (!role) return { error: "Fel kod. Kontrollera med tränaren och försök igen." };

  const store = await cookies();
  store.set("bsk_session", sessionToken(role), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
  redirect(role === "coach" ? "/" : "/matcher");
}

export async function logout() {
  const store = await cookies();
  store.delete("bsk_session");
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
  if (!id || !name) return;
  await run("UPDATE players SET name = ?, jersey_number = ?, notes = ? WHERE id = ?", [
    name,
    jersey ? Number(jersey) : null,
    notes,
    id,
  ]);
  revalidatePath(`/spelare/${id}`);
  revalidatePath("/spelare");
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
  if (!date || !opponent) return;

  const ourScore = ourScoreRaw !== null && ourScoreRaw !== "" ? Number(ourScoreRaw) : null;
  const oppScore = oppScoreRaw !== null && oppScoreRaw !== "" ? Number(oppScoreRaw) : null;

  let matchId: number;
  if (id) {
    await run(
      "UPDATE matches SET date = ?, opponent = ?, home_away = ?, match_type = ?, our_score = ?, opponent_score = ?, notes = ? WHERE id = ?",
      [date, opponent, homeAway, matchType, ourScore, oppScore, notes, id]
    );
    matchId = id;
  } else {
    const res = await run(
      "INSERT INTO matches (date, opponent, home_away, match_type, our_score, opponent_score, notes, created_by_role, code, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'coach', ?, 'manual')",
      [date, opponent, homeAway, matchType, ourScore, oppScore, notes, await generateMatchCode()]
    );
    matchId = Number(res.lastInsertRowid);
  }

  await savePlayerStats(matchId, formData);

  revalidatePath("/matcher");
  revalidatePath("/statistik");
  redirect(`/matcher/${matchId}`);
}

export async function deleteMatch(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  if (!id) return;
  await batch([
    { sql: "DELETE FROM match_events WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_players WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM matches WHERE id = ?", args: [id] },
  ]);
  revalidatePath("/matcher");
  redirect("/matcher");
}

export async function regenerateMatchCode(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  if (!id) return;
  await run("UPDATE matches SET code = ? WHERE id = ?", [await generateMatchCode(), id]);
  revalidatePath(`/matcher/${id}`);
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
      if (exists) continue;
      const notes = [
        m.series && `Serie: ${m.series}`,
        m.time && `Avspark ${m.time}`,
        m.location && `Plats: ${m.location}`,
      ]
        .filter(Boolean)
        .join(" · ");
      await run(
        "INSERT INTO matches (date, opponent, home_away, match_type, notes, created_by_role, code, source, external_uid) VALUES (?, ?, ?, ?, ?, 'coach', ?, 'calendar', ?)",
        [m.date, m.opponent, m.homeAway, m.matchType, notes, await generateMatchCode(), m.uid]
      );
      imported++;
    }
  } catch {
    redirect("/installningar?kalender=fel");
  }

  revalidatePath("/matcher");
  redirect(`/installningar?kalender=${imported}`);
}

// ---- Rapportering med matchkod (publik, ingen inloggning) ----
export async function openReport(_prev: { error?: string } | null, formData: FormData) {
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "Koden består av 6 siffror." };
  const match = await get<{ id: number }>("SELECT id FROM matches WHERE code = ?", [code]);
  if (!match) return { error: "Ingen match hittades med den koden. Kontrollera med tränaren." };
  redirect(`/rapportera/${code}`);
}

// ---- Inställningar ----
export async function updateSettings(formData: FormData) {
  await requireRole(["coach"]);
  const keys = [
    "club_name",
    "team_name",
    "primary_color",
    "accent_color",
    "coach_code",
    "parent_code",
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
