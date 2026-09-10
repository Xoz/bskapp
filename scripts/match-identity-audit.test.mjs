import {describe,it,expect} from 'vitest';
import postgres from 'postgres';
import {duplicateMatchQuery} from './match-identity-audit.mjs';
describe.skipIf(!process.env.BSK_SYNC_TEST_DATABASE_URL)('matchidentitet i publiceringskontrollen',()=>{
  it('skiljer parallella cupmatcher men fångar samma käll-id och okopplade dubbletter',async()=>{
    const sql=postgres(process.env.BSK_SYNC_TEST_DATABASE_URL,{max:1});
    try {
      await sql.unsafe(`CREATE TEMP TABLE matches(id int,date text,start_time text,opponent text,group_id int,source text,external_uid text,cancelled int DEFAULT 0);
        CREATE TEMP TABLE development_activities(match_id int,group_id int,external_key text);
        INSERT INTO matches VALUES (1,'2026-08-16','12:30','Slutspelsmatch',1,'calendar','cal123-40600@svenskalag.se',0),
        (2,'2026-08-16','12:30','Slutspelsmatch',1,'svenskalag_sanktan','sanktan:456',0);`);
      const count=async()=>(await sql.unsafe(duplicateMatchQuery))[0].count;
      expect(await count()).toBe(0);
      await sql`UPDATE matches SET external_uid='sanktan:123',date='2026-08-17' WHERE id=2`;
      expect(await count()).toBe(1);
      await sql`UPDATE matches SET cancelled=1 WHERE id=2`;
      expect(await count()).toBe(0);
      await sql`UPDATE matches SET cancelled=0,date='2026-08-16',external_uid=NULL,source='manual' WHERE id=2`;
      expect(await count()).toBe(1);
      await sql`UPDATE matches SET source='svenskalag_sanktan' WHERE id=2`;
      await sql`INSERT INTO development_activities VALUES(2,1,'sanktan:456')`;
      expect(await count()).toBe(0);
      await sql`UPDATE matches SET group_id=2,source='manual' WHERE id=2`;
      expect(await count()).toBe(0);
    }finally{await sql.end();}
  });
});
