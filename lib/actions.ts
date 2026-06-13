"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { all, get, run, batch, getSetting, setSetting, generateMatchCode } from "./db";
import { renewShareToken, revokeShareToken } from "./queries";
import { generatePlayerCardText } from "./ai";
import { sessionToken, getRole, getRealRole, Role } from "./auth";
import { ALL_SKILLS } from "./svff";
import { STAT_IDS } from "./stats";
import { OPPONENT_GOAL } from "./liveTypes";
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
  store.delete("bsk_view");
  redirect(role === "coach" ? "/" : "/matcher");
}

export async function logout() {
  const store = await cookies();
  store.delete("bsk_session");
  store.delete("bsk_view");
  redirect("/login");
}

// Växla visningsroll. En tränare kan förhandsvisa som förälder/spelare (sätter
// bsk_view) och växla tillbaka. Övriga roller dirigeras till rätt vy/inloggning.
export async function setViewAs(formData: FormData) {
  const real = await getRealRole();
  const target = String(formData.get("view") ?? "");
  const store = await cookies();

  if (real === "coach") {
    if (target === "parent" || target === "player") {
      store.set("bsk_view", target, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      redirect(target === "player" ? "/rapportera" : "/matcher");
    }
    store.delete("bsk_view");
    redirect("/");
  }

  if (target === "player") redirect("/rapportera");
  if (real === "parent" && target === "parent") redirect("/matcher");
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
  if (!date || !opponent) return;

  const ourScore = ourScoreRaw !== null && ourScoreRaw !== "" ? Number(ourScoreRaw) : null;
  const oppScore = oppScoreRaw !== null && oppScoreRaw !== "" ? Number(oppScoreRaw) : null;

  let matchId: number;
  if (id) {
    await run(
      "UPDATE matches SET date = ?, start_time = ?, periods = ?, period_minutes = ?, opponent = ?, home_away = ?, match_type = ?, our_score = ?, opponent_score = ?, notes = ?, level = ?, cup_name = ? WHERE id = ?",
      [date, startTime, periods, periodMinutes, opponent, homeAway, matchType, ourScore, oppScore, notes, level, cupName, id]
    );
    matchId = id;
  } else {
    const res = await run(
      "INSERT INTO matches (date, start_time, periods, period_minutes, opponent, home_away, match_type, our_score, opponent_score, notes, level, cup_name, created_by_role, code, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'coach', ?, 'manual')",
      [date, startTime, periods, periodMinutes, opponent, homeAway, matchType, ourScore, oppScore, notes, level, cupName, await generateMatchCode()]
    );
    matchId = Number(res.lastInsertRowid);
  }

  await savePlayerStats(matchId, formData);

  revalidatePath("/matcher");
  revalidatePath("/statistik");
  redirect(`/matcher/${matchId}`);
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
    { sql: "DELETE FROM matches WHERE id = ?", args: [id] },
  ]);
  revalidatePath("/matcher");
  redirect("/matcher");
}

export async function resetMatch(formData: FormData) {
  await requireRole(["coach"]);
  const id = Number(formData.get("id"));
  if (!id) return;
  await batch([
    { sql: "DELETE FROM match_events WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_players WHERE match_id = ?", args: [id] },
    { sql: "DELETE FROM match_reporters WHERE match_id = ?", args: [id] },
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
  } else if (ev.player_id != null && STAT_IDS.includes(ev.stat_id)) {
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
      if (exists) {
        // Fyll i nivå/cup på redan importerade matcher som saknar det
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
        continue;
      }
      const notes = [
        m.series && `Serie: ${m.series}`,
        m.time && `Avspark ${m.time}`,
        m.location && `Plats: ${m.location}`,
      ]
        .filter(Boolean)
        .join(" · ");
      await run(
        "INSERT INTO matches (date, opponent, home_away, match_type, notes, level, cup_name, created_by_role, code, source, external_uid) VALUES (?, ?, ?, ?, ?, ?, ?, 'coach', ?, 'calendar', ?)",
        [m.date, m.opponent, m.homeAway, m.matchType, notes, m.level, m.cupName, await generateMatchCode(), m.uid]
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
    "jersey_color",
    "jersey_text_color",
    "gk_jersey_color",
    "gk_jersey_text_color",
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
