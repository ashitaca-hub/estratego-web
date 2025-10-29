import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type PlayerStatsRow = {
  player_id: string | null;
  surface_used: string | null;
  tourney_id: string | null;
  previous_tourney_id: string | null;
  aces_best_of_3: number | null;
  aces_same_surface: number | null;
  aces_current_tournament: number | null;
  aces_previous_tournament: number | null;
  double_faults_best_of_3: number | null;
  double_faults_same_surface: number | null;
  double_faults_current_tournament: number | null;
  double_faults_previous_tournament: number | null;
  aces_current_minus_previous: number | null;
  double_faults_current_minus_previous: number | null;
  opponent_aces_best_of_3_same_surface: number | null;
  opponent_double_faults_best_of_3_same_surface: number | null;
  sample_aces_best_of_3: number | null;
  sample_aces_same_surface: number | null;
  sample_aces_current_tournament: number | null;
  sample_aces_previous_tournament: number | null;
  sample_double_faults_best_of_3: number | null;
  sample_double_faults_same_surface: number | null;
  sample_double_faults_current_tournament: number | null;
  sample_double_faults_previous_tournament: number | null;
  sample_opponent_aces_best_of_3_same_surface: number | null;
  sample_opponent_double_faults_best_of_3_same_surface: number | null;
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

const normalizeSurface = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
};

const derivePreviousTourney = (tourneyId: string | null): string | null => {
  if (!tourneyId) return null;
  const match = tourneyId.match(/^(\d{4})(-.+)$/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  if (!Number.isFinite(year)) return null;
  return `${year - 1}${match[2]}`;
};

const coerceNumber = (value: unknown): number | null => {
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const rawPlayerId = (body as Record<string, unknown>).player_id;
  const rawSurface = (body as Record<string, unknown>).surface;
  const rawTourneyId = (body as Record<string, unknown>).tourney_id;

  const playerId = normalizePlayerId(rawPlayerId);
  if (!playerId) {
    return NextResponse.json(
      { error: "player_id requerido" },
      { status: 400 },
    );
  }

  const normalizedSurface = normalizeSurface(rawSurface);
  const tourneyId =
    typeof rawTourneyId === "string" ? rawTourneyId.trim() : null;
  const previousTourney = derivePreviousTourney(tourneyId);

  const numericPlayer = Number.parseInt(playerId, 10);
  if (!Number.isFinite(numericPlayer)) {
    return NextResponse.json(
      { error: "player_id debe ser numerico" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .rpc("player_stats_summary", {
      p_player_id: numericPlayer,
      p_surface: normalizedSurface,
      p_tourney_id: tourneyId,
    })
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = (data ?? null) as PlayerStatsRow | null;

  return NextResponse.json({
    player_id: payload?.player_id ?? String(numericPlayer),
    filters: {
      surface: payload?.surface_used ?? normalizedSurface,
      tourney_id: payload?.tourney_id ?? tourneyId,
      previous_tourney_id:
        payload?.previous_tourney_id ?? previousTourney,
    },
    stats: {
      aces_best_of_3: coerceNumber(payload?.aces_best_of_3),
      aces_same_surface: coerceNumber(payload?.aces_same_surface),
      aces_current_tournament: coerceNumber(payload?.aces_current_tournament),
      aces_previous_tournament: coerceNumber(payload?.aces_previous_tournament),
      double_faults_best_of_3: coerceNumber(payload?.double_faults_best_of_3),
      double_faults_same_surface: coerceNumber(payload?.double_faults_same_surface),
      double_faults_current_tournament: coerceNumber(payload?.double_faults_current_tournament),
      double_faults_previous_tournament: coerceNumber(
        payload?.double_faults_previous_tournament,
      ),
      aces_current_minus_previous: coerceNumber(
        payload?.aces_current_minus_previous,
      ),
      double_faults_current_minus_previous: coerceNumber(
        payload?.double_faults_current_minus_previous,
      ),
      opponent_aces_best_of_3_same_surface: coerceNumber(
        payload?.opponent_aces_best_of_3_same_surface,
      ),
      opponent_double_faults_best_of_3_same_surface: coerceNumber(
        payload?.opponent_double_faults_best_of_3_same_surface,
      ),
    },
    samples: {
      aces_best_of_3: coerceNumber(payload?.sample_aces_best_of_3) ?? 0,
      aces_same_surface: coerceNumber(payload?.sample_aces_same_surface) ?? 0,
      aces_current_tournament:
        coerceNumber(payload?.sample_aces_current_tournament) ?? 0,
      aces_previous_tournament:
        coerceNumber(payload?.sample_aces_previous_tournament) ?? 0,
      double_faults_best_of_3:
        coerceNumber(payload?.sample_double_faults_best_of_3) ?? 0,
      double_faults_same_surface:
        coerceNumber(payload?.sample_double_faults_same_surface) ?? 0,
      double_faults_current_tournament:
        coerceNumber(payload?.sample_double_faults_current_tournament) ?? 0,
      double_faults_previous_tournament:
        coerceNumber(payload?.sample_double_faults_previous_tournament) ?? 0,
      opponent_aces_best_of_3_same_surface:
        coerceNumber(payload?.sample_opponent_aces_best_of_3_same_surface) ?? 0,
      opponent_double_faults_best_of_3_same_surface:
        coerceNumber(payload?.sample_opponent_double_faults_best_of_3_same_surface) ?? 0,
    },
  });
}
