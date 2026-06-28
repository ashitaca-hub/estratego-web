export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest } from "next/server";
import { computePrematchSummary } from "@/app/api/prematch/route";

type BracketPlayer = {
  id: string;
  name: string;
  country?: string | null;
};

type BracketMatch = {
  id: string;
  round: string;
  top: BracketPlayer;
  bottom: BracketPlayer;
  winnerId?: string;
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

const isRealPlayerId = (value: string | null | undefined): value is string => {
  if (!value) return false;
  const upper = value.trim().toUpperCase();
  if (!upper || upper === "TBD" || upper === "BYE") return false;
  return Number.isFinite(Number(value));
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
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const origin = new URL(request.url).origin;

  const bracketRes = await fetch(`${origin}/api/tournament/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });

  if (!bracketRes.ok) {
    const text = await bracketRes.text();
    return new Response(JSON.stringify({ error: text || `HTTP ${bracketRes.status}` }), {
      status: bracketRes.status,
    });
  }

  const bracket = (await bracketRes.json()) as {
    tourney_id: string;
    event: string;
    surface: string;
    matches: BracketMatch[];
  };

  const pendingMatches = (bracket.matches ?? []).filter(
    (m) => isRealPlayerId(m.top?.id) && isRealPlayerId(m.bottom?.id) && !m.winnerId,
  );

  const year = new Date().getFullYear();

  const computations = await mapWithConcurrency(pendingMatches, 4, async (match) => {
    try {
      const result = await computePrematchSummary({
        playerA_id: Number(match.top.id),
        playerB_id: Number(match.bottom.id),
        tourney_id: bracket.tourney_id,
        year,
        playerA_name: match.top.name,
        playerB_name: match.bottom.name,
        event_name: bracket.event,
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

    const candidates: Array<{
      favored: BracketPlayer;
      other: BracketPlayer;
      modelProbability: number | null;
      oddsSide: { price: number | null; implied_probability: number | null; value_diff: number | null } | null;
    }> = [
      {
        favored: match.top,
        other: match.bottom,
        modelProbability: formatted?.playerA?.win_probability ?? formatted?.prob_player ?? null,
        oddsSide: odds.playerA ?? null,
      },
      {
        favored: match.bottom,
        other: match.top,
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
        favoredPlayer: {
          id: candidate.favored.id,
          name: candidate.favored.name,
          country: candidate.favored.country ?? null,
        },
        otherPlayer: {
          id: candidate.other.id,
          name: candidate.other.name,
          country: candidate.other.country ?? null,
        },
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
      tourney_id: bracket.tourney_id,
      event: bracket.event,
      surface: bracket.surface,
      scanned: pendingMatches.length,
      items,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
