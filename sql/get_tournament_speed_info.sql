-- get_tournament_speed_info expone el ranking de velocidad de pista de un
-- torneo (y el rango completo min/max de todos los torneos) para poder
-- pintarlo junto al nombre del torneo en el cuadro principal, sin depender
-- de jugadores concretos (a diferencia de get_extended_prematch_summary).
-- estratego_v1 no esta expuesto via PostgREST (solo public/graphql_public),
-- por eso hace falta este RPC puente en vez de consultar la tabla directo.
CREATE OR REPLACE FUNCTION public.get_tournament_speed_info(
  p_tourney_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $function$
DECLARE
  v_speed_id TEXT;
  v_speed_rank INT;
  v_speed_min INT;
  v_speed_max INT;
BEGIN
  v_speed_id := split_part(p_tourney_id, '-', 2);

  SELECT speed_rank
    INTO v_speed_rank
    FROM estratego_v1.court_speed_ranking_norm
    WHERE tourney_id = v_speed_id;

  SELECT MIN(speed_rank), MAX(speed_rank)
    INTO v_speed_min, v_speed_max
    FROM estratego_v1.court_speed_ranking_norm;

  RETURN jsonb_build_object(
    'speed_rank', v_speed_rank,
    'speed_min', v_speed_min,
    'speed_max', v_speed_max
  );
END;
$function$;
