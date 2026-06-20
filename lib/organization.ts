import { all } from "./db";
import type { Permission, Role } from "./auth";

export type OrganizationGroup = {
  id: number;
  name: string;
  group_type: "squad" | "subgroup" | "matchgroup";
  parent_id: number | null;
  parent_name: string | null;
  cup_name: string;
  color: string;
  active: number;
  member_count: number;
};

export type OrganizationUser = {
  id: number;
  email: string;
  name: string;
  active: number;
  roles: Role[];
  permissions: Partial<Record<Permission, boolean>>;
  groupIds: number[];
  playerLinks: { playerId: number; relation: "self" | "parent" }[];
};

export async function getOrganizationGroups(): Promise<OrganizationGroup[]> {
  return all<OrganizationGroup>(
    `SELECT g.id, g.name, g.group_type, g.parent_id, parent.name AS parent_name,
            g.cup_name, g.color, g.active, COUNT(pgm.player_id)::int AS member_count
     FROM groups g
     LEFT JOIN groups parent ON parent.id = g.parent_id
     LEFT JOIN player_group_memberships pgm ON pgm.group_id = g.id
     GROUP BY g.id, parent.name
     ORDER BY CASE g.group_type WHEN 'squad' THEN 0 WHEN 'subgroup' THEN 1 ELSE 2 END,
              lower(g.name)`
  );
}

export async function getOrganizationUsers(): Promise<OrganizationUser[]> {
  const [users, roles, permissions, groups, links] = await Promise.all([
    all<{ id: number; email: string; name: string; active: number }>(
      "SELECT id, email, name, active FROM users ORDER BY active DESC, lower(name), lower(email)"
    ),
    all<{ user_id: number; role: Role }>("SELECT user_id, role FROM user_roles"),
    all<{ user_id: number; permission_key: Permission; allowed: number }>(
      "SELECT user_id, permission_key, allowed FROM user_permissions"
    ),
    all<{ user_id: number; group_id: number }>("SELECT user_id, group_id FROM user_group_access"),
    all<{ user_id: number; player_id: number; relation: "self" | "parent" }>(
      "SELECT user_id, player_id, relation FROM user_player_links"
    ),
  ]);
  return users.map((user) => ({
    ...user,
    roles: roles.filter((row) => row.user_id === user.id).map((row) => row.role),
    permissions: Object.fromEntries(
      permissions.filter((row) => row.user_id === user.id).map((row) => [row.permission_key, !!row.allowed])
    ),
    groupIds: groups.filter((row) => row.user_id === user.id).map((row) => row.group_id),
    playerLinks: links
      .filter((row) => row.user_id === user.id)
      .map((row) => ({ playerId: row.player_id, relation: row.relation })),
  }));
}

export async function getPlayerGroupMemberships(): Promise<
  { player_id: number; group_id: number; is_primary: number }[]
> {
  return all("SELECT player_id, group_id, is_primary FROM player_group_memberships");
}
