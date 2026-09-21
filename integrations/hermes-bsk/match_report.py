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
    local=kickoff(match).astimezone(server.TZ)
    groups=replies['players']
    accepted=groups['accepted']
    accepted_ids={p['player_id'] for p in accepted}
    by_id={p['player_id']:p for p in lineup}
    placed={p['player_id'] for p in lineup if p.get('lineup_x') is not None and p.get('lineup_y') is not None}
    starters=[p for p in accepted if p['player_id'] in placed]
    others=[p for p in accepted if p['player_id'] not in placed]
    complete=replies['named_counts_match_source'] is True and not replies['truncated']
    lines=[f"⚽ {clean(replies['group'])} – {clean(match['opponent'])}",
           local.strftime('%d/%m kl. %H:%M')+(' · '+clean(match['location']) if match.get('location') else '')]
    lines+=['',f"{'Trupp' if complete else 'Kända ja-svar'}: {len(accepted)} spelare (tackat ja)."]
    def names(players,positions=False):
        parts=[]
        for p in players:
            position=clean(by_id.get(p['player_id'],{}).get('selected_position')) if positions else ''
            parts.append(clean(p['name'])+(' ('+position+')' if position else ''))
        return ', '.join(parts)
    if starters:
        lines.append('Sparad start'+(' ('+clean(formation)+')' if formation else '')+': '+names(starters,True))
        if others: lines.append('Övriga i truppen: '+names(others))
    elif accepted:
        lines.append(names(accepted))
        lines.append('Startuppställning återstår att planera.')
    else:
        lines.append('Inga bekräftade spelare att planera med ännu.')
    missing_starters=placed-accepted_ids
    if missing_starters:
        lines.append(f"⚠️ {len(missing_starters)} i sparad start saknar ja-svar; uppställningen behöver ses över.")
    pending=len(groups['pending'])
    if pending: lines.append(f'{pending} obesvarade – ingår inte i truppen ovan.')
    if not complete:
        total=replies['source_counts'].get('accepted')
        lines.append('⚠️ Namnlistan kan vara ofullständig.'+ (f' Källan anger {total} ja-svar.' if total is not None else ''))
    lines+=['',f'{server.BASE}/matcher/{match["id"]}']
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
