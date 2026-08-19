"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { all, get, run, batch, getSetting, setSetting, logActivity, DEFAULT_COLORS } from "./db";
import { renewShareToken, revokeShareToken } from "./queries";
import {
  playerSessionToken,
  getCurrentUser,
  getRealRole,
  hasPermission,
  canAccessPlayer,
  canAccessGroup,
  isStaffRole,
  PERMISSIONS,
  ROLES,
  Permission,
  getCoachName,
} from "./auth";
import { ALL_SKILLS } from "./svff";
import { SKILLS, STATUS_ORDER, type SkillStatus, type StatusMap } from "./skillTrappan";
import { STAT_IDS, LIVE_COUNT_IDS } from "./stats";
import { OPPONENT_GOAL } from "./liveTypes";
import { fetchCalendar, extractMatches, calendarName, calendarGroup } from "./ical";
import { normalizePersonName, parseAttendanceWorkbook } from "./attendance";
import { syncDevelopmentSourceRows } from "./developmentSync";
import { erasePlayerData } from "./playerPrivacy";
import { swedishToday } from "./dates";
import {
  stepByKey,
  stepByOutcome,
  outcomeFromAreas,
  computeDelta,
  seedRating,
  RATING_AREAS,
} from "./rating";

async function requirePermission(permission: Permission): Promise<void> {
  if (!(await hasPermission(permission))) redirect("/oversikt?behorighet=saknas");
}

async function requirePlayerPermission(permission: Permission, playerId: number): Promise<void> {
  await requirePermission(permission);
  if (!(await canAccessPlayer(playerId))) redirect("/oversikt?behorighet=saknas");
}

async function requireMatchPermission(permission: Permission, matchId: number): Promise<void> {
  await requirePermission(permission);
  const match = await get<{ group_id: number | null }>("SELECT group_id FROM matches WHERE id = ?", [matchId]);
  if (!match || !(await canAccessGroup(match.group_id))) redirect("/oversikt?behorighet=saknas");
}

async function resolveWritableGroupId(requested: number | null = null): Promise<number | null> {
  if (requested) {
    if (!(await canAccessGroup(requested))) redirect("/oversikt?behorighet=saknas");
    return requested;
  }
  const user = await getCurrentUser();
  if (user?.groupIds.length) return user.groupIds[0];
  const group = await get<{ id: number }>(
    "SELECT id FROM groups WHERE active = 1 AND group_type = 'subgroup' ORDER BY id LIMIT 1"
  );
  return group?.id ?? null;
}

async function ensureCupMatchGroup(cupName: string, requested: number | null = null): Promise<number | null> {
  if (requested) return resolveWritableGroupId(requested);
  const parentId = await resolveWritableGroupId();
  const existing = await get<{ id: number }>(
    "SELECT id FROM groups WHERE active = 1 AND group_type = 'matchgroup' AND lower(cup_name) = lower(?) AND parent_id IS NOT DISTINCT FROM ? ORDER BY id LIMIT 1",
    [cupName, parentId]
  );
  if (existing) return existing.id;
  const rows = await run(
    "INSERT INTO groups (name, group_type, parent_id, cup_name) VALUES (?, 'matchgroup', ?, ?) ON CONFLICT DO NOTHING RETURNING id",
    [cupName, parentId, cupName]
  );
  if (rows[0]?.id) return Number(rows[0].id);
  const raced = await get<{ id: number }>(
    "SELECT id FROM groups WHERE group_type = 'matchgroup' AND lower(cup_name) = lower(?) AND parent_id IS NOT DISTINCT FROM ? ORDER BY id LIMIT 1",
    [cupName, parentId]
  );
  return raced?.id ?? parentId;
}

async function requireCupAccess(cupName: string, cupGroup = ""): Promise<number | null> {
  const rows = await all<{ group_id: number | null }>(
    "SELECT DISTINCT group_id FROM matches WHERE cup_name = ? AND cup_group = ?",
    [cupName, cupGroup]
  );
  for (const row of rows) {
    if (!(await canAccessGroup(row.group_id))) redirect("/oversikt?behorighet=saknas");
  }
  return rows[0]?.group_id ?? null;
}

async function requireCupMatchAccess(
  matchId: number,
  cupName: string,
  cupGroup: string
): Promise<void> {
  const match = await get<{
    cup_name: string;
    cup_group: string;
    group_id: number | null;
  }>("SELECT cup_name, cup_group, group_id FROM matches WHERE id = ?", [matchId]);
  if (
    !match ||
    match.cup_name !== cupName ||
    match.cup_group !== cupGroup ||
    !(await canAccessGroup(match.group_id))
  ) {
    redirect("/oversikt?behorighet=saknas");
  }
}

// ---- Auth ----
export async function logout() {
  const store = await cookies();
  store.delete("bsk_session");
  store.delete("bsk_view");
  store.delete("bsk_coach_email");
  store.delete("bsk_coach_name");
  store.delete("bsk_player_session");
  store.delete("bsk_invite_token");
  redirect("/login");
}

export async function updateCoachProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return;
  await run("UPDATE users SET name = ? WHERE id = ?", [name, user.id]);
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
  await requirePermission("manage_users");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const current = await getSetting("allowed_coach_emails");
  const list = current.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!list.includes(email)) list.push(email);
  await setSetting("allowed_coach_emails", list.join(","));
  revalidatePath("/installningar");
}

export async function removeCoachEmail(formData: FormData) {
  await requirePermission("manage_users");
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
  const id = Number(formData.get("player_id"));
  if (!id) return;
  await requirePlayerPermission("manage_players", id);
  // Generera unik 6-siffrig PIN
  let pin: string;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (await get("SELECT 1 FROM players WHERE pin = ? AND active = 1", [pin]));
  await run("UPDATE players SET pin = ? WHERE id = ?", [pin, id]);
  revalidatePath("/installningar");
}

export async function generateCoachInvite() {
  await requirePermission("manage_users");
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
  const store = await cookies();
  store.set("bsk_invite_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });
  redirect("/api/auth/google");
}

// Växla visningsroll. En tränare kan förhandsvisa som förälder/spelare (sätter
// bsk_view) och växla tillbaka. Övriga roller dirigeras till rätt vy/inloggning.
export async function setViewAs(formData: FormData) {
  const real = await getRealRole();
  const target = String(formData.get("view") ?? "");
  const store = await cookies();

  if (isStaffRole(real)) {
    if (target === "player" || target === "parent") {
      store.set("bsk_view", target, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      redirect("/mina-spelare");
    }
    store.delete("bsk_view");
    redirect("/oversikt");
  }

  redirect("/login");
}

// ---- Användare, roller och grupper ----
export async function createOrganizationUser(formData: FormData) {
  await requirePermission("manage_users");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const role = String(formData.get("role") ?? "coach");
  const actor = await getCurrentUser();
  if (!actor || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !ROLES.includes(role as never)) return;
  if (role === "admin" && !actor.roles.includes("admin")) redirect("/administration?behorighet=saknas");
  const rows = await run(
    "INSERT INTO users (email, name) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, active = 1 RETURNING id",
    [email, name]
  );
  const id = Number(rows[0]?.id);
  if (!id) return;
  await run("INSERT INTO user_roles (user_id, role) VALUES (?, ?) ON CONFLICT DO NOTHING", [id, role]);
  revalidatePath("/administration");
  redirect(`/administration?anvandare=${id}`);
}

export async function saveUserAccess(formData: FormData) {
  await requirePermission("manage_users");
  const actor = await getCurrentUser();
  const userId = Number(formData.get("user_id"));
  if (!actor || !userId) return;
  const existingRoles = await all<{ role: string }>("SELECT role FROM user_roles WHERE user_id = ?", [userId]);
  const targetIsAdmin = existingRoles.some((row) => row.role === "admin");
  if (targetIsAdmin && !actor.roles.includes("admin")) redirect("/administration?behorighet=saknas");

  const roles = formData.getAll("role").map(String).filter((role): role is (typeof ROLES)[number] => ROLES.includes(role as never));
  if (roles.length === 0) return;
  if (roles.includes("admin") && !actor.roles.includes("admin")) redirect("/administration?behorighet=saknas");
  if (userId === actor.id && actor.roles.includes("admin") && !roles.includes("admin")) {
    redirect("/administration?fel=egen-admin");
  }

  const active = formData.get("active") === "1" ? 1 : 0;
  const statements: { sql: string; args?: (string | number | null)[] }[] = [
    { sql: "UPDATE users SET active = ? WHERE id = ?", args: [userId === actor.id ? 1 : active, userId] },
    { sql: "DELETE FROM user_roles WHERE user_id = ?", args: [userId] },
    ...roles.map((role) => ({ sql: "INSERT INTO user_roles (user_id, role) VALUES (?, ?)", args: [userId, role] })),
    { sql: "DELETE FROM user_permissions WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM user_group_access WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM user_player_links WHERE user_id = ?", args: [userId] },
  ];
  if (!roles.includes("admin")) {
    for (const permission of PERMISSIONS) {
      const value = formData.get(`permission_${permission}`);
      if (value === "allow" || value === "deny") {
        statements.push({
          sql: "INSERT INTO user_permissions (user_id, permission_key, allowed) VALUES (?, ?, ?)",
          args: [userId, permission, value === "allow" ? 1 : 0],
        });
      }
    }
  }
  for (const groupId of formData.getAll("group_id").map(Number).filter(Boolean)) {
    if (!(await canAccessGroup(groupId))) redirect("/administration?behorighet=saknas");
    statements.push({ sql: "INSERT INTO user_group_access (user_id, group_id) VALUES (?, ?)", args: [userId, groupId] });
  }
  for (const playerId of formData.getAll("parent_player_id").map(Number).filter(Boolean)) {
    statements.push({ sql: "INSERT INTO user_player_links (user_id, player_id, relation) VALUES (?, ?, 'parent')", args: [userId, playerId] });
  }
  const selfPlayerId = Number(formData.get("self_player_id"));
  if (selfPlayerId) {
    statements.push({ sql: "INSERT INTO user_player_links (user_id, player_id, relation) VALUES (?, ?, 'self')", args: [userId, selfPlayerId] });
  }
  await batch(statements);
  revalidatePath("/administration");
  redirect(`/administration?sparad=1&anvandare=${userId}`);
}

export async function createGroup(formData: FormData) {
  await requirePermission("manage_groups");
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const groupType = String(formData.get("group_type") ?? "subgroup");
  const parentId = Number(formData.get("parent_id")) || null;
  const cupName = String(formData.get("cup_name") ?? "").trim().slice(0, 100);
  const color = String(formData.get("color") ?? "").trim().slice(0, 20);
  if (!name || !["squad", "subgroup", "matchgroup"].includes(groupType)) return;
  if (parentId && !(await canAccessGroup(parentId))) redirect("/administration?behorighet=saknas");
  await run(
    "INSERT INTO groups (name, group_type, parent_id, cup_name, color) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
    [name, groupType, parentId, groupType === "matchgroup" ? cupName : "", color]
  );
  revalidatePath("/administration");
}

export async function saveGroup(formData: FormData) {
  await requirePermission("manage_groups");
  const groupId = Number(formData.get("group_id"));
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!groupId || !name) return;
  if (!(await canAccessGroup(groupId))) redirect("/administration?behorighet=saknas");
  const parentId = Number(formData.get("parent_id")) || null;
  if (parentId && !(await canAccessGroup(parentId))) redirect("/administration?behorighet=saknas");
  const cupName = String(formData.get("cup_name") ?? "").trim().slice(0, 100);
  const color = String(formData.get("color") ?? "").trim().slice(0, 20);
  const active = formData.get("active") === "1" ? 1 : 0;
  const playerIds = formData.getAll("player_id").map(Number).filter(Boolean);
  const statements: { sql: string; args?: (string | number | null)[] }[] = [
    {
      sql: "UPDATE groups SET name = ?, parent_id = ?, cup_name = ?, color = ?, active = ? WHERE id = ?",
      args: [name, parentId, cupName, color, active, groupId],
    },
    { sql: "DELETE FROM player_group_memberships WHERE group_id = ?", args: [groupId] },
  ];
  for (const playerId of playerIds) {
    statements.push({
      sql: "INSERT INTO player_group_memberships (player_id, group_id, is_primary) VALUES (?, ?, ?) ON CONFLICT (player_id, group_id) DO UPDATE SET is_primary = excluded.is_primary",
      args: [playerId, groupId, formData.get(`primary_${playerId}`) === "1" ? 1 : 0],
    });
  }
  await batch(statements);
  revalidatePath("/administration");
  revalidatePath("/spelare");
}

// ---- Spelare ----
export async function addPlayer(formData: FormData) {
  await requirePermission("manage_players");
  const name = String(formData.get("name") ?? "").trim();
  const jersey = formData.get("jersey_number");
  const groupId = Number(formData.get("group_id")) || null;
  if (!name) return;
  if (groupId && !(await canAccessGroup(groupId))) redirect("/oversikt?behorighet=saknas");
  const rows = await run("INSERT INTO players (name, jersey_number) VALUES (?, ?) RETURNING id", [
    name,
    jersey ? Number(jersey) : null,
  ]);
  const playerId = Number(rows[0]?.id);
  if (playerId && groupId) {
    await run("INSERT INTO player_group_memberships (player_id, group_id, is_primary) VALUES (?, ?, 1)", [playerId, groupId]);
  }
  revalidatePath("/spelare");
}

// Klistra in truppen från svenskalag.se – ett namn per rad
export async function addPlayersBulk(formData: FormData) {
  await requirePermission("manage_players");
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
  await requirePermission("manage_players");
  await run("UPDATE players SET active = 0 WHERE name LIKE 'Exempel:%'");
  revalidatePath("/spelare");
  redirect("/spelare");
}

export async function updatePlayer(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const jersey = formData.get("jersey_number");
  const notes = String(formData.get("notes") ?? "");
  const position = String(formData.get("position") ?? "");
  const level = String(formData.get("level") ?? "");
  if (!id || !name) return;
  await requirePlayerPermission("manage_players", id);
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
  const id = Number(formData.get("id"));
  const level = String(formData.get("level") ?? "");
  if (!id || !level) return;
  await requirePlayerPermission("manage_evaluations", id);
  await run("UPDATE players SET level = ? WHERE id = ?", [level, id]);
  revalidatePath(`/spelare/${id}`);
  revalidatePath("/spelare");
}

// Skapa/förnya spelarens delningslänk (gäller 48h) inför ett spelarsamtal.
export async function generateShareLink(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await requirePlayerPermission("manage_players", id);
  await renewShareToken(id);
  revalidatePath(`/spelare/${id}`);
}

// Återkalla länken direkt
export async function revokeShareLink(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await requirePlayerPermission("manage_players", id);
  await revokeShareToken(id);
  revalidatePath(`/spelare/${id}`);
}

export async function removePlayer(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await requirePlayerPermission("manage_players", id);
  // Mjuk borttagning – historiken finns kvar
  await run("UPDATE players SET active = 0 WHERE id = ?", [id]);
  revalidatePath("/spelare");
  redirect("/spelare");
}

export async function erasePlayer(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) return;
  if (!(await hasPermission("manage_users")) || !(await canAccessPlayer(id))) redirect("/oversikt?behorighet=saknas");
  const player = await get<{ name: string }>("SELECT name FROM players WHERE id = ?", [id]);
  if (!player || String(formData.get("confirmation") ?? "").trim() !== player.name) {
    redirect(`/spelare/${id}?radering=bekraftelse`);
  }
  const actor = (await getCoachName()) ?? "Behörig tränare";
  await erasePlayerData(id, actor);
  revalidatePath("/spelare");
  redirect("/spelare?raderad=1");
}

// ---- Utvärderingar ----
export async function createEvaluation(formData: FormData) {
  const playerId = Number(formData.get("player_id"));
  const date = String(formData.get("date") ?? "").slice(0, 10);
  const strengths = String(formData.get("strengths") ?? "");
  const goals = String(formData.get("development_goals") ?? "");
  const coachName = String(formData.get("coach_name") ?? "");
  if (!playerId || !date) return;
  await requirePlayerPermission("manage_evaluations", playerId);

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
    "INSERT INTO evaluations (player_id, date, strengths, development_goals, coach_name) VALUES (?, ?, ?, ?, ?) RETURNING id",
    [playerId, date, strengths, goals, coachName]
  );
  const evalId = Number(res[0].id);
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
  const id = Number(formData.get("id"));
  const evaluation = await get<{ player_id: number }>("SELECT player_id FROM evaluations WHERE id = ?", [id]);
  if (!evaluation) return;
  await requirePlayerPermission("manage_evaluations", evaluation.player_id);
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
  await requirePermission("manage_matches");
  const id = formData.get("id") ? Number(formData.get("id")) : null;
  let groupId = Number(formData.get("group_id")) || null;
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
  if (id) await requireMatchPermission("manage_matches", id);
  groupId = await resolveWritableGroupId(groupId);

  const ourScore = ourScoreRaw !== null && ourScoreRaw !== "" ? Number(ourScoreRaw) : null;
  const oppScore = oppScoreRaw !== null && oppScoreRaw !== "" ? Number(oppScoreRaw) : null;

  let matchId: number;
  if (id) {
    await run(
      "UPDATE matches SET date = ?, start_time = ?, periods = ?, period_minutes = ?, opponent = ?, home_away = ?, match_type = ?, our_score = ?, opponent_score = ?, notes = ?, level = ?, cup_name = ?, location = ?, group_id = COALESCE(?, group_id) WHERE id = ?",
      [date, startTime, periods, periodMinutes, opponent, homeAway, matchType, ourScore, oppScore, notes, level, cupName, location, groupId, id]
    );
    matchId = id;
  } else {
    const res = await run(
      "INSERT INTO matches (date, start_time, periods, period_minutes, opponent, home_away, match_type, our_score, opponent_score, notes, level, cup_name, location, group_id, created_by_role, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'coach', 'manual') RETURNING id",
      [date, startTime, periods, periodMinutes, opponent, homeAway, matchType, ourScore, oppScore, notes, level, cupName, location, groupId]
    );
    matchId = Number(res[0].id);
  }

  await savePlayerStats(matchId, formData);

  const logName = (await getCoachName()) ?? "Tränare";
  await logActivity(logName, id ? "Uppdaterade match" : "Lade till match", opponent);

  await syncDevelopmentSourceRows();
  revalidatePath("/matcher");
  revalidatePath("/idag");
  revalidatePath("/observera");
  revalidatePath("/uttagning");
  revalidatePath("/statistik");
  redirect(`/matcher/${matchId}`);
}

// ---- Cup-hantering ----

export async function updateCup(formData: FormData) {
  await requirePermission("manage_matches");
  const originalName = String(formData.get("original_cup_name") ?? "").trim();
  const originalGroup = String(formData.get("original_cup_group") ?? "").trim();
  const newName = String(formData.get("new_cup_name") ?? "").trim();
  if (!originalName || !newName) return;
  await requireCupAccess(originalName, originalGroup);

  const ids = [
    ...new Set(
      String(formData.get("match_ids") ?? "")
        .split(",")
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];
  // Hidden formfält är inte betrodda. Verifiera samtliga match-id:n mot den
  // ursprungliga cupen, cupgruppen och användarens gruppscope före första skrivningen.
  for (const id of ids) await requireCupMatchAccess(id, originalName, originalGroup);

  const level = String(formData.get("level") ?? "");
  const cupGroup = String(formData.get("cup_group") ?? "").trim();
  const periods = Math.min(9, Math.max(1, Number(formData.get("periods")) || 3));
  const periodMinutes = Math.min(90, Math.max(1, Number(formData.get("period_minutes")) || 20));

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
      "UPDATE matches SET date = ?, start_time = ?, opponent = ?, home_away = ?, cup_phase = ?, cup_round = ? WHERE id = ? AND cup_name = ? AND cup_group = ?",
      [date, time || null, finalOpponent, homeAway, phase, round || null, id, originalName, originalGroup]
    );
  }

  // Cupens gemensamma fält uppdateras sist så de individuella uppdateringarna
  // ovan alltid kan scopeas mot de ursprungliga, serververifierade värdena.
  await run(
    "UPDATE matches SET level = ?, periods = ?, period_minutes = ?, cup_group = ?, cup_name = ? WHERE cup_name = ? AND cup_group = ?",
    [level, periods, periodMinutes, cupGroup, newName, originalName, originalGroup]
  );
  if (newName !== originalName) {
    revalidatePath(`/matcher/cup/${encodeURIComponent(originalName)}`);
  }

  revalidatePath("/matcher");
  revalidatePath("/matcher", "layout");
  const grp = cupGroup ? `&grupp=${encodeURIComponent(cupGroup)}` : "";
  redirect(`/matcher/cup/${encodeURIComponent(newName)}?sparad=1${grp}`);
}

export async function deleteCupMatch(id: number, cupName: string, cupGroup: string) {
  if (!id) return;
  await requireMatchPermission("manage_matches", id);
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
  await requirePermission("manage_matches");
  if (!cupName) return;
  await requireCupAccess(cupName, cupGroup);
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
  await requirePermission("manage_matches");
  const cupName = String(formData.get("cup_name") ?? "").trim();
  const cupGroup = String(formData.get("cup_group") ?? "").trim();
  if (!cupName) return;
  await requireCupAccess(cupName, cupGroup);
  // Ärver datum och speltidsformat från cupens befintliga matcher.
  const existing = await get<{ date: string; periods: number; period_minutes: number; level: string; group_id: number | null }>(
    "SELECT date, periods, period_minutes, level, group_id FROM matches WHERE cup_name = ? AND cup_group = ? ORDER BY date DESC, start_time DESC LIMIT 1",
    [cupName, cupGroup]
  );
  await run(
    "INSERT INTO matches (date, opponent, home_away, match_type, cup_name, cup_group, cup_phase, periods, period_minutes, level, group_id) VALUES (?, ?, 'home', 'cup', ?, ?, 'playoff', ?, ?, ?, ?)",
    [
      existing?.date ?? swedishToday(),
      "TBD",
      cupName,
      cupGroup,
      existing?.periods ?? 3,
      existing?.period_minutes ?? 20,
      existing?.level ?? "",
      existing?.group_id ?? await ensureCupMatchGroup(cupName),
    ]
  );
  revalidatePath("/matcher");
  const grp = cupGroup ? `?grupp=${encodeURIComponent(cupGroup)}` : "";
  redirect(`/matcher/cup/${encodeURIComponent(cupName)}${grp}`);
}

// Spara cupens uttagna trupp som medlemskap i cupens matchgrupp. Truppen blir
// default-trupp per match (kan justeras per match i laguttagningen, match_squad).
export async function saveCupSquad(formData: FormData) {
  await requirePermission("manage_squads");
  const cupName = String(formData.get("cup_name") ?? "").trim();
  const cupGroup = String(formData.get("cup_group") ?? "").trim();
  if (!cupName) return;
  const groupId = await requireCupAccess(cupName, cupGroup);
  if (!groupId) {
    const back = cupGroup ? `?grupp=${encodeURIComponent(cupGroup)}` : "";
    redirect(`/matcher/cup/${encodeURIComponent(cupName)}${back}`);
  }
  const ids = formData.getAll("player_id").map(Number).filter((n) => Number.isFinite(n) && n > 0);

  const stmts: { sql: string; args: (string | number | null)[] }[] = [
    { sql: "DELETE FROM player_group_memberships WHERE group_id = ?", args: [groupId] },
  ];
  for (const pid of ids) {
    stmts.push({
      sql: "INSERT INTO player_group_memberships (player_id, group_id, is_primary) VALUES (?, ?, 0) ON CONFLICT DO NOTHING",
      args: [pid, groupId],
    });
  }
  await batch(stmts);

  const matchRows = await all<{ id: number }>(
    "SELECT id FROM matches WHERE cup_name = ? AND cup_group = ?",
    [cupName, cupGroup]
  );
  for (const m of matchRows) revalidatePath(`/matcher/${m.id}/laguttagning`);
  revalidatePath("/matcher");

  const grp = cupGroup ? `&grupp=${encodeURIComponent(cupGroup)}` : "";
  redirect(`/matcher/cup/${encodeURIComponent(cupName)}?sparad=trupp${grp}`);
}

export async function addCup(formData: FormData) {
  await requirePermission("manage_matches");
  const cupName = String(formData.get("cup_name") ?? "").trim();
  const level = String(formData.get("level") ?? "");
  if (!cupName) return;
  const groupId = await ensureCupMatchGroup(cupName, Number(formData.get("group_id")) || null);

  const matchCount = Number(formData.get("match_count") ?? 0);
  for (let i = 0; i < matchCount; i++) {
    const opponent = String(formData.get(`opponent_${i}`) ?? "").trim();
    const date = String(formData.get(`date_${i}`) ?? "").trim();
    const time = String(formData.get(`time_${i}`) ?? "").trim();
    const homeAway = String(formData.get(`home_away_${i}`) ?? "home");
    if (!opponent || !date) continue;
    await run(
      "INSERT INTO matches (date, start_time, opponent, home_away, match_type, level, cup_name, cup_phase, group_id) VALUES (?, ?, ?, ?, 'cup', ?, ?, 'group', ?)",
      [date, time || null, opponent, homeAway, level, cupName, groupId]
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
  const id = Number(formData.get("id"));
  const level = String(formData.get("level") ?? "");
  if (!id) return;
  await requireMatchPermission("manage_matches", id);

  const applyCup = formData.get("apply_cup") === "on";
  if (applyCup) {
    const m = await get<{ cup_name: string; group_id: number | null }>("SELECT cup_name, group_id FROM matches WHERE id = ?", [id]);
    if (m?.cup_name) {
      await run("UPDATE matches SET level = ? WHERE cup_name = ? AND group_id IS NOT DISTINCT FROM ?", [level, m.cup_name, m.group_id]);
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
  const matchId = Number(formData.get("match_id"));
  if (!matchId) return;
  await requireMatchPermission("manage_evaluations", matchId);

  const match = await get<{ level: string; opponent: string }>(
    "SELECT level, opponent FROM matches WHERE id = ?",
    [matchId]
  );
  if (!match) return;

  const players = await all<{ id: number; level: string; form_rating: number | null }>(
    `SELECT p.id, p.level, p.form_rating
       FROM players p
       JOIN match_players mp ON mp.player_id = p.id
      WHERE mp.match_id = ? AND p.active = 1`,
    [matchId]
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
  const matchId = Number(formData.get("match_id"));
  if (!matchId) return;
  await requireMatchPermission("manage_squads", matchId);
  const ids = formData.getAll("player_id").map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const applyCup = formData.get("apply_cup") === "on";

  let targetIds = [matchId];
  if (applyCup) {
    const m = await get<{ cup_name: string; cup_group: string; group_id: number | null }>(
      "SELECT cup_name, cup_group, group_id FROM matches WHERE id = ?",
      [matchId]
    );
    if (m?.cup_name) {
      const rows = await all<{ id: number }>(
        `SELECT id FROM matches
         WHERE cup_name = ? AND cup_group = ? AND group_id IS NOT DISTINCT FROM ?`,
        [m.cup_name, m.cup_group, m.group_id]
      );
      if (rows.length > 0) targetIds = rows.map((r) => r.id);
    }
  }

  const stmts: { sql: string; args?: (string | number | null)[] }[] = [];
  for (const mid of targetIds) {
    stmts.push({ sql: "DELETE FROM match_squad WHERE match_id = ?", args: [mid] });
    for (const pid of ids) {
      stmts.push({
        sql: "INSERT INTO match_squad (match_id, player_id) VALUES (?, ?) ON CONFLICT (match_id, player_id) DO NOTHING",
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
  const matchId = Number(formData.get("match_id"));
  if (!matchId) return;
  await requireMatchPermission("manage_squads", matchId);

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
    const m = await get<{ cup_name: string; cup_group: string; group_id: number | null }>(
      "SELECT cup_name, cup_group, group_id FROM matches WHERE id = ?",
      [matchId]
    );
    if (m?.cup_name) {
      const rows = await all<{ id: number }>(
        `SELECT id FROM matches
         WHERE cup_name = ? AND cup_group = ? AND group_id IS NOT DISTINCT FROM ?`,
        [m.cup_name, m.cup_group, m.group_id]
      );
      if (rows.length > 0) squadTargets = rows.map((r) => r.id);
    }
  }

  const stmts: { sql: string; args?: (string | number | null)[] }[] = [];
  for (const mid of squadTargets) {
    stmts.push({ sql: "DELETE FROM match_squad WHERE match_id = ?", args: [mid] });
    for (const pid of squadIds) {
      stmts.push({ sql: "INSERT INTO match_squad (match_id, player_id) VALUES (?, ?) ON CONFLICT (match_id, player_id) DO NOTHING", args: [mid, pid] });
    }
    stmts.push({ sql: "UPDATE matches SET formation = ? WHERE id = ?", args: [formation, mid] });
    revalidatePath(`/matcher/${mid}/laguttagning`);
    revalidatePath(`/matcher/${mid}`);
  }
  // Utplacering (positioner) sparas bara för den här matchen
  stmts.push({ sql: "DELETE FROM match_lineup WHERE match_id = ?", args: [matchId] });
  for (const p of positions) {
    stmts.push({
      sql: "INSERT INTO match_lineup (match_id, player_id, x, y) VALUES (?, ?, ?, ?) ON CONFLICT (match_id, player_id) DO NOTHING",
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
  const id = Number(formData.get("id"));
  if (!id) return;
  await requireMatchPermission("manage_matches", id);
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
  const id = Number(formData.get("id"));
  if (!id) return;
  await requireMatchPermission("report_matches", id);
  const open = formData.get("open") === "1";
  await run("UPDATE matches SET report_open = ? WHERE id = ?", [open ? 1 : 0, id]);
  revalidatePath(`/matcher/${id}`);
}

export async function resetMatch(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await requireMatchPermission("report_matches", id);
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
  const matchId = Number(formData.get("match_id"));
  const playerId = formData.get("player_id") === "opponent" ? null : Number(formData.get("player_id")) || null;
  const statId = String(formData.get("stat_id") ?? "");
  const period = Number(formData.get("period")) || null;
  const minutes = Number(formData.get("minutes") ?? 0);
  const seconds = Number(formData.get("seconds") ?? 0);
  const matchSecond = (minutes > 0 || seconds > 0) ? minutes * 60 + seconds : null;
  const isOpponentGoal = formData.get("player_id") === "opponent";

  if (!matchId || !statId) return { error: "Ogiltiga värden" };
  await requireMatchPermission("report_matches", matchId);

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
  const eventId = Number(formData.get("event_id"));
  const matchId = Number(formData.get("match_id"));
  if (!eventId || !matchId) return;
  await requireMatchPermission("report_matches", matchId);

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
      sql: "UPDATE matches SET opponent_score = GREATEST(COALESCE(opponent_score, 0) - 1, 0) WHERE id = ?",
      args: [matchId],
    });
  } else if (ev.player_id != null && LIVE_COUNT_IDS.includes(ev.stat_id)) {
    stmts.push({
      sql: `UPDATE match_players SET ${ev.stat_id} = GREATEST(${ev.stat_id} - 1, 0) WHERE match_id = ? AND player_id = ?`,
      args: [matchId, ev.player_id],
    });
    if (ev.stat_id === "goals") {
      stmts.push({
        sql: "UPDATE matches SET our_score = GREATEST(COALESCE(our_score, 0) - 1, 0) WHERE id = ?",
        args: [matchId],
      });
    }
  }

  await batch(stmts);
  revalidatePath(`/matcher/${matchId}`);
}

// ---- Kalenderimport (svenskalag.se m.fl.) ----
export async function importCalendarMatches() {
  await requirePermission("manage_matches");
  const url = (await getSetting("calendar_url")).trim();
  if (!url) redirect("/installningar?kalender=saknas");
  const groupId = await resolveWritableGroupId();

  let imported = 0;
  try {
    const ics = await fetchCalendar(url);
    const ownNames = [await getSetting("team_name"), await getSetting("club_name")].filter(Boolean);
    const matches = extractMatches(ics, ownNames);

    // Flera egna lag kan vara anmälda till samma cup (skiljs åt av teamVariant, t.ex.
    // "Friendly 1"/"Friendly 2"). Varje variant får en egen matchgrupp så att laguttagning
    // inte blandas ihop mellan lagen; huvud-/tävlingslaget (teamVariant null) använder
    // den vanliga gruppen.
    const variantGroupIds = new Map<string, number | null>();
    async function resolveMatchGroupId(m: (typeof matches)[number]): Promise<number | null> {
      if (!m.teamVariant) return groupId;
      const key = `${m.cupName}::${m.teamVariant}`;
      if (!variantGroupIds.has(key)) {
        variantGroupIds.set(key, await ensureCupMatchGroup(`${m.cupName} (${m.teamVariant})`));
      }
      return variantGroupIds.get(key) ?? groupId;
    }

    for (const m of matches) {
      if (!m.date) continue;
      const exists = await get<{ 1: number }>("SELECT 1 FROM matches WHERE external_uid = ?", [
        m.uid,
      ]);
      if (exists) {
        // Fyll i nivå/cup/grupp/tid/plats på redan importerade matcher som saknar det
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
        if (m.teamVariant) {
          await run(
            "UPDATE matches SET cup_group = ? WHERE external_uid = ? AND (cup_group IS NULL OR cup_group = '')",
            [m.teamVariant, m.uid]
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
      const matchGroupId = await resolveMatchGroupId(m);
      await run(
        "INSERT INTO matches (date, start_time, opponent, home_away, match_type, notes, level, cup_name, cup_group, location, group_id, created_by_role, source, external_uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'coach', 'calendar', ?)",
        [m.date, m.time, m.opponent, m.homeAway, m.matchType, notes, m.level, m.cupName, m.teamVariant ?? "", m.location, matchGroupId, m.uid]
      );
      imported++;
    }
  } catch {
    redirect("/installningar?kalender=fel");
  }

  await syncDevelopmentSourceRows();
  revalidatePath("/matcher");
  revalidatePath("/idag");
  revalidatePath("/observera");
  revalidatePath("/uttagning");
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
  await requirePermission("manage_matches");
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
  await requirePermission("manage_matches");
  const url = String(formData.get("url") ?? "").trim();
  const cupName = String(formData.get("cup_name") ?? "").trim();
  const level = String(formData.get("level") ?? "");
  if (!url || !cupName) redirect("/matcher/importera-cup?fel=saknas");
  const groupId = await ensureCupMatchGroup(cupName, Number(formData.get("group_id")) || null);

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
        "INSERT INTO matches (date, start_time, opponent, home_away, match_type, cup_phase, notes, level, cup_name, group_id, created_by_role, source, external_uid) VALUES (?, ?, ?, ?, 'cup', 'group', ?, ?, ?, ?, 'coach', 'calendar', ?)",
        [m.date, m.time, m.opponent, m.homeAway, notes, level, cupName, groupId, m.uid]
      );
      imported++;
    }
  } catch {
    redirect("/matcher/importera-cup?fel=hamta");
  }

  const logName = (await getCoachName()) ?? "Tränare";
  await logActivity(logName, "Importerade cup", cupName);
  await syncDevelopmentSourceRows();
  revalidatePath("/matcher");
  revalidatePath("/idag");
  revalidatePath("/uttagning");
  redirect(`/matcher/cup/${encodeURIComponent(cupName)}`);
}

// ---- Inställningar ----
export async function updateSettings(formData: FormData) {
  await requirePermission("manage_settings");
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

export async function importAttendanceWorkbook(formData: FormData) {
  await requirePermission("manage_settings");
  const file = formData.get("attendance_file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/installningar?narvaro=fil");
  }

  let parsed;
  try {
    parsed = await parseAttendanceWorkbook(await file.arrayBuffer());
  } catch {
    redirect("/installningar?narvaro=fel");
  }

  const activePlayers = await all<{ id: number; name: string }>(
    "SELECT id, name FROM players WHERE active = 1"
  );
  const playerIdsByName = new Map(
    activePlayers.map((player) => [normalizePersonName(player.name), player.id] as const)
  );
  const importedBy = (await getCoachName()) ?? "Tränare";
  const importRow = await run(
    `INSERT INTO attendance_imports (file_name, period_label, team_name, exported_at, imported_by)
     VALUES (?, ?, ?, ?, ?) RETURNING id`,
    [file.name.slice(0, 180), parsed.period ?? "", parsed.teamName ?? "", parsed.exportedAt, importedBy]
  );
  const importId = Number(importRow[0]?.id);
  if (!importId) redirect("/installningar?narvaro=fel");

  const statements: { sql: string; args: (string | number | null)[] }[] = [];
  let matchedPlayers = 0;
  for (const player of parsed.players) {
    const playerId = playerIdsByName.get(normalizePersonName(player.name)) ?? null;
    if (playerId) matchedPlayers++;
    for (const activity of parsed.activities) {
      statements.push({
        sql: `INSERT INTO attendance_events
          (import_id, player_id, player_name, birth_date, activity_date, start_time, end_time, title, category, source_column, source_label, present)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          importId,
          playerId,
          player.name,
          player.birthDate,
          activity.date,
          activity.startTime,
          activity.endTime,
          activity.title,
          activity.category,
          activity.sourceColumn,
          activity.sourceLabel,
          player.attendanceByColumn.get(activity.sourceColumn) ? 1 : 0,
        ],
      });
    }
  }

  for (let i = 0; i < statements.length; i += 500) {
    await batch(statements.slice(i, i + 500));
  }

  await logActivity(importedBy, "Importerade närvaro", `${parsed.players.length} spelare`);
  await syncDevelopmentSourceRows();
  revalidatePath("/installningar");
  revalidatePath("/spelare");
  revalidatePath("/idag");
  revalidatePath("/observera");
  redirect(
    `/installningar?narvaro=ok&narvaro_spelare=${parsed.players.length}&narvaro_aktiviteter=${parsed.activities.length}&narvaro_matchade=${matchedPlayers}`
  );
}

export async function syncSanktanMatchCounts(formData: FormData) {
  await requirePermission("manage_settings");
  const season = Number(formData.get("season"));
  const raw = String(formData.get("counts") ?? "").trim();
  if (!Number.isInteger(season) || season < 2020 || season > 2100 || !raw) {
    redirect("/installningar?sanktan=fel#trupp");
  }

  const activePlayers = await all<{ id: number; name: string }>(
    "SELECT id, name FROM players WHERE active = 1 ORDER BY name"
  );
  const playersByName = new Map(activePlayers.map((player) => [normalizePersonName(player.name), player] as const));
  const parsed = new Map<number, { player: { id: number; name: string }; gul: number; gron: number }>();

  for (const [index, line] of raw.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).entries()) {
    const columns = line.split(/\t|;/).map((value) => value.trim());
    if (index === 0 && normalizePersonName(columns[0] ?? "") === "spelare") continue;
    if (columns.length < 3) redirect("/installningar?sanktan=fel#trupp");
    const player = playersByName.get(normalizePersonName(columns[0]));
    const gul = Number(columns[1]);
    const gron = Number(columns[2]);
    if (!player || !Number.isInteger(gul) || gul < 0 || !Number.isInteger(gron) || gron < 0 || parsed.has(player.id)) {
      redirect("/installningar?sanktan=fel#trupp");
    }
    parsed.set(player.id, { player, gul, gron });
  }

  if (parsed.size !== activePlayers.length) {
    redirect(`/installningar?sanktan=ofullstandig&sanktan_spelare=${parsed.size}#trupp`);
  }

  const statements: { sql: string; args: (string | number)[] }[] = [{
    sql: "DELETE FROM player_competition_match_counts WHERE season = ? AND competition = 'sanktan'",
    args: [season],
  }];
  for (const { player, gul, gron } of parsed.values()) {
    for (const [sourceTeam, matchCount] of [["Gul", gul], ["Grön", gron]] as const) {
      statements.push({
        sql: `INSERT INTO player_competition_match_counts
              (player_id, season, competition, source_team, match_count, updated_at)
              VALUES (?, ?, 'sanktan', ?, ?, to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
              ON CONFLICT (player_id, season, competition, source_team)
              DO UPDATE SET match_count = excluded.match_count, updated_at = excluded.updated_at`,
        args: [player.id, season, sourceTeam, matchCount],
      });
    }
  }
  await batch(statements);

  const importedBy = (await getCoachName()) ?? "Tränare";
  await logActivity(importedBy, "Synkade Sanktanmatcher", `${season} · ${parsed.size} spelare`);
  revalidatePath("/installningar");
  revalidatePath("/spelare");
  redirect(`/installningar?sanktan=ok&sanktan_spelare=${parsed.size}#trupp`);
}

export async function syncSanktanMatchHistory(formData: FormData) {
  await requirePermission("manage_settings");
  const season = Number(formData.get("season"));
  const raw = String(formData.get("history") ?? "").trim();
  if (!Number.isInteger(season) || season < 2020 || season > 2100 || !raw) {
    redirect("/installningar?sanktan_historik=fel#trupp");
  }

  type ImportedMatch = {
    id: string;
    date: string;
    time: string | null;
    opponent: string;
    homeAway: "home" | "away";
    location: string | null;
    sourceTeam: "Gul" | "Grön";
    level: number;
    href: string;
    players: string[];
  };
  let imported: ImportedMatch[];
  try {
    imported = JSON.parse(raw) as ImportedMatch[];
  } catch {
    redirect("/installningar?sanktan_historik=fel#trupp");
  }
  if (!Array.isArray(imported) || imported.length === 0) {
    redirect("/installningar?sanktan_historik=fel#trupp");
  }

  const activePlayers = await all<{ id: number; name: string }>(
    "SELECT id, name FROM players WHERE active = 1 ORDER BY name"
  );
  const playersByName = new Map(activePlayers.map((player) => [normalizePersonName(player.name), player] as const));
  const seenMatches = new Set<string>();
  const historyCounts = new Map<string, number>();

  for (const match of imported) {
    if (
      !match || !/^\d+$/.test(String(match.id)) || seenMatches.has(String(match.id))
      || !new RegExp(`^${season}-\\d{2}-\\d{2}$`).test(String(match.date))
      || !["Gul", "Grön"].includes(match.sourceTeam)
      || ![2, 3, 4].includes(Number(match.level))
      || !["home", "away"].includes(match.homeAway)
      || !String(match.opponent ?? "").trim()
      || !String(match.href ?? "").startsWith("/bollstanassk-fotboll-f2014-")
      || !Array.isArray(match.players)
    ) {
      redirect("/installningar?sanktan_historik=fel#trupp");
    }
    seenMatches.add(String(match.id));
    const seenPlayers = new Set<number>();
    for (const name of match.players) {
      const player = playersByName.get(normalizePersonName(name));
      if (!player || seenPlayers.has(player.id)) redirect("/installningar?sanktan_historik=fel#trupp");
      seenPlayers.add(player.id);
      const key = `${player.id}:${match.sourceTeam}`;
      historyCounts.set(key, (historyCounts.get(key) ?? 0) + 1);
    }
  }

  const expectedCounts = await all<{ player_id: number; source_team: string; match_count: number }>(
    `SELECT player_id, source_team, match_count
     FROM player_competition_match_counts
     WHERE season = ? AND competition = 'sanktan'`,
    [season]
  );
  if (expectedCounts.length !== activePlayers.length * 2 || expectedCounts.some((row) =>
    Number(row.match_count) !== (historyCounts.get(`${row.player_id}:${row.source_team}`) ?? 0)
  )) {
    redirect("/installningar?sanktan_historik=avvikelse#trupp");
  }

  const teamGroups = await all<{ id: number; name: string }>(
    "SELECT id, name FROM groups WHERE group_type = 'subgroup' AND active = 1 AND name IN ('Gul', 'Grön')"
  );
  const groupIdByName = new Map(teamGroups.map((group) => [group.name, group.id] as const));
  if (!groupIdByName.has("Gul") || !groupIdByName.has("Grön")) {
    redirect("/installningar?sanktan_historik=fel#trupp");
  }

  const statements: { sql: string; args: (string | number | null)[] }[] = [
    {
      sql: "DELETE FROM player_competition_matches WHERE season = ? AND competition = 'sanktan'",
      args: [season],
    },
    {
      sql: `DELETE FROM development_activity_participation
            WHERE source = 'svenskalag_sanktan'
              AND activity_id IN (
                SELECT id FROM development_activities
                WHERE external_source = 'svenskalag_sanktan' AND activity_date LIKE ?
              )`,
      args: [`${season}-%`],
    },
  ];
  for (const match of imported) {
    const activityId = `sanktan-${match.id}`;
    const activityTitle = `${match.homeAway === "home" ? "Hemma" : "Borta"} mot ${match.opponent.trim()}`;
    statements.push({
      sql: `INSERT INTO player_competition_matches
            (external_id, season, competition, source_team, level, match_date, start_time, opponent, home_away, location, source_url, updated_at)
            VALUES (?, ?, 'sanktan', ?, ?, ?, ?, ?, ?, ?, ?, to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))`,
      args: [String(match.id), season, match.sourceTeam, Number(match.level), match.date, match.time || null,
        match.opponent.trim(), match.homeAway, match.location?.trim() || null, match.href],
    });
    statements.push({
      sql: `INSERT INTO development_activities
            (id, activity_date, start_time, activity_type, title, external_source, external_key, group_id)
            VALUES (?, ?, ?, 'match', ?, 'svenskalag_sanktan', ?, ?)
            ON CONFLICT (external_key) DO UPDATE SET
              activity_date = excluded.activity_date,
              start_time = excluded.start_time,
              activity_type = excluded.activity_type,
              title = excluded.title,
              group_id = excluded.group_id,
              updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')`,
      args: [activityId, match.date, match.time || null, activityTitle, `sanktan:${match.id}`, groupIdByName.get(match.sourceTeam) ?? null],
    });
    for (const name of match.players) {
      const player = playersByName.get(normalizePersonName(name));
      if (!player) continue;
      statements.push({
        sql: "INSERT INTO player_competition_match_players (match_external_id, player_id) VALUES (?, ?)",
        args: [String(match.id), player.id],
      });
      statements.push({
        sql: `INSERT INTO development_activity_participation
              (activity_id, player_id, attendance_status, selected, source, updated_at)
              VALUES (?, ?, 'present', 1, 'svenskalag_sanktan', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
              ON CONFLICT (activity_id, player_id) DO UPDATE SET
                attendance_status = 'present', selected = 1, source = 'svenskalag_sanktan',
                updated_at = excluded.updated_at`,
        args: [activityId, player.id],
      });
    }
  }
  await batch(statements);

  const importedBy = (await getCoachName()) ?? "Tränare";
  await logActivity(importedBy, "Synkade Sanktan-historik", `${season} · ${imported.length} matcher`);
  revalidatePath("/installningar");
  revalidatePath("/spelare");
  revalidatePath("/observera");
  redirect(`/installningar?sanktan_historik=ok&sanktan_matcher=${imported.length}#trupp`);
}

export async function syncSanktanCallupHistory(formData: FormData) {
  await requirePermission("manage_settings");
  const season = Number(formData.get("season"));
  const raw = String(formData.get("callups") ?? "").trim();
  if (!Number.isInteger(season) || season < 2020 || season > 2100 || !raw) redirect("/installningar?sanktan_kallelser=fel#trupp");

  type ImportedCallup = { id: string; called: string[] };
  let imported: ImportedCallup[];
  try { imported = JSON.parse(raw) as ImportedCallup[]; } catch { redirect("/installningar?sanktan_kallelser=fel#trupp"); }
  if (!Array.isArray(imported) || imported.length === 0) redirect("/installningar?sanktan_kallelser=fel#trupp");

  const [yellowPlayers, historicalMatches] = await Promise.all([
    all<{ id: number; name: string }>(
      "SELECT id, name FROM players WHERE active = 1 ORDER BY name"
    ),
    all<{ activity_id: string; external_id: string }>(
      `SELECT da.id AS activity_id, replace(da.external_key, 'sanktan:', '') AS external_id
       FROM development_activities da JOIN groups g ON g.id = da.group_id
       WHERE da.external_source = 'svenskalag_sanktan' AND da.activity_date LIKE ? AND da.activity_date <= ?
         AND g.group_type = 'subgroup' AND g.name = 'Gul' ORDER BY da.activity_date, da.start_time, da.id`,
      [`${season}-%`, swedishToday()]
    ),
  ]);
  const yellowByName = new Map(yellowPlayers.map((player) => [normalizePersonName(player.name), player] as const));
  const activityByExternalId = new Map(historicalMatches.map((match) => [match.external_id, match.activity_id] as const));
  const seen = new Set<string>();
  const statements: { sql: string; args: (string | number)[] }[] = [];
  for (const match of imported) {
    const externalId = String(match?.id ?? "");
    if (!/^\d+$/.test(externalId) || seen.has(externalId) || !activityByExternalId.has(externalId) || !Array.isArray(match.called)) redirect("/installningar?sanktan_kallelser=match#trupp");
    seen.add(externalId);
    const called = new Set<number>();
    for (const name of match.called) {
      const player = yellowByName.get(normalizePersonName(String(name)));
      if (!player || called.has(player.id)) redirect(`/installningar?sanktan_kallelser=spelare&sanktan_kallelse_match=${externalId}&sanktan_kallelse_index=${called.size}#trupp`);
      called.add(player.id);
      statements.push({
        sql: `INSERT INTO development_activity_callups (activity_id, player_id, attendance_status)
              VALUES (?, ?, 'unknown') ON CONFLICT (activity_id, player_id) DO UPDATE SET attendance_status = 'unknown'`,
        args: [activityByExternalId.get(externalId)!, player.id],
      });
    }
  }
  if (seen.size !== historicalMatches.length || seen.size !== activityByExternalId.size) redirect("/installningar?sanktan_kallelser=ofullstandig#trupp");
  const activityIds = historicalMatches.map((match) => match.activity_id);
  if (activityIds.length) statements.unshift({ sql: `DELETE FROM development_activity_callups WHERE activity_id IN (${activityIds.map(() => "?").join(", ")})`, args: activityIds });
  await batch(statements);

  const importedBy = (await getCoachName()) ?? "Tränare";
  await logActivity(importedBy, "Synkade historiska Sanktan-kallelser", `${season} · Gul · ${seen.size} matcher`);
  revalidatePath("/installningar"); revalidatePath("/spelare"); revalidatePath("/observera"); revalidatePath("/uttagning");
  redirect(`/installningar?sanktan_kallelser=ok&sanktan_kallelser_matcher=${seen.size}#trupp`);
}

export async function resetColors() {
  await requirePermission("manage_settings");
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

// ---------- Utvecklingsträdet (skillTrappan) ----------
// Anropas direkt från klientkomponenten (UtvecklingChecklist) på varje klick,
// inte via <form> – checklistan har för många enskilda knappar för att det ska
// vara rimligt att slå in dem i formulär var för sig.

export async function setSkillStatus(playerId: number, skillId: string, status: SkillStatus): Promise<void> {
  if (!STATUS_ORDER.includes(status) || !SKILLS.some((skill) => skill.id === skillId)) return;
  await requirePlayerPermission("manage_evaluations", playerId);
  await run(
    `INSERT INTO player_skill_status (player_id, skill_id, status, updated_at)
     VALUES (?, ?, ?, to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
     ON CONFLICT (player_id, skill_id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
    [playerId, skillId, status]
  );
  revalidatePath(`/spelare/${playerId}/utveckling`);
  revalidatePath("/utveckling");
  revalidatePath("/mitt-utvecklingstrad");
}

export async function setSkillNote(playerId: number, note: string): Promise<void> {
  await requirePlayerPermission("manage_evaluations", playerId);
  const trimmed = note.slice(0, 2000);
  await run(
    `INSERT INTO player_skill_notes (player_id, note, updated_at)
     VALUES (?, ?, to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
     ON CONFLICT (player_id) DO UPDATE SET note = EXCLUDED.note, updated_at = EXCLUDED.updated_at`,
    [playerId, trimmed]
  );
  revalidatePath(`/spelare/${playerId}/utveckling`);
}

// En avstämning sparar både det nya aktuella läget och en oföränderlig snapshot.
// UUID:t skapas i applikationen så samtliga skrivningar kan göras i en transaktion.
export async function createDevelopmentCheckpoint(formData: FormData): Promise<void> {
  const playerId = Number(formData.get("player_id"));
  if (!playerId) return;
  await requirePlayerPermission("manage_evaluations", playerId);

  const dateRaw = String(formData.get("date") ?? "").slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : swedishToday();
  const enteredCoach = String(formData.get("coach_name") ?? "").trim().slice(0, 120);
  const coachName = enteredCoach || (await getCoachName()) || "Tränare";
  const strengths = String(formData.get("strengths") ?? "").trim().slice(0, 2000);
  const focusNote = String(formData.get("focus_note") ?? "").trim().slice(0, 2000);
  const wellbeingNote = String(formData.get("wellbeing_note") ?? "").trim().slice(0, 2000);

  const currentRows = await all<{ skill_id: string; status: SkillStatus }>(
    "SELECT skill_id, status FROM player_skill_status WHERE player_id = ?",
    [playerId]
  );
  const current: StatusMap = Object.fromEntries(currentRows.map((row) => [row.skill_id, row.status]));

  const next: StatusMap = {};
  for (const skill of SKILLS) {
    const submitted = String(formData.get(`skill_${skill.id}`) ?? current[skill.id] ?? "not_started") as SkillStatus;
    next[skill.id] = STATUS_ORDER.includes(submitted) ? submitted : (current[skill.id] ?? "not_started");
  }

  const validIds = new Set(SKILLS.map((skill) => skill.id));
  const focusIds = [...new Set(formData.getAll("focus_skill").map(String))]
    .filter((id) => validIds.has(id))
    .slice(0, 2);
  const checkpointId = crypto.randomUUID();
  const snapshotArgs = SKILLS.flatMap((skill) => [
    checkpointId,
    skill.id,
    next[skill.id],
    current[skill.id] ?? "not_started",
    focusIds.includes(skill.id) ? 1 : 0,
  ]);
  const statusArgs = SKILLS.flatMap((skill) => [playerId, skill.id, next[skill.id]]);

  await batch([
    {
      sql: `INSERT INTO development_checkpoints
        (id, player_id, date, coach_name, strengths, focus_note, wellbeing_note)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [checkpointId, playerId, date, coachName, strengths, focusNote, wellbeingNote],
    },
    {
      sql: `INSERT INTO development_checkpoint_skills
        (checkpoint_id, skill_id, status, previous_status, is_focus)
        VALUES ${SKILLS.map(() => "(?, ?, ?, ?, ?)").join(", ")}`,
      args: snapshotArgs,
    },
    {
      sql: `INSERT INTO player_skill_status (player_id, skill_id, status, updated_at)
        SELECT incoming.player_id, incoming.skill_id, incoming.status,
          to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
        FROM (VALUES ${SKILLS.map(() => "(?, ?, ?)").join(", ")})
          AS incoming(player_id, skill_id, status)
        ON CONFLICT (player_id, skill_id)
        DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
      args: statusArgs,
    },
  ]);

  const player = await get<{ name: string }>("SELECT name FROM players WHERE id = ?", [playerId]);
  if (player) await logActivity(coachName, "Gjorde utvecklingsavstämning", player.name);

  revalidatePath(`/spelare/${playerId}`);
  revalidatePath(`/spelare/${playerId}/utveckling`);
  revalidatePath("/utveckling");
  revalidatePath("/mitt-utvecklingstrad");
  redirect(`/spelare/${playerId}/utveckling?sparad=1`);
}
