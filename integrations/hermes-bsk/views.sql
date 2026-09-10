-- Install as the existing BSK database owner. The login has no base-table access.
CREATE SCHEMA bsk_hermes;
REVOKE ALL ON SCHEMA bsk_hermes FROM PUBLIC;
CREATE TABLE bsk_hermes.binding (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  user_id integer NOT NULL REFERENCES public.users(id),
  group_id integer NOT NULL REFERENCES public.groups(id)
);
INSERT INTO bsk_hermes.binding(user_id,group_id) VALUES (:user_id,:group_id);

-- Mirror lib/auth.ts defaults/overrides; additionally require a staff role and
-- restrict even an admin to the explicitly configured team.
CREATE VIEW bsk_hermes.access WITH (security_barrier=true) AS
SELECT u.id AS user_id, g.id AS group_id, g.name AS group_name, permission.key,
  CASE WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin') THEN true
       ELSE COALESCE((SELECT p.allowed=1 FROM public.user_permissions p WHERE p.user_id=u.id AND p.permission_key=permission.key),
         EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND
           (r.role IN ('head_coach','coach') OR (r.role='leader' AND permission.key IN ('view_players','view_matches'))))) END AS allowed
FROM bsk_hermes.binding b JOIN public.users u ON u.id=b.user_id
JOIN public.groups g ON g.id=b.group_id
CROSS JOIN (VALUES ('view_players'),('view_matches'),('view_private_player_data'),('view_statistics'),('manage_evaluations')) permission(key)
WHERE u.active=1 AND g.active=1
AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role IN ('admin','head_coach','coach','leader'))
AND (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin')
 OR NOT EXISTS (SELECT 1 FROM public.user_group_access uga WHERE uga.user_id=u.id)
 OR EXISTS (SELECT 1 FROM public.user_group_access uga WHERE uga.user_id=u.id AND uga.group_id IN (g.id,g.parent_id)));

CREATE VIEW bsk_hermes.context WITH (security_barrier=true) AS
SELECT group_name, key AS permission, allowed FROM bsk_hermes.access;

CREATE VIEW bsk_hermes.players WITH (security_barrier=true) AS
SELECT p.id,p.name,p.jersey_number FROM public.players p
WHERE p.active=1 AND EXISTS (
 SELECT 1 FROM bsk_hermes.access a JOIN public.player_group_memberships pm ON pm.group_id=a.group_id
 WHERE a.key='view_players' AND a.allowed AND pm.player_id=p.id
 AND (pm.starts_on IS NULL OR pm.starts_on='' OR pm.starts_on <= to_char(now() AT TIME ZONE 'Europe/Stockholm','YYYY-MM-DD'))
 AND (pm.ends_on IS NULL OR pm.ends_on='' OR pm.ends_on >= to_char(now() AT TIME ZONE 'Europe/Stockholm','YYYY-MM-DD')));

CREATE VIEW bsk_hermes.matches WITH (security_barrier=true) AS
SELECT m.id,m.date,m.start_time,m.opponent,m.home_away,m.match_type,m.location,
 m.finished,m.our_score,m.opponent_score,m.source
FROM public.matches m JOIN public.groups g ON g.id=m.group_id
WHERE EXISTS (SELECT 1 FROM bsk_hermes.access a WHERE a.key='view_matches' AND a.allowed AND a.group_id IN (g.id,g.parent_id));

CREATE VIEW bsk_hermes.checkpoints WITH (security_barrier=true) AS
SELECT dc.id,dc.player_id,dc.date,dc.strengths,dc.focus_note,dc.created_at
FROM public.development_checkpoints dc JOIN bsk_hermes.players p ON p.id=dc.player_id
WHERE EXISTS (SELECT 1 FROM bsk_hermes.access WHERE key='view_private_player_data' AND allowed);

CREATE VIEW bsk_hermes.skills WITH (security_barrier=true) AS
SELECT s.player_id,s.skill_id,s.status,s.updated_at
FROM public.player_skill_status s JOIN bsk_hermes.players p ON p.id=s.player_id
WHERE EXISTS (SELECT 1 FROM bsk_hermes.access WHERE key='view_private_player_data' AND allowed);

-- Only the new, explicitly team-scoped browser source. Legacy imports lack
-- team attribution and may overlap. Unknown is never treated as absent.
CREATE VIEW bsk_hermes.training_attendance WITH (security_barrier=true) AS
SELECT p.id AS player_id,da.id AS activity_id,da.activity_date,da.start_time,
 dap.attendance_status,dap.updated_at
FROM public.development_activity_participation dap
JOIN public.development_activities da ON da.id=dap.activity_id
JOIN bsk_hermes.players p ON p.id=dap.player_id
WHERE da.activity_type='training' AND da.external_source='svenskalag_browser'
AND dap.source='svenskalag_browser'
AND EXISTS (SELECT 1 FROM bsk_hermes.access a WHERE a.key='view_statistics' AND a.allowed AND a.group_id=da.group_id);

CREATE VIEW bsk_hermes.training_activities WITH (security_barrier=true) AS
SELECT da.id,da.activity_date,da.updated_at
FROM public.development_activities da
WHERE da.activity_type='training' AND da.external_source='svenskalag_browser'
AND EXISTS (SELECT 1 FROM bsk_hermes.access a WHERE a.key='view_statistics' AND a.allowed AND a.group_id=da.group_id);

CREATE VIEW bsk_hermes.training_plans WITH (security_barrier=true) AS
SELECT t.id,t.document->>'title' AS title,t.document->>'date' AS date,t.revision,t.updated_at,
 (SELECT COALESCE(jsonb_agg(jsonb_build_object('title',b.value->'diagram'->>'title',
    'minutes',b.value->'minutes','instructions',b.value->'diagram'->>'notes') ORDER BY b.ordinality),'[]'::jsonb)
  FROM jsonb_array_elements(t.document->'blocks') WITH ORDINALITY b(value,ordinality)) AS exercises
FROM public.training_plans t
WHERE EXISTS (SELECT 1 FROM bsk_hermes.access a WHERE a.key='manage_evaluations' AND a.allowed AND a.user_id=t.created_by);

GRANT USAGE ON SCHEMA bsk_hermes TO bsk_hermes_read;
GRANT SELECT ON bsk_hermes.context,bsk_hermes.players,bsk_hermes.matches,
 bsk_hermes.checkpoints,bsk_hermes.skills,bsk_hermes.training_attendance,
 bsk_hermes.training_activities,bsk_hermes.training_plans TO bsk_hermes_read;
ALTER ROLE bsk_hermes_read SET default_transaction_read_only=on;
ALTER ROLE bsk_hermes_read SET statement_timeout='5s';
ALTER ROLE bsk_hermes_read SET search_path=bsk_hermes,pg_catalog;
