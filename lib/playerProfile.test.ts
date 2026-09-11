import { describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { profileFocus, playerListContext, playerTrainingStatsQuery } from './playerProfile';
import { SKILLS } from './skillTrappan';

it('skiljer uttryckligt fokus från steg i arbete och hittar inte på ett fokus i ett tomt träd', () => {
  expect(profileFocus({}, [])).toEqual({ explicit: false, skills: [] });
  const first = SKILLS[0], second = SKILLS[1];
  expect(profileFocus({ [first.id]: 'training' }, []).skills.map(s => s.id)).toEqual([first.id]);
  expect(profileFocus({ [first.id]: 'training', [second.id]: 'done' }, [{ skill_id: second.id, status: 'done', is_focus: 1 }]))
    .toEqual({ explicit: true, skills: [second] });
  expect(profileFocus({}, [{ skill_id: 'unknown', status: 'training', is_focus: 1 }]).skills).toEqual([]);
});
it('bevarar lag och sökning utan att göra användarindata till en returadress', () => {
  const result = playerListContext('Grön', 'Exempel & ?#');
  expect(new URLSearchParams(result).get('lag')).toBe('Grön');
  expect(new URLSearchParams(result).get('q')).toBe('Exempel & ?#');
  expect(playerListContext(undefined, 'a'.repeat(101))).toBe('');
});

describe.skipIf(!process.env.BSK_SYNC_TEST_DATABASE_URL)('profilens träningsnärvaro', () => {
  it('skiljer verklig frånvaro från ja/nej/okänd kallelse och avgränsar period och spelare', async () => {
    const sql = postgres(process.env.BSK_SYNC_TEST_DATABASE_URL!, { max: 1 });
    try {
      await sql.unsafe(`CREATE TEMP TABLE development_activities(id text, activity_type text, activity_date text);
        CREATE TEMP TABLE development_activity_participation(activity_id text, player_id int, attendance_status text);
        CREATE TEMP TABLE development_activity_callups(activity_id text, player_id int, attendance_status text);
        INSERT INTO development_activities VALUES ('present','training','2026-09-01'),('absent','training','2026-09-02'),
          ('yes','training','2026-09-03'),('no','training','2026-09-04'),('old','training','2026-01-05'),
          ('previous-year','training','2025-09-01'),('future','training','2026-09-12'),('today','training','2026-09-11'),
          ('other-player','training','2026-09-05'),('match','match','2026-09-06'),('no-data','training','2026-09-07');
        INSERT INTO development_activity_participation VALUES ('present',1,'present'),('absent',1,'absent'),
          ('old',1,'present'),('previous-year',1,'present'),('future',1,'present'),('today',1,'present'),('other-player',2,'present'),('match',1,'present');
        INSERT INTO development_activity_callups VALUES ('yes',1,'present'),('no',1,'absent'),('absent',1,'present');`);
      const read = async (today: string) => {
        const query = playerTrainingStatsQuery(1, today); let i = 0;
        return sql.unsafe(query.sql.replace(/\?/g, () => `$${++i}`), query.args);
      };
      expect(await read('2026-09-11')).toEqual([{ training_count: 2, recent_present: 1, recent_absent: 1, recent_unknown: 2 }]);
      await sql.unsafe(`INSERT INTO development_activities VALUES ('december','training','2025-12-29');
        INSERT INTO development_activity_participation VALUES ('december',1,'present');`);
      expect(await read('2026-01-06')).toEqual([{ training_count: 1, recent_present: 2, recent_absent: 0, recent_unknown: 0 }]);
    } finally { await sql.end(); }
  });
});
