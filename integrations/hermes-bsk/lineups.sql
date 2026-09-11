-- Additive read views and exclusion of cancelled matches.
CREATE OR REPLACE VIEW bsk_hermes.matches WITH (security_barrier=true) AS
SELECT m.id,m.date,m.start_time,m.opponent,m.home_away,m.match_type,m.location,
 m.finished,m.our_score,m.opponent_score,m.source
FROM public.matches m JOIN public.groups g ON g.id=m.group_id
WHERE COALESCE(m.cancelled,0)=0 AND EXISTS (SELECT 1 FROM bsk_hermes.access a WHERE a.key='view_matches' AND a.allowed AND a.group_id IN (g.id,g.parent_id));

CREATE VIEW bsk_hermes.match_details WITH (security_barrier=true) AS
SELECT m.id,m.formation FROM public.matches m JOIN bsk_hermes.matches a ON a.id=m.id
WHERE EXISTS (SELECT 1 FROM bsk_hermes.access WHERE key='view_players' AND allowed);
CREATE VIEW bsk_hermes.lineup WITH (security_barrier=true) AS
SELECT r.match_id,p.id AS player_id,p.name,r.selected_position,r.lineup_x,r.lineup_y
FROM public.match_roster r JOIN bsk_hermes.matches m ON m.id=r.match_id
JOIN public.players p ON p.id=r.player_id
WHERE r.selection_status='selected'
AND EXISTS (SELECT 1 FROM bsk_hermes.access WHERE key='view_players' AND allowed);
GRANT SELECT ON bsk_hermes.match_details,bsk_hermes.lineup TO bsk_hermes_read;
