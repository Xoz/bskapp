"""Private Hermes no-agent job. Empty output is quiet; state contains no player data."""
from pathlib import Path
from datetime import datetime, timedelta, timezone
import fcntl
import json
import os
import subprocess
from schedule_matches import reader_args

UTC = timezone.utc


def consume(reports, state, now):
    sent = state.setdefault('sent', {})
    output = []
    for report in reports:
        start = datetime.fromisoformat(report['start'])
        key = report['id'] + '|' + start.isoformat()
        if key in sent or not start - timedelta(minutes=15) <= now < start:
            continue
        output.append(report['text'])
        sent[key] = start.isoformat()
    state['sent'] = {key: value for key, value in sent.items()
                     if datetime.fromisoformat(value) > now - timedelta(days=7)}
    return '\n\n──────────\n\n'.join(output)


def main():
    from hermes_constants import get_hermes_home
    folder = get_hermes_home() / 'bsk-training-reports'
    folder.mkdir(mode=0o700, exist_ok=True)
    with (folder / 'state.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        command = reader_args()
        command[-1] = '/opt/bsk/hermes-mcp/training_report.py'
        result = subprocess.run(command, capture_output=True, text=True, timeout=30)
        if result.returncode:
            raise RuntimeError('BSK:s träningsrapport kunde inte hämtas. Kontrollera BSK.')
        statefile = folder / 'state.json'
        state = json.loads(statefile.read_text()) if statefile.exists() else {}
        output = consume(json.loads(result.stdout), state, datetime.now(UTC))
        # At-most-once intent: record before handing stdout to the native delivery queue.
        tmp = statefile.with_suffix('.tmp')
        tmp.write_text(json.dumps(state)); tmp.chmod(0o600)
        os.replace(tmp, statefile)
        if output:
            print(output)


if __name__ == '__main__':
    main()
