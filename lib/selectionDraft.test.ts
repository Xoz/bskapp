import {describe,it,expect} from 'vitest';
import postgres from 'postgres';
import {selectionDraftStatements} from './selectionDraft';
describe.skipIf(!process.env.BSK_SYNC_TEST_DATABASE_URL)('laguppställning oberoende av kallelser',()=>{
  it('bevarar svar och närvaro även vid byte och tömning av utkast för flera matcher',async()=>{
    const sql=postgres(process.env.BSK_SYNC_TEST_DATABASE_URL!,{max:1});
    try {
      await sql.unsafe(`CREATE TEMP TABLE match_roster(match_id int,player_id int,selection_status text,selected_position text,callup_status text,source text,updated_at timestamptz,PRIMARY KEY(match_id,player_id));
        CREATE TEMP TABLE settings(key text PRIMARY KEY,value text);
        CREATE TEMP TABLE match_players(match_id int,player_id int);
        INSERT INTO match_roster VALUES(301,1,'selected','','accepted','svenskalag_browser',now()),(301,2,NULL,'','declined','svenskalag_browser',now()),(402,1,'selected','','pending','svenskalag_browser',now());
        INSERT INTO match_players VALUES(402,1);`);
      const save=async(id:number,players:{playerId:number;position:string}[])=>sql.begin(async tx=>{
        for(const statement of selectionDraftStatements(id,players)) {
          let position=0;
          await tx.unsafe(statement.sql.replace(/\?/g,()=>`$${++position}`),statement.args);
        }
      });
      await save(301,[{playerId:2,position:'Back'}]);
      expect(await sql`SELECT player_id,callup_status,selection_status FROM match_roster WHERE match_id=301 ORDER BY player_id`).toEqual([
        {player_id:1,callup_status:'accepted',selection_status:null},{player_id:2,callup_status:'declined',selection_status:'selected'},
      ]);
      expect((await sql`SELECT selection_status FROM match_roster WHERE match_id=402`)[0].selection_status).toBe('selected');
      await save(301,[]);
      expect(await sql`SELECT player_id FROM match_roster WHERE match_id=301 AND selection_status='selected'`).toHaveLength(0);
      expect((await sql`SELECT value FROM settings WHERE key='svenskalag_draft:301'`)[0].value).toBe('true');
      await save(402,[]);
      expect((await sql`SELECT callup_status FROM match_roster WHERE match_id=402`)[0].callup_status).toBe('pending');
      expect(await sql`SELECT * FROM match_players`).toHaveLength(1);
    }finally{await sql.end();}
  });
});
it('avvisar dubbla spelarval innan något skrivs',()=>{
  expect(()=>selectionDraftStatements(301,[{playerId:1,position:''},{playerId:1,position:''}])).toThrow();
});
