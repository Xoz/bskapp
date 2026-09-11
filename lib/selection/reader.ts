import type { all as All } from '../db';
import { regularMatchSql } from '../regularMatches';
import { matchCompetitionLevelSql } from '../sanktanLevel';
import { swedishDate } from '../dates';
import { policyKey, readPolicy, type Evidence, type MatchEvidence, type Training } from './rules';

/** Internt läslager: anroparen verifierar samtliga spelar-id och målmatchens lag. */
export async function loadSelectionEvidence(all:typeof All,playerIds:number[],targetMatchId?:number,now=Date.now()):Promise<Map<number,Evidence>> {
 const ids=[...new Set(playerIds)];if(!ids.length)return new Map();
 const target=await (targetMatchId?all<NonNullable<Evidence['target']>>(`SELECT m.id,m.date,m.start_time time,m.location,m.periods*m.period_minutes duration,
    COALESCE(${matchCompetitionLevelSql},substring(meta.value::jsonb->>'competitionName' from 'F2014-\\s*([1-5])')::int) level
    FROM matches m LEFT JOIN settings meta ON meta.key='svenskalag_match_metadata:'||m.id::text WHERE m.id=? AND m.cancelled=0 AND m.finished=0 AND ${regularMatchSql()}`,[targetMatchId]):Promise.resolve([]));
 if(targetMatchId&&!target[0])throw Error("Matchen är inte tillgänglig.");
 const horizon=Math.max(now+21*86400000,target[0]?Date.parse(target[0].date+"T12:00:00Z")+7*86400000:0);
 const asOf=swedishDate(new Date(now)),from=swedishDate(new Date(now-28*86400000)),to=swedishDate(new Date(horizon)),marks=ids.map(()=>'?').join(',');
 const [settings,training,matches]=await Promise.all([
  all<{key:string;value:string}>(`SELECT key,value FROM settings WHERE key IN (${marks})`,ids.map(policyKey)),
  all<Training&{player_id:number}>(`WITH relevant AS (
    SELECT DISTINCT ON (p.id,da.activity_date,da.start_time,da.group_id)
      p.id player_id,da.id,da.activity_date date,
      CASE WHEN ap.attendance_status IN ('present','absent') THEN ap.attendance_status ELSE 'unknown' END status,
      da.start_time
    FROM players p JOIN player_group_memberships pm ON pm.player_id=p.id AND pm.is_primary=1
    JOIN groups g ON g.id=pm.group_id AND g.group_type='subgroup'
    JOIN development_activities da ON da.group_id=g.id AND da.activity_type='training'
    LEFT JOIN development_activity_participation ap ON ap.activity_id=da.id AND ap.player_id=p.id
    WHERE p.id IN (${marks}) AND (da.activity_date<? OR (da.activity_date=?
      AND (da.activity_date||' '||COALESCE(da.start_time,'18:00'))::timestamp + interval '60 minutes' <= (?::timestamptz AT TIME ZONE 'Europe/Stockholm')
      AND EXISTS(SELECT 1 FROM development_activity_participation completed WHERE completed.activity_id=da.id AND completed.attendance_status='present')))
      AND (pm.starts_on IS NULL OR pm.starts_on<=da.activity_date) AND (pm.ends_on IS NULL OR pm.ends_on>=da.activity_date)
      AND da.external_source IN ('svenskalag_browser','svenskalag_file')
      AND lower(da.title) NOT LIKE '%extra%' AND lower(da.title) NOT LIKE '%inställd%'
    ORDER BY p.id,da.activity_date,da.start_time,da.group_id,(ap.attendance_status IN ('present','absent')) DESC NULLS LAST,da.id
   ), numbered AS (SELECT *,row_number() OVER(PARTITION BY player_id ORDER BY date DESC,start_time DESC NULLS LAST,id) n FROM relevant)
   SELECT player_id,id,date,status FROM numbered WHERE n<=4 ORDER BY player_id,date DESC,start_time DESC NULLS LAST,id`,[...ids,asOf,asOf,new Date(now).toISOString()]),
  all<MatchEvidence&{player_id:number}>(`SELECT p.id player_id,m.id,m.date,m.start_time time,m.periods*m.period_minutes duration,m.location,
    COALESCE(${matchCompetitionLevelSql}, substring(meta.value::jsonb->>'competitionName' from 'F2014-\\s*([1-5])')::int) level,
    EXISTS(SELECT 1 FROM match_players mp WHERE mp.match_id=m.id AND mp.player_id=p.id AND (
      NOT EXISTS(SELECT 1 FROM settings ps WHERE ps.key='svenskalag_presence:'||m.id::text)
      OR EXISTS(SELECT 1 FROM development_activities da JOIN development_activity_participation ap ON ap.activity_id=da.id
        WHERE da.match_id=m.id AND ap.player_id=p.id AND ap.attendance_status='present'))) AND (m.finished=1 OR m.date<?) played,
    mr.callup_status reply,COALESCE(mr.selection_status='selected',false) selected
    FROM players p JOIN matches m ON m.date BETWEEN ? AND ? AND m.cancelled=0 AND ${regularMatchSql()}
    LEFT JOIN match_roster mr ON mr.match_id=m.id AND mr.player_id=p.id
    LEFT JOIN settings meta ON meta.key='svenskalag_match_metadata:'||m.id::text
    WHERE p.id IN (${marks}) AND (mr.callup_status IS NOT NULL OR mr.selection_status='selected'
      OR EXISTS(SELECT 1 FROM match_players mp WHERE mp.match_id=m.id AND mp.player_id=p.id))
    ORDER BY p.id,m.date,m.start_time,m.id`,[asOf,from,to,...ids]),

 ]);
 if(targetMatchId&&!target[0])throw Error('Matchen är inte tillgänglig.');
 const raw=new Map(settings.map(r=>[r.key,r.value]));
 return new Map(ids.map(id=>[id,{asOf,policy:readPolicy(raw.get(policyKey(id))),revision:raw.get(policyKey(id))??'',training:training.filter(t=>t.player_id===id),matches:matches.filter(m=>m.player_id===id),target:target[0]??null}]));
}
