-- simulate_full_tournament rebuilds the draw for a tournament and
-- simulates every round using probabilities from get_extended_prematch_summary.
CREATE OR REPLACE FUNCTION public.simulate_full_tournament(
  p_tourney_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
  rounds          CONSTANT TEXT[] := ARRAY['R64','R32','R16','QF','SF','F'];
  first_round_idx INT;
  first_round     TEXT;
  round_idx       INT;
  current_round   TEXT;
  next_round      TEXT;
  r               RECORD;
  winner          INT;
  top_player      INT;
  bot_player      INT;
  match_year      INT;
  prematch        JSONB;
  prob_top        FLOAT;
  match_num       INT;
  next_match_num  INT;
  next_match_id   TEXT;
BEGIN
  -- keep server-side timeout reasonable but finite
  PERFORM set_config('statement_timeout', '60000', true);

  SELECT idx, rounds[idx]
  INTO first_round_idx, first_round
  FROM (
    SELECT i AS idx
    FROM generate_subscripts(rounds, 1) AS g(i)
    ORDER BY i
  ) t
  WHERE EXISTS (
    SELECT 1
    FROM public.draw_matches
    WHERE tourney_id = p_tourney_id
      AND round      = rounds[t.idx]
  )
  ORDER BY idx
  LIMIT 1;

  IF first_round_idx IS NULL THEN
    RAISE NOTICE 'No hay rondas en draw_matches para %', p_tourney_id;
    RETURN;
  END IF;

  -- ensure temp table can be recreated within the same session
  EXECUTE 'DROP TABLE IF EXISTS pg_temp.tmp_first_round';

  CREATE TEMP TABLE tmp_first_round ON COMMIT DROP AS
  SELECT id, top_id, bot_id
  FROM public.draw_matches
  WHERE tourney_id = p_tourney_id
    AND round      = first_round;

  UPDATE public.draw_matches
  SET top_id    = NULL,
      bot_id    = NULL,
      winner_id = NULL
  WHERE tourney_id = p_tourney_id;

  UPDATE public.draw_matches dm
  SET top_id = tmp.top_id,
      bot_id = tmp.bot_id
  FROM tmp_first_round tmp
  WHERE dm.tourney_id = p_tourney_id
    AND dm.id        = tmp.id;

  SELECT LEFT(tourney_date::text, 4)::INT
  INTO match_year
  FROM estratego_v1.tournaments
  WHERE tourney_id = p_tourney_id
  LIMIT 1;

  FOR round_idx IN 1 .. array_length(rounds, 1) LOOP
    current_round := rounds[round_idx];
    next_round := CASE
      WHEN round_idx < array_length(rounds, 1)
        THEN rounds[round_idx + 1]
      ELSE NULL
    END;

    IF round_idx < first_round_idx THEN
      CONTINUE;
    END IF;

    FOR r IN
      SELECT id, top_id, bot_id
      FROM public.draw_matches
      WHERE tourney_id = p_tourney_id
        AND round      = current_round
      ORDER BY id
    LOOP
      top_player := NULL;
      bot_player := NULL;

      IF r.top_id IS NOT NULL THEN
        BEGIN
          top_player := r.top_id::INT;
        EXCEPTION WHEN invalid_text_representation THEN
          top_player := NULL;
        END;
      END IF;

      IF r.bot_id IS NOT NULL THEN
        BEGIN
          bot_player := r.bot_id::INT;
        EXCEPTION WHEN invalid_text_representation THEN
          bot_player := NULL;
        END;
      END IF;

      IF top_player IS NULL AND bot_player IS NULL THEN
        CONTINUE;
      ELSIF top_player IS NULL THEN
        winner := bot_player;
      ELSIF bot_player IS NULL THEN
        winner := top_player;
      ELSE
        prematch := get_extended_prematch_summary(p_tourney_id, match_year, top_player, bot_player);
        prob_top := (prematch -> 'playerA' ->> 'win_probability')::FLOAT;
        winner := CASE
          WHEN random() < prob_top THEN top_player
          ELSE bot_player
        END;
      END IF;

      UPDATE public.draw_matches
      SET winner_id = winner
      WHERE tourney_id = p_tourney_id
        AND id        = r.id;

      IF next_round IS NOT NULL THEN
        match_num := split_part(r.id, '-', 2)::INT;
        next_match_num := (match_num + 1) / 2;
        next_match_id := next_round || '-' || next_match_num;

        IF (match_num % 2) = 1 THEN
          UPDATE public.draw_matches
          SET top_id = winner
          WHERE tourney_id = p_tourney_id
            AND id        = next_match_id;
        ELSE
          UPDATE public.draw_matches
          SET bot_id = winner
          WHERE tourney_id = p_tourney_id
            AND id        = next_match_id;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;
