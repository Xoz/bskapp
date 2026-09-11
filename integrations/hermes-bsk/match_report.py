"""Deterministic, read-only match briefing. stdout is delivered by Hermes cron."""
from datetime import datetime, timedelta, timezone
import argparse
import json
import server

UTC=timezone.utc

def kickoff(match):
    try:
        raw=datetime.fromisoformat(match['date']+'T'+match['start_time'])
        if raw.tzinfo is not None: return None
        local=raw.replace(tzinfo=server.TZ)
        # Reject nonexistent/ambiguous local times instead of guessing around DST.
        if local.astimezone(UTC).astimezone(server.TZ).replace(tzinfo=None)!=raw: return None
        if local.utcoffset()!=raw.replace(tzinfo=server.TZ,fold=1).utcoffset(): return None
        return local.astimezone(UTC)
    except (ValueError,TypeError,KeyError): return None


def schedule_data(now):
    with server.database('view_matches') as (conn,group):
        rows=conn.execute('SELECT * FROM bsk_hermes.matches WHERE date BETWEEN %s AND %s AND finished=0 ORDER BY date,start_time,id LIMIT 1001',
          (now.astimezone(server.TZ).date().isoformat(),(now+timedelta(days=60)).astimezone(server.TZ).date().isoformat())).fetchall()
        if len(rows)>1000: raise ValueError('För många kommande matcher för en komplett schemaläggning.')
        valid=[];missing=[]
        for row in rows:
            time=kickoff(row)
            if time is None: missing.append(row['id'])
            elif time>now: valid.append({'match_id':row['id'],'kickoff':time.isoformat()})
        return {'matches':valid,'missing_time':missing}


def clean(value):
    return ' '.join(str(value or '').split())


def format_report(match, replies, lineup, formation, now):
    start=kickoff(match);late=now > start-timedelta(hours=24)+timedelta(minutes=5)
    local=start.astimezone(server.TZ)
    groups=replies['players'];accepted={p['player_id'] for p in groups['accepted']}
    statuses={p['player_id']:label for key,label in [('accepted','Ja'),('declined','Nej'),('pending','Obesvarat'),('no_response_data','Svar saknas')] for p in groups[key]}
    selected={p['player_id'] for p in groups['selected']}
    unconfirmed=selected-accepted
    lines=[('⚽ Matchrapport – mindre än 24 timmar kvar' if late else '⚽ Matchrapport – 24 timmar före'),
       f"{replies['group']} – {clean(match['opponent'])}",local.strftime('%Y-%m-%d kl. %H:%M')]
    if match.get('location'): lines.append(clean(match['location']))
    lines+=['',f'Uttagna: {len(selected)} · Tackat ja bland uttagna: {len(selected & accepted)}']
    if not selected: lines.append('⚠️ Ingen uttagen trupp är sparad. Trupp och eventuella reserver behöver kontrolleras.')
    elif unconfirmed:
        lines.append(f'⚠️ {len(unconfirmed)} uttagna saknar ja-svar. Kontrollera återbud/obesvarat och behovet av reserver.')
    else: lines.append('Alla uttagna har tackat ja. Det är kallelsesvar, inte en garanti för närvaro.')
    by_id={p['player_id']:p for p in lineup}
    starters=[p for p in groups['selected'] if by_id.get(p['player_id'],{}).get('lineup_x') is not None and by_id.get(p['player_id'],{}).get('lineup_y') is not None]
    starter_ids={p['player_id'] for p in starters}
    remaining=[p for p in groups['selected'] if p['player_id'] not in starter_ids]
    def player_line(p):
        position=clean(by_id.get(p['player_id'],{}).get('selected_position'))
        return f"• {clean(p['name'])}{' ('+position+')' if position else ''} – {statuses.get(p['player_id'],'Svar saknas')}"
    if formation: lines+=['',f'Sparad formation: {clean(formation)}']
    if starters:
        lines+=['','Sparad startuppställning:']+[player_line(p) for p in starters]
        if remaining: lines+=['','Övriga uttagna (ej placerade i startuppställningen):']+[player_line(p) for p in remaining]
    else:
        lines+=['','Ingen startuppställning är sparad.']
        if remaining: lines+=['Uttagen trupp:']+[player_line(p) for p in remaining]
    for label,key in [('Alla som tackat ja','accepted'),('Tackat nej','declined'),('Inte svarat','pending')]:
        names=', '.join(clean(p['name']) for p in groups[key])
        lines+=['',label+': '+(names or 'Inga registrerade namn.')]
    extra=[p for p in groups['accepted'] if p['player_id'] not in selected]
    if extra: lines+=['','Tackat ja men inte uttagna: '+', '.join(clean(p['name']) for p in extra)]
    if replies['named_counts_match_source'] is not True or replies['truncated']:
        totals=replies['source_counts']
        lines+=['','⚠️ Namnlistan kan vara ofullständig. Källtotaler ja/nej/obesvarat: '+ '/'.join(str(totals[k]) if totals[k] is not None else 'saknas' for k in ('accepted','declined','pending'))]
    lines+=['',f"Uppgifter hämtade {now.astimezone(server.TZ).strftime('%Y-%m-%d %H:%M')}. Senaste synk kan ligga tidigare.",f'{server.BASE}/matcher/{match["id"]}']
    return '\n'.join(lines)


def report(match_id,expected,now,preview=False):
    with server.database('view_players') as (conn,group):
        match=conn.execute('SELECT * FROM bsk_hermes.matches WHERE id=%s',(server.positive(match_id),)).fetchone()
        if not match or match['finished']: return ''
        start=kickoff(match)
        if not start or (expected and start!=datetime.fromisoformat(expected)): return ''
        if not preview and (now<start-timedelta(hours=24) or now>=start): return ''
        detail=conn.execute('SELECT * FROM bsk_hermes.match_details WHERE id=%s',(match_id,)).fetchone()
        lineup=conn.execute('SELECT * FROM bsk_hermes.lineup WHERE match_id=%s ORDER BY name,player_id',(match_id,)).fetchall()
    replies=server.kallelsesvar(f'match:{match_id}')
    return format_report(match,replies,lineup,detail['formation'] if detail else '',now)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--schedule',action='store_true');p.add_argument('--match',type=int);p.add_argument('--expected');p.add_argument('--preview',action='store_true');a=p.parse_args()
    now=datetime.now(UTC)
    if a.schedule: print(json.dumps(schedule_data(now)))
    elif a.match:
        result=report(a.match,a.expected,now,a.preview)
        if result: print(result)
    else: p.error('Choose --schedule or --match')
