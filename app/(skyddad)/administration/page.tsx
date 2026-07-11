import { redirect } from "next/navigation";
import Link from "next/link";
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
  type OrganizationGroup,
} from "@/lib/organization";
import {
  createGroup,
  createOrganizationUser,
  saveGroup,
  saveUserAccess,
} from "@/lib/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration" };

type Tab = "anvandare" | "organisation";

export default async function AdministrationPage({
  searchParams,
}: {
  searchParams: Promise<{ anvandare?: string; sparad?: string; fel?: string; yta?: string }>;
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

  // Flikar – bara visa växlaren om personen har båda behörigheterna.
  const tab: Tab = params.yta === "organisation" ? "organisation" : "anvandare";
  const showTabs = canManageUsers && canManageGroups;
  const showUsers = canManageUsers && (!showTabs || tab === "anvandare");
  const showGroups = canManageGroups && (!showTabs || tab === "organisation");

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Åtkomst och organisation</p>
        <h1 className="text-[32px] font-bold mt-0.5">Administration</h1>
        <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
          Roller ger en grundnivå. Därefter kan varje person begränsas per funktion och per lag.
        </p>
      </header>

      {showTabs && (
        <nav className="flex gap-1 p-1 w-fit rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <TabLink href="/administration?yta=anvandare" active={tab === "anvandare"}>Användare</TabLink>
          <TabLink href="/administration?yta=organisation" active={tab === "organisation"}>Organisation</TabLink>
        </nav>
      )}

      {params.sparad && <Notice text="Ändringarna är sparade." />}
      {params.fel === "egen-admin" && <Notice text="Du kan inte ta bort din egen adminbehörighet." warning />}

      {showUsers && (
        <section className="space-y-5">
          <div>
            <p className="eyebrow">Användare</p>
            <h2 className="text-xl font-semibold mt-1">Roller och begränsningar</h2>
            <p className="body-small mt-1 max-w-2xl" style={{ color: "var(--ink-secondary)" }}>
              Lägg till en person med Google-adressen de loggar in med. Rollen styr vad de ser som
              standard – lägg på funktions- eller lagbegränsningar bara om någon ska se mindre än sin roll.
            </p>
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
                  href={`/administration?anvandare=${user.id}${tab === "organisation" ? "&yta=organisation" : ""}`}
                  className="block rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: user.id === selectedId ? "var(--primary-soft)" : "transparent", color: user.active ? "var(--ink)" : "var(--ink-muted)" }}
                >
                  <span className="font-medium block">{user.name || user.email}</span>
                  <span className="caption" style={{ color: "var(--ink-muted)" }}>{user.roles.map((role) => ROLE_LABELS[role]).join(", ") || "Ingen roll"}</span>
                </a>
              ))}
            </nav>

            {selected && (
              <form action={saveUserAccess} className="card p-5 md:p-6 space-y-7">
                <input type="hidden" name="user_id" value={selected.id} />
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="font-semibold">{selected.name || selected.email}</h3><p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>{selected.email}</p></div>
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
                          <span className="body-small">{PERMISSION_LABELS[permission]}</span>
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

      {showGroups && (
        <GroupsSection groups={groups} players={players} memberships={memberships} />
      )}
    </div>
  );
}

function GroupsSection({
  groups,
  players,
  memberships,
}: {
  groups: OrganizationGroup[];
  players: { id: number; name: string }[];
  memberships: { player_id: number; group_id: number; is_primary: number }[];
}) {
  const squads = groups.filter((g) => g.group_type === "squad");
  const subgroups = groups.filter((g) => g.group_type === "subgroup");
  const matchgroups = groups.filter((g) => g.group_type === "matchgroup");
  // Undergrupper/matchgrupper som pekar på ett föräldraobjekt utanför listan (t.ex. inaktiverat) – tappa inte bort dem.
  const orphanSubgroups = subgroups.filter((g) => !squads.some((s) => s.id === g.parent_id));
  const orphanMatchgroups = matchgroups.filter((g) => !subgroups.some((s) => s.id === g.parent_id) && !squads.some((s) => s.id === g.parent_id));

  return (
    <section className="space-y-5">
      <div>
        <p className="eyebrow">Organisation</p>
        <h2 className="text-xl font-semibold mt-1">Huvudtrupp, undergrupper och matchgrupper</h2>
      </div>

      <div className="card p-5 space-y-2 text-sm" style={{ color: "var(--ink-secondary)" }}>
        <p><strong style={{ color: "var(--ink)" }}>Huvudtrupp</strong> – hela laget, t.ex. BSK F2014. Alla spelare hör hit.</p>
        <p><strong style={{ color: "var(--ink)" }}>Undergrupp</strong> – ett permanent lag inom truppen, t.ex. Gul eller Grön. Skapa en här och bocka i vilka spelare som hör dit.</p>
        <p><strong style={{ color: "var(--ink)" }}>Matchgrupp</strong> – skapas automatiskt när en cup importeras, för att hålla isär flera egna lag i samma turnering. Du behöver sällan röra dessa själv.</p>
      </div>

      <form action={createGroup} className="card p-5 grid md:grid-cols-[1fr_11rem_1fr_1fr_auto] gap-3 items-end">
        <Field label="Namn"><input name="name" className="input" required placeholder="t.ex. Grön" /></Field>
        <Field label="Typ"><select name="group_type" className="input" defaultValue="subgroup"><option value="squad">Huvudtrupp</option><option value="subgroup">Undergrupp</option><option value="matchgroup">Matchgrupp</option></select></Field>
        <Field label="Tillhör"><select name="parent_id" className="input"><option value="">Ingen</option>{groups.filter((group) => group.group_type !== "matchgroup").map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field>
        <Field label="Cup (valfritt)"><input name="cup_name" className="input" /></Field>
        <button className="btn-primary" type="submit">Skapa</button>
      </form>

      <div className="space-y-5">
        {squads.map((squad) => (
          <div key={squad.id} className="space-y-3">
            <GroupCard group={squad} players={players} memberships={memberships} groups={groups} />
            <div className="pl-4 md:pl-6 space-y-3" style={{ borderLeft: "2px solid var(--border)" }}>
              {subgroups.filter((sg) => sg.parent_id === squad.id).map((subgroup) => (
                <div key={subgroup.id} className="space-y-3">
                  <GroupCard group={subgroup} players={players} memberships={memberships} groups={groups} />
                  <MatchgroupList matchgroups={matchgroups.filter((mg) => mg.parent_id === subgroup.id)} players={players} memberships={memberships} groups={groups} indent />
                </div>
              ))}
            </div>
          </div>
        ))}

        {orphanSubgroups.length > 0 && (
          <div className="grid xl:grid-cols-2 gap-5">
            {orphanSubgroups.map((g) => <GroupCard key={g.id} group={g} players={players} memberships={memberships} groups={groups} />)}
          </div>
        )}
        {orphanMatchgroups.length > 0 && (
          <MatchgroupList matchgroups={orphanMatchgroups} players={players} memberships={memberships} groups={groups} />
        )}
      </div>
    </section>
  );
}

function MatchgroupList({
  matchgroups,
  players,
  memberships,
  groups,
  indent = false,
}: {
  matchgroups: OrganizationGroup[];
  players: { id: number; name: string }[];
  memberships: { player_id: number; group_id: number; is_primary: number }[];
  groups: OrganizationGroup[];
  indent?: boolean;
}) {
  if (matchgroups.length === 0) return null;
  return (
    <details className={indent ? "pl-4 md:pl-6" : undefined}>
      <summary className="body-small cursor-pointer" style={{ color: "var(--ink-muted)" }}>
        Matchgrupper ({matchgroups.length}) – auto-skapade vid cup-import
      </summary>
      <div className="grid xl:grid-cols-2 gap-5 mt-3">
        {matchgroups.map((g) => <GroupCard key={g.id} group={g} players={players} memberships={memberships} groups={groups} />)}
      </div>
    </details>
  );
}

function GroupCard({
  group,
  players,
  memberships,
  groups,
}: {
  group: OrganizationGroup;
  players: { id: number; name: string }[];
  memberships: { player_id: number; group_id: number; is_primary: number }[];
  groups: OrganizationGroup[];
}) {
  return (
    <form action={saveGroup} className="card p-5 space-y-4">
      <input type="hidden" name="group_id" value={group.id} />
      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <Field label={groupTypeLabel(group.group_type)}><input name="name" className="input" defaultValue={group.name} /></Field>
        <label className="flex items-center gap-2 text-sm pb-3"><input type="checkbox" name="active" value="1" defaultChecked={!!group.active} /> Aktiv</label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Tillhör"><select name="parent_id" className="input" defaultValue={group.parent_id ?? ""}><option value="">Ingen</option>{groups.filter((candidate) => candidate.id !== group.id && candidate.group_type !== "matchgroup").map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></Field>
        <Field label="Cup"><input name="cup_name" className="input" defaultValue={group.cup_name} disabled={group.group_type !== "matchgroup"} /></Field>
      </div>
      <details><summary className="body-small cursor-pointer">Spelare ({group.member_count})</summary><div className="grid sm:grid-cols-2 gap-2 mt-3">{players.map((player) => <Check key={player.id} name="player_id" value={String(player.id)} label={player.name} checked={memberships.some((membership) => membership.group_id === group.id && membership.player_id === player.id)} />)}</div></details>
      <button className="btn-secondary" type="submit">Spara grupp</button>
    </form>
  );
}

function groupTypeLabel(type: "squad" | "subgroup" | "matchgroup") {
  return type === "squad" ? "Huvudtrupp" : type === "subgroup" ? "Undergrupp" : "Matchgrupp";
}

function Notice({ text, warning = false }: { text: string; warning?: boolean }) {
  return <div className="rounded-xl px-4 py-3 text-sm" style={{ background: warning ? "var(--warn-bg)" : "var(--ok-bg)", color: warning ? "var(--warning)" : "var(--success)" }}>{text}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

function Block({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <fieldset className="space-y-3"><legend className="font-semibold">{title}</legend><p className="caption" style={{ color: "var(--ink-muted)" }}>{hint}</p>{children}</fieldset>;
}

function Check({ name, value, label, checked, disabled = false }: { name: string; value: string; label: string; checked: boolean; disabled?: boolean }) {
  return <label className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ border: "1px solid var(--border)" }}><input type="checkbox" name={name} value={value} defaultChecked={checked} disabled={disabled} />{label}</label>;
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{ background: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-deep)" : "var(--ink-secondary)" }}
    >
      {children}
    </Link>
  );
}
