-- Guarda, para cada partido consultado en el prematch, la probabilidad del
-- modelo junto con la cuota de mercado (normalmente Pinnacle) disponible en
-- ese momento. Permite comparar despues, con el resultado real ya conocido,
-- cuando el mercado se desvia de lo que dicen los datos y si el modelo
-- capta esas desviaciones.
CREATE TABLE IF NOT EXISTS public.prediction_log (
  id                       BIGSERIAL PRIMARY KEY,
  tourney_id               TEXT NOT NULL,
  event_name               TEXT,
  player_a_id              INTEGER NOT NULL,
  player_b_id              INTEGER NOT NULL,
  player_a_name            TEXT,
  player_b_name            TEXT,
  model_prob_a             NUMERIC,
  bookmaker                TEXT,
  price_a                  NUMERIC,
  price_b                  NUMERIC,
  market_implied_prob_a    NUMERIC,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS prediction_log_match_idx
  ON public.prediction_log (tourney_id, player_a_id, player_b_id);

CREATE INDEX IF NOT EXISTS prediction_log_created_at_idx
  ON public.prediction_log (created_at);

ALTER TABLE public.prediction_log ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prediction_log'
      AND policyname = 'prediction_log_select'
  ) THEN
    CREATE POLICY prediction_log_select
      ON public.prediction_log
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prediction_log'
      AND policyname = 'prediction_log_insert'
  ) THEN
    CREATE POLICY prediction_log_insert
      ON public.prediction_log
      FOR INSERT
      WITH CHECK (true);
  END IF;
END;
$$;
