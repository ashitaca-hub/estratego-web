-- Rebuilds the first-round matchups in draw_matches based on draw_entries.
--
-- El tamano del cuadro se deriva de la posicion (pos) mas alta cargada en
-- draw_entries para el torneo, redondeada a la potencia de 2 superior, en
-- vez de leerse de una columna draw_size separada (tournaments/tournaments_info)
-- que se ha desincronizado varias veces. Ademas, draws reales de ATP/Challenger
-- como 28, 48 o 56 SIEMPRE se juegan como el siguiente cuadro potencia de 2
-- (32, 64, 64...) con byes explicitos para los sembrados que se saltan la
-- primera ronda -- redondear hacia arriba en vez de exigir una potencia de 2
-- exacta evita que esos torneos caigan silenciosamente en un "R16" por
-- defecto con el numero de partidos equivocado.
CREATE OR REPLACE FUNCTION public.build_draw_matches(
  p_tournament_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
  round_labels CONSTANT TEXT[] := ARRAY['R128','R64','R32','R16','QF','SF','F'];
  v_max_pos    INT;
  v_size       INT;
  v_round      TEXT;
  start_idx    INT;
  i            INT;
  top_pos      INT;
  bot_pos      INT;
  v_idx        INT;
  top_id       INT;
  bot_id       INT;
  matches_prev INT;
  r_idx        INT;
BEGIN
  SELECT MAX(pos)
    INTO v_max_pos
    FROM public.draw_entries
   WHERE tourney_id = p_tournament_id;

  IF v_max_pos IS NULL OR v_max_pos < 2 THEN
    RAISE EXCEPTION 'No hay draw_entries para tourney_id=%', p_tournament_id;
  END IF;

  -- Redondea al siguiente tamano de cuadro potencia de 2 (2,4,8,...,128).
  v_size := 2;
  WHILE v_size < v_max_pos LOOP
    v_size := v_size * 2;
  END LOOP;

  -- Drop existing matches for this tournament to ensure a clean rebuild.
  DELETE
    FROM public.draw_matches
   WHERE tourney_id = p_tournament_id;

  v_round := CASE v_size
    WHEN 128 THEN 'R128'
    WHEN 64  THEN 'R64'
    WHEN 32  THEN 'R32'
    WHEN 16  THEN 'R16'
    WHEN 8   THEN 'QF'
    WHEN 4   THEN 'SF'
    WHEN 2   THEN 'F'
    ELSE 'R16'
  END;

  SELECT idx
    INTO start_idx
    FROM unnest(round_labels) WITH ORDINALITY AS t(lbl, idx)
   WHERE lbl = v_round
   LIMIT 1;

  v_idx := 1;
  i := 1;

  -- Generate pairings sequentially using the positions in draw_entries.
  -- Una posicion sin fila en draw_entries se trata como bye (NULL).
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

  -- Pre-create empty matches for later rounds so simulations can advance.
  IF start_idx IS NOT NULL THEN
    matches_prev := v_size / 2; -- number of matches in the opening round

    FOR r_idx IN start_idx + 1 .. array_length(round_labels, 1) LOOP
      matches_prev := (matches_prev + 1) / 2; -- round up half the previous round

      IF matches_prev <= 0 THEN
        EXIT;
      END IF;

      FOR i IN 1 .. matches_prev LOOP
        INSERT INTO public.draw_matches (id, tourney_id, round, top_id, bot_id, winner_id)
        VALUES (
          CONCAT(round_labels[r_idx], '-', i),
          p_tournament_id,
          round_labels[r_idx],
          NULL,
          NULL,
          NULL
        )
        ON CONFLICT (tourney_id, id) DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;
END;
$function$;
