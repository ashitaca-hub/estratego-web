-- simulation_results table stores, per simulated run, the deepest round
-- reached by every player in a given tournament.
CREATE TABLE IF NOT EXISTS public.simulation_results (
  tourney_id   TEXT NOT NULL,
  run_number   INT  NOT NULL,
  player_id    INT  NOT NULL,
  reached_round TEXT NOT NULL,
  PRIMARY KEY (tourney_id, run_number, player_id)
);

-- simulate_multiple_runs executes a tournament simulation p_runs times and
-- records, for each run, how far every player advanced.
CREATE OR REPLACE FUNCTION public.simulate_multiple_runs(
  p_tourney_id TEXT,
  p_year       INT,
  p_runs       INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
  run_idx      INT;
  round_labels CONSTANT TEXT[] := ARRAY['R128','R64','R32','R16','QF','SF','F'];
BEGIN
  IF p_runs <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'p_runs must be greater than zero';
  END IF;

  -- Fresh slate for the requested tournament.
  DELETE FROM public.simulation_results
   WHERE tourney_id = p_tourney_id;

  FOR run_idx IN 1..p_runs LOOP
    -- Execute a full tournament simulation (assumes the draw is already built).
    PERFORM public.simulate_full_tournament(p_tourney_id);

    WITH round_map AS (
      SELECT round, ord::INT
      FROM unnest(round_labels) WITH ORDINALITY AS t(round, ord)
    ),
    player_stages AS (
      SELECT
        player_id,
        CASE
          WHEN is_winner THEN COALESCE(next_round.ord, current_round.ord)
          ELSE current_round.ord
        END AS stage_ord
      FROM public.draw_matches dm
      CROSS JOIN LATERAL (
        VALUES
          (dm.top_id, dm.winner_id = dm.top_id),
          (dm.bot_id, dm.winner_id = dm.bot_id)
      ) AS p(player_id, is_winner)
      JOIN round_map current_round ON current_round.round = dm.round
      LEFT JOIN round_map next_round ON next_round.ord = current_round.ord + 1
      WHERE dm.tourney_id = p_tourney_id
        AND p.player_id IS NOT NULL
    ),
    best_stage AS (
      SELECT player_id, MAX(stage_ord) AS max_ord
      FROM player_stages
      GROUP BY player_id
    )
    INSERT INTO public.simulation_results (tourney_id, run_number, player_id, reached_round)
    SELECT
      p_tourney_id,
      run_idx,
      bs.player_id,
      rm.round
    FROM best_stage bs
    JOIN round_map rm ON rm.ord = bs.max_ord
    ON CONFLICT (tourney_id, run_number, player_id)
    DO UPDATE
      SET reached_round = EXCLUDED.reached_round;
  END LOOP;
END;
$function$;
