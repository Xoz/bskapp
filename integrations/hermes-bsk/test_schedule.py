import os
from pathlib import Path
import sys
import tempfile
import unittest
from datetime import datetime,timedelta,timezone
from unittest.mock import patch
from schedule_matches import reconcile
from match_report import kickoff,format_report

UTC=timezone.utc
NOW=datetime(2026,9,10,12,tzinfo=UTC)

class Fake:
    def __init__(self): self.jobs=[];self.executions={}
    def list_jobs(self,include_disabled=False): return self.jobs
    def latest_execution(self,id): return self.executions.get(id)
    def create_job(self,**kw):
        job=dict(kw,id=str(len(self.jobs)+1),enabled=True,state='scheduled');self.jobs.append(job);return job
    def pause_job(self,id,reason):
        next(j for j in self.jobs if j['id']==id).update(enabled=False,state='paused',paused_reason=reason)

    def rearm_oneshot(self,id,run_at):
        next(j for j in self.jobs if j['id']==id).update(enabled=True,state='scheduled')

class ScheduleTests(unittest.TestCase):
    def test_exact_24h_duplicate_restart_and_move(self):
        with tempfile.TemporaryDirectory() as tmp:
            b=Fake();state={};data={'matches':[{'match_id':7,'kickoff':'2026-09-12T07:00:00+00:00'}],'missing_time':[]}
            planned,_=reconcile(data,state,b,Path(tmp),'local',NOW)
            self.assertEqual(planned[0]['run_at'],'2026-09-11T07:00:00+00:00')
            self.assertEqual(reconcile(data,state,b,Path(tmp),'local',NOW)[0],[])
            self.assertEqual(reconcile(data,{},b,Path(tmp),'local',NOW)[0],[])
            data['matches'][0]['kickoff']='2026-09-13T07:00:00+00:00'
            self.assertEqual(len(reconcile(data,state,b,Path(tmp),'local',NOW)[0]),1)
            self.assertFalse(b.jobs[0]['enabled'])
            reconcile({'matches':[],'missing_time':[]},state,b,Path(tmp),'local',NOW)
            self.assertFalse(b.jobs[1]['enabled'])
            data['matches'][0]['kickoff']='2026-09-12T07:00:00+00:00'
            reconcile(data,state,b,Path(tmp),'local',NOW)
            self.assertTrue(b.jobs[0]['enabled'])

    def test_late_added_and_never_replay_unknown(self):
        with tempfile.TemporaryDirectory() as tmp:
            b=Fake();state={};data={'matches':[{'match_id':1,'kickoff':(NOW+timedelta(hours=2)).isoformat()}],'missing_time':[]}
            planned,_=reconcile(data,state,b,Path(tmp),'local',NOW)
            self.assertEqual(planned[0]['run_at'],(NOW+timedelta(seconds=15)).isoformat())
            b.executions['1']={'status':'unknown'};b.jobs=[]
            self.assertEqual(reconcile(data,state,b,Path(tmp),'local',NOW)[0],[])
            b.executions={}
            self.assertEqual(len(reconcile(data,state,b,Path(tmp),'local',NOW)[0]),1)

    def test_completed_paused_jobs_not_repeated_and_missing_time_warning_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            b=Fake();state={};data={'matches':[{'match_id':1,'kickoff':(NOW+timedelta(days=2)).isoformat()}],'missing_time':[9]}
            _,warning=reconcile(data,state,b,Path(tmp),'local',NOW)
            self.assertIn('/matcher/9',warning)
            b.jobs[0].update(state='completed',enabled=False)
            self.assertEqual(reconcile(data,state,b,Path(tmp),'local',NOW),([],''))
            b.jobs[0].update(state='paused')
            self.assertEqual(reconcile(data,state,b,Path(tmp),'local',NOW)[0],[])

    def test_dst_real_elapsed_24_hours(self):
        for day,hour in [('2026-03-29','12:00'),('2026-10-25','12:00')]:
            start=kickoff({'date':day,'start_time':hour})
            self.assertEqual((start-(start-timedelta(hours=24))).total_seconds(),86400)
        self.assertIsNone(kickoff({'date':'2026-03-29','start_time':'02:30'}))
        self.assertIsNone(kickoff({'date':'2026-10-25','start_time':'02:30'}))
        self.assertIsNone(kickoff({'date':'2026-09-11','start_time':''}))

    def test_lineup_and_unconfirmed_conflict_not_invented_reserves(self):
        match={'id':1,'date':'2026-09-12','start_time':'09:00','opponent':'Testlag','location':''}
        replies={'group':'Test Gul','players':{'accepted':[{'player_id':1,'name':'Test A'},{'player_id':3,'name':'Test C'}],
         'declined':[{'player_id':2,'name':'Test B'}],'pending':[],'no_response_data':[],
         'selected':[{'player_id':1,'name':'Test A'},{'player_id':2,'name':'Test B'}]},'named_counts_match_source':True,'truncated':False}
        lineup=[{'player_id':1,'selected_position':'GK','lineup_x':.5,'lineup_y':.9}]
        text=format_report(match,replies,lineup,'2-3-1',NOW)
        self.assertIn('Sparad startuppställning:',text)
        self.assertIn('Test A (GK) – Ja',text)
        self.assertIn('Test B – Nej',text)
        self.assertIn('Tackat ja men inte uttagna: Test C',text)
        self.assertIn('1 uttagna saknar ja-svar',text)

    def test_z_native_hermes_job_registration_isolated(self):
        sys.path.insert(0,'/usr/local/lib/hermes-agent')
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ,{'HERMES_HOME':tmp}):
            from cron import jobs
            from cron.executions import latest_execution as read_latest_execution
            class Native:
                list_jobs=staticmethod(jobs.list_jobs);create_job=staticmethod(jobs.create_job)
                pause_job=staticmethod(jobs.pause_job);rearm_oneshot=staticmethod(jobs.rearm_oneshot);latest_execution=staticmethod(read_latest_execution)
            now=datetime.now(UTC)
            data={'matches':[{'match_id':1,'kickoff':(now+timedelta(days=2)).isoformat()}],'missing_time':[]}
            state={};scripts=Path(tmp)/'scripts'
            first,_=reconcile(data,state,Native,scripts,'local',now)
            self.assertEqual(len(first),1)
            job=jobs.list_jobs()[0]
            self.assertTrue(job['no_agent']);self.assertEqual(job['deliver'],'local')
            self.assertEqual(job['schedule']['kind'],'once')
            self.assertEqual(reconcile(data,state,Native,scripts,'local',now)[0],[])
            self.assertTrue((scripts/job['script']).exists())

if __name__=='__main__': unittest.main()
