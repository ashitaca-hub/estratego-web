export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { computePrematchSummary } from "@/app/api/prematch/route";

type PendingMatch = {
  id: string;
  round: string;
  topId: number;
  botId: number;
};

type ValueBetItem = {
  matchId: string;
  round: string;
  favoredPlayer: { id: string; name: string; country: string | null };
  otherPlayer: { id: string; name: string; country: string | null };
  modelProbability: number;
  oddsPrice: number;
  impliedProbability: number;
  valueDiff: number;
  tier: "high" | "good";
  bookmaker: string;
};

const VALUE_DIFF_FLOOR = 0.03; // 3pp, igual que ODDS_VALUE_THRESHOLD en /api/prematch
const VALUE_DIFF_HIGH = 0.15; // 15pp

const IOC_TO_ISO2: Record<string, string> = {
  ESP: "ES", ARG: "AR", USA: "US", GBR: "GB", UKR: "UA", GER: "DE", FRA: "FR", ITA: "IT",
  SUI: "CH", NED: "NL", BEL: "BE", SWE: "SE", NOR: "NO", DEN: "DK", CRO: "HR", SRB: "RS",
  BIH: "BA", POR: "PT", POL: "PL", CZE: "CZ", SVK: "SK", SLO: "SI", HUN: "HU", AUT: "AT",
  AUS: "AU", NZL: "NZ", CAN: "CA", MEX: "MX", COL: "CO", CHI: "CL", PER: "PE", ECU: "EC",
  URU: "UY", BOL: "BO", VEN: "VE", BRA: "BR", JPN: "JP", KOR: "KR", CHN: "CN", HKG: "HK",
  TPE: "TW", THA: "TH", VIE: "VN", IND: "IN", PAK: "PK", QAT: "QA", UAE: "AE", KAZ: "KZ",
  UZB: "UZ", GEO: "GE", ARM: "AM", TUR: "TR", GRE: "GR", CYP: "CY", ROU: "RO", BUL: "BG",
  LTU: "LT", LAT: "LV", EST: "EE", FIN: "FI", IRL: "IE", SCO: "GB", WAL: "GB",
};

const iocToIso2 = (ioc?: string | null): string | null => {
  if (!ioc || typeof ioc !== "string") return null;
  const code = ioc.trim().toUpperCase();
  return IOC_TO_ISO2[code] || null;
};

const isoToFlag = (iso?: string | null): string | null => {
  if (!iso || typeof iso !== "string") return null;
  const code = iso.trim().toUpperCase();
  if (code.length !== 2) return null;
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  const chars = Array.from(code).map((c) => String.fromCodePoint(A + (c.charCodeAt(0) - base)));
  return chars.join("");
};

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await fn(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const { data: hdr, error: hdrErr } = await supabase
      .from("tournaments")
      .select("tourney_id,name,surface")
      .eq("tourney_id", id)
      .single();

    if (hdrErr || !hdr) {
      return new Response(JSON.stringify({ error: hdrErr?.message || "Torneo no encontrado" }), {
        status: 404,
      });
    }

    const { data: rawMatches, error: matchesErr } = await supabase
      .from("draw_matches")
      .select("id,round,top_id,bot_id,winner_id")
      .eq("tourney_id", id);

    if (matchesErr) {
      return new Response(JSON.stringify({ error: matchesErr.message }), { status: 500 });
    }

    const pendingMatches: PendingMatch[] = (rawMatches ?? [])
      .filter((m: any) => m.top_id != null && m.bot_id != null && m.winner_id == null)
      .map((m: any) => ({
        id: m.id,
        round: m.round,
        topId: Number(m.top_id),
        botId: Number(m.bot_id),
      }))
      .filter((m) => Number.isFinite(m.topId) && Number.isFinite(m.botId));

    const playerIds = Array.from(new Set(pendingMatches.flatMap((m) => [m.topId, m.botId])));

    const [{ data: plist }, { data: iocList }] = await Promise.all([
      playerIds.length
        ? supabase.from("players_min").select("player_id,name").in("player_id", playerIds)
        : Promise.resolve({ data: [] as any[] }),
      playerIds.length
        ? supabase.from("players_flag").select("player_id,ioc").in("player_id", playerIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const nameMap = new Map<number, string>();
    (plist ?? []).forEach((p: any) => {
      const pid = Number(p?.player_id);
      if (Number.isFinite(pid) && typeof p?.name === "string") nameMap.set(pid, p.name);
    });

    const flagMap = new Map<number, string | null>();
    (iocList ?? []).forEach((r: any) => {
      const pid = Number(r?.player_id);
      if (Number.isFinite(pid)) flagMap.set(pid, isoToFlag(iocToIso2(r?.ioc)));
    });

    const playerInfo = (pid: number) => ({
      id: String(pid),
      name: nameMap.get(pid) ?? `Jugador ${pid}`,
      country: flagMap.get(pid) ?? null,
    });

    const year = new Date().getFullYear();

    const computations = await mapWithConcurrency(pendingMatches, 4, async (match) => {
      try {
        const result = await computePrematchSummary({
          playerA_id: match.topId,
          playerB_id: match.botId,
          tourney_id: hdr.tourney_id,
          year,
          playerA_name: nameMap.get(match.topId) ?? null,
          playerB_name: nameMap.get(match.botId) ?? null,
          event_name: hdr.name,
        });
        return { match, result };
      } catch (err) {
        console.warn("[valuebets] error computing prematch for match", match.id, err);
        return { match, result: null as any };
      }
    });

    const items: ValueBetItem[] = [];

    for (const { match, result } of computations) {
      if (!result || result.status !== 200) continue;
      const formatted = result.body as any;
      const odds = formatted?.odds;
      if (!odds) continue;

      const top = playerInfo(match.topId);
      const bottom = playerInfo(match.botId);

      const candidates = [
        {
          favored: top,
          other: bottom,
          modelProbability: formatted?.playerA?.win_probability ?? formatted?.prob_player ?? null,
          oddsSide: odds.playerA ?? null,
        },
        {
          favored: bottom,
          other: top,
          modelProbability:
            formatted?.playerB?.win_probability ??
            (formatted?.prob_player != null ? 1 - formatted.prob_player : null),
          oddsSide: odds.playerB ?? null,
        },
      ];

      for (const candidate of candidates) {
        const diff = candidate.oddsSide?.value_diff ?? null;
        const price = candidate.oddsSide?.price ?? null;
        const implied = candidate.oddsSide?.implied_probability ?? null;
        if (diff == null || price == null || implied == null || candidate.modelProbability == null) {
          continue;
        }
        if (diff < VALUE_DIFF_FLOOR) continue;

        items.push({
          matchId: match.id,
          round: match.round,
          favoredPlayer: candidate.favored,
          otherPlayer: candidate.other,
          modelProbability: candidate.modelProbability,
          oddsPrice: price,
          impliedProbability: implied,
          valueDiff: diff,
          tier: diff >= VALUE_DIFF_HIGH ? "high" : "good",
          bookmaker: odds.bookmaker ?? "bookmaker",
        });
      }
    }

    items.sort((a, b) => b.valueDiff - a.valueDiff);

    return new Response(
      JSON.stringify({
        tourney_id: hdr.tourney_id,
        event: hdr.name,
        surface: hdr.surface,
        scanned: pendingMatches.length,
        items,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("[valuebets] unhandled error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500 },
    );
  }
}
