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

  h2h_rec RECORD;
  country_a TEXT;
  country_b TEXT;
  tourney_surf TEXT;
  tourney_speed_id TEXT;
  tourney_speed_rank INT;
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

  -- Tournament surface and month
  SELECT surface,
         EXTRACT(MONTH FROM TO_DATE(tourney_date::TEXT, 'YYYYMMDD'))::INT,
         country
    INTO tourney_surf, tourney_month, tourney_country
    FROM estratego_v1.tournaments
    WHERE tourney_id = p_tourney_id;

  tourney_speed_id := split_part(p_tourney_id, '-', 2);

  SELECT speed_rank
    INTO tourney_speed_rank
    FROM estratego_v1.court_speed_ranking_norm
    WHERE tourney_id = tourney_speed_id;

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

  -- Head-to-head record
  SELECT wins, losses, last_meeting
    INTO h2h_rec
    FROM estratego_v1.h2h
    WHERE player_id = player_a_id AND opponent_id = player_b_id;

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

  -- Weighted score across metrics already stored in prematch_metric_weights
  FOR w IN SELECT * FROM estratego_v1.prematch_metric_weights LOOP
    IF w.metric = 'win_pct_year' THEN
      win_score_a := win_score_a
        + COALESCE(rec_a_year.wins * 1.0 / NULLIF(rec_a_year.total, 0), 0) * w.weight;
      win_score_b := win_score_b
        + COALESCE(rec_b_year.wins * 1.0 / NULLIF(rec_b_year.total, 0), 0) * w.weight;
    ELSIF w.metric = 'win_pct_surface' THEN
      win_score_a := win_score_a
        + COALESCE(rec_a_surf.wins_surf * 1.0 / NULLIF(rec_a_surf.total_surf, 0), 0) * w.weight;
      win_score_b := win_score_b
        + COALESCE(rec_b_surf.wins_surf * 1.0 / NULLIF(rec_b_surf.total_surf, 0), 0) * w.weight;
    ELSIF w.metric = 'win_pct_month' THEN
      win_score_a := win_score_a + COALESCE(win_month_a, 0) * w.weight;
      win_score_b := win_score_b + COALESCE(win_month_b, 0) * w.weight;
    ELSIF w.metric = 'win_pct_vs_top10' THEN
      win_score_a := win_score_a + COALESCE(win_vs_rankband_a, 0) * w.weight;
      win_score_b := win_score_b + COALESCE(win_vs_rankband_b, 0) * w.weight;
    ELSIF w.metric = 'court_speed_score' THEN
      win_score_a := win_score_a + COALESCE(court_speed_score_a, 0) * w.weight;
      win_score_b := win_score_b + COALESCE(court_speed_score_b, 0) * w.weight;
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
      win_score_a := win_score_a + COALESCE(ranking_score_a, 0) * w.weight;
      win_score_b := win_score_b + COALESCE(ranking_score_b, 0) * w.weight;
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
      'win_pct_month', win_month_a,
      'win_pct_vs_top10', win_vs_rankband_a,
      'win_pct_fifth_set', win_pct_fifth_set_a,
      'court_speed_score', court_speed_score_a,
      'win_score', win_score_a,
      'win_probability', prob_a,
      'last_year_round', round_last_a,
      'defends_round', defend_label_a,
      'ranking_score', ranking_score_a,
      'h2h_score', h2h_score_a,
      'rest_score', rest_score_a,
      'motivation_score', motivation_score_a,
      'alerts', to_jsonb(alerts_a),
      'last_results', to_jsonb(COALESCE(last_results_a, ARRAY[]::TEXT[]))
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
      'win_pct_month', win_month_b,
      'win_pct_vs_top10', win_vs_rankband_b,
      'win_pct_fifth_set', win_pct_fifth_set_b,
      'court_speed_score', court_speed_score_b,
      'win_score', win_score_b,
      'win_probability', prob_b,
      'last_year_round', round_last_b,
      'defends_round', defend_label_b,
      'ranking_score', ranking_score_b,
      'h2h_score', h2h_score_b,
      'rest_score', rest_score_b,
      'motivation_score', motivation_score_b,
      'alerts', to_jsonb(alerts_b),
      'last_results', to_jsonb(COALESCE(last_results_b, ARRAY[]::TEXT[]))
    ),
    'h2h', jsonb_build_object(
      'wins', h2h_rec.wins,
      'losses', h2h_rec.losses,
      'last_meeting', h2h_rec.last_meeting
    ),
    'meta', jsonb_build_object(
      'defends_round', meta_defend_round,
      'defends_round_opponent', defend_label_b
    )
  );
END;
$function$;



