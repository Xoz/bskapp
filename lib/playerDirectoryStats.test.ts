import { describe, it, expect } from 'vitest';
import postgres from 'postgres';
import { playerDirectoryStatsQuery } from './playerDirectoryStats';

describe.skipIf(!process.env.BSK_SYNC_TEST_DATABASE_URL)('spelarlistans matchstatistik', () => {
  it('avgränsar år och lag, utesluter cuper samt skiljer kallelse från uttagning', async () => {
    const sql = postgres(process.env.BSK_SYNC_TEST_DATABASE_URL!, { max: 1 });
    try {
      await sql.unsafe(`CREATE TEMP TABLE groups(id int, name text, group_type text, parent_id int);
        CREATE TEMP TABLE players(id int);
        CREATE TEMP TABLE matches(id int, date text, finished int, cancelled int, group_id int);
        CREATE TEMP TABLE settings(key text,value text);
        INSERT INTO settings VALUES('unrelated_text','inte JSON');
        ALTER TABLE matches ADD COLUMN match_type text DEFAULT 'seriespel', ADD COLUMN cup_name text DEFAULT '';
        CREATE TEMP TABLE match_players(match_id int, player_id int);
        CREATE TEMP TABLE match_roster(match_id int, player_id int, callup_status text);
        INSERT INTO groups VALUES(1,'Gul','subgroup',NULL),(2,'Cup','matchgroup',1),(3,'Grön','subgroup',NULL),(4,'Cupfinal','matchgroup',2);
        INSERT INTO players VALUES(1),(2);
        INSERT INTO matches(id,date,finished,cancelled,group_id) VALUES
          (1,'2026-09-01',1,0,1),(2,'2026-09-02',1,0,2),
          (3,'2026-09-12',0,0,1),(4,'2026-09-03',1,0,3),
          (5,'2025-09-01',1,0,1),(6,'2026-09-04',1,1,1),
          (7,'2026-09-05',1,0,1),(8,'2027-01-01',0,0,1),
          (9,'2026-09-06',1,0,NULL),(10,'2026-09-07',1,0,4);
        INSERT INTO match_players SELECT id,1 FROM matches;
        INSERT INTO match_roster VALUES(1,1,'accepted'),(2,1,'declined'),(3,1,'pending'),
          (4,1,'accepted'),(5,1,'accepted'),(6,1,'accepted'),(7,1,NULL),
          (8,1,'pending'),(9,1,'accepted'),(10,1,'accepted');`);
      const read = async (team: string | null, ids = [1]) => {
        const query = playerDirectoryStatsQuery(ids, '2026-09-10', team);
        let index = 0;
        return sql.unsafe(query.sql.replace(/\?/g, () => `$${++index}`), query.args);
      };
      expect(await read('Gul')).toEqual([{ player_id: 1, match_count: 2, callup_count: 2 }]);
      expect(await read('Grön')).toEqual([{ player_id: 1, match_count: 1, callup_count: 1 }]);
      expect(await read(null)).toEqual([{ player_id: 1, match_count: 4, callup_count: 4 }]);
      expect(await read('Gul', [2])).toEqual([{ player_id: 2, match_count: 0, callup_count: 0 }]);
      expect(await read('Gul', [])).toEqual([]);
      await sql`UPDATE matches SET match_type='cup' WHERE id=1`;
      expect((await read('Gul'))[0].match_count).toBe(1);
      await sql`UPDATE matches SET match_type='seriespel',cup_name='Exempelcup' WHERE id=1`;
      expect((await read('Gul'))[0].match_count).toBe(1);
      await sql`UPDATE matches SET cup_name='' WHERE id=1`;
      await sql`INSERT INTO settings VALUES('svenskalag_match_metadata:1','{"scope":"cup"}')`;
      expect((await read('Gul'))[0].match_count).toBe(1);
      expect((await read('Gul'))[0].callup_count).toBe(1);
      await sql`DELETE FROM settings`;
      await sql`UPDATE matches SET match_type='traningsmatch' WHERE id=1`;
      expect((await read('Gul'))[0].match_count).toBe(2);
    } finally {
      await sql.end();
    }
  });
});
