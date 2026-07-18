-- Milstolpe 6–7: match→träning, individuella mål, audit och säker import/export.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users;
ALTER TABLE development_goals ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS matches_team_start_idx ON matches(team_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS observations_team_created_idx ON match_observations(match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS development_goals_player_status_idx ON development_goals(player_id, status);
CREATE INDEX IF NOT EXISTS activity_logs_org_created_idx ON activity_logs(organization_id, created_at DESC);
