-- Additive migration. Run after views.sql, including on first installation.
CREATE VIEW bsk_hermes.events WITH (security_barrier=true) AS
SELECT 'match:'||m.id AS id,'match'::text AS kind,m.date,m.start_time,
 m.opponent AS title,m.location,m.id AS match_id,
 m.callup_accepted_count AS accepted_count,m.callup_declined_count AS declined_count,
 m.callup_pending_count AS pending_count,m.callup_source AS source,
 (SELECT max(r.updated_at)::text FROM public.match_roster r WHERE r.match_id=m.id) AS data_updated_at
FROM public.matches m JOIN bsk_hermes.matches allowed ON allowed.id=m.id
UNION ALL
SELECT 'training:'||da.id,'traning',da.activity_date,da.start_time,da.title,
 NULL::text,NULL::integer,s.accepted_count,s.declined_count,s.pending_count,
 COALESCE(s.source,da.external_source),s.updated_at
FROM public.development_activities da
LEFT JOIN public.development_activity_callup_summaries s ON s.activity_id=da.id
WHERE da.activity_type='training' AND EXISTS
 (SELECT 1 FROM bsk_hermes.access a WHERE a.key='view_matches' AND a.allowed AND a.group_id=da.group_id);

-- Guest names belong to the authorized event; this grants no access to their
-- private profile or other events. No membership filter may hide invited guests.
CREATE VIEW bsk_hermes.callups WITH (security_barrier=true) AS
SELECT e.id AS event_id,p.id AS player_id,p.name,r.callup_status AS response,
 r.selection_status='selected' AS selected
FROM bsk_hermes.events e JOIN public.match_roster r ON e.match_id=r.match_id
JOIN public.players p ON p.id=r.player_id
WHERE e.kind='match' AND (r.callup_status IS NOT NULL OR r.selection_status='selected')
AND EXISTS (SELECT 1 FROM bsk_hermes.access WHERE key='view_players' AND allowed)
UNION ALL
SELECT e.id,p.id,p.name,
 CASE c.attendance_status WHEN 'present' THEN 'accepted' WHEN 'absent' THEN 'declined'
 WHEN 'unknown' THEN 'pending' ELSE NULL END,false
FROM bsk_hermes.events e JOIN public.development_activity_callups c ON e.id='training:'||c.activity_id
JOIN public.players p ON p.id=c.player_id
WHERE e.kind='traning'
AND EXISTS (SELECT 1 FROM bsk_hermes.access WHERE key='view_players' AND allowed);
GRANT SELECT ON bsk_hermes.events,bsk_hermes.callups TO bsk_hermes_read;
