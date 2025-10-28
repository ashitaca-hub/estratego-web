import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type RawMatchRow = {
  tourney_id: unknown;
  best_of: unknown;
  surface: unknown;
  winner_id: unknown;
  loser_id: unknown;
  w_ace: unknown;
  w_df: unknown;
  l_ace: unknown;
  l_df: unknown;
};

type Role = "winner" | "loser";

type MetricAccumulator = {
  sum: number;
  count: number;
};

const makeMetric = (): MetricAccumulator => ({ sum: 0, count: 0 });

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const addValue = (metric: MetricAccumulator, value: unknown) => {
  const num = toNumber(value);
  if (num === null) return;
  metric.sum += num;
  metric.count += 1;
};

const average = (metric: MetricAccumulator): number | null => {
  if (!metric.count) return null;
  return metric.sum / metric.count;
};

const normalizeSurface = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
};

const normalizePlayerId = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "bigint") {
    return String(value);
  }
  return null;
};

const previousTourneyId = (tourneyId: string | null): string | null => {
  if (!tourneyId) return null;
  const match = tourneyId.match(/^(\d{4})(-.+)$/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  if (!Number.isFinite(year)) return null;
  return `${year - 1}${match[2]}`;
};

const MATCH_FIELDS =
  "tourney_id,best_of,surface,winner_id,loser_id,w_ace,w_df,l_ace,l_df";

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Supabase service role no configurado" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const rawPlayerId = (body as Record<string, unknown>).player_id;
  const surfaceRaw = (body as Record<string, unknown>).surface;
  const tourneyIdRaw = (body as Record<string, unknown>).tourney_id;

  const playerId = normalizePlayerId(rawPlayerId);
  if (!playerId) {
    return NextResponse.json(
      { error: "player_id requerido" },
      { status: 400 },
    );
  }

  const normalizedSurface = normalizeSurface(surfaceRaw);
  const tourneyId =
    typeof tourneyIdRaw === "string" ? tourneyIdRaw.trim() : null;
  const previousTourney = previousTourneyId(tourneyId ?? null);

  const numericPlayer = Number.parseInt(playerId, 10);
  const filterValue: string | number = Number.isFinite(numericPlayer)
    ? numericPlayer
    : playerId;

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const [winnerResult, loserResult] = await Promise.all([
    supabaseAdmin
      .schema("estratego_v1")
      .from("matches")
      .select(MATCH_FIELDS)
      .eq("winner_id", filterValue)
      .limit(2000),
    supabaseAdmin
      .schema("estratego_v1")
      .from("matches")
      .select(MATCH_FIELDS)
      .eq("loser_id", filterValue)
      .limit(2000),
  ]);

  if (winnerResult.error) {
    return NextResponse.json({ error: winnerResult.error.message }, { status: 500 });
  }
  if (loserResult.error) {
    return NextResponse.json({ error: loserResult.error.message }, { status: 500 });
  }

  const entries: Array<{ row: RawMatchRow; role: Role }> = [];

  (winnerResult.data as RawMatchRow[] | null)?.forEach((row) => {
    entries.push({ row, role: "winner" });
  });
  (loserResult.data as RawMatchRow[] | null)?.forEach((row) => {
    entries.push({ row, role: "loser" });
  });

  const metrics = {
    aces_best_of_3: makeMetric(),
    aces_same_surface: makeMetric(),
    aces_previous_tournament: makeMetric(),
    df_best_of_3: makeMetric(),
    df_same_surface: makeMetric(),
    df_previous_tournament: makeMetric(),
    opponent_aces_best_of_3_same_surface: makeMetric(),
    opponent_df_best_of_3_same_surface: makeMetric(),
  };

  const counts: Record<keyof typeof metrics, number> = {
    aces_best_of_3: 0,
    aces_same_surface: 0,
    aces_previous_tournament: 0,
    df_best_of_3: 0,
    df_same_surface: 0,
    df_previous_tournament: 0,
    opponent_aces_best_of_3_same_surface: 0,
    opponent_df_best_of_3_same_surface: 0,
  };

  for (const { row, role } of entries) {
    const bestOf = toNumber(row.best_of);
    const currentSurface = normalizeSurface(row.surface);
    const matchTourneyId = normalizePlayerId(row.tourney_id);

    const acesFor = role === "winner" ? row.w_ace : row.l_ace;
    const dfFor = role === "winner" ? row.w_df : row.l_df;
    const acesAgainst = role === "winner" ? row.l_ace : row.w_ace;
    const dfAgainst = role === "winner" ? row.l_df : row.w_df;

    if (bestOf === 3) {
      addValue(metrics.aces_best_of_3, acesFor);
      if (toNumber(acesFor) !== null) counts.aces_best_of_3 += 1;

      addValue(metrics.df_best_of_3, dfFor);
      if (toNumber(dfFor) !== null) counts.df_best_of_3 += 1;
    }

    if (normalizedSurface && currentSurface === normalizedSurface) {
      addValue(metrics.aces_same_surface, acesFor);
      if (toNumber(acesFor) !== null) counts.aces_same_surface += 1;

      addValue(metrics.df_same_surface, dfFor);
      if (toNumber(dfFor) !== null) counts.df_same_surface += 1;

      if (bestOf === 3) {
        addValue(
          metrics.opponent_aces_best_of_3_same_surface,
          acesAgainst,
        );
        if (toNumber(acesAgainst) !== null) {
          counts.opponent_aces_best_of_3_same_surface += 1;
        }

        addValue(
          metrics.opponent_df_best_of_3_same_surface,
          dfAgainst,
        );
        if (toNumber(dfAgainst) !== null) {
          counts.opponent_df_best_of_3_same_surface += 1;
        }
      }
    }

    if (previousTourney && matchTourneyId === previousTourney) {
      addValue(metrics.aces_previous_tournament, acesFor);
      if (toNumber(acesFor) !== null) counts.aces_previous_tournament += 1;

      addValue(metrics.df_previous_tournament, dfFor);
      if (toNumber(dfFor) !== null) counts.df_previous_tournament += 1;
    }
  }

  return NextResponse.json({
    player_id: playerId,
    filters: {
      surface: normalizedSurface,
      tourney_id: tourneyId,
      previous_tourney_id: previousTourney,
    },
    stats: {
      aces_best_of_3: average(metrics.aces_best_of_3),
      aces_same_surface: average(metrics.aces_same_surface),
      aces_previous_tournament: average(metrics.aces_previous_tournament),
      double_faults_best_of_3: average(metrics.df_best_of_3),
      double_faults_same_surface: average(metrics.df_same_surface),
      double_faults_previous_tournament: average(metrics.df_previous_tournament),
      opponent_aces_best_of_3_same_surface: average(
        metrics.opponent_aces_best_of_3_same_surface,
      ),
      opponent_double_faults_best_of_3_same_surface: average(
        metrics.opponent_df_best_of_3_same_surface,
      ),
    },
    samples: {
      aces_best_of_3: counts.aces_best_of_3,
      aces_same_surface: counts.aces_same_surface,
      aces_previous_tournament: counts.aces_previous_tournament,
      double_faults_best_of_3: counts.df_best_of_3,
      double_faults_same_surface: counts.df_same_surface,
      double_faults_previous_tournament: counts.df_previous_tournament,
      opponent_aces_best_of_3_same_surface:
        counts.opponent_aces_best_of_3_same_surface,
      opponent_double_faults_best_of_3_same_surface:
        counts.opponent_df_best_of_3_same_surface,
    },
  });
}
