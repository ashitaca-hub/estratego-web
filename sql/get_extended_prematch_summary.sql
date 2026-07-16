-- get_extended_prematch_summary aggregates performance metrics for two players,
-- returning a JSON payload with weighted win probabilities and context.
CREATE OR REPLACE FUNCTION public.get_extended_prematch_summary(
  p_tourney_id  TEXT,
  p_year        INTEGER,
  player_a_id   INTEGER,
  player_b_id   INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $function$
DECLARE
  rec_a_year RECORD;
  rec_b_year RECORD;
  rec_a_surf RECORD;
  rec_b_surf RECORD;

  win_pct_year_a FLOAT;
  win_pct_year_b FLOAT;
  win_pct_surface_a FLOAT;
  win_pct_surface_b FLOAT;
  win_month_a FLOAT;
  win_month_b FLOAT;
  win_vs_rankband_a FLOAT;
  win_vs_rankband_b FLOAT;
  win_pct_fifth_set_a FLOAT;
  win_pct_fifth_set_b FLOAT;
  court_speed_score_a FLOAT;
  court_speed_score_b FLOAT;
  win_score_a FLOAT := 0;
  win_score_b FLOAT := 0;
  prob_a FLOAT := NULL;
  prob_b FLOAT := NULL;
  ranking_score_a FLOAT := NULL;
  ranking_score_b FLOAT := NULL;
  h2h_score_a FLOAT := NULL;
  h2h_score_b FLOAT := NULL;
  rest_score_a FLOAT := NULL;
  rest_score_b FLOAT := NULL;
  defend_component_a FLOAT := 0;
  defend_component_b FLOAT := 0;
  motivation_score_a FLOAT := 0;
  motivation_score_b FLOAT := 0;
  recent_matches_a INT := 0;
  recent_matches_b INT := 0;
  last_match_a_text TEXT;
  last_match_b_text TEXT;
  home_advantage_a BOOLEAN := FALSE;
  home_advantage_b BOOLEAN := FALSE;
  last_surface_a TEXT;
  last_surface_b TEXT;
  surface_change_a BOOLEAN := FALSE;
  surface_change_b BOOLEAN := FALSE;

  h2h_rec RECORD;
  country_a TEXT;
  country_b TEXT;
  tourney_surf TEXT;
  tourney_speed_id TEXT;
  tourney_speed_rank INT;
  tourney_speed_min INT;
  tourney_speed_max INT;
  tourney_country TEXT;
  ranking_a INT;
  ranking_b INT;
  days_since_a INT;
  days_since_b INT;
  tourney_month INT;
  w RECORD;
  denom FLOAT;

  alerts_a TEXT[] := ARRAY[]::TEXT[];
  alerts_b TEXT[] := ARRAY[]::TEXT[];
  last_results_a TEXT[] := NULL;
  last_results_b TEXT[] := NULL;
  points_current_a INT := NULL;
  points_current_b INT := NULL;
  points_prev_a INT := NULL;
  points_prev_b INT := NULL;
  points_delta_a INT := NULL;
  points_delta_b INT := NULL;

  round_last_a TEXT := NULL;
  round_last_b TEXT := NULL;
  defend_label_a TEXT := NULL;
  defend_label_b TEXT := NULL;
  tourney_base TEXT;
  tourney_base_int INT;
  prev_year INT;
  tourney_prev_id TEXT;
  meta_defend_round TEXT := NULL;
  tourney_level TEXT;

  -- Proximo torneo (el que el jugador disputo el año pasado justo despues
  -- de esta misma edicion) y si conviene avisar de ello.
  prev_event_last_date_a DATE;
  prev_event_last_date_b DATE;
  next_tourney_id_a TEXT;
  next_tourney_id_b TEXT;
  next_tourney_result_a TEXT;
  next_tourney_result_b TEXT;
  next_tourney_code_a TEXT;
  next_tourney_code_b TEXT;
  this_year_next_id_a TEXT;
  this_year_next_id_b TEXT;
  next_tourney_name_a TEXT;
  next_tourney_name_b TEXT;
  next_tourney_level_a TEXT;
  next_tourney_level_b TEXT;
  next_tourney_country_a TEXT;
  next_tourney_country_b TEXT;
  tourney_level_rank INT;
  next_level_rank_a INT;
  next_level_rank_b INT;
  next_is_upgrade_a BOOLEAN := FALSE;
  next_is_upgrade_b BOOLEAN := FALSE;
  next_is_home_a BOOLEAN := FALSE;
  next_is_home_b BOOLEAN := FALSE;

  -- Especializacion relativa por velocidad de pista (court_speed_edge) y
  -- rendimiento historico del jugador en ESTE torneo a traves de los años
  -- (tournament_history).
  win_pct_career_a FLOAT;
  win_pct_career_b FLOAT;
  court_speed_edge_a FLOAT;
  court_speed_edge_b FLOAT;
  tourney_hist_a RECORD;
  tourney_hist_b RECORD;
  tourney_hist_label_a TEXT := NULL;
  tourney_hist_label_b TEXT := NULL;
BEGIN
  -- Win % in current year
  SELECT COUNT(*) FILTER (WHERE winner_id = player_a_id) AS wins,
         COUNT(*) AS total
    INTO rec_a_year
    FROM estratego_v1.matches_full
    WHERE EXTRACT(YEAR FROM tourney_date) = p_year
      AND (winner_id = player_a_id OR loser_id = player_a_id);

  SELECT COUNT(*) FILTER (WHERE winner_id = player_b_id) AS wins,
         COUNT(*) AS total
    INTO rec_b_year
    FROM estratego_v1.matches_full
    WHERE EXTRACT(YEAR FROM tourney_date) = p_year
      AND (winner_id = player_b_id OR loser_id = player_b_id);

  win_pct_year_a := CASE WHEN rec_a_year.total > 0 THEN rec_a_year.wins * 1.0 / rec_a_year.total ELSE NULL END;
  win_pct_year_b := CASE WHEN rec_b_year.total > 0 THEN rec_b_year.wins * 1.0 / rec_b_year.total ELSE NULL END;

  -- Tournament surface and month
  SELECT surface,
         EXTRACT(MONTH FROM TO_DATE(tourney_date::TEXT, 'YYYYMMDD'))::INT,
         country,
         level
    INTO tourney_surf, tourney_month, tourney_country, tourney_level
    FROM estratego_v1.tournaments
    WHERE tourney_id = p_tourney_id;

  tourney_speed_id := split_part(p_tourney_id, '-', 2);

  SELECT speed_rank
    INTO tourney_speed_rank
    FROM estratego_v1.court_speed_ranking_norm
    WHERE tourney_id = tourney_speed_id;

  -- Rango completo de speed_rank (para poder ubicar este torneo en una barra
  -- lento->rapido en el frontend). estratego_v1 no esta expuesto via
  -- PostgREST (solo public/graphql_public), asi que el frontend no puede
  -- consultar esta tabla directamente: se expone aqui, dentro del RPC.
  SELECT MIN(speed_rank), MAX(speed_rank)
    INTO tourney_speed_min, tourney_speed_max
    FROM estratego_v1.court_speed_ranking_norm;

  -- Win % on surface over the last 5 seasons (incl. current year)
  SELECT COUNT(*) FILTER (WHERE winner_id = player_a_id) AS wins_surf,
         COUNT(*) AS total_surf
    INTO rec_a_surf
    FROM estratego_v1.matches_full
    WHERE EXTRACT(YEAR FROM tourney_date) BETWEEN (p_year - 4) AND p_year
      AND surface = tourney_surf
      AND (winner_id = player_a_id OR loser_id = player_a_id);

  SELECT COUNT(*) FILTER (WHERE winner_id = player_b_id) AS wins_surf,
         COUNT(*) AS total_surf
    INTO rec_b_surf
    FROM estratego_v1.matches_full
    WHERE EXTRACT(YEAR FROM tourney_date) BETWEEN (p_year - 4) AND p_year
      AND surface = tourney_surf
      AND (winner_id = player_b_id OR loser_id = player_b_id);

  win_pct_surface_a := CASE WHEN rec_a_surf.total_surf > 0 THEN rec_a_surf.wins_surf * 1.0 / rec_a_surf.total_surf ELSE NULL END;
  win_pct_surface_b := CASE WHEN rec_b_surf.total_surf > 0 THEN rec_b_surf.wins_surf * 1.0 / rec_b_surf.total_surf ELSE NULL END;

  -- Latest ranking snapshot up to the tournament year (prefers v2 table, falls back to legacy)
  SELECT rs.rank
    INTO ranking_a
    FROM estratego_v1.rankings_snapshot_v2 rs
    WHERE rs.player_id = player_a_id
      AND LEFT(rs.match_id, 4)::INT <= p_year
    ORDER BY LEFT(rs.match_id, 4)::INT DESC, rs.created_at DESC
    LIMIT 1;

  IF ranking_a IS NULL THEN
    SELECT rs.rank
      INTO ranking_a
      FROM estratego_v1.rankings_snapshot rs
      WHERE rs.player_id = player_a_id
        AND LEFT(rs.match_id, 4)::INT <= p_year
      ORDER BY LEFT(rs.match_id, 4)::INT DESC
      LIMIT 1;
  END IF;

  SELECT rs.rank
    INTO ranking_b
    FROM estratego_v1.rankings_snapshot_v2 rs
    WHERE rs.player_id = player_b_id
      AND LEFT(rs.match_id, 4)::INT <= p_year
    ORDER BY LEFT(rs.match_id, 4)::INT DESC, rs.created_at DESC
    LIMIT 1;

  IF ranking_b IS NULL THEN
    SELECT rs.rank
      INTO ranking_b
      FROM estratego_v1.rankings_snapshot rs
      WHERE rs.player_id = player_b_id
        AND LEFT(rs.match_id, 4)::INT <= p_year
      ORDER BY LEFT(rs.match_id, 4)::INT DESC
      LIMIT 1;
  END IF;

  IF ranking_a IS NOT NULL THEN
    ranking_score_a := EXP(-GREATEST(ranking_a - 1, 0) / 20.0);
  END IF;

  IF ranking_b IS NOT NULL THEN
    ranking_score_b := EXP(-GREATEST(ranking_b - 1, 0) / 20.0);
  END IF;

  -- Head-to-head record, calculado en vivo desde matches_full (la tabla
  -- estratego_v1.h2h es una cache que dejo de refrescarse y queda desactualizada).
  SELECT
    COUNT(*) FILTER (WHERE winner_id = player_a_id) AS wins,
    COUNT(*) FILTER (WHERE winner_id = player_b_id) AS losses,
    MAX(tourney_date) AS last_meeting
    INTO h2h_rec
    FROM estratego_v1.matches_full
    WHERE (winner_id = player_a_id AND loser_id = player_b_id)
       OR (winner_id = player_b_id AND loser_id = player_a_id);

  denom := COALESCE(h2h_rec.wins, 0)::FLOAT + COALESCE(h2h_rec.losses, 0)::FLOAT + 2;
  IF denom > 0 THEN
    h2h_score_a := (COALESCE(h2h_rec.wins, 0)::FLOAT + 1) / denom;
    h2h_score_b := (COALESCE(h2h_rec.losses, 0)::FLOAT + 1) / denom;
  END IF;

  -- Countries
  SELECT ioc INTO country_a FROM estratego_v1.players WHERE player_id = player_a_id;
  SELECT ioc INTO country_b FROM estratego_v1.players WHERE player_id = player_b_id;

  -- Days since last match
  SELECT (CURRENT_DATE - MAX(tourney_date))
    INTO days_since_a
    FROM estratego_v1.matches_full
    WHERE winner_id = player_a_id OR loser_id = player_a_id;

  SELECT (CURRENT_DATE - MAX(tourney_date))
    INTO days_since_b
    FROM estratego_v1.matches_full
    WHERE winner_id = player_b_id OR loser_id = player_b_id;

  SELECT COUNT(*)
    INTO recent_matches_a
    FROM estratego_v1.matches_full
    WHERE tourney_date IS NOT NULL
      AND CURRENT_DATE - tourney_date BETWEEN 0 AND 15
      AND (winner_id = player_a_id OR loser_id = player_a_id);

  SELECT COUNT(*)
    INTO recent_matches_b
    FROM estratego_v1.matches_full
    WHERE tourney_date IS NOT NULL
      AND CURRENT_DATE - tourney_date BETWEEN 0 AND 15
      AND (winner_id = player_b_id OR loser_id = player_b_id);

  SELECT COALESCE(
           json_match->>'score',
           json_match->>'match_score',
           json_match->>'result',
           json_match->>'status',
           json_match->>'outcome'
         )
    INTO last_match_a_text
    FROM (
      SELECT to_jsonb(mf) AS json_match
      FROM estratego_v1.matches_full mf
      WHERE winner_id = player_a_id OR loser_id = player_a_id
      ORDER BY mf.tourney_date DESC
      LIMIT 1
    ) AS last_match_a;

  SELECT COALESCE(
           json_match->>'score',
           json_match->>'match_score',
           json_match->>'result',
           json_match->>'status',
           json_match->>'outcome'
         )
    INTO last_match_b_text
    FROM (
      SELECT to_jsonb(mf) AS json_match
      FROM estratego_v1.matches_full mf
      WHERE winner_id = player_b_id OR loser_id = player_b_id
      ORDER BY mf.tourney_date DESC
      LIMIT 1
    ) AS last_match_b;

  SELECT ARRAY(
           SELECT CASE WHEN winner_id = player_a_id THEN 'W' ELSE 'L' END
           FROM estratego_v1.matches_full mf
           WHERE winner_id = player_a_id OR loser_id = player_a_id
           ORDER BY mf.tourney_date DESC, mf.match_id DESC NULLS LAST
           LIMIT 5
         )
    INTO last_results_a;

  SELECT ARRAY(
           SELECT CASE WHEN winner_id = player_b_id THEN 'W' ELSE 'L' END
           FROM estratego_v1.matches_full mf
           WHERE winner_id = player_b_id OR loser_id = player_b_id
           ORDER BY mf.tourney_date DESC, mf.match_id DESC NULLS LAST
           LIMIT 5
         )
    INTO last_results_b;

  -- Surface of each player's most recent match, to detect a surface switch
  -- going into this tournament (e.g. clay -> grass).
  SELECT mf.surface
    INTO last_surface_a
    FROM estratego_v1.matches_full mf
    WHERE winner_id = player_a_id OR loser_id = player_a_id
    ORDER BY mf.tourney_date DESC, mf.match_id DESC NULLS LAST
    LIMIT 1;

  SELECT mf.surface
    INTO last_surface_b
    FROM estratego_v1.matches_full mf
    WHERE winner_id = player_b_id OR loser_id = player_b_id
    ORDER BY mf.tourney_date DESC, mf.match_id DESC NULLS LAST
    LIMIT 1;

  SELECT CASE
           WHEN winner_id = player_a_id THEN winner_rank_points
           ELSE loser_rank_points
         END
    INTO points_current_a
    FROM estratego_v1.matches_full
   WHERE winner_id = player_a_id OR loser_id = player_a_id
   ORDER BY tourney_date DESC,
            CASE UPPER(round)
              WHEN 'F' THEN 7
              WHEN 'SF' THEN 6
              WHEN 'QF' THEN 5
              WHEN 'R16' THEN 4
              WHEN 'R32' THEN 3
              WHEN 'R64' THEN 2
              WHEN 'R128' THEN 1
              ELSE 0
            END DESC,
            match_id DESC NULLS LAST
   LIMIT 1;

  SELECT CASE
           WHEN winner_id = player_b_id THEN winner_rank_points
           ELSE loser_rank_points
         END
    INTO points_current_b
    FROM estratego_v1.matches_full
   WHERE winner_id = player_b_id OR loser_id = player_b_id
   ORDER BY tourney_date DESC,
            CASE UPPER(round)
              WHEN 'F' THEN 7
              WHEN 'SF' THEN 6
              WHEN 'QF' THEN 5
              WHEN 'R16' THEN 4
              WHEN 'R32' THEN 3
              WHEN 'R64' THEN 2
              WHEN 'R128' THEN 1
              ELSE 0
            END DESC,
            match_id DESC NULLS LAST
   LIMIT 1;

  IF days_since_a IS NOT NULL THEN
    rest_score_a := 1 / (1 + ABS(days_since_a - 7)::FLOAT / 7);
    rest_score_a := LEAST(1.0, GREATEST(0.0, rest_score_a));
    IF days_since_a <= 2 THEN
      alerts_a := array_append(alerts_a, format('Ha competido hace %s dia(s); posible fatiga.', days_since_a));
    ELSIF days_since_a >= 20 THEN
      alerts_a := array_append(alerts_a, format('Lleva %s dias sin competir; posible falta de ritmo.', days_since_a));
    END IF;
  END IF;

  IF days_since_b IS NOT NULL THEN
    rest_score_b := 1 / (1 + ABS(days_since_b - 7)::FLOAT / 7);
    rest_score_b := LEAST(1.0, GREATEST(0.0, rest_score_b));
    IF days_since_b <= 2 THEN
      alerts_b := array_append(alerts_b, format('Ha competido hace %s dia(s); posible fatiga.', days_since_b));
    ELSIF days_since_b >= 20 THEN
      alerts_b := array_append(alerts_b, format('Lleva %s dias sin competir; posible falta de ritmo.', days_since_b));
    END IF;
  END IF;

  IF recent_matches_a > 6 THEN
    alerts_a := array_append(
      alerts_a,
      format('Ha disputado %s partidos en los ultimos 15 dias; posible fatiga.', recent_matches_a)
    );
  END IF;

  IF recent_matches_b > 6 THEN
    alerts_b := array_append(
      alerts_b,
      format('Ha disputado %s partidos en los ultimos 15 dias; posible fatiga.', recent_matches_b)
    );
  END IF;

  IF last_match_a_text IS NOT NULL AND POSITION('RET' IN UPPER(last_match_a_text)) > 0 THEN
    alerts_a := array_append(alerts_a, 'Se retiro en su ultimo partido.');
  END IF;

  IF tourney_country IS NOT NULL THEN
    home_advantage_a := country_a IS NOT NULL AND UPPER(country_a) = UPPER(tourney_country);
    home_advantage_b := country_b IS NOT NULL AND UPPER(country_b) = UPPER(tourney_country);
  END IF;

  IF tourney_surf IS NOT NULL THEN
    surface_change_a := last_surface_a IS NOT NULL AND UPPER(last_surface_a) <> UPPER(tourney_surf);
    surface_change_b := last_surface_b IS NOT NULL AND UPPER(last_surface_b) <> UPPER(tourney_surf);
  END IF;

  IF last_match_b_text IS NOT NULL AND POSITION('RET' IN UPPER(last_match_b_text)) > 0 THEN
    alerts_b := array_append(alerts_b, 'Se retiro en su ultimo partido.');
  END IF;

  -- Monthly win percentage
  SELECT COUNT(*) FILTER (WHERE winner_id = player_a_id)::FLOAT / NULLIF(COUNT(*), 0)
    INTO win_month_a
    FROM estratego_v1.matches_full
    WHERE EXTRACT(MONTH FROM tourney_date)::INT = tourney_month
      AND (winner_id = player_a_id OR loser_id = player_a_id);

  SELECT COUNT(*) FILTER (WHERE winner_id = player_b_id)::FLOAT / NULLIF(COUNT(*), 0)
    INTO win_month_b
    FROM estratego_v1.matches_full
    WHERE EXTRACT(MONTH FROM tourney_date)::INT = tourney_month
      AND (winner_id = player_b_id OR loser_id = player_b_id);

  -- Win % vs Top-10 opponents
  SELECT COUNT(*) FILTER (WHERE winner_id = player_a_id)::FLOAT / NULLIF(COUNT(*), 0)
    INTO win_vs_rankband_a
    FROM estratego_v1.matches_full mf
    JOIN estratego_v1.rankings_snapshot rs
      ON rs.player_id = CASE
        WHEN mf.winner_id = player_a_id THEN mf.loser_id
        WHEN mf.loser_id = player_a_id THEN mf.winner_id
      END
      AND LEFT(rs.match_id, 4) = TO_CHAR(mf.tourney_date, 'YYYY')
    WHERE (winner_id = player_a_id OR loser_id = player_a_id)
      AND rs.rank <= 10;

  SELECT COUNT(*) FILTER (WHERE winner_id = player_b_id)::FLOAT / NULLIF(COUNT(*), 0)
    INTO win_vs_rankband_b
    FROM estratego_v1.matches_full mf
    JOIN estratego_v1.rankings_snapshot rs
      ON rs.player_id = CASE
        WHEN mf.winner_id = player_b_id THEN mf.loser_id
        WHEN mf.loser_id = player_b_id THEN mf.winner_id
      END
      AND LEFT(rs.match_id, 4) = TO_CHAR(mf.tourney_date, 'YYYY')
    WHERE (winner_id = player_b_id OR loser_id = player_b_id)
      AND rs.rank <= 10;

  -- Win % when match reaches the 5th set (best-of-5 only)
  SELECT COUNT(*) FILTER (WHERE winner_id = player_a_id AND sets_played = 5)::FLOAT
         / NULLIF(COUNT(*) FILTER (WHERE sets_played = 5), 0)
    INTO win_pct_fifth_set_a
    FROM (
      SELECT
        mf.winner_id,
        mf.loser_id,
        (length(score_clean) - length(replace(score_clean, '-', ''))) AS sets_played
      FROM estratego_v1.matches_full mf
      CROSS JOIN LATERAL (SELECT to_jsonb(mf) AS js) j
      CROSS JOIN LATERAL (
        SELECT regexp_replace(
          COALESCE(
            j.js->>'score',
            j.js->>'match_score',
            j.js->>'result',
            j.js->>'outcome',
            ''
          ),
          '\\([^)]*\\)',
          '',
          'g'
        ) AS score_clean
      ) sc
      WHERE (mf.winner_id = player_a_id OR mf.loser_id = player_a_id)
        AND mf.best_of = 5
    ) AS scored_a;

  SELECT COUNT(*) FILTER (WHERE winner_id = player_b_id AND sets_played = 5)::FLOAT
         / NULLIF(COUNT(*) FILTER (WHERE sets_played = 5), 0)
    INTO win_pct_fifth_set_b
    FROM (
      SELECT
        mf.winner_id,
        mf.loser_id,
        (length(score_clean) - length(replace(score_clean, '-', ''))) AS sets_played
      FROM estratego_v1.matches_full mf
      CROSS JOIN LATERAL (SELECT to_jsonb(mf) AS js) j
      CROSS JOIN LATERAL (
        SELECT regexp_replace(
          COALESCE(
            j.js->>'score',
            j.js->>'match_score',
            j.js->>'result',
            j.js->>'outcome',
            ''
          ),
          '\\([^)]*\\)',
          '',
          'g'
        ) AS score_clean
      ) sc
      WHERE (mf.winner_id = player_b_id OR mf.loser_id = player_b_id)
        AND mf.best_of = 5
    ) AS scored_b;

  -- Court speed adaptation
  SELECT COUNT(*) FILTER (WHERE winner_id = player_a_id)::FLOAT / NULLIF(COUNT(*), 0)
    INTO court_speed_score_a
    FROM estratego_v1.matches_full mf
    JOIN estratego_v1.court_speed_ranking_norm cs
      ON cs.tourney_id = split_part(mf.tourney_id, '-', 2)
    WHERE (winner_id = player_a_id OR loser_id = player_a_id)
      AND cs.speed_rank BETWEEN tourney_speed_rank - 10 AND tourney_speed_rank + 10;

  SELECT COUNT(*) FILTER (WHERE winner_id = player_b_id)::FLOAT / NULLIF(COUNT(*), 0)
    INTO court_speed_score_b
    FROM estratego_v1.matches_full mf
    JOIN estratego_v1.court_speed_ranking_norm cs
      ON cs.tourney_id = split_part(mf.tourney_id, '-', 2)
    WHERE (winner_id = player_b_id OR loser_id = player_b_id)
      AND cs.speed_rank BETWEEN tourney_speed_rank - 10 AND tourney_speed_rank + 10;

  -- court_speed_score es un % de victorias absoluto en pistas de velocidad
  -- similar; no distingue "juega bien en general" de "esta es su
  -- especialidad". court_speed_edge compara ese % contra su % de victorias
  -- de carrera (todas las superficies/velocidades) para medir la diferencia
  -- relativa. No se usa en el bucle de ponderacion, es solo informativo.
  SELECT COUNT(*) FILTER (WHERE winner_id = player_a_id)::FLOAT / NULLIF(COUNT(*), 0)
    INTO win_pct_career_a
    FROM estratego_v1.matches_full
    WHERE winner_id = player_a_id OR loser_id = player_a_id;

  SELECT COUNT(*) FILTER (WHERE winner_id = player_b_id)::FLOAT / NULLIF(COUNT(*), 0)
    INTO win_pct_career_b
    FROM estratego_v1.matches_full
    WHERE winner_id = player_b_id OR loser_id = player_b_id;

  IF court_speed_score_a IS NOT NULL AND win_pct_career_a IS NOT NULL THEN
    court_speed_edge_a := court_speed_score_a - win_pct_career_a;
  END IF;

  IF court_speed_score_b IS NOT NULL AND win_pct_career_b IS NOT NULL THEN
    court_speed_edge_b := court_speed_score_b - win_pct_career_b;
  END IF;

  IF court_speed_edge_a IS NOT NULL AND court_speed_edge_a >= 0.20 THEN
    alerts_a := array_append(alerts_a, format('Rinde un %s%% mejor de lo habitual en pistas de esta velocidad; posible especialidad.', ROUND((court_speed_edge_a * 100)::NUMERIC, 0)));
  ELSIF court_speed_edge_a IS NOT NULL AND court_speed_edge_a <= -0.20 THEN
    alerts_a := array_append(alerts_a, format('Rinde un %s%% peor de lo habitual en pistas de esta velocidad; posible punto debil.', ROUND((ABS(court_speed_edge_a) * 100)::NUMERIC, 0)));
  END IF;

  IF court_speed_edge_b IS NOT NULL AND court_speed_edge_b >= 0.20 THEN
    alerts_b := array_append(alerts_b, format('Rinde un %s%% mejor de lo habitual en pistas de esta velocidad; posible especialidad.', ROUND((court_speed_edge_b * 100)::NUMERIC, 0)));
  ELSIF court_speed_edge_b IS NOT NULL AND court_speed_edge_b <= -0.20 THEN
    alerts_b := array_append(alerts_b, format('Rinde un %s%% peor de lo habitual en pistas de esta velocidad; posible punto debil.', ROUND((ABS(court_speed_edge_b) * 100)::NUMERIC, 0)));
  END IF;

  -- Defends-round / motivation_score se calculan ANTES del bucle de
  -- ponderacion (mas abajo). Antes se calculaban despues, con lo cual el
  -- bucle siempre usaba motivation_score_a/b = 0 (su valor inicial
  -- declarado), sin importar el peso configurado ni si el jugador defendia
  -- titulo: el bug pasaba desapercibido porque el JSON de salida si mostraba
  -- el valor final (correcto), calculado tarde solo para mostrarlo.
  tourney_base := split_part(p_tourney_id, '-', 2);
  IF tourney_base ~ '^\d+$' THEN
    tourney_base_int := tourney_base::INT;
  ELSE
    tourney_base_int := NULL;
  END IF;

  prev_year := p_year - 1;

  IF tourney_base_int IS NOT NULL THEN
    SELECT t.tourney_id
      INTO tourney_prev_id
      FROM estratego_v1.tournaments t
     WHERE LEFT(t.tourney_id, 4)::INT = prev_year
       AND split_part(t.tourney_id, '-', 2) ~ '^\d+$'
       AND split_part(t.tourney_id, '-', 2)::INT = tourney_base_int
     ORDER BY t.tourney_date DESC
     LIMIT 1;
  END IF;

  IF tourney_prev_id IS NULL THEN
    tourney_prev_id := prev_year::TEXT || '-' || tourney_base;
  END IF;

  SELECT CASE
           WHEN winner_id = player_a_id THEN winner_rank_points
           ELSE loser_rank_points
         END
    INTO points_prev_a
    FROM estratego_v1.matches_full
   WHERE tourney_id = tourney_prev_id
     AND (winner_id = player_a_id OR loser_id = player_a_id)
   ORDER BY tourney_date DESC,
            CASE UPPER(round)
              WHEN 'F' THEN 7
              WHEN 'SF' THEN 6
              WHEN 'QF' THEN 5
              WHEN 'R16' THEN 4
              WHEN 'R32' THEN 3
              WHEN 'R64' THEN 2
              WHEN 'R128' THEN 1
              ELSE 0
            END DESC,
            match_id DESC NULLS LAST
   LIMIT 1;

  SELECT CASE
           WHEN winner_id = player_b_id THEN winner_rank_points
           ELSE loser_rank_points
         END
    INTO points_prev_b
    FROM estratego_v1.matches_full
   WHERE tourney_id = tourney_prev_id
     AND (winner_id = player_b_id OR loser_id = player_b_id)
   ORDER BY tourney_date DESC,
            CASE UPPER(round)
              WHEN 'F' THEN 7
              WHEN 'SF' THEN 6
              WHEN 'QF' THEN 5
              WHEN 'R16' THEN 4
              WHEN 'R32' THEN 3
              WHEN 'R64' THEN 2
              WHEN 'R128' THEN 1
              ELSE 0
            END DESC,
            match_id DESC NULLS LAST
   LIMIT 1;

  IF points_current_a IS NOT NULL AND points_prev_a IS NOT NULL THEN
    points_delta_a := points_current_a - points_prev_a;
  END IF;

  IF points_current_b IS NOT NULL AND points_prev_b IS NOT NULL THEN
    points_delta_b := points_current_b - points_prev_b;
  END IF;

  -- Aviso cuando el jugador tiene menos puntos ahora que en esta misma
  -- edicion el año pasado: puede indicar que busca recuperar puntos en
  -- torneos de categoria inferior. Silencio si no jugo la edicion anterior
  -- (points_delta queda NULL), igual que el resto de avisos de esta funcion.
  IF points_delta_a IS NOT NULL AND points_delta_a < 0 THEN
    alerts_a := array_append(alerts_a, format(
      'Tiene %s puntos menos que hace un ano en este torneo; podria buscar recuperar puntos en categorias inferiores.',
      ABS(points_delta_a)
    ));
  END IF;

  IF points_delta_b IS NOT NULL AND points_delta_b < 0 THEN
    alerts_b := array_append(alerts_b, format(
      'Tiene %s puntos menos que hace un ano en este torneo; podria buscar recuperar puntos en categorias inferiores.',
      ABS(points_delta_b)
    ));
  END IF;

  SELECT CASE
           WHEN EXISTS (
             SELECT 1
             FROM estratego_v1.matches_full
             WHERE tourney_id = tourney_prev_id
               AND winner_id = player_a_id
               AND round = 'F'
           ) THEN 'W'
           WHEN EXISTS (
             SELECT 1
             FROM estratego_v1.matches_full
             WHERE tourney_id = tourney_prev_id
               AND winner_id = player_a_id
               AND round = 'SF'
           ) THEN 'F'
           WHEN EXISTS (
             SELECT 1
             FROM estratego_v1.matches_full
             WHERE tourney_id = tourney_prev_id
               AND winner_id = player_a_id
               AND round = 'QF'
           ) THEN 'SF'
           ELSE NULL
         END
    INTO round_last_a;

  SELECT CASE
           WHEN EXISTS (
             SELECT 1
             FROM estratego_v1.matches_full
             WHERE tourney_id = tourney_prev_id
               AND winner_id = player_b_id
               AND round = 'F'
           ) THEN 'W'
           WHEN EXISTS (
             SELECT 1
             FROM estratego_v1.matches_full
             WHERE tourney_id = tourney_prev_id
               AND winner_id = player_b_id
               AND round = 'SF'
           ) THEN 'F'
           WHEN EXISTS (
             SELECT 1
             FROM estratego_v1.matches_full
             WHERE tourney_id = tourney_prev_id
               AND winner_id = player_b_id
               AND round = 'QF'
           ) THEN 'SF'
           ELSE NULL
         END
    INTO round_last_b;

  defend_component_a := 0;
  defend_component_b := 0;
  defend_label_a := NULL;
  defend_label_b := NULL;

  IF round_last_a IS NOT NULL THEN
    defend_component_a := CASE round_last_a
      WHEN 'W' THEN 1
      WHEN 'F' THEN 0.75
      WHEN 'SF' THEN 0.5
      ELSE 0
    END;
    defend_label_a := CASE round_last_a
      WHEN 'W' THEN 'Campeon'
      WHEN 'F' THEN 'Finalista'
      WHEN 'SF' THEN 'Semifinalista'
      ELSE NULL
    END;
    meta_defend_round := defend_label_a;
    alerts_a := array_append(alerts_a, format('Defiende %s del ano anterior.', COALESCE(defend_label_a, round_last_a)));
  END IF;

  IF round_last_b IS NOT NULL THEN
    defend_component_b := CASE round_last_b
      WHEN 'W' THEN 1
      WHEN 'F' THEN 0.75
      WHEN 'SF' THEN 0.5
      ELSE 0
    END;
    defend_label_b := CASE round_last_b
      WHEN 'W' THEN 'Campeon'
      WHEN 'F' THEN 'Finalista'
      WHEN 'SF' THEN 'Semifinalista'
      ELSE NULL
    END;
    alerts_b := array_append(alerts_b, format('Defiende %s del ano anterior.', COALESCE(defend_label_b, round_last_b)));
  END IF;

  motivation_score_a := LEAST(1.0, defend_component_a);
  motivation_score_b := LEAST(1.0, defend_component_b);

  -- Historial del jugador en ESTE torneo especifico, a traves de TODOS los
  -- años (no solo el año pasado como round_last_a/b). Reusa tourney_base_int
  -- ya calculado arriba. lost_first_match detecta ediciones donde el
  -- jugador solo disputo un partido (y lo perdio) en esa edicion. Las
  -- queries se ejecutan siempre (sin IF tourney_base_int IS NOT NULL):
  -- si tourney_base_int es NULL, el join nunca casa (NULL = x es NULL) y
  -- devuelve 0 filas, con lo cual times_played/titles/etc. quedan en 0 en
  -- vez de dejar tourney_hist_a/b como un RECORD sin asignar (lo cual
  -- rompería el "tourney_hist_a.titles >= 1" de mas abajo con un error).
    SELECT
      COUNT(*) AS times_played,
      COUNT(*) FILTER (WHERE is_champion) AS titles,
      COUNT(*) FILTER (WHERE reached_final) AS finals_reached,
      COUNT(*) FILTER (WHERE reached_semis) AS semis_reached,
      COUNT(*) FILTER (WHERE lost_first_match) AS first_match_exits
      INTO tourney_hist_a
      FROM (
        SELECT
          pm.tourney_id,
          BOOL_OR(pm.won AND pm.round_rank = 7) AS is_champion,
          BOOL_OR(pm.round_rank = 7) AS reached_final,
          BOOL_OR(pm.round_rank >= 6) AS reached_semis,
          (COUNT(*) = 1 AND BOOL_AND(NOT pm.won)) AS lost_first_match
        FROM (
          SELECT
            mf.tourney_id,
            (mf.winner_id = player_a_id) AS won,
            CASE UPPER(mf.round)
              WHEN 'F' THEN 7 WHEN 'SF' THEN 6 WHEN 'QF' THEN 5
              WHEN 'R16' THEN 4 WHEN 'R32' THEN 3 WHEN 'R64' THEN 2
              WHEN 'R128' THEN 1 ELSE 0
            END AS round_rank
          FROM estratego_v1.matches_full mf
          JOIN estratego_v1.tournaments t ON t.tourney_id = mf.tourney_id
           AND split_part(t.tourney_id, '-', 2) ~ '^\d+$'
           AND split_part(t.tourney_id, '-', 2)::INT = tourney_base_int
          WHERE mf.winner_id = player_a_id OR mf.loser_id = player_a_id
        ) pm
        GROUP BY pm.tourney_id
      ) per_edition_a;

    SELECT
      COUNT(*) AS times_played,
      COUNT(*) FILTER (WHERE is_champion) AS titles,
      COUNT(*) FILTER (WHERE reached_final) AS finals_reached,
      COUNT(*) FILTER (WHERE reached_semis) AS semis_reached,
      COUNT(*) FILTER (WHERE lost_first_match) AS first_match_exits
      INTO tourney_hist_b
      FROM (
        SELECT
          pm.tourney_id,
          BOOL_OR(pm.won AND pm.round_rank = 7) AS is_champion,
          BOOL_OR(pm.round_rank = 7) AS reached_final,
          BOOL_OR(pm.round_rank >= 6) AS reached_semis,
          (COUNT(*) = 1 AND BOOL_AND(NOT pm.won)) AS lost_first_match
        FROM (
          SELECT
            mf.tourney_id,
            (mf.winner_id = player_b_id) AS won,
            CASE UPPER(mf.round)
              WHEN 'F' THEN 7 WHEN 'SF' THEN 6 WHEN 'QF' THEN 5
              WHEN 'R16' THEN 4 WHEN 'R32' THEN 3 WHEN 'R64' THEN 2
              WHEN 'R128' THEN 1 ELSE 0
            END AS round_rank
          FROM estratego_v1.matches_full mf
          JOIN estratego_v1.tournaments t ON t.tourney_id = mf.tourney_id
           AND split_part(t.tourney_id, '-', 2) ~ '^\d+$'
           AND split_part(t.tourney_id, '-', 2)::INT = tourney_base_int
          WHERE mf.winner_id = player_b_id OR mf.loser_id = player_b_id
        ) pm
        GROUP BY pm.tourney_id
      ) per_edition_b;

  IF tourney_hist_a.titles >= 1 THEN
    tourney_hist_label_a := format('Ha ganado este torneo %s vez(es).', tourney_hist_a.titles);
  ELSIF tourney_hist_a.finals_reached >= 1 THEN
    tourney_hist_label_a := format('Ha llegado a %s final(es) de este torneo.', tourney_hist_a.finals_reached);
  ELSIF tourney_hist_a.semis_reached >= 1 THEN
    tourney_hist_label_a := format('Ha llegado a %s semifinal(es) de este torneo.', tourney_hist_a.semis_reached);
  ELSIF tourney_hist_a.times_played >= 2 AND tourney_hist_a.first_match_exits = tourney_hist_a.times_played THEN
    tourney_hist_label_a := format('En %s participaciones nunca ha pasado de primera ronda en este torneo.', tourney_hist_a.times_played);
  END IF;

  IF tourney_hist_b.titles >= 1 THEN
    tourney_hist_label_b := format('Ha ganado este torneo %s vez(es).', tourney_hist_b.titles);
  ELSIF tourney_hist_b.finals_reached >= 1 THEN
    tourney_hist_label_b := format('Ha llegado a %s final(es) de este torneo.', tourney_hist_b.finals_reached);
  ELSIF tourney_hist_b.semis_reached >= 1 THEN
    tourney_hist_label_b := format('Ha llegado a %s semifinal(es) de este torneo.', tourney_hist_b.semis_reached);
  ELSIF tourney_hist_b.times_played >= 2 AND tourney_hist_b.first_match_exits = tourney_hist_b.times_played THEN
    tourney_hist_label_b := format('En %s participaciones nunca ha pasado de primera ronda en este torneo.', tourney_hist_b.times_played);
  END IF;

  -- Proximo torneo: el que cada jugador disputo el año pasado justo despues
  -- de la edicion anterior de ESTE torneo (dato real de matches_full, no una
  -- suposicion de calendario). Si no jugo nada despues (fin de temporada,
  -- lesion...) estas variables quedan en NULL y no se muestra nada.
  IF tourney_prev_id IS NOT NULL THEN
    SELECT MAX(tourney_date)
      INTO prev_event_last_date_a
      FROM estratego_v1.matches_full
      WHERE tourney_id = tourney_prev_id
        AND (winner_id = player_a_id OR loser_id = player_a_id);

    SELECT MAX(tourney_date)
      INTO prev_event_last_date_b
      FROM estratego_v1.matches_full
      WHERE tourney_id = tourney_prev_id
        AND (winner_id = player_b_id OR loser_id = player_b_id);
  END IF;

  IF prev_event_last_date_a IS NOT NULL THEN
    SELECT mf.tourney_id
      INTO next_tourney_id_a
      FROM estratego_v1.matches_full mf
      WHERE (winner_id = player_a_id OR loser_id = player_a_id)
        AND tourney_date > prev_event_last_date_a
      ORDER BY tourney_date ASC
      LIMIT 1;
  END IF;

  IF prev_event_last_date_b IS NOT NULL THEN
    SELECT mf.tourney_id
      INTO next_tourney_id_b
      FROM estratego_v1.matches_full mf
      WHERE (winner_id = player_b_id OR loser_id = player_b_id)
        AND tourney_date > prev_event_last_date_b
      ORDER BY tourney_date ASC
      LIMIT 1;
  END IF;

  -- Resultado mas profundo alcanzado en ese proximo torneo (mismo truco que
  -- round_last_a/b: haber ganado la ronda X implica haber avanzado a X+1).
  IF next_tourney_id_a IS NOT NULL THEN
    SELECT CASE
             WHEN EXISTS (SELECT 1 FROM estratego_v1.matches_full WHERE tourney_id = next_tourney_id_a AND winner_id = player_a_id AND round = 'F') THEN 'W'
             WHEN EXISTS (SELECT 1 FROM estratego_v1.matches_full WHERE tourney_id = next_tourney_id_a AND winner_id = player_a_id AND round = 'SF') THEN 'F'
             WHEN EXISTS (SELECT 1 FROM estratego_v1.matches_full WHERE tourney_id = next_tourney_id_a AND winner_id = player_a_id AND round = 'QF') THEN 'SF'
             ELSE NULL
           END
      INTO next_tourney_result_a;

    next_tourney_code_a := split_part(next_tourney_id_a, '-', 2);
    this_year_next_id_a := p_year::TEXT || '-' || next_tourney_code_a;

    SELECT name, level, country
      INTO next_tourney_name_a, next_tourney_level_a, next_tourney_country_a
      FROM estratego_v1.tournaments
      WHERE tourney_id = this_year_next_id_a;

    -- Si la edicion de este año todavia no esta en el calendario, usamos la
    -- del año pasado solo para poder mostrar nombre/nivel/pais (el chequeo
    -- de "sube de categoria" exige el nivel de la edicion de este año).
    IF next_tourney_name_a IS NULL THEN
      SELECT name, level, country
        INTO next_tourney_name_a, next_tourney_level_a, next_tourney_country_a
        FROM estratego_v1.tournaments
       WHERE tourney_id = next_tourney_id_a;
    END IF;
  END IF;

  IF next_tourney_id_b IS NOT NULL THEN
    SELECT CASE
             WHEN EXISTS (SELECT 1 FROM estratego_v1.matches_full WHERE tourney_id = next_tourney_id_b AND winner_id = player_b_id AND round = 'F') THEN 'W'
             WHEN EXISTS (SELECT 1 FROM estratego_v1.matches_full WHERE tourney_id = next_tourney_id_b AND winner_id = player_b_id AND round = 'SF') THEN 'F'
             WHEN EXISTS (SELECT 1 FROM estratego_v1.matches_full WHERE tourney_id = next_tourney_id_b AND winner_id = player_b_id AND round = 'QF') THEN 'SF'
             ELSE NULL
           END
      INTO next_tourney_result_b;

    next_tourney_code_b := split_part(next_tourney_id_b, '-', 2);
    this_year_next_id_b := p_year::TEXT || '-' || next_tourney_code_b;

    SELECT name, level, country
      INTO next_tourney_name_b, next_tourney_level_b, next_tourney_country_b
      FROM estratego_v1.tournaments
      WHERE tourney_id = this_year_next_id_b;

    IF next_tourney_name_b IS NULL THEN
      SELECT name, level, country
        INTO next_tourney_name_b, next_tourney_level_b, next_tourney_country_b
        FROM estratego_v1.tournaments
       WHERE tourney_id = next_tourney_id_b;
    END IF;
  END IF;

  -- Categoria: Slam/Finals > Masters 1000 > ATP/WTA tour > Challenger.
  tourney_level_rank := CASE tourney_level
    WHEN 'G' THEN 4 WHEN 'F' THEN 4 WHEN 'M' THEN 3 WHEN 'A' THEN 2 WHEN 'C' THEN 1 ELSE 0
  END;
  next_level_rank_a := CASE next_tourney_level_a
    WHEN 'G' THEN 4 WHEN 'F' THEN 4 WHEN 'M' THEN 3 WHEN 'A' THEN 2 WHEN 'C' THEN 1 ELSE NULL
  END;
  next_level_rank_b := CASE next_tourney_level_b
    WHEN 'G' THEN 4 WHEN 'F' THEN 4 WHEN 'M' THEN 3 WHEN 'A' THEN 2 WHEN 'C' THEN 1 ELSE NULL
  END;

  next_is_upgrade_a := next_level_rank_a IS NOT NULL AND next_level_rank_a > tourney_level_rank;
  next_is_upgrade_b := next_level_rank_b IS NOT NULL AND next_level_rank_b > tourney_level_rank;

  next_is_home_a := next_tourney_country_a IS NOT NULL AND country_a IS NOT NULL
                    AND UPPER(country_a) = UPPER(next_tourney_country_a);
  next_is_home_b := next_tourney_country_b IS NOT NULL AND country_b IS NOT NULL
                    AND UPPER(country_b) = UPPER(next_tourney_country_b);

  -- Weighted score across metrics already stored in prematch_metric_weights.
  -- Cuando a un jugador le falta el dato (sin partidos ese periodo, sin
  -- ranking, etc.) se usa el valor del rival en su lugar (neutral) en vez de
  -- 0, que equivalia a asumirle el peor caso posible solo por falta de datos.
  FOR w IN SELECT * FROM estratego_v1.prematch_metric_weights LOOP
    IF w.metric = 'win_pct_year' THEN
      win_score_a := win_score_a + COALESCE(win_pct_year_a, win_pct_year_b, 0) * w.weight;
      win_score_b := win_score_b + COALESCE(win_pct_year_b, win_pct_year_a, 0) * w.weight;
    ELSIF w.metric = 'win_pct_surface' THEN
      win_score_a := win_score_a + COALESCE(win_pct_surface_a, win_pct_surface_b, 0) * w.weight;
      win_score_b := win_score_b + COALESCE(win_pct_surface_b, win_pct_surface_a, 0) * w.weight;
    ELSIF w.metric = 'win_pct_month' THEN
      win_score_a := win_score_a + COALESCE(win_month_a, win_month_b, 0) * w.weight;
      win_score_b := win_score_b + COALESCE(win_month_b, win_month_a, 0) * w.weight;
    ELSIF w.metric = 'win_pct_vs_top10' THEN
      win_score_a := win_score_a + COALESCE(win_vs_rankband_a, win_vs_rankband_b, 0) * w.weight;
      win_score_b := win_score_b + COALESCE(win_vs_rankband_b, win_vs_rankband_a, 0) * w.weight;
    ELSIF w.metric = 'court_speed_score' THEN
      win_score_a := win_score_a + COALESCE(court_speed_score_a, court_speed_score_b, 0) * w.weight;
      win_score_b := win_score_b + COALESCE(court_speed_score_b, court_speed_score_a, 0) * w.weight;
    ELSIF w.metric = 'rest_score' THEN
      -- rest_score se usa solo como alerta, no impacta en la ponderaciÃ³n
      NULL;
    END IF;
  END LOOP;

  -- Additional metrics with default weights if absent from the configuration table
  FOR w IN
    SELECT metric, weight
    FROM estratego_v1.prematch_metric_weights
    WHERE metric IN ('ranking_score','h2h_score','motivation_score')
    UNION ALL
    SELECT metric, weight
    FROM (VALUES
      ('ranking_score', 0.12),
      ('h2h_score', 0.08),
      ('motivation_score', 0.05)
    ) AS defaults(metric, weight)
    WHERE NOT EXISTS (
      SELECT 1
      FROM estratego_v1.prematch_metric_weights mw
      WHERE mw.metric = defaults.metric
    )
  LOOP
    IF w.metric = 'ranking_score' THEN
      win_score_a := win_score_a + COALESCE(ranking_score_a, ranking_score_b, 0) * w.weight;
      win_score_b := win_score_b + COALESCE(ranking_score_b, ranking_score_a, 0) * w.weight;
    ELSIF w.metric = 'h2h_score' THEN
      win_score_a := win_score_a + COALESCE(h2h_score_a, 0) * w.weight;
      win_score_b := win_score_b + COALESCE(h2h_score_b, 0) * w.weight;
    ELSIF w.metric = 'motivation_score' THEN
      win_score_a := win_score_a + COALESCE(motivation_score_a, 0) * w.weight;
      win_score_b := win_score_b + COALESCE(motivation_score_b, 0) * w.weight;
    END IF;
  END LOOP;

  IF win_score_a + win_score_b > 0 THEN
    prob_a := win_score_a / (win_score_a + win_score_b);
    prob_b := win_score_b / (win_score_a + win_score_b);
  END IF;

  RETURN jsonb_build_object(
    'playerA', jsonb_build_object(
      'win_pct_year', CASE WHEN rec_a_year.total > 0 THEN rec_a_year.wins * 100.0 / rec_a_year.total ELSE NULL END,
      'win_pct_surface', CASE WHEN rec_a_surf.total_surf > 0 THEN rec_a_surf.wins_surf * 100.0 / rec_a_surf.total_surf ELSE NULL END,
      'ranking', ranking_a,
      'points_current', points_current_a,
      'points_previous', points_prev_a,
      'points_delta', points_delta_a,
      'days_since_last', days_since_a,
      'home_advantage', home_advantage_a,
      'surface_change', surface_change_a,
      'win_pct_month', win_month_a,
      'win_pct_vs_top10', win_vs_rankband_a,
      'win_pct_fifth_set', win_pct_fifth_set_a,
      'court_speed_score', court_speed_score_a,
      'court_speed_edge', court_speed_edge_a,
      'win_score', win_score_a,
      'win_probability', prob_a,
      'last_year_round', round_last_a,
      'defends_round', defend_label_a,
      'ranking_score', ranking_score_a,
      'h2h_score', h2h_score_a,
      'rest_score', rest_score_a,
      'motivation_score', motivation_score_a,
      'alerts', to_jsonb(alerts_a),
      'last_results', to_jsonb(COALESCE(last_results_a, ARRAY[]::TEXT[])),
      'next_tournament', CASE WHEN next_tourney_id_a IS NULL THEN NULL ELSE jsonb_build_object(
        'name', next_tourney_name_a,
        'level', next_tourney_level_a,
        'country', next_tourney_country_a,
        'last_year_round', next_tourney_result_a,
        'is_category_upgrade', next_is_upgrade_a,
        'is_home', next_is_home_a
      ) END,
      'tournament_history', CASE WHEN tourney_hist_a.times_played IS NULL OR tourney_hist_a.times_played = 0 OR tourney_hist_label_a IS NULL THEN NULL ELSE jsonb_build_object(
        'times_played', tourney_hist_a.times_played,
        'titles', tourney_hist_a.titles,
        'finals_reached', tourney_hist_a.finals_reached,
        'semis_reached', tourney_hist_a.semis_reached,
        'label', tourney_hist_label_a
      ) END
    ),
    'playerB', jsonb_build_object(
      'win_pct_year', CASE WHEN rec_b_year.total > 0 THEN rec_b_year.wins * 100.0 / rec_b_year.total ELSE NULL END,
      'win_pct_surface', CASE WHEN rec_b_surf.total_surf > 0 THEN rec_b_surf.wins_surf * 100.0 / rec_b_surf.total_surf ELSE NULL END,
      'ranking', ranking_b,
      'points_current', points_current_b,
      'points_previous', points_prev_b,
      'points_delta', points_delta_b,
      'days_since_last', days_since_b,
      'home_advantage', home_advantage_b,
      'surface_change', surface_change_b,
      'win_pct_month', win_month_b,
      'win_pct_vs_top10', win_vs_rankband_b,
      'win_pct_fifth_set', win_pct_fifth_set_b,
      'court_speed_score', court_speed_score_b,
      'court_speed_edge', court_speed_edge_b,
      'win_score', win_score_b,
      'win_probability', prob_b,
      'last_year_round', round_last_b,
      'defends_round', defend_label_b,
      'ranking_score', ranking_score_b,
      'h2h_score', h2h_score_b,
      'rest_score', rest_score_b,
      'motivation_score', motivation_score_b,
      'alerts', to_jsonb(alerts_b),
      'last_results', to_jsonb(COALESCE(last_results_b, ARRAY[]::TEXT[])),
      'next_tournament', CASE WHEN next_tourney_id_b IS NULL THEN NULL ELSE jsonb_build_object(
        'name', next_tourney_name_b,
        'level', next_tourney_level_b,
        'country', next_tourney_country_b,
        'last_year_round', next_tourney_result_b,
        'is_category_upgrade', next_is_upgrade_b,
        'is_home', next_is_home_b
      ) END,
      'tournament_history', CASE WHEN tourney_hist_b.times_played IS NULL OR tourney_hist_b.times_played = 0 OR tourney_hist_label_b IS NULL THEN NULL ELSE jsonb_build_object(
        'times_played', tourney_hist_b.times_played,
        'titles', tourney_hist_b.titles,
        'finals_reached', tourney_hist_b.finals_reached,
        'semis_reached', tourney_hist_b.semis_reached,
        'label', tourney_hist_label_b
      ) END
    ),
    'h2h', jsonb_build_object(
      'wins', h2h_rec.wins,
      'losses', h2h_rec.losses,
      'last_meeting', h2h_rec.last_meeting
    ),
    'meta', jsonb_build_object(
      'defends_round', meta_defend_round,
      'defends_round_opponent', defend_label_b
    ),
    'surface', tourney_surf,
    'tourney_speed_rank', tourney_speed_rank,
    'tourney_speed_min', tourney_speed_min,
    'tourney_speed_max', tourney_speed_max
  );
END;
$function$;



