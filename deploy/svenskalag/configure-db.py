#!/usr/bin/env python3
"""Skapar endast synkens DB-roll och skyddade miljöfil. Skriver aldrig hemligheter till stdout."""
from pathlib import Path
import os, secrets, shlex, subprocess
from urllib.parse import urlsplit, urlunsplit, quote
os.umask(0o077)
destination=Path('/etc/bsk-sync/sync.env')
if destination.exists():
    raise SystemExit('Synkmiljö finns redan; lämnas orörd.')
values={}
for line in Path('/etc/bsk/bsk.env').read_text().splitlines():
    if line.startswith('DATABASE_URL='):
        values['DATABASE_URL']=shlex.split(line.split('=',1)[1])[0]
base=urlsplit(values['DATABASE_URL'])
password=secrets.token_urlsafe(36)
sql=f"""
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='bsk_sync') THEN CREATE ROLE bsk_sync LOGIN; END IF; END $$;
ALTER ROLE bsk_sync PASSWORD '{password}';
GRANT CONNECT ON DATABASE bsk TO bsk_sync;
GRANT USAGE ON SCHEMA public TO bsk_sync;
GRANT SELECT ON groups, players TO bsk_sync;
GRANT SELECT, INSERT, UPDATE, DELETE ON settings TO bsk_sync;
GRANT SELECT, INSERT, UPDATE ON development_activities TO bsk_sync;
GRANT USAGE, SELECT ON SEQUENCE matches_id_seq TO bsk_sync;
GRANT SELECT, INSERT, UPDATE ON matches TO bsk_sync;
GRANT SELECT, INSERT ON match_players TO bsk_sync;
GRANT SELECT, INSERT, UPDATE ON match_roster TO bsk_sync;
GRANT SELECT, INSERT, UPDATE ON development_activity_participation TO bsk_sync;
GRANT SELECT, INSERT, UPDATE, DELETE ON development_activity_callups TO bsk_sync;
GRANT SELECT, INSERT, UPDATE ON development_activity_callup_summaries TO bsk_sync;
"""
subprocess.run(['docker','exec','-i','bsk-db','psql','-U','bsk','-d','bsk','-v','ON_ERROR_STOP=1'],input=sql,text=True,check=True,stdout=subprocess.DEVNULL)
host=base.hostname
if ':' in host: host=f'[{host}]'
netloc=f'bsk_sync:{quote(password)}@{host}' + (f':{base.port}' if base.port else '')
url=urlunsplit((base.scheme,netloc,base.path,base.query,''))
destination.parent.mkdir(mode=0o750,parents=True,exist_ok=True)
destination.write_text(f'DATABASE_URL={url}\nSVENSKALAG_STATE_FILE=/var/lib/bsk-sync/state.json\n')
os.chmod(destination,0o600)
print('Synkens databasroll och privata miljöfil är skapade.')
