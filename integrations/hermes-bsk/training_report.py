"""Read-only training reports due within fifteen minutes, using Swedish local time."""
from datetime import datetime, timedelta, timezone
import json
import server
from match_report import kickoff, clean

UTC = timezone.utc


def format_report(reply, now):
    event = reply['event']
    lines = [f"⚽ {clean(reply['group'])} – träning",
             f"📅 {event['date']} kl. {event['start_time']}"]
    for key, label in [('accepted', 'Tackat ja'), ('declined', 'Tackat nej'),
                       ('pending', 'Obesvarat'), ('no_response_data', 'Svar saknas')]:
        players = reply['players'][key]
        lines += ['', f'{label} ({len(players)}):']
        lines += ['• ' + clean(p['name']) for p in players] or ['Inga registrerade namn.']
    if reply['named_counts_match_source'] is not True or reply['truncated']:
        totals = '/'.join(str(reply['source_counts'][k]) if reply['source_counts'][k] is not None else 'saknas'
                          for k in ('accepted', 'declined', 'pending'))
        lines += ['', '⚠️ Namnlistan kan vara ofullständig. Källtotaler ja/nej/obesvarat: ' + totals]
    lines += ['', 'Ja avser kallelsesvar, inte registrerad närvaro.',
              f"Hämtat {now.astimezone(server.TZ).strftime('%Y-%m-%d %H:%M')}. Senaste synk kan ligga tidigare.",
              event['url']]
    return '\n'.join(lines)


def due_reports(now):
    today = now.astimezone(server.TZ).date()
    data = server.aktiviteter(today.isoformat(), (today + timedelta(days=1)).isoformat(), 'traning')
    if data['truncated']:
        raise RuntimeError('BSK:s träningslista är för stor för en fullständig kontroll.')
    reports = []
    for event in data['events']:
        start = kickoff(event)
        if not start or not start - timedelta(minutes=15) <= now < start:
            continue
        reply = server.kallelsesvar(event['id'])
        # Recheck fresh event time: moved activities must not use a stale time.
        if kickoff(reply['event']) != start:
            continue
        reports.append({'id': event['id'], 'start': start.isoformat(),
                        'text': format_report(reply, now)})
    return reports


if __name__ == '__main__':
    print(json.dumps(due_reports(datetime.now(UTC)), ensure_ascii=False))
