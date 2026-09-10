import {describe,it,expect} from 'vitest';
import postgres from 'postgres';
import {activityCallupCountsSql,activityCallupNamesSql} from './activityCallups';
describe.skipIf(!process.env.BSK_SYNC_TEST_DATABASE_URL)('aktivitetens kallelsesvar',()=>{
  it('visar matchens källtotaler och namn, och behåller träningskällan',async()=>{
    const sql=postgres(process.env.BSK_SYNC_TEST_DATABASE_URL!,{max:1});
    try {
      await sql.unsafe(`CREATE TEMP TABLE matches(id int,callup_accepted_count int,callup_declined_count int,callup_pending_count int);
        CREATE TEMP TABLE development_activities(id text,match_id int);
        CREATE TEMP TABLE players(id int,name text);
        CREATE TEMP TABLE match_roster(match_id int,player_id int,callup_status text);
        CREATE TEMP TABLE development_activity_callups(activity_id text,player_id int,attendance_status text);
        CREATE TEMP TABLE development_activity_callup_summaries(activity_id text,accepted_count int,declined_count int,pending_count int);
        INSERT INTO matches VALUES(7,10,1,0);
        INSERT INTO development_activities VALUES('match',7),('training',NULL);
        INSERT INTO players VALUES(1,'Exempel A'),(2,'Exempel B'),(3,'Enbart uttagen');
        INSERT INTO match_roster VALUES(7,1,'declined'),(7,2,'accepted'),(7,3,NULL);
        INSERT INTO development_activity_callups VALUES('match',1,'present'),('training',1,'present');
        INSERT INTO development_activity_callup_summaries VALUES('match',99,0,0),('training',1,0,0);`);
      const read=()=>sql.unsafe(`SELECT da.id,${activityCallupCountsSql},${activityCallupNamesSql} FROM development_activities da LEFT JOIN matches m ON m.id=da.match_id ORDER BY da.id`);
      const [match,training]=await read();
      expect(match).toMatchObject({accepted_callup_count:10,declined_callup_count:1,pending_callup_count:0,accepted_player_names:['Exempel B'],declined_player_names:['Exempel A'],called_player_names:['Exempel A','Exempel B']});
      expect(training).toMatchObject({accepted_callup_count:1,accepted_player_names:['Exempel A']});
      await sql`UPDATE matches SET callup_accepted_count=NULL`;
      expect((await read())[0].accepted_callup_count).toBe(1);
    }finally{await sql.end();}
  });
});
