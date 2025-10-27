-- Creates a lightweight cache table for sportsbook odds responses.
CREATE TABLE IF NOT EXISTS public.odds_cache (
  id            BIGSERIAL PRIMARY KEY,
  player_key    TEXT NOT NULL,
  event_scope   TEXT,
  sport_key     TEXT NOT NULL,
  data          JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Accelerates lookups by player-key + event scope.
CREATE UNIQUE INDEX IF NOT EXISTS odds_cache_player_scope_idx
  ON public.odds_cache (player_key, event_scope);

-- Optional TTL pruning helper.
CREATE INDEX IF NOT EXISTS odds_cache_updated_at_idx
  ON public.odds_cache (updated_at);

-- Enable RLS in case it isn't already and allow anonymous selects/inserts.
ALTER TABLE public.odds_cache ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'odds_cache'
      AND policyname = 'odds_cache_select'
  ) THEN
    CREATE POLICY odds_cache_select
      ON public.odds_cache
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'odds_cache'
      AND policyname = 'odds_cache_upsert'
  ) THEN
    CREATE POLICY odds_cache_upsert
      ON public.odds_cache
      FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'odds_cache'
      AND policyname = 'odds_cache_update'
  ) THEN
    CREATE POLICY odds_cache_update
      ON public.odds_cache
      FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;
