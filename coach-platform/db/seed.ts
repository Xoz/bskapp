import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? "postgres://coach:coach@localhost:5434/coach";
  if (!new URL(databaseUrl).hostname.match(/^(localhost|127\.0\.0\.1)$/)) throw new Error("Seedning får bara köras mot lokal databas.");
  const sql = postgres(databaseUrl, { max: 1 });
  await sql.begin(async tx => {
    await tx`TRUNCATE organizations, users CASCADE`;
    const [organization] = await tx`INSERT INTO organizations (name) VALUES ('BSK Demo') RETURNING id`;
    const [coach] = await tx`INSERT INTO users (email,name) VALUES ('demo@planlinjen.local','Demo Tränare') ON CONFLICT(email) DO UPDATE SET name=excluded.name RETURNING id`;
    await tx`INSERT INTO organization_members VALUES (${organization.id},${coach.id},'organization_admin') ON CONFLICT DO NOTHING`;
    const [team] = await tx`INSERT INTO teams (organization_id,name,game_format) VALUES (${organization.id},'F2014 Gul','7v7') RETURNING id`;
    await tx`INSERT INTO team_members VALUES (${team.id},${coach.id},'head_coach')`;
    const names = ["Alva","Mira","Nora","Lea","Elsa","Signe","Lilly","Tilde","Iris","Ester","Selma","Lova","Juni","Maja"];
    for (const [index,name] of names.entries()) await tx`INSERT INTO players (team_id,name,birth_year,shirt_number) VALUES (${team.id},${name},2014,${index+2})`;
    const exerciseNames = ["Färgad första touch","Triangel med scanning","Fyra portar","Vänd ur press","3 mot 1 rondo","4 mot 2 riktningsspel","Driva och växla","1 mot 1 mot mål","2 mot 1 beslut","Passa genom linje","Spelbar diamant","Överlapp på kant","Väggspel till avslut","Avslut efter mottagning","Returjakten","Pressignal två och två","Försvarssida i korridor","Återerövra på fem","Omställningszoner","Bredd och djup 5v5","Spela ur hög press","Tre lag behåller","Smålagsspel med joker","Matchspel med bonuszon","Lugn nedvarvning med boll"];
    const exerciseIds = [];
    for (const [index,name] of exerciseNames.entries()) {
      const [exercise] = await tx`INSERT INTO exercises (organization_id,name,summary,min_players,max_players,duration_minutes,created_by) VALUES (${organization.id},${name},'En tydlig, matchnära övning med många bollkontakter och korta coachstopp.',${4+(index%3)*2},${14+(index%4)},${8+(index%4)*3},${coach.id}) RETURNING id`;
      exerciseIds.push(exercise.id);
    }
    const themes = ["Första touch","Scanning","Spelbarhet","Passningsprecision","En mot en offensivt"];
    for (let index=0; index<10; index++) {
      const [session] = await tx`INSERT INTO training_sessions (team_id,title,theme,starts_at,planned_minutes,status,created_by) VALUES (${team.id},${["Trygg med boll","Spelbar före pass","Vinna tillbaka","Utmana framåt","Spela ur press"][index%5]},${themes[index%5]},${`2026-07-${String(14+index).padStart(2,"0")} 18:00:00+02`},75,${index===0?'planned':'draft'},${coach.id}) RETURNING id`;
      for (const [blockIndex,minutes] of [15,25,35].entries()) await tx`INSERT INTO training_session_blocks (session_id,exercise_id,title,minutes,sort_order,coaching_points) VALUES (${session.id},${exerciseIds[(index+blockIndex*10)%exerciseIds.length]},${exerciseNames[(index+blockIndex*10)%exerciseNames.length]},${minutes},${blockIndex},${["Blicken upp","Agera direkt"]})`;
    }
  });
  await sql.end();
  console.log("Pilotdata skapad: 14 spelare, 25 övningar och 10 träningspass.");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
