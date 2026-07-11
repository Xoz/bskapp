-- Milstolpe 5: träningsläge + genomfört pass. Lägger till block-meta och
-- separata conducted_*-tabeller (genomfört pass skilt från planerat).

ALTER TABLE training_session_blocks ADD COLUMN IF NOT EXISTS coach text;
ALTER TABLE training_session_blocks ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE training_session_blocks ADD COLUMN IF NOT EXISTS equipment text[] NOT NULL DEFAULT '{}';
ALTER TABLE training_session_blocks ADD COLUMN IF NOT EXISTS group_name text;

DO $$ BEGIN
  CREATE TYPE block_difficulty AS ENUM ('too_easy','ok','too_hard');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE block_conduct_status AS ENUM ('completed','skipped');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS conducted_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES training_sessions ON DELETE CASCADE,
  conducted_at timestamptz NOT NULL DEFAULT now(),
  overall_note text NOT NULL DEFAULT '',
  level_feedback text NOT NULL DEFAULT '',
  followup text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conducted_session_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conducted_session_id uuid NOT NULL REFERENCES conducted_sessions ON DELETE CASCADE,
  block_id uuid REFERENCES training_session_blocks ON DELETE SET NULL,
  sort_order int NOT NULL,
  status block_conduct_status NOT NULL,
  actual_minutes int NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  difficulty block_difficulty,
  replaced_exercise_id uuid REFERENCES exercises ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS conducted_sessions_session_idx ON conducted_sessions(session_id);