import { redirect } from "next/navigation";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLES,
  ROLE_LABELS,
  getCurrentUser,
  hasPermission,
} from "@/lib/auth";
import { getPlayers } from "@/lib/queries";
import {
  getOrganizationGroups,
  getOrganizationUsers,
  getPlayerGroupMemberships,
} from "@/lib/organization";
import {
  createGroup,
  createOrganizationUser,
  saveGroup,
  saveUserAccess,
} from "@/lib/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration" };

export default async function AdministrationPage({
  searchParams,
}: {
  searchParams: Promise<{ anvandare?: string; sparad?: string; fel?: string }>;
}) {
  const [canManageUsers, canManageGroups, currentUser] = await Promise.all([
    hasPermission("manage_users"),
    hasPermission("manage_groups"),
    getCurrentUser(),
  ]);
  if (!currentUser) redirect("/login");
  if (!canManageUsers && !canManageGroups) redirect("/oversikt?behorighet=saknas");

  const [users, allGroups, players, memberships, params] = await Promise.all([
    getOrganizationUsers(),
    getOrganizationGroups(),
    getPlayers(),
    getPlayerGroupMemberships(),
    searchParams,
  ]);
  const groups = allGroups.filter((group) => currentUser.roles.includes("admin") || currentUser.groupIds.length === 0 || currentUser.groupIds.includes(group.id) || (group.parent_id != null && currentUser.groupIds.includes(group.parent_id)));
  const selectedId = Number(params.anvandare) || users[0]?.id;
  const selected = users.find((user) => user.id === selectedId);
  const canAssignAdmin = currentUser.roles.includes("admin");

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Åtkomst och organisation</p>
        <h1 className="text-[1.7rem] font-bold mt-0.5">Administration</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Roller ger en grundnivå. Därefter kan varje person begränsas per funktion och per lag.
        </p>
      </header>

      {params.sparad && <Notice text="Ändringarna är sparade." />}
      {params.fel === "egen-admin" && <Notice text="Du kan inte ta bort din egen adminbehörighet." warning />}

      {canManageUsers && (
        <section className="space-y-5">
          <div>
            <p className="eyebrow">Användare</p>
            <h2 className="text-xl font-semibold mt-1">Roller och begränsningar</h2>
          </div>

          <form action={createOrganizationUser} className="card p-5 grid md:grid-cols-[1fr_1fr_11rem_auto] gap-3 items-end">
            <Field label="Namn"><input name="name" className="input" placeholder="Förnamn Efternamn" /></Field>
            <Field label="Google-e-post"><input name="email" type="email" className="input" required placeholder="namn@example.se" /></Field>
            <Field label="Första roll">
              <select name="role" className="input" defaultValue="coach">
                {ROLES.filter((role) => role !== "admin" || canAssignAdmin).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              </select>
            </Field>
            <button className="btn-primary" type="submit">Lägg till</button>
          </form>

          <div className="grid lg:grid-cols-[15rem_1fr] gap-5 items-start">
            <nav className="card p-2 space-y-1">
              {users.map((user) => (
                <a
                  key={user.id}
                  href={`/administration?anvandare=${user.id}`}
                  className="block rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: user.id === selectedId ? "var(--primary-soft)" : "transparent", color: user.active ? "var(--ink)" : "var(--ink-faint)" }}
                >
                  <span className="font-medium block">{user.name || user.email}</span>
                  <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{user.roles.map((role) => ROLE_LABELS[role]).join(", ") || "Ingen roll"}</span>
                </a>
              ))}
            </nav>

            {selected && (
              <form action={saveUserAccess} className="card p-5 md:p-6 space-y-7">
                <input type="hidden" name="user_id" value={selected.id} />
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="font-semibold">{selected.name || selected.email}</h3><p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>{selected.email}</p></div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" value="1" defaultChecked={!!selected.active} /> Aktiv</label>
                </div>

                <Block title="Roller" hint="En person kan ha flera roller, till exempel Ledare och Förälder.">
                  <div className="grid sm:grid-cols-2 gap-2">
                    {ROLES.filter((role) => role !== "admin" || canAssignAdmin || selected.roles.includes("admin")).map((role) => (
                      <Check key={role} name="role" value={role} label={ROLE_LABELS[role]} checked={selected.roles.includes(role)} disabled={role === "admin" && !canAssignAdmin} />
                    ))}
                  </div>
                </Block>

                {!selected.roles.includes("admin") && (
                  <Block title="Funktionsåtkomst" hint="Ärvd använder rollens standard. Tillåt eller neka skriver över standarden för just denna person.">
                    <div className="space-y-2">
                      {PERMISSIONS.map((permission) => (
                        <div key={permission} className="grid sm:grid-cols-[1fr_9rem] gap-2 items-center">
                          <span className="text-sm">{PERMISSION_LABELS[permission]}</span>
                          <select name={`permission_${permission}`} className="input py-2" defaultValue={selected.permissions[permission] === true ? "allow" : selected.permissions[permission] === false ? "deny" : "inherit"}>
                            <option value="inherit">Ärvd</option><option value="allow">Tillåt</option><option value="deny">Neka</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </Block>
                )}

                <Block title="Lagåtkomst" hint="Inget valt betyder alla lag. Välj ett eller flera för att begränsa personen.">
                  <div className="grid sm:grid-cols-2 gap-2">
                    {groups.filter((group) => group.active).map((group) => <Check key={group.id} name="group_id" value={String(group.id)} label={`${group.name} · ${groupTypeLabel(group.group_type)}`} checked={selected.groupIds.includes(group.id)} />)}
                  </div>
                </Block>

                <Block title="Kopplade spelare" hint="Spelarrollen kopplas till sig själv. Föräldrar kan kopplas till flera barn.">
                  <label className="label" htmlFor="self_player_id">Spelaren själv</label>
                  <select id="self_player_id" name="self_player_id" className="input mb-3" defaultValue={selected.playerLinks.find((link) => link.relation === "self")?.playerId ?? ""}>
                    <option value="">Ingen</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                  </select>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {players.map((player) => <Check key={player.id} name="parent_player_id" value={String(player.id)} label={player.name} checked={selected.playerLinks.some((link) => link.relation === "parent" && link.playerId === player.id)} />)}
                  </div>
                </Block>

                <button className="btn-primary" type="submit">Spara användare</button>
              </form>
            )}
          </div>
        </section>
      )}

      {canManageGroups && (
        <section className="space-y-5">
          <div><p className="eyebrow">Organisation</p><h2 className="text-xl font-semibold mt-1">Huvudtrupp, undergrupper och matchgrupper</h2></div>
          <form action={createGroup} className="card p-5 grid md:grid-cols-[1fr_11rem_1fr_1fr_auto] gap-3 items-end">
            <Field label="Namn"><input name="name" className="input" required placeholder="Cup – Lag Gul" /></Field>
            <Field label="Typ"><select name="group_type" className="input" defaultValue="subgroup"><option value="squad">Huvudtrupp</option><option value="subgroup">Undergrupp</option><option value="matchgroup">Matchgrupp</option></select></Field>
            <Field label="Tillhör"><select name="parent_id" className="input"><option value="">Ingen</option>{groups.filter((group) => group.group_type !== "matchgroup").map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field>
            <Field label="Cup (valfritt)"><input name="cup_name" className="input" /></Field>
            <button className="btn-primary" type="submit">Skapa</button>
          </form>

          <div className="grid xl:grid-cols-2 gap-5">
            {groups.map((group) => (
              <form key={group.id} action={saveGroup} className="card p-5 space-y-4">
                <input type="hidden" name="group_id" value={group.id} />
                <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                  <Field label={groupTypeLabel(group.group_type)}><input name="name" className="input" defaultValue={group.name} /></Field>
                  <label className="flex items-center gap-2 text-sm pb-3"><input type="checkbox" name="active" value="1" defaultChecked={!!group.active} /> Aktiv</label>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Tillhör"><select name="parent_id" className="input" defaultValue={group.parent_id ?? ""}><option value="">Ingen</option>{groups.filter((candidate) => candidate.id !== group.id && candidate.group_type !== "matchgroup").map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></Field>
                  <Field label="Cup"><input name="cup_name" className="input" defaultValue={group.cup_name} disabled={group.group_type !== "matchgroup"} /></Field>
                </div>
                <details><summary className="text-sm cursor-pointer">Spelare ({group.member_count})</summary><div className="grid sm:grid-cols-2 gap-2 mt-3">{players.map((player) => <Check key={player.id} name="player_id" value={String(player.id)} label={player.name} checked={memberships.some((membership) => membership.group_id === group.id && membership.player_id === player.id)} />)}</div></details>
                <button className="btn-secondary" type="submit">Spara grupp</button>
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function groupTypeLabel(type: "squad" | "subgroup" | "matchgroup") {
  return type === "squad" ? "Huvudtrupp" : type === "subgroup" ? "Undergrupp" : "Matchgrupp";
}

function Notice({ text, warning = false }: { text: string; warning?: boolean }) {
  return <div className="rounded-xl px-4 py-3 text-sm" style={{ background: warning ? "var(--warn-bg)" : "var(--ok-bg)", color: warning ? "var(--warn)" : "var(--ok)" }}>{text}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

function Block({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <fieldset className="space-y-3"><legend className="font-semibold">{title}</legend><p className="text-xs" style={{ color: "var(--ink-faint)" }}>{hint}</p>{children}</fieldset>;
}

function Check({ name, value, label, checked, disabled = false }: { name: string; value: string; label: string; checked: boolean; disabled?: boolean }) {
  return <label className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ border: "1px solid var(--line)" }}><input type="checkbox" name={name} value={value} defaultChecked={checked} disabled={disabled} />{label}</label>;
}
