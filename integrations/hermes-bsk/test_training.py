"""Synthetic tests: no messages sent and no production data read."""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import io
import unittest
import training_report as report
from training_alert import consume

UTC = timezone.utc


def reply(date='2026-09-12', time='10:07'):
    return {'group': 'Testlag', 'event': {'id': 'training:test', 'date': date,
            'start_time': time, 'url': 'https://bsk2014.se/idag'},
            'players': {'accepted': [{'player_id': 1, 'name': 'Testspelare'}],
                        'declined': [], 'pending': [], 'no_response_data': []},
            'named_counts_match_source': False, 'truncated': False,
            'source_counts': {'accepted': 2, 'declined': 0, 'pending': 0}}


class Training(unittest.TestCase):
    def fetch(self, now, data):
        with patch.object(report.server, 'aktiviteter', return_value={'events': [data['event']], 'truncated': False}), \
             patch.object(report.server, 'kallelsesvar', return_value=data):
            return report.due_reports(now)

    def test_weekend_arbitrary_time_utf8_and_coverage(self):
        now = datetime(2026, 9, 12, 7, 52, tzinfo=UTC)
        data = self.fetch(now, reply())
        self.assertEqual(len(data), 1)
        text = data[0]['text']
        self.assertIn('Testspelare', text)
        self.assertIn('Namnlistan kan vara ofullständig', text)
        self.assertIn('📅', text.encode('utf-8').decode('utf-8'))
        self.assertEqual(self.fetch(now - timedelta(seconds=1), reply()), [])
        self.assertEqual(self.fetch(now + timedelta(minutes=15), reply()), [])

    def test_winter_and_midnight(self):
        self.assertEqual(len(self.fetch(datetime(2026, 12, 12, 17, 15, tzinfo=UTC), reply('2026-12-12', '18:30'))), 1)
        self.assertEqual(len(self.fetch(datetime(2026, 9, 12, 21, 55, tzinfo=UTC), reply('2026-09-13', '00:10'))), 1)

    def test_moved_training(self):
        now = datetime(2026, 9, 12, 7, 52, tzinfo=UTC)
        with patch.object(report.server, 'aktiviteter', return_value={'events': [reply()['event']], 'truncated': False}), \
             patch.object(report.server, 'kallelsesvar', return_value=reply(time='11:07')):
            self.assertEqual(report.due_reports(now), [])

    def test_duplicate_restart_and_multiple_trainings(self):
        now = datetime(2026, 9, 12, 7, 52, tzinfo=UTC)
        reports = self.fetch(now, reply())
        reports.append({**reports[0], 'id': 'training:second'})
        state = {}
        self.assertEqual(consume(reports, state, now).count('⚽'), 2)
        import json
        restored = json.loads(json.dumps(state))
        self.assertEqual(consume(reports, restored, now + timedelta(minutes=1)), '')
        self.assertNotIn('Testspelare', json.dumps(state))
        self.assertEqual(consume(reports, {}, now + timedelta(minutes=15)), '')

    def test_truncated_list_fails_visibly(self):
        with patch.object(report.server, 'aktiviteter', return_value={'events': [], 'truncated': True}):
            with self.assertRaises(RuntimeError):
                report.due_reports(datetime.now(UTC))


if __name__ == '__main__':
    unittest.main()
