import type postgres from 'postgres';
export type RemovedMatch={matchId:number;sourceId:string;evidence:'source-deleted'};
/** Arkivera bara bekräftat borttagna källposter; behåll all trupp och historik. */
export async function applyRemovedMatches(sql:ReturnType<typeof postgres>,removed:RemovedMatch[],today:string,dryRun=false) {
  if(removed.some(r=>!Number.isInteger(r.matchId)||r.matchId<1||!/^\d+$/.test(r.sourceId)||r.evidence!=='source-deleted')||new Set(removed.map(r=>r.matchId)).size!==removed.length) throw new Error('Ogiltiga borttagningsbevis');
  await sql.begin(async tx=>{
    for(const item of removed) {
      const rows=await tx`SELECT m.id FROM matches m JOIN groups g ON g.id=m.group_id
        WHERE m.id=${item.matchId} AND g.name='Gul' AND g.group_type='subgroup' AND g.active=1
        AND m.date LIKE ${today.slice(0,4)+'%'} AND m.source IN ('calendar','svenskalag_sanktan')
        AND (m.external_uid=${'sanktan:'+item.sourceId} OR m.external_uid=${'cal'+item.sourceId+'-40600@svenskalag.se'}
          OR EXISTS(SELECT 1 FROM development_activities da WHERE da.match_id=m.id AND da.group_id=m.group_id AND da.external_key=${'sanktan:'+item.sourceId})) FOR UPDATE OF m`;
      if(rows.length!==1) throw new Error('Matchens källkoppling ändrades under kontrollen');
      if(dryRun) continue;
      await tx`UPDATE matches SET cancelled=1 WHERE id=${item.matchId}`;
      await tx`INSERT INTO settings(key,value) VALUES(${'svenskalag_removed:'+item.matchId},${JSON.stringify({sourceId:item.sourceId,verifiedAt:new Date().toISOString()})}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`;
    }
  });
}
