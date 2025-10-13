// app/api/prematch/route.ts
export const dynamic = "force-dynamic";
import { supabase } from "@/lib/supabase";

type PlayerSummary = {
  win_pct_year: number | null;
  win_pct_surface: number | null;
  ranking: number | null;
  home_advantage: boolean | null;
  days_since_last: number | null;
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
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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
    asNumber(playerRecord?.["win_pct_year"]) ??
    getFromPrefixes((source, prefix) =>
      asNumber(source[`${prefix}_win_pct_year`]) ?? asNumber(source[`win_pct_year_${prefix}`]),
    );
  const winPctSurface =
    asNumber(playerRecord?.["win_pct_surface"]) ??
    getFromPrefixes((source, prefix) =>
      asNumber(source[`${prefix}_win_pct_surface`]) ??
      asNumber(source[`win_pct_surface_${prefix}`]),
    );
  const ranking =
    asNumber(playerRecord?.["ranking"]) ??
    getFromPrefixes((source, prefix) =>
      asNumber(source[`${prefix}_ranking`]) ?? asNumber(source[`ranking_${prefix}`]),
    );
  const homeAdvantage =
    asBoolean(playerRecord?.["home_advantage"]) ??
    getFromPrefixes((source, prefix) =>
      asBoolean(source[`${prefix}_home_advantage`]) ??
      asBoolean(source[`home_advantage_${prefix}`]),
    );
  const daysSinceLast =
    asNumber(playerRecord?.["days_since_last"]) ??
    getFromPrefixes((source, prefix) =>
      asNumber(source[`${prefix}_days_since_last`]) ??
      asNumber(source[`days_since_last_${prefix}`]),
    );

  return {
    win_pct_year: winPctYear,
    win_pct_surface: winPctSurface,
    ranking,
    home_advantage: homeAdvantage,
    days_since_last: daysSinceLast,
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

  const tournament = parseTournament(baseRecord);
  const extras = parseExtras(baseRecord);

  return {
    prob_player:
      asNumber(baseRecord["prob_player"]) ??
      asNumber(baseRecord["player_prob"]) ??
      asNumber(baseRecord["probability"]) ??
      null,
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

const toIsoYear = (value: unknown, fallbackYear: number): string | null => {
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString().slice(0, 10);
    }
  }

  if (Number.isFinite(fallbackYear)) {
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

  if (!playerA_id || !playerB_id || !tourney_id || normalizedYear === null) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), {
      status: 400,
    });
  }

  const rpcPayload: PrematchRpcPayload = {
    player_a_id: playerA_id,
    player_b_id: playerB_id,
    p_tourney_id: String(tourney_id),
    p_year: normalizedYear,
  };

  let { data, error } = await callExtendedPrematchSummary(rpcPayload);

  if (error && error.message.includes("function pg_catalog.extract")) {
    const isoYear = toIsoYear(year, normalizedYear);

    if (isoYear) {
      console.warn(
        "⚠️ Reintentando prematch con fecha ISO para evitar error de extract",
        {
          originalYear: year,
          normalizedYear,
          isoYear,
        },
      );

      const retry = await callExtendedPrematchSummary({
        ...rpcPayload,
        p_year: isoYear,
      });

      if (!retry.error) {
        data = retry.data;
        error = null;
      } else if (!retry.error.message.includes("invalid input syntax for type integer")) {
        // Solo remplazamos el error original si el reintento devolvió un mensaje distinto;
        // de lo contrario, conservamos el error inicial para facilitar el diagnóstico.
        data = retry.data;
        error = retry.error;
      } else {
        console.warn(
          "⚠️ Reintento con fecha ISO rechazado por el RPC (esperaba entero)",
          {
            isoYear,
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
