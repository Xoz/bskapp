-- Skadeuppgifter kan vara känsliga hälsouppgifter. Planlinjen samlar inte in
-- dem utan ett separat föreningsbeslut; äldre pilotvärden blir frånvaro.
UPDATE training_session_attendance SET status = 'absent' WHERE status = 'injured';

ALTER TABLE training_session_attendance
  ALTER COLUMN status TYPE text USING status::text;

DROP TYPE attendance_status;
CREATE TYPE attendance_status AS ENUM ('present','absent','late','partial','trial');

ALTER TABLE training_session_attendance
  ALTER COLUMN status TYPE attendance_status USING status::attendance_status;
