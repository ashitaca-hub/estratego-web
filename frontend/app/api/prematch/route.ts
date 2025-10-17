// app/api/prematch/route.ts
export const dynamic = "force-dynamic";
import { supabase } from "@/lib/supabase";

type PlayerSummary = {
  win_pct_year: number | null;
  win_pct_surface: number | null;
  ranking: number | null;
  home_advantage: boolean | null;
  days_since_last: number | null;
  win_pct_month: number | null;
  win_pct_vs_top10: number | null;
  court_speed_score: number | null;
  win_score: number | null;
  win_probability: number | null;
  defends_round?: string | null;
};

type TournamentSummary = {
  name: string | null;
  surface: string | null;
  bucket: string | null;
  month: number | null;
};

type ExtrasSummary = {
  display_p: string | null;
  display_o: string | null;
  country_p: string | null;
  country_o: string | null;
  rank_p: number | null;
  rank_o: number | null;
  ytd_wr_p: number | null;
  ytd_wr_o: number | null;
};

type PrematchSummaryResponse = {
  prob_player: number | null;
  playerA: PlayerSummary;
  playerB: PlayerSummary;
  h2h: {
    wins: number;
    losses: number;
    total: number;
    last_meeting: string | null;
  };
  last_surface: string | null;
  defends_round: string | null;
  court_speed: number | null;
  tournament?: TournamentSummary;
  extras?: ExtrasSummary;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const match = value.trim().match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return null;
    const normalized = match[0].includes(",") && !match[0].includes(".")
      ? match[0].replace(",", ".")
      : match[0].replace(/,/g, "");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeProbability = (value: number | null): number | null => {
  if (value === null || Number.isNaN(value)) return null;

  const ratio = value > 1 ? value / 100 : value;
  if (!Number.isFinite(ratio)) return null;
  if (ratio < 0) return 0;
  if (ratio > 1) return 1;

  return ratio;
};

const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return null;
};

const asString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return `${value}`;
  return null;
};

const hasTruthyValue = (obj: Record<string, unknown>): boolean => {
  return Object.values(obj).some((value) => value !== null && value !== undefined);
};

const pickNumber = (
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): number | null => {
  if (!source) return null;
  for (const key of keys) {
    const value = asNumber(source[key]);
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
};

const pickBoolean = (
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): boolean | null => {
  if (!source) return null;
  for (const key of keys) {
    const value = asBoolean(source[key]);
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
};

const buildPlayer = (
  base: Record<string, unknown>,
  keys: string[],
  fallbackPrefixes: string[],
): PlayerSummary => {
  let playerRecord: Record<string, unknown> | null = null;
  for (const candidate of keys) {
    playerRecord = asRecord(base[candidate]);
    if (playerRecord) break;
  }

  const getFromPrefixes = <T>(
    extractor: (source: Record<string, unknown>, prefix: string) => T | null,
  ): T | null => {
    for (const prefix of fallbackPrefixes) {
      const fromPrefix = extractor(base, prefix);
      if (fromPrefix !== null && fromPrefix !== undefined) {
        return fromPrefix;
      }
    }
    return null;
  };

  const winPctYear =
    pickNumber(playerRecord, [
      "win_pct_year",
      "win_pct_season",
      "ytd_win_pct",
      "ytd_wr",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_win_pct_year`,
        `win_pct_year_${prefix}`,
        `${prefix}_win_pct_season`,
        `win_pct_season_${prefix}`,
        `${prefix}_ytd_win_pct`,
        `ytd_win_pct_${prefix}`,
        `${prefix}_ytd_wr`,
        `ytd_wr_${prefix}`,
      ]),
    );
  const winPctSurface =
    pickNumber(playerRecord, [
      "win_pct_surface",
      "surface_win_pct",
      "surface_wr",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_win_pct_surface`,
        `win_pct_surface_${prefix}`,
        `${prefix}_surface_win_pct`,
        `surface_win_pct_${prefix}`,
        `${prefix}_surface_wr`,
        `surface_wr_${prefix}`,
      ]),
    );
  const ranking =
    pickNumber(playerRecord, ["ranking", "rank", "current_rank"]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_ranking`,
        `ranking_${prefix}`,
        `${prefix}_rank`,
        `rank_${prefix}`,
        `${prefix}_current_rank`,
        `current_rank_${prefix}`,
      ]),
    );
  const homeAdvantage =
    pickBoolean(playerRecord, ["home_advantage", "is_home", "is_local"]) ??
    getFromPrefixes((source, prefix) =>
      pickBoolean(source, [
        `${prefix}_home_advantage`,
        `home_advantage_${prefix}`,
        `${prefix}_is_home`,
        `is_home_${prefix}`,
        `${prefix}_is_local`,
        `is_local_${prefix}`,
      ]),
    );
  const daysSinceLast =
    pickNumber(playerRecord, [
      "days_since_last",
      "days_since_last_match",
      "days_since_last_game",
      "days_since_match",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_days_since_last`,
        `days_since_last_${prefix}`,
        `${prefix}_days_since_last_match`,
        `days_since_last_match_${prefix}`,
        `${prefix}_days_since_match`,
        `days_since_match_${prefix}`,
      ]),
    );
  const winPctMonth =
    pickNumber(playerRecord, [
      "win_pct_month",
      "win_pct_this_month",
      "win_pct_last_30",
      "win_pct_30d",
      "monthly_win_pct",
      "last_30_wr",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_win_pct_month`,
        `win_pct_month_${prefix}`,
        `${prefix}_win_pct_this_month`,
        `win_pct_this_month_${prefix}`,
        `${prefix}_win_pct_last_30`,
        `win_pct_last_30_${prefix}`,
        `${prefix}_win_pct_30d`,
        `win_pct_30d_${prefix}`,
        `${prefix}_monthly_win_pct`,
        `monthly_win_pct_${prefix}`,
        `${prefix}_last_30_wr`,
        `last_30_wr_${prefix}`,
      ]),
    );
  const winPctVsTop10 =
    pickNumber(playerRecord, [
      "win_pct_vs_top10",
      "win_pct_vs_top_10",
      "win_pct_top10",
      "top10_win_pct",
      "pct_vs_top10",
      "pct_vs_top_10",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_win_pct_vs_top10`,
        `win_pct_vs_top10_${prefix}`,
        `${prefix}_win_pct_vs_top_10`,
        `win_pct_vs_top_10_${prefix}`,
        `${prefix}_win_pct_top10`,
        `win_pct_top10_${prefix}`,
        `${prefix}_top10_win_pct`,
        `top10_win_pct_${prefix}`,
        `${prefix}_pct_vs_top10`,
        `pct_vs_top10_${prefix}`,
        `${prefix}_pct_vs_top_10`,
        `pct_vs_top_10_${prefix}`,
      ]),
    );
  const courtSpeedScore =
    pickNumber(playerRecord, [
      "court_speed_score",
      "court_speed",
      "court_speed_index",
      "court_speed_rating",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_court_speed_score`,
        `court_speed_score_${prefix}`,
        `${prefix}_court_speed`,
        `court_speed_${prefix}`,
        `${prefix}_court_speed_index`,
        `court_speed_index_${prefix}`,
        `${prefix}_court_speed_rating`,
        `court_speed_rating_${prefix}`,
      ]),
    );
  const winScore =
    pickNumber(playerRecord, ["win_score", "win_rating", "win_index"]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_win_score`,
        `win_score_${prefix}`,
        `${prefix}_win_rating`,
        `win_rating_${prefix}`,
        `${prefix}_win_index`,
        `win_index_${prefix}`,
      ]),
    );
  const winProbability =
    pickNumber(playerRecord, [
      "win_probability",
      "probability",
      "win_prob",
      "predicted_win_pct",
    ]) ??
    getFromPrefixes((source, prefix) =>
      pickNumber(source, [
        `${prefix}_win_probability`,
        `win_probability_${prefix}`,
        `${prefix}_probability`,
        `probability_${prefix}`,
        `${prefix}_win_prob`,
        `win_prob_${prefix}`,
        `${prefix}_predicted_win_pct`,
        `predicted_win_pct_${prefix}`,
      ]),
    );
  const defendsRound =
    asString(playerRecord?.["defends_round"]) ??
    asString(playerRecord?.["last_year_round"]) ??
    getFromPrefixes((source, prefix) =>
      asString(
        source[`${prefix}_defends_round`] ??
          source[`${prefix}_last_year_round`] ??
          source[`defends_round_${prefix}`] ??
          source[`last_year_round_${prefix}`],
      ),
    );

  return {
    win_pct_year: winPctYear,
    win_pct_surface: winPctSurface,
    ranking,
    home_advantage: homeAdvantage,
    days_since_last: daysSinceLast,
    win_pct_month: winPctMonth,
    win_pct_vs_top10: winPctVsTop10,
    court_speed_score: courtSpeedScore,
    win_score: winScore,
    win_probability: winProbability,
    defends_round: defendsRound,
  };
};

const parseExtras = (base: Record<string, unknown>): ExtrasSummary | undefined => {
  const rawExtras = base.extras ?? base.extra ?? base.player_extras;
  let extrasRecord = asRecord(rawExtras);

  if (!extrasRecord && typeof rawExtras === "string") {
    try {
      const parsed = JSON.parse(rawExtras);
      extrasRecord = asRecord(parsed);
    } catch {
      extrasRecord = null;
    }
  }

  if (!extrasRecord) return undefined;

  const formatted: ExtrasSummary = {
    display_p: asString(extrasRecord?.["display_p"]),
    display_o: asString(extrasRecord?.["display_o"]),
    country_p: asString(extrasRecord?.["country_p"]),
    country_o: asString(extrasRecord?.["country_o"]),
    rank_p: asNumber(extrasRecord?.["rank_p"]),
    rank_o: asNumber(extrasRecord?.["rank_o"]),
    ytd_wr_p: asNumber(extrasRecord?.["ytd_wr_p"]),
    ytd_wr_o: asNumber(extrasRecord?.["ytd_wr_o"]),
  };

  return hasTruthyValue(formatted as Record<string, unknown>) ? formatted : undefined;
};

const parseTournament = (base: Record<string, unknown>): TournamentSummary | undefined => {
  const rawTournament = base.tournament ?? base.tourney ?? base.event;
  const tournamentRecord = asRecord(rawTournament) ?? null;

  const formatted: TournamentSummary = {
    name:
      asString(tournamentRecord?.["name"]) ??
      asString(base["tournament_name"]) ??
      asString(base["event_name"]),
    surface:
      asString(tournamentRecord?.["surface"]) ??
      asString(base["tournament_surface"]) ??
      asString(base["surface"]),
    bucket:
      asString(tournamentRecord?.["bucket"]) ??
      asString(tournamentRecord?.["category"]) ??
      asString(base["tournament_bucket"]) ??
      asString(base["category"]),
    month: asNumber(tournamentRecord?.["month"]) ?? asNumber(base["tournament_month"]),
  };

  return hasTruthyValue(formatted as Record<string, unknown>) ? formatted : undefined;
};

const formatPrematchSummary = (raw: unknown): PrematchSummaryResponse => {
  const base = Array.isArray(raw) ? raw[0] : raw;
  const baseRecord = asRecord(base) ?? {};

  const playerA = buildPlayer(baseRecord, ["playerA", "player_a", "player_p", "p"], [
    "player_a",
    "playerA",
    "player_p",
    "p",
  ]);
  const playerB = buildPlayer(baseRecord, ["playerB", "player_b", "player_o", "o"], [
    "player_b",
    "playerB",
    "player_o",
    "o",
  ]);

  const h2hRecord =
    asRecord(baseRecord["h2h"]) ??
    asRecord(baseRecord["head_to_head"]) ??
    asRecord(baseRecord["h2h_stats"]) ??
    null;

  const wins =
    asNumber(h2hRecord?.["wins"]) ??
    asNumber(baseRecord["h2h_wins"]) ??
    asNumber(baseRecord["player_a_h2h_wins"]) ??
    0;
  const losses =
    asNumber(h2hRecord?.["losses"]) ??
    asNumber(baseRecord["h2h_losses"]) ??
    asNumber(baseRecord["player_a_h2h_losses"]) ??
    0;

  const lastMeeting =
    asString(h2hRecord?.["last_meeting"]) ??
    asString(baseRecord["last_meeting"]) ??
    asString(baseRecord["h2h_last_meeting"]);

  const metaRecord = asRecord(baseRecord["meta"]) ?? null;

  const lastSurface =
    asString(metaRecord?.["last_surface"]) ??
    asString(baseRecord["last_surface"]) ??
    asString(baseRecord["surface_last"]);
  const defendsRound =
    asString(metaRecord?.["defends_round"]) ??
    asString(baseRecord["defends_round"]) ??
    asString(baseRecord["defends"]);
  const courtSpeed =
    asNumber(metaRecord?.["court_speed"]) ??
    asNumber(baseRecord["court_speed"]) ??
    asNumber(baseRecord["speed"]);

  const extras = parseExtras(baseRecord);
  const tournament = parseTournament(baseRecord);

  // Priorizamos la probabilidad asociada explícitamente a playerA si existe,
  // y evitamos usar campos de display (nombres) como fuente numérica.
  const probabilityCandidates: Array<number | null> = [
    playerA.win_probability,
    asNumber(baseRecord["prob_player"]),
    asNumber(baseRecord["player_prob"]),
    asNumber(baseRecord["probability"]),
    asNumber((extras as any)?.ytd_wr_p),
  ];

  let probability: number | null = null;
  for (const candidate of probabilityCandidates) {
    const normalized = normalizeProbability(candidate);
    if (normalized !== null) {
      probability = normalized;
      break;
    }
  }

  return {
    prob_player: probability,
    playerA,
    playerB,
    h2h: {
      wins: wins ?? 0,
      losses: losses ?? 0,
      total: (wins ?? 0) + (losses ?? 0),
      last_meeting: lastMeeting,
    },
    last_surface: lastSurface,
    defends_round: defendsRound,
    court_speed: courtSpeed,
    tournament,
    extras,
  };
};

type PrematchRpcPayload = {
  player_a_id: number;
  player_b_id: number;
  p_tourney_id: string;
  p_year: number | string;
};

const extractYear = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const match = value.match(/\d{4}/);
    if (!match) return null;

    const parsed = Number.parseInt(match[0], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const isoFromString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!/[\-\/T]/.test(trimmed)) return null;

  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return null;

  return new Date(timestamp).toISOString().slice(0, 10);
};

const toIsoYear = (value: unknown, fallbackYear?: number): string | null => {
  const fromString = isoFromString(value);
  if (fromString) return fromString;

  if (typeof fallbackYear === "number" && Number.isFinite(fallbackYear)) {
    return `${fallbackYear}-01-01`;
  }

  return null;
};

const callExtendedPrematchSummary = async (payload: PrematchRpcPayload) => {
  console.log("🪵 Llamando get_extended_prematch_summary con:", payload);

  return supabase.rpc("get_extended_prematch_summary", payload);
};

export async function POST(req: Request) {
  const body = await req.json();
  const { playerA_id, playerB_id, tourney_id, year } = body;

  const normalizedYear = extractYear(year);
  const isoYearFromInput = isoFromString(year);
  const fallbackIsoYear = toIsoYear(year, normalizedYear ?? undefined);

  const preferIso = isoYearFromInput !== null;

  const primaryYear: number | string | null = preferIso
    ? isoYearFromInput
    : normalizedYear ?? fallbackIsoYear;

  if (!playerA_id || !playerB_id || !tourney_id || primaryYear === null) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), {
      status: 400,
    });
  }

  const alternateYear: number | string | null = preferIso
    ? normalizedYear
    : isoYearFromInput ?? (fallbackIsoYear !== primaryYear ? fallbackIsoYear : null);

  const rpcPayload: PrematchRpcPayload = {
    player_a_id: playerA_id,
    player_b_id: playerB_id,
    p_tourney_id: String(tourney_id),
    p_year: primaryYear,
  };

  let { data, error } = await callExtendedPrematchSummary(rpcPayload);

  if (error && alternateYear !== null) {
    const retryCondition = preferIso
      ? error.message.includes("invalid input syntax for type integer") ||
        error.message.includes("date/time field value out of range")
      : error.message.includes("function pg_catalog.extract");

    if (retryCondition) {
      console.warn(
        preferIso
          ? "⚠️ Reintentando prematch con año entero tras rechazo del ISO"
          : "⚠️ Reintentando prematch con fecha ISO para evitar error de extract",
        {
          originalYear: year,
          normalizedYear,
          isoYear: fallbackIsoYear,
          alternateYear,
        },
      );

      const retry = await callExtendedPrematchSummary({
        ...rpcPayload,
        p_year: alternateYear,
      });

      if (!retry.error) {
        data = retry.data;
        error = null;
      } else if (
        (preferIso && !retry.error.message.includes("function pg_catalog.extract")) ||
        (!preferIso && !retry.error.message.includes("invalid input syntax for type integer"))
      ) {
        // Solo remplazamos el error original si el reintento devolvió un mensaje distinto;
        // de lo contrario, conservamos el error inicial para facilitar el diagnóstico.
        data = retry.data;
        error = retry.error;
      } else {
        console.warn(
          preferIso
            ? "⚠️ Reintento con año entero rechazado por el RPC"
            : "⚠️ Reintento con fecha ISO rechazado por el RPC (esperaba entero)",
          {
            alternateYear,
            retryError: retry.error.message,
          },
        );
      }
    }
  }

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  const formatted = formatPrematchSummary(data);

  return new Response(JSON.stringify(formatted), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
