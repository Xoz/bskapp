import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL ?? "postgres://coach:coach@localhost:5434/coach", { max: 1 });
  await sql.begin(async tx => {
    const [organization] = await tx`INSERT INTO organizations (name) VALUES ('BSK Demo') RETURNING id`;
    const [coach] = await tx`INSERT INTO users (email,name) VALUES ('demo@planlinjen.local','Demo Tränare') ON CONFLICT(email) DO UPDATE SET name=excluded.name RETURNING id`;
    await tx`INSERT INTO organization_members VALUES (${organization.id},${coach.id},'organization_admin') ON CONFLICT DO NOTHING`;
    const [team] = await tx`INSERT INTO teams (organization_id,name,game_format) VALUES (${organization.id},'F2014 Gul','7v7') RETURNING id`;
    await tx`INSERT INTO team_members VALUES (${team.id},${coach.id},'head_coach')`;
    const names = ["Alva","Mira","Nora","Lea","Elsa","Signe","Lilly","Tilde","Iris","Ester","Selma","Lova","Juni","Maja"];
    for (const [index,name] of names.entries()) await tx`INSERT INTO players (team_id,name,birth_year,shirt_number) VALUES (${team.id},${name},2014,${index+2})`;
  });
  await sql.end();
  console.log("Demoorganisation och 14 fiktiva spelare skapade.");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
