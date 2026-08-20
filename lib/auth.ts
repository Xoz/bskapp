import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { cache } from "react";
import { all, get } from "./db";

// next start bakom nginx (loopback-bunden) återspeglar inte Host-headern i
// req.url — den visar serverns egen bind-adress (t.ex. localhost:3001) istället
// för den publika domänen. nginx sätter X-Forwarded-Proto/-Host med egna
// variabler och skriver alltid över klientens egna värden, så de går att lita
// på här. Utan proxy (lokal dev) faller vi tillbaka på req.url som förut.
export function requestOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (proto && host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

export const ROLES = ["admin", "head_coach", "coach", "leader", "player", "parent"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  head_coach: "Huvudtränare",
  coach: "Tränare",
  leader: "Ledare",
  player: "Spelare",
  parent: "Förälder",
};

export const PERMISSIONS = [
  "manage_users",
  "manage_settings",
  "manage_groups",
  "view_players",
  "manage_players",
  "view_private_player_data",
  "manage_evaluations",
  "view_matches",
  "manage_matches",
  "manage_squads",
  "report_matches",
  "view_statistics",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  manage_users: "Hantera användare och roller",
  manage_settings: "Hantera klubbinställningar",
  manage_groups: "Hantera lag och grupper",
  view_players: "Se spelare",
  manage_players: "Hantera spelare",
  view_private_player_data: "Se privata anteckningar och utveckling",
  manage_evaluations: "Skapa och ändra utvärderingar",
  view_matches: "Se matcher",
  manage_matches: "Skapa och ändra matcher/cuper",
  manage_squads: "Hantera kallelser och laguttagningar",
  report_matches: "Rapportera live och matchstatistik",
  view_statistics: "Se lagstatistik",
};

const DEFAULT_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  head_coach: PERMISSIONS.filter((p) => p !== "manage_settings"),
  coach: [
    "view_players", "manage_players", "view_private_player_data", "manage_evaluations",
    "view_matches", "manage_matches", "manage_squads", "report_matches",
    "view_statistics",
  ],
  leader: ["view_players", "view_matches", "manage_squads", "report_matches"],
  player: [],
  parent: [],
};

export type CurrentUser = {
  id: number;
  email: string;
  name: string;
  roles: Role[];
  primaryRole: Role;
  permissions: Permission[];
  groupIds: number[];
};

export type ViewRole = "staff" | "player" | "parent";

const SECRET_FILE = path.join(process.cwd(), "data", "session-secret");

function getSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!fs.existsSync(SECRET_FILE)) {
    fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
    fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString("hex"));
  }
  return fs.readFileSync(SECRET_FILE, "utf8").trim();
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function userSessionToken(userId: number): string {
  const value = `user:${userId}`;
  return `${value}.${sign(value)}`;
}

/** @deprecated Behålls bara för att äldre deployade cookies ska kunna kännas igen. */
export function sessionToken(role: "coach"): string {
  return `${role}.${sign(role)}`;
}

export function coachEmailToken(email: string): string {
  return `${email}.${sign(`coach_email:${email}`)}`;
}

export function playerSessionToken(playerId: number): string {
  return `${playerId}.${sign(`player:${playerId}`)}`;
}

export async function getCoachEmail(): Promise<string | null> {
  const token = (await cookies()).get("bsk_coach_email")?.value;
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const email = token.slice(0, dot);
  return token.slice(dot + 1) === sign(`coach_email:${email}`) ? email : null;
}

export async function getCoachName(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user?.name) return user.name;
  return (await cookies()).get("bsk_coach_name")?.value || null;
}

export async function getPlayerSession(): Promise<number | null> {
  const token = (await cookies()).get("bsk_player_session")?.value;
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const id = token.slice(0, dot);
  if (token.slice(dot + 1) !== sign(`player:${id}`)) return null;
  const num = Number(id);
  return Number.isFinite(num) && num > 0 ? num : null;
}

const ROLE_ORDER: Role[] = ["admin", "head_coach", "coach", "leader", "parent", "player"];

export async function loadCurrentUserById(id: number): Promise<CurrentUser | null> {
  if (!Number.isInteger(id) || id < 1) return null;
  const user = await get<{ id: number; email: string; name: string }>(
    "SELECT id, email, name FROM users WHERE id = ? AND active = 1",
    [id]
  );
  if (!user) return null;
  const [roleRows, overrideRows, groupRows] = await Promise.all([
    all<{ role: Role }>("SELECT role FROM user_roles WHERE user_id = ?", [id]),
    all<{ permission_key: Permission; allowed: number }>(
      "SELECT permission_key, allowed FROM user_permissions WHERE user_id = ?",
      [id]
    ),
    all<{ group_id: number }>("SELECT group_id FROM user_group_access WHERE user_id = ?", [id]),
  ]);
  const roles = roleRows.map((r) => r.role).filter((r): r is Role => ROLES.includes(r));
  if (roles.length === 0) return null;
  const primaryRole = ROLE_ORDER.find((role) => roles.includes(role)) ?? roles[0];
  const effective = new Set<Permission>();
  for (const role of roles) for (const permission of DEFAULT_PERMISSIONS[role]) effective.add(permission);
  if (!roles.includes("admin")) {
    for (const row of overrideRows) {
      if (!PERMISSIONS.includes(row.permission_key)) continue;
      if (row.allowed) effective.add(row.permission_key);
      else effective.delete(row.permission_key);
    }
  }
  return {
    ...user,
    roles,
    primaryRole,
    permissions: [...effective],
    groupIds: groupRows.map((r) => r.group_id),
  };
}

export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get("bsk_session")?.value;
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const value = token.slice(0, dot);
  if (!value.startsWith("user:") || token.slice(dot + 1) !== sign(value)) return null;
  const id = Number(value.slice(5));
  return loadCurrentUserById(id);
});

export function isStaffRole(role: Role | null | undefined): boolean {
  return role === "admin" || role === "head_coach" || role === "coach" || role === "leader";
}

export async function hasPermission(permission: Permission): Promise<boolean> {
  return (await getCurrentUser())?.permissions.includes(permission) ?? false;
}

// Tom grupplista betyder alla grupper. När minst en grupp väljs blir åtkomsten
// uttryckligen begränsad till dessa (Admin ignorerar alltid begränsningen).
export async function canAccessGroup(groupId: number | null | undefined): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.roles.includes("admin") || groupId == null || user.groupIds.length === 0) return true;
  if (user.groupIds.includes(groupId)) return true;
  const inherited = await get<{ ok: number }>(
    `SELECT 1 AS ok FROM groups g
     JOIN user_group_access uga ON uga.user_id = ? AND uga.group_id = g.parent_id
     WHERE g.id = ? LIMIT 1`,
    [user.id, groupId]
  );
  return !!inherited;
}

export async function canAccessPlayer(playerId: number): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.permissions.includes("view_players")) {
    if (user.roles.includes("admin") || user.groupIds.length === 0) return true;
    const row = await get<{ ok: number }>(
      `SELECT 1 AS ok FROM player_group_memberships pgm
       JOIN groups g ON g.id = pgm.group_id
       JOIN user_group_access uga ON uga.user_id = ? AND (uga.group_id = pgm.group_id OR uga.group_id = g.parent_id)
       WHERE pgm.player_id = ? LIMIT 1`,
      [user.id, playerId]
    );
    return !!row;
  }
  const link = await get<{ ok: number }>(
    "SELECT 1 AS ok FROM user_player_links WHERE user_id = ? AND player_id = ? LIMIT 1",
    [user.id, playerId]
  );
  return !!link;
}

export async function getRealRole(): Promise<Role | null> {
  return (await getCurrentUser())?.primaryRole ?? null;
}

export async function getRole(): Promise<Role | null> {
  const role = await getRealRole();
  // Kompatibilitetslager för äldre sidor: alla personalroller renderar det
  // befintliga tränargränssnittet. Den verkliga auktoriseringen sker alltid
  // med permissions i server actions och route-layouts.
  return isStaffRole(role) ? "coach" : role;
}

export async function getViewRole(): Promise<ViewRole> {
  const user = await getCurrentUser();
  if (!user) return "player";
  const view = (await cookies()).get("bsk_view")?.value;
  if (isStaffRole(user.primaryRole) && (view === "player" || view === "parent")) return view;
  return isStaffRole(user.primaryRole) ? "staff" : user.primaryRole === "parent" ? "parent" : "player";
}
