import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = data ?? null;

  return NextResponse.json({
    player_id: payload?.player_id ?? playerId,
    filters: {
      surface: payload?.surface_used ?? normalizedSurface,
      tourney_id: payload?.tourney_id ?? tourneyId,
      previous_tourney_id:
        payload?.previous_tourney_id ?? previousTourney,
    },
    stats: {
      aces_best_of_3: payload?.aces_best_of_3 ?? null,
      aces_same_surface: payload?.aces_same_surface ?? null,
      aces_previous_tournament: payload?.aces_previous_tournament ?? null,
      double_faults_best_of_3: payload?.double_faults_best_of_3 ?? null,
      double_faults_same_surface: payload?.double_faults_same_surface ?? null,
      double_faults_previous_tournament:
        payload?.double_faults_previous_tournament ?? null,
      opponent_aces_best_of_3_same_surface:
        payload?.opponent_aces_best_of_3_same_surface ?? null,
      opponent_double_faults_best_of_3_same_surface:
        payload?.opponent_double_faults_best_of_3_same_surface ?? null,
    },
    samples: {
      aces_best_of_3: payload?.sample_aces_best_of_3 ?? 0,
      aces_same_surface: payload?.sample_aces_same_surface ?? 0,
      aces_previous_tournament:
        payload?.sample_aces_previous_tournament ?? 0,
      double_faults_best_of_3:
        payload?.sample_double_faults_best_of_3 ?? 0,
      double_faults_same_surface:
        payload?.sample_double_faults_same_surface ?? 0,
      double_faults_previous_tournament:
        payload?.sample_double_faults_previous_tournament ?? 0,
      opponent_aces_best_of_3_same_surface:
        payload?.sample_opponent_aces_best_of_3_same_surface ?? 0,
      opponent_double_faults_best_of_3_same_surface:
        payload?.sample_opponent_double_faults_best_of_3_same_surface ?? 0,
    },
  });
}
