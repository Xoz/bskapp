"""One-time VPS installation. Run as root after isolated tests; no app deployment.
The role and views are installed transactionally. Existing installations are not overwritten.
"""
import argparse
import json
import os
from pathlib import Path
import pwd
import secrets
import shutil
import subprocess
from datetime import datetime, timezone

p=argparse.ArgumentParser()
p.add_argument('--user-id',required=True,type=int)
p.add_argument('--group-id',required=True,type=int)
a=p.parse_args()
assert os.geteuid()==0 and a.user_id>0 and a.group_id>0
ROOT=Path(__file__).resolve().parent
TARGET=Path('/opt/bsk/hermes-mcp')
CONF=Path('/etc/bsk-hermes/connection.json')

def db(query):
    r=subprocess.run(['docker','exec','-i','bsk-db','psql','-X','-v','ON_ERROR_STOP=1','-U','bsk','-d','bsk','-At'],input=query,text=True,capture_output=True)
    if r.returncode: raise RuntimeError('Database operation failed; credentials and SQL suppressed')
    return r.stdout.strip()

if TARGET.exists() or CONF.exists() or db("SELECT count(*) FROM pg_roles WHERE rolname='bsk_hermes_read'")!='0':
    raise SystemExit('Existing installation found. Use the documented update/rollback procedure.')
assert db(f"SELECT count(*) FROM users u CROSS JOIN groups g WHERE u.id={a.user_id} AND u.active=1 AND g.id={a.group_id} AND g.active=1 AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role IN ('admin','head_coach','coach'))")=='1'
baseline=db('SELECT (SELECT count(*) FROM players),(SELECT count(*) FROM matches),(SELECT count(*) FROM training_plans),(SELECT count(*) FROM development_checkpoints)')
try:
    account=pwd.getpwnam('bsk-hermes')
except KeyError:
    subprocess.run(['useradd','--system','--no-create-home','--shell','/usr/sbin/nologin','bsk-hermes'],check=True)
    account=pwd.getpwnam('bsk-hermes')
stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
release=Path('/opt/bsk/hermes-mcp-releases')/stamp
release.mkdir(parents=True)
for filename in ['server.py','views.sql','skills.json','requirements.in','requirements.lock','launch.sh','callups.sql','lineups.sql','match_report.py','schedule_matches.py']:
    shutil.copy2(ROOT/filename,release/filename)
subprocess.run(['/root/.local/bin/uv','venv',str(release/'.venv'),'--python','3.12'],check=True)
subprocess.run(['/root/.local/bin/uv','pip','sync','--python',str(release/'.venv/bin/python'),str(release/'requirements.lock'),'--quiet'],check=True)
CONF.parent.mkdir(mode=0o750,exist_ok=True)
os.chown(CONF.parent,0,account.pw_gid)
password=secrets.token_urlsafe(48)
views=(ROOT/'views.sql').read_text().replace(':user_id',str(a.user_id)).replace(':group_id',str(a.group_id))
# Password is generated server-side and sent only on psql stdin, never argv/logs.
db("BEGIN; CREATE ROLE bsk_hermes_read LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '"+password+"';\n"+views+'\n'+(ROOT/'callups.sql').read_text()+'\n'+(ROOT/'lineups.sql').read_text()+'\nCOMMIT;')
fd=os.open(CONF,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o640)
with os.fdopen(fd,'w') as f:
    json.dump({'dsn':'postgresql://bsk_hermes_read:'+password+'@127.0.0.1:5433/bsk'},f)
os.chown(CONF,0,account.pw_gid)
TARGET.symlink_to(release)
after=db('SELECT (SELECT count(*) FROM players),(SELECT count(*) FROM matches),(SELECT count(*) FROM training_plans),(SELECT count(*) FROM development_checkpoints)')
assert baseline==after,'Business table counts changed during installation; investigate concurrent work'
print(json.dumps({'release':str(release),'business_counts_unchanged':True,'counts':after,'user_id':a.user_id,'group_id':a.group_id}))
