-- Rebuilds the first-round matchups in draw_matches based on draw_entries.
-- Expects the tournament metadata (draw_size) to live in public.tournaments_info.
CREATE OR REPLACE FUNCTION public.build_draw_matches(
  p_tournament_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
  v_size    INT;
  v_round   TEXT;
  i         INT;
  top_pos   INT;
  bot_pos   INT;
  v_idx     INT;
  top_id    INT;
  bot_id    INT;
BEGIN
  -- Determine draw size for the requested tournament.
  SELECT draw_size
    INTO v_size
    FROM public.tournaments_info
   WHERE tourney_id = p_tournament_id;

  IF v_size IS NULL THEN
    RAISE EXCEPTION 'tournament % not found in tournaments_info', p_tournament_id;
  END IF;

  -- Drop existing matches for this tournament to ensure a clean rebuild.
  DELETE
    FROM public.draw_matches
   WHERE tourney_id = p_tournament_id;

  -- Pick the opening round label based on draw size (defaults to R16).
  IF v_size = 16 THEN
    v_round := 'R16';
  ELSIF v_size = 32 THEN
    v_round := 'R32';
  ELSIF v_size = 64 THEN
    v_round := 'R64';
  ELSE
    v_round := 'R16';
  END IF;

  v_idx := 1;
  i := 1;

  -- Generate pairings sequentially using the positions in draw_entries.
  WHILE i < v_size LOOP
    top_pos := i;
    bot_pos := i + 1;

    SELECT player_id
      INTO top_id
      FROM public.draw_entries
     WHERE tourney_id = p_tournament_id
       AND pos = top_pos;

    SELECT player_id
      INTO bot_id
      FROM public.draw_entries
     WHERE tourney_id = p_tournament_id
       AND pos = bot_pos;

    INSERT INTO public.draw_matches (id, tourney_id, round, top_id, bot_id)
    VALUES (
      CONCAT(v_round, '-', v_idx),
      p_tournament_id,
      v_round,
      top_id,
      bot_id
    );

    v_idx := v_idx + 1;
    i := i + 2;
  END LOOP;
END;
$function$;
