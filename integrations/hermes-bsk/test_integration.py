"""Real PostgreSQL isolation tests, synthetic data only. Run on the VPS staging directory.
Creates a temporary database and login; drops both even on failure. No production writes.
"""
import asyncio
import json
import os
from pathlib import Path
import secrets
import subprocess
import unittest
import psycopg
from psycopg import sql
from mcp import Client
import server

SUFFIX=secrets.token_hex(4)
DB='bsk_hermes_test_'+SUFFIX
ROLE='bsk_hermes_test_'+SUFFIX
PW=secrets.token_urlsafe(32)
CONFIG=Path('/tmp/'+DB+'.json')


def admin(query, database=DB):
    result=subprocess.run(['docker','exec','-i','bsk-db','psql','-X','-v','ON_ERROR_STOP=1','-U','bsk','-d',database,'-At'],input=query,text=True,capture_output=True)
    if result.returncode:
        # Fixture SQL only, never emit credentials.
        raise RuntimeError('Test database setup or assertion failed')
    return result.stdout.strip()


FIXTURE='''
CREATE TABLE users(id int primary key,active int);
CREATE TABLE groups(id int primary key,name text,group_type text,parent_id int,active int);
CREATE TABLE user_roles(user_id int,role text);
CREATE TABLE user_permissions(user_id int,permission_key text,allowed int);
CREATE TABLE user_group_access(user_id int,group_id int);
CREATE TABLE players(id int primary key,name text,jersey_number int,active int);
CREATE TABLE player_group_memberships(player_id int,group_id int,starts_on text,ends_on text);
CREATE TABLE matches(id int,date text,start_time text,opponent text,home_away text,match_type text,location text,finished int,our_score int,opponent_score int,source text,group_id int);
CREATE TABLE development_checkpoints(id text,player_id int,date text,strengths text,focus_note text,created_at text,wellbeing_note text);
CREATE TABLE player_skill_status(player_id int,skill_id text,status text,updated_at text);
CREATE TABLE development_activities(id text,activity_date text,start_time text,activity_type text,external_source text,group_id int,updated_at text);
CREATE TABLE development_activity_participation(activity_id text,player_id int,attendance_status text,source text,updated_at text);
CREATE TABLE training_plans(id text,created_by int,document jsonb,revision int,updated_at timestamptz);
INSERT INTO users VALUES (1,1),(2,1);
INSERT INTO user_roles VALUES (1,'admin'),(2,'coach');
INSERT INTO groups VALUES(1,'Test Gul','subgroup',NULL,1),(2,'Test Annat','subgroup',NULL,1),(3,'Test Cup','matchgroup',1,1);
INSERT INTO players VALUES (1,'Testspelare A',1,1),(2,'Testspelare B',2,1),(3,'Utgången',3,1),(4,'Inaktiv',4,0);
INSERT INTO player_group_memberships VALUES (1,1,NULL,NULL),(2,2,NULL,NULL),(3,1,NULL,'2020-01-01'),(4,1,NULL,NULL);
INSERT INTO matches VALUES (1,'2026-01-10','12:00','Testmotstånd','home','friendly','Testplan',0,0,0,'manual',1),(2,'2026-01-11','12:00','Annan','away','friendly','',1,1,2,'manual',2),(3,'2026-01-12','12:00','Cup','home','cup','',1,2,1,'manual',3);
INSERT INTO development_checkpoints VALUES ('cp1',1,'2026-01-01','Teststyrka','Testfokus','2026-01-01','NOT EXPOSED'),('cp2',2,'2026-01-01','Other','Other','2026-01-01','Other');
INSERT INTO player_skill_status VALUES(1,'bollkontroll-1','training','2026-01-01'),(2,'bollkontroll-1','done','2026-01-01');
INSERT INTO development_activities VALUES
 ('a1','2026-01-01','12:00','training','svenskalag_browser',1,'2026-01-01'),
 ('a2','2026-01-02','12:00','training','svenskalag_browser',1,'2026-01-02'),
 ('a3','2026-01-03','12:00','training','svenskalag_browser',1,'2026-01-03'),
 ('a4','2026-01-04','12:00','training','svenskalag_browser',1,'2026-01-04'),
 ('other','2026-01-05','12:00','training','svenskalag_browser',2,'2026-01-05'),
 ('legacy','2026-01-01','12:00','training','svenskalag_attendance',NULL,'2026-01-01');
INSERT INTO development_activity_participation VALUES
 ('a1',1,'present','svenskalag_browser','2026-01-01'),
 ('a2',1,'absent','svenskalag_browser','2026-01-02'),
 ('a3',1,'unknown','svenskalag_browser','2026-01-03'),
 ('other',1,'absent','svenskalag_browser','2026-01-05'),
 ('legacy',1,'absent','svenskalag_attendance','2026-01-01');
INSERT INTO training_plans VALUES
 ('11111111-1111-4111-8111-111111111111',1,'{"title":"Eget testpass","date":"2026-01-01","blocks":[{"minutes":10,"diagram":{"title":"Övning","notes":"Testinstruktion","objects":[]}}]}',1,now()),
 ('22222222-2222-4222-8222-222222222222',2,'{"title":"Annans pass","date":"2026-01-01","blocks":[]}',1,now());
'''

FIXTURE += """
ALTER TABLE matches ADD COLUMN callup_accepted_count int;
ALTER TABLE matches ADD COLUMN callup_declined_count int;
ALTER TABLE matches ADD COLUMN callup_pending_count int;
ALTER TABLE matches ADD COLUMN callup_source text;
ALTER TABLE development_activities ADD COLUMN title text DEFAULT 'Testträning';
CREATE TABLE match_roster(match_id int,player_id int,callup_status text,selection_status text,updated_at timestamptz);
CREATE TABLE development_activity_callups(activity_id text,player_id int,attendance_status text);
CREATE TABLE development_activity_callup_summaries(activity_id text,accepted_count int,declined_count int,pending_count int,source text,updated_at text);
INSERT INTO match_roster VALUES (1,1,'accepted','selected',now()),(1,2,'declined','selected',now()),(1,3,'pending',NULL,now()),(3,1,NULL,'selected',now()),(2,2,'accepted','selected',now());
UPDATE matches SET callup_accepted_count=2,callup_declined_count=1,callup_pending_count=1,callup_source='svenskalag_browser' WHERE id=1;
INSERT INTO development_activity_callups VALUES ('a1',1,'present'),('a1',2,'absent'),('a1',3,'unknown'),('other',2,'present');
INSERT INTO development_activity_callup_summaries VALUES ('a1',1,1,1,'svenskalag_browser','2026-01-01');
"""


class Integration(unittest.TestCase):
    def test_01_team_and_inactive_scope(self):
        self.assertEqual([r['id'] for r in server.hitta_spelare()['players']],[1])
        for id in [2,3,4,999]:
            with self.assertRaises(ValueError): server.spelarutveckling(id)

    def test_02_matches_and_future_score(self):
        rows=server.matcher('2026-01-01','2026-01-31')['matches']
        self.assertEqual([r['id'] for r in rows],[1,3])
        self.assertIsNone(rows[0]['our_score'])
        self.assertEqual(rows[1]['our_score'],2)

    def test_03_development_minimisation(self):
        r=server.spelarutveckling(1)
        self.assertEqual(r['latest_checkpoint']['focus_note'],'Testfokus')
        self.assertNotIn('wellbeing_note',r['latest_checkpoint'])
        self.assertEqual(r['recorded_skills'][0]['label'],'Stanna bollen med sulan')

    def test_04_attendance_unknown_and_source(self):
        r=server.traningsnarvaro('2026-01-01','2026-01-31',1)
        self.assertEqual(r['coverage']['activities'],4)
        p=r['players'][0]
        self.assertEqual((p['present'],p['absent'],p['unknown'],p['activities_without_row'],p['rate_percent']),(1,1,1,1,50.0))
        empty=server.traningsnarvaro('2025-01-01','2025-01-31',1)
        self.assertIsNone(empty['players'][0]['rate_percent'])
        with self.assertRaises(ValueError): server.traningsnarvaro('2026-01-01','2026-01-31',2)

    def test_05_plan_owner(self):
        self.assertEqual(len(server.traningspass()['plans']),1)
        self.assertEqual(server.traningspass('22222222-2222-4222-8222-222222222222')['plans'],[])
        p=server.traningspass('11111111-1111-4111-8111-111111111111')['plans'][0]
        self.assertEqual(p['exercises'][0]['instructions'],'Testinstruktion')
        self.assertNotIn('objects',p['exercises'][0])

    def test_06_invalid_input_and_injection(self):
        self.assertEqual(server.hitta_spelare("' OR 1=1 --")['players'],[])
        for v in [0,-1,True,"1 OR 1=1"]:
            with self.assertRaises(ValueError): server.spelarutveckling(v)
        for a,b in [('2026-02-30','2026-03-01'),('2026-03-02','2026-03-01'),('2020-01-01','2026-01-01')]:
            with self.assertRaises(ValueError): server.matcher(a,b)

    def test_07_database_denies_base_tables_and_writes(self):
        dsn=json.loads(CONFIG.read_text())['dsn']
        for q in ['SELECT * FROM public.players','SELECT * FROM bsk_hermes.binding',
                  'SELECT * FROM bsk_hermes.access','SELECT wellbeing_note FROM bsk_hermes.checkpoints',
                  'UPDATE public.players SET name=name','DELETE FROM bsk_hermes.players']:
            with psycopg.connect(dsn,autocommit=True) as c:
                c.execute('SET default_transaction_read_only=off')
                with self.assertRaises(psycopg.Error): c.execute(q)

    def test_08_permission_override_and_revocation(self):
        admin("DELETE FROM user_roles WHERE user_id=1; INSERT INTO user_roles VALUES(1,'coach'); INSERT INTO user_permissions VALUES(1,'view_private_player_data',0)")
        try:
            self.assertEqual(len(server.hitta_spelare()['players']),1)
            with self.assertRaises(ValueError): server.spelarutveckling(1)
            admin('UPDATE users SET active=0 WHERE id=1')
            with self.assertRaises(ValueError): server.status()
            admin('UPDATE users SET active=1 WHERE id=1; INSERT INTO user_group_access VALUES(1,2)')
            with self.assertRaises(ValueError): server.status()
            admin("DELETE FROM user_group_access; DELETE FROM user_roles WHERE user_id=1; INSERT INTO user_roles VALUES(1,'parent')")
            with self.assertRaises(ValueError): server.status()
        finally:
            admin("UPDATE users SET active=1; DELETE FROM user_permissions; DELETE FROM user_group_access; DELETE FROM user_roles WHERE user_id=1; INSERT INTO user_roles VALUES(1,'admin')")

    def test_callups_guests_and_selection_are_separate(self):
        r=server.kallelsesvar('match:1')
        self.assertEqual([p['player_id'] for p in r['players']['accepted']],[1])
        self.assertEqual([p['player_id'] for p in r['players']['declined']],[2])
        self.assertEqual(len(r['players']['selected']),2)
        self.assertEqual(r['source_counts']['accepted'],2)
        self.assertFalse(r['named_counts_match_source'])
        with self.assertRaises(ValueError): server.spelarutveckling(2)
        missing=server.kallelsesvar('match:3')
        self.assertEqual(len(missing['players']['no_response_data']),1)
        self.assertEqual(missing['players']['accepted'],[])
        self.assertIsNone(missing['named_counts_match_source'])

    def test_training_responses_not_actual_attendance(self):
        r=server.kallelsesvar('training:a1')
        self.assertEqual(r['named_counts'],{'accepted':1,'declined':1,'pending':1})
        self.assertTrue(r['named_counts_match_source'])
        # a2 has actual absence but no invitation responses: do not invent a no.
        empty=server.kallelsesvar('training:a2')
        self.assertEqual(empty['players']['declined'],[])
        self.assertIsNone(empty['named_counts_match_source'])

    def test_activity_scope_validation_and_permission(self):
        events=server.aktiviteter('2026-01-01','2026-01-31')['events']
        self.assertNotIn('match:2',[e['id'] for e in events])
        self.assertNotIn('training:other',[e['id'] for e in events])
        for event in ['match:2','training:other','match:999',"match:1' OR 1=1"]:
            with self.assertRaises(ValueError): server.kallelsesvar(event)
        with self.assertRaises(ValueError): server.aktiviteter(typ='other')
        admin("DELETE FROM user_roles WHERE user_id=1; INSERT INTO user_roles VALUES(1,'coach'); INSERT INTO user_permissions VALUES(1,'view_matches',0)")
        try:
            with self.assertRaises(ValueError): server.kallelsesvar('match:1')
        finally:
            admin("DELETE FROM user_permissions; DELETE FROM user_roles WHERE user_id=1; INSERT INTO user_roles VALUES(1,'admin')")

    def test_09_mcp_protocol(self):
        async def check():
            async with Client(server.mcp) as c:
                listed=(await c.list_tools()).tools
                self.assertEqual(len(listed),8)
                self.assertTrue(all(t.annotations.read_only_hint for t in listed))
                for name,args in [('status',{}),('hitta_spelare',{}),('matcher',{'fran':'2026-01-01','till':'2026-01-31'}),('spelarutveckling',{'spelar_id':1}),('traningsnarvaro',{'fran':'2026-01-01','till':'2026-01-31'}),('traningspass',{}),('aktiviteter',{'fran':'2026-01-01','till':'2026-01-31'}),('kallelsesvar',{'aktivitets_id':'match:1'})]:
                    result=await c.call_tool(name,args)
                    self.assertFalse(result.is_error,name)
                bad=await c.call_tool('spelarutveckling',{'spelar_id':2})
                self.assertTrue(bad.is_error)
        asyncio.run(check())


if __name__=='__main__':
    try:
        admin(f'CREATE DATABASE {DB}', 'bsk')
        admin(f"CREATE ROLE {ROLE} LOGIN PASSWORD '{PW}'",'bsk')
        admin(FIXTURE)
        view_sql=Path(__file__).with_name('views.sql').read_text().replace('bsk_hermes_read',ROLE).replace(':user_id','1').replace(':group_id','1')
        admin(view_sql)
        admin(Path(__file__).with_name('callups.sql').read_text().replace('bsk_hermes_read',ROLE))
        CONFIG.touch(mode=0o600)
        CONFIG.write_text(json.dumps({'dsn':f'postgresql://{ROLE}:{PW}@127.0.0.1:5433/{DB}'}))
        os.environ['BSK_HERMES_CONFIG']=str(CONFIG)
        result=unittest.main(exit=False)
        if not result.result.wasSuccessful(): raise SystemExit(1)
    finally:
        CONFIG.unlink(missing_ok=True)
        admin(f'DROP DATABASE IF EXISTS {DB} WITH (FORCE)','bsk')
        admin(f'DROP ROLE IF EXISTS {ROLE}','bsk')
