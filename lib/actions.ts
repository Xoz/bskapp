"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import db, { getSetting, setSetting } from "./db";
import { sessionToken, getRole, Role } from "./auth";
import { ALL_SKILLS } from "./svff";

async function requireRole(allowed: Role[]): Promise<Role> {
  const role = await getRole();
  if (!role || !allowed.includes(role)) redirect("/login");
  return role;
}

// ---- Auth ----
export async function login(_prev: { error?: string } | null, formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  let role: Role | null = null;
  if (code === getSetting("coach_code").toUpperCase()) role = "coach";
  else if (code === getSetting("parent_code").toUpperCase()) role = "parent";

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
  db.prepare("INSERT INTO players (name, jersey_number) VALUES (?, ?)").run(
    name,
    jersey ? Number(jersey) : null
  );
  revalidatePath("/spelare");
}

export async function updatePlayer(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const jersey = formData.get("jersey_number");
  const notes = String(formData.get("notes") ?? "");
  if (!id || !name) return;
  db.prepare("UPDATE players SET name = ?, jersey_number = ?, notes = ? WHERE id = ?").run(
    name,
    jersey ? Number(jersey) : null,
    notes,
    id
  );
  revalidatePath(`/spelare/${id}`);
  revalidatePath("/spelare");
}

export async function removePlayer(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  if (!id) return;
  // Mjuk borttagning – historiken finns kvar
  db.prepare("UPDATE players SET active = 0 WHERE id = ?").run(id);
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

  const insertEval = db.prepare(
    "INSERT INTO evaluations (player_id, date, strengths, development_goals, coach_name) VALUES (?, ?, ?, ?, ?)"
  );
  const insertScore = db.prepare(
    "INSERT INTO evaluation_scores (evaluation_id, skill_id, level) VALUES (?, ?, ?)"
  );
  const tx = db.transaction(() => {
    const res = insertEval.run(playerId, date, strengths, goals, coachName);
    for (const s of scores) insertScore.run(res.lastInsertRowid, s.skillId, s.level);
  });
  tx();

  revalidatePath(`/spelare/${playerId}`);
  redirect(`/spelare/${playerId}`);
}

export async function deleteEvaluation(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  const playerId = Number(formData.get("player_id"));
  if (!id) return;
  db.prepare("DELETE FROM evaluations WHERE id = ?").run(id);
  revalidatePath(`/spelare/${playerId}`);
}

// ---- Matcher ----
export async function saveMatch(formData: FormData) {
  const role = await requireRole(["coach", "parent"]);
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
    db.prepare(
      "UPDATE matches SET date = ?, opponent = ?, home_away = ?, match_type = ?, our_score = ?, opponent_score = ?, notes = ? WHERE id = ?"
    ).run(date, opponent, homeAway, matchType, ourScore, oppScore, notes, id);
    matchId = id;
  } else {
    const res = db
      .prepare(
        "INSERT INTO matches (date, opponent, home_away, match_type, our_score, opponent_score, notes, created_by_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(date, opponent, homeAway, matchType, ourScore, oppScore, notes, role);
    matchId = Number(res.lastInsertRowid);
  }

  // Spelarstatistik
  const players = db.prepare("SELECT id FROM players WHERE active = 1").all() as { id: number }[];
  const upsert = db.prepare(
    `INSERT INTO match_players (match_id, player_id, minutes, goals, assists) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(match_id, player_id) DO UPDATE SET minutes = excluded.minutes, goals = excluded.goals, assists = excluded.assists`
  );
  const remove = db.prepare("DELETE FROM match_players WHERE match_id = ? AND player_id = ?");
  const tx = db.transaction(() => {
    for (const p of players) {
      const played = formData.get(`played_${p.id}`);
      if (!played) {
        remove.run(matchId, p.id);
        continue;
      }
      const minutes = Number(formData.get(`minutes_${p.id}`) ?? 0) || 0;
      const goals = Number(formData.get(`goals_${p.id}`) ?? 0) || 0;
      const assists = Number(formData.get(`assists_${p.id}`) ?? 0) || 0;
      upsert.run(matchId, p.id, minutes, goals, assists);
    }
  });
  tx();

  revalidatePath("/matcher");
  revalidatePath("/statistik");
  redirect(`/matcher/${matchId}`);
}

export async function deleteMatch(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  if (!id) return;
  db.prepare("DELETE FROM matches WHERE id = ?").run(id);
  revalidatePath("/matcher");
  redirect("/matcher");
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
    if (value !== null && String(value).trim() !== "") setSetting(key, String(value).trim());
  }
  revalidatePath("/", "layout");
  redirect("/installningar?sparad=1");
}
