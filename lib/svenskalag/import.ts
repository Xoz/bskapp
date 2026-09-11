import { matchMetadataKey } from "./matchMetadata";
import type postgres from "postgres";
import {lineupKey,draftKey} from "./outbox";
import { nameKey, validateSnapshot, type ActivitySnapshot, type SyncTeam } from "./model";

/** Hela hämtningen valideras före transaktionen. Inga schemaändringar i arbetaren. */
export async function applySnapshot(sql: ReturnType<typeof postgres>, items: ActivitySnapshot[], today: string, dryRun = false, team: SyncTeam = "Gul") {
  if (team === "Grön" && items.length === 0) return {activities:0, skippedCups:0, unknownMatches:0, unmatched:[] as string[]};
  validateSnapshot(items, today, team);
  if (team === "Grön" && items.some(a => a.kind !== "match" || a.lineup)) throw new Error("Grön importerar endast matchuppgifter, svar och närvaro");
  return sql.begin(async tx => {
    const groups = await tx`SELECT id FROM groups WHERE name = ${team} AND group_type = 'subgroup' AND active = 1`;
    if (groups.length !== 1) throw new Error(`${team} måste vara entydigt kopplat`);
    const groupId = groups[0].id;
    // Samma låsordning som cupens utkast. Hela transaktionen är lokal, utan browseranrop.
    if(!dryRun) for(const match of await tx`SELECT id FROM matches WHERE group_id=${groupId} ORDER BY id`) {
      await tx`SELECT pg_advisory_xact_lock(2014, ${match.id})`;
    }

    const players = await tx`SELECT id, name FROM players WHERE active = 1`;
    const names = new Map<string, number[]>();
    for (const p of players) names.set(nameKey(p.name), [...(names.get(nameKey(p.name)) ?? []), p.id]);
    const formerPlayers = await tx`SELECT name FROM players WHERE active = 0`;
    const ignoredNames = new Set(formerPlayers.filter(p => !names.has(nameKey(p.name))).map(p => nameKey(p.name)));
    const leaderNames: unknown = JSON.parse((await tx`SELECT value FROM settings WHERE key='svenskalag_non_player_names'`)[0]?.value ?? '[]');
    if (!Array.isArray(leaderNames) || leaderNames.some(n => typeof n !== 'string' || !n.trim())) throw new Error('Ogiltig ledarkoppling');
    for (const name of leaderNames) ignoredNames.add(nameKey(name));
    const unmatched: string[] = [];
    const write=async(key:string,value:unknown)=>{await tx`INSERT INTO settings(key,value) VALUES(${key},${JSON.stringify(value)}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`;};
    let activities = 0, skippedCups = 0, unknownMatches = 0;
    for (const a of items) {
      if (a.match?.metadata?.scope === "cup") {
        // Märk endast redan kända matcher för beräkningsfiltret. Importera inte cupen.
        if (!dryRun) {
          const sourceKey = `sanktan:${a.sourceId}`;
          const known = await tx`SELECT m.id FROM matches m WHERE m.group_id=${groupId} AND (
            m.external_uid=${sourceKey} OR m.external_uid LIKE ${'cal'+a.sourceId+'-%@svenskalag.se'}
            OR EXISTS (SELECT 1 FROM development_activities da WHERE da.match_id=m.id AND da.external_key=${sourceKey} AND da.group_id=${groupId}))`;
          if (known.length === 1) await write(matchMetadataKey(known[0].id), a.match.metadata);
        }
        skippedCups++; continue;
      }
      if (a.match?.metadata?.scope === "unknown") {
        unknownMatches++; unmatched.push(`Match ${a.sourceId}: tävling eller spelform behöver verifieras (${a.match.metadata.competitionName || "saknas"})`); continue;
      }
      const key = a.kind === "match" ? `sanktan:${a.sourceId}` : `svenskalag:activity:${a.sourceId}`;
      let rows = Array.from(await tx`SELECT id, match_id FROM development_activities WHERE external_key = ${key} AND group_id = ${groupId}`);
      // Svenska Lag skapar och uppdaterar matchens grunddata med stabilt käll-id.
      if(a.kind==='match'&&a.match) {
        if(rows.length===0) {
          const matches=await tx`SELECT id,group_id FROM matches WHERE external_uid=${key} OR external_uid LIKE ${'cal'+a.sourceId+'-%@svenskalag.se'}`;
          if(matches.length>1||(matches.length===1&&matches[0].group_id!==groupId)) {unmatched.push(`Match ${a.sourceId}: lagkoppling behöver granskas`);continue;}
          if(!dryRun) {
            const matchId=matches[0]?.id??(await tx`INSERT INTO matches(date,start_time,opponent,home_away,group_id,source,external_uid) VALUES(${a.date},${a.time},${a.match.opponent},${a.match.homeAway},${groupId},'svenskalag_sanktan',${key}) RETURNING id`)[0].id;
            rows=Array.from(await tx`SELECT id,match_id FROM development_activities WHERE match_id=${matchId} AND group_id=${groupId}`) as typeof rows;
            if(rows.length===0) rows=Array.from(await tx`INSERT INTO development_activities(id,external_key,external_source,group_id,activity_type,activity_date,start_time,title,match_id) VALUES(${`svenskalag-match-${a.sourceId}`},${key},'svenskalag_sanktan',${groupId},'match',${a.date},${a.time},${a.title},${matchId}) RETURNING id,match_id`) as typeof rows;
            else await tx`UPDATE development_activities SET external_key=${key},external_source='svenskalag_sanktan' WHERE id=${rows[0].id}`;
          }
        }
        if(!dryRun&&rows.length===1) {
          await tx`DELETE FROM settings WHERE key=${`svenskalag_removed:${rows[0].match_id}`}`;
          await tx`UPDATE matches SET date=${a.date},start_time=${a.time},opponent=${a.match.opponent},home_away=${a.match.homeAway},location=COALESCE(${a.match.location??null},location),cancelled=${a.cancelled?1:0} WHERE id=${rows[0].match_id} AND group_id=${groupId}`;
          if (a.match.metadata?.scope === "supported") {
            const meta=a.match.metadata;
            // 7v7/9v9 och 60/75 minuter är lagets beslutade standarder.
            await tx`UPDATE matches SET match_type=${meta.matchType},periods=3,period_minutes=${meta.format===9?25:20} WHERE id=${rows[0].match_id} AND group_id=${groupId}`;
            await write(matchMetadataKey(rows[0].match_id), {...meta,fetchedAt:new Date().toISOString()});
          }
          await tx`UPDATE development_activities SET activity_date=${a.date},start_time=${a.time},title=${a.title} WHERE match_id=${rows[0].match_id}`;
        }
      }
      if(a.kind==='match'&&!(dryRun&&a.match)&&(rows.length!==1||rows[0].match_id==null)) {unmatched.push(`Match ${a.sourceId} saknar koppling`);continue;}
      if(a.kind==='match'&&rows.length===1&&(await tx`SELECT id FROM matches WHERE id=${rows[0].match_id} AND group_id=${groupId}`).length!==1) {unmatched.push(`Match ${a.sourceId}: lagkoppling behöver granskas`);continue;}
      if(a.cancelled){activities++;continue;}
      const legacy = a.kind === "training" && rows.length === 0 ? await tx`SELECT id, match_id, external_source, title FROM development_activities WHERE group_id = ${groupId} AND activity_type = 'training' AND activity_date = ${a.date} AND start_time = ${a.time}` : [];
      if (legacy.length > 1 || (legacy.length === 1 && (legacy[0].external_source !== "svenskalag_file" || nameKey(legacy[0].title) !== nameKey(a.title)))) { unmatched.push(`Träning ${a.sourceId}: befintlig aktivitet behöver kopplas`); continue; }
      const callups: {id: number; status: string}[] = [];
      const attendance: number[] = [];
      let ambiguous = false;
      for (const p of a.callups) {
        if (ignoredNames.has(nameKey(p.name))) continue;
        const ids = names.get(nameKey(p.name)) ?? [];
        if (ids.length !== 1) { ambiguous = true; continue; }
        callups.push({id: ids[0], status: p.status});
      }
      for (const name of a.attendance ?? []) {
        if (ignoredNames.has(nameKey(name))) continue;
        const ids = names.get(nameKey(name)) ?? [];
        if (ids.length !== 1) { ambiguous = true; continue; }
        attendance.push(ids[0]);
      }
      if (ambiguous) unmatched.push(`Aktivitet ${a.sourceId}: vissa spelare saknar entydig koppling`);
      activities++;
      if (dryRun) continue;
      if (a.kind === "training" && rows.length === 0) {
        // En äldre export kan redan ha skapat passet: kräver entydig matchning.
        if (legacy.length === 1) {
          rows = legacy;
          await tx`UPDATE development_activities SET external_key = ${key}, external_source = 'svenskalag_browser' WHERE id = ${rows[0].id}`;
        } else {
          rows = await tx`INSERT INTO development_activities (id, external_key, external_source, group_id, activity_type, activity_date, start_time, title)
            VALUES (${`svenskalag-activity-${a.sourceId}`}, ${key}, 'svenskalag_browser', ${groupId}, 'training', ${a.date}, ${a.time}, ${a.title}) RETURNING id, match_id`;
        }
      }
      const activity = rows[0];
      if (a.kind === "match") {
        const matchId = activity.match_id;
        // Samma lås som webb/mobil: en pågående synk får inte skriva över ett nytt utkast.
        await tx`SELECT pg_advisory_xact_lock(2014, ${matchId})`;
        if(a.lineup) {
          await write(lineupKey(matchId),{sourceId:a.sourceId,date:a.date,names:a.lineup,fetchedAt:new Date().toISOString()});
          // Svenska Lags uppställning är utgångspunkt tills tränaren sparar ett eget utkast.
          const draft=(await tx`SELECT value FROM settings WHERE key=${draftKey(matchId)}`)[0];
          const manual=(await tx`SELECT player_id FROM match_roster WHERE match_id=${matchId} AND source='manual' AND selection_status='selected'`).length>0;
          if(!draft&&!manual) {
            await tx`UPDATE match_roster SET selection_status=NULL WHERE match_id=${matchId}`;
            for(const name of a.lineup) {
              if (ignoredNames.has(nameKey(name))) continue;
              const ids=names.get(nameKey(name))??[];
              if(ids.length!==1) {unmatched.push(`Match ${a.sourceId}: laguppställningens spelarkoppling behöver granskas`);continue;}
              await tx`INSERT INTO match_roster(match_id,player_id,selection_status,source) VALUES(${matchId},${ids[0]},'selected','svenskalag_browser') ON CONFLICT(match_id,player_id) DO UPDATE SET selection_status='selected',source='svenskalag_browser'`;
            }
          }
        }
        // Svaren ägs av Svenska Lag. Uttagningsutkast och positioner är separata.
        await tx`UPDATE match_roster SET callup_status = NULL, updated_at = now() WHERE match_id = ${matchId}`;
        for (const p of callups) await tx`INSERT INTO match_roster (match_id, player_id, callup_status, source)
          VALUES (${matchId}, ${p.id}, ${p.status}, 'svenskalag_browser') ON CONFLICT (match_id, player_id)
          DO UPDATE SET callup_status = excluded.callup_status, updated_at = now()`;
        await tx`UPDATE matches SET callup_accepted_count = ${a.totals.accepted}, callup_declined_count = ${a.totals.declined}, callup_pending_count = ${a.totals.pending}, callup_source = 'svenskalag_browser' WHERE id = ${matchId} AND group_id = ${groupId}`;
      } else {
        await tx`UPDATE development_activities SET activity_date = ${a.date}, start_time = ${a.time}, title = ${a.title} WHERE id = ${activity.id}`;
        await tx`DELETE FROM development_activity_callups WHERE activity_id = ${activity.id}`;
        for (const p of callups) await tx`INSERT INTO development_activity_callups (activity_id, player_id, attendance_status) VALUES (${activity.id}, ${p.id}, ${p.status === 'accepted' ? 'present' : p.status === 'declined' ? 'absent' : 'unknown'})`;
        await tx`INSERT INTO development_activity_callup_summaries (activity_id, accepted_count, declined_count, pending_count, source)
          VALUES (${activity.id}, ${a.totals.accepted}, ${a.totals.declined}, ${a.totals.pending}, 'svenskalag_browser') ON CONFLICT (activity_id)
          DO UPDATE SET accepted_count = excluded.accepted_count, declined_count = excluded.declined_count, pending_count = excluded.pending_count, source = excluded.source, updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')`;
      }
      if (a.attendance !== null) {
        if(a.kind==='match') {
          await write(`svenskalag_presence:${activity.match_id}`,{sourceId:a.sourceId,fetchedAt:new Date().toISOString()});
          for(const id of attendance) await tx`INSERT INTO match_players(match_id,player_id) VALUES(${activity.match_id},${id}) ON CONFLICT(match_id,player_id) DO NOTHING`;
        }
        // Registrerad närvaro i Svenska Lag är master, även efter en lokal korrigering.
        await tx`UPDATE development_activity_participation SET attendance_status = 'absent', source='svenskalag_browser' WHERE activity_id = ${activity.id}`;
        for (const id of attendance) await tx`INSERT INTO development_activity_participation (activity_id, player_id, attendance_status, source)
          VALUES (${activity.id}, ${id}, 'present', 'svenskalag_browser') ON CONFLICT (activity_id, player_id) DO UPDATE SET attendance_status = excluded.attendance_status, source = excluded.source`;
      }
    }
    if (!activities && !skippedCups && !unknownMatches) throw new Error("Ingen aktivitet kunde kopplas säkert");
    return { activities, skippedCups, unknownMatches, unmatched: unmatched.slice(0, 30) };
  });
}
