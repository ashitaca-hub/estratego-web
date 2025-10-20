// app/api/simulate/multiple/route.ts
export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";

type MultipleSimPayload = {
  tourney_id?: string;
  runs?: number;
  year?: number;
};

const roundOrder = ["R64", "R32", "R16", "QF", "SF", "F"] as const;
const nextRound: Record<(typeof roundOrder)[number], string | null> = {
  R64: "R32",
  R32: "R16",
  R16: "QF",
  QF: "SF",
  SF: "F",
  F: null,
};

async function ensureDraw(tourneyId: string) {
  const { data: existing, error: checkError } = await supabase
    .from("draw_matches")
    .select("id")
    .eq("tourney_id", tourneyId)
    .limit(1);

  if (checkError) {
    throw new Error(`Error checking draw_matches: ${checkError.message}`);
  }

  if (!existing || existing.length === 0) {
    const { error: buildError } = await supabase.rpc("build_draw_matches", {
      p_tournament_id: tourneyId,
    });

    if (buildError) {
      throw new Error(`Error in build_draw_matches: ${buildError.message}`);
    }
  }
}

async function promoteWinners(tourneyId: string) {
  const { data: roundsRows, error: roundsErr } = await supabase
    .from("draw_matches")
    .select("id, round, winner_id")
    .eq("tourney_id", tourneyId);

  if (roundsErr || !roundsRows || roundsRows.length === 0) {
    return;
  }

  const present = new Set(roundsRows.map((r: any) => r.round));
  for (const r of roundOrder) {
    if (!present.has(r)) continue;
    const next = nextRound[r];
    if (!next) break;

    const cur = roundsRows
      .filter((row: any) => row.round === r)
      .sort((a: any, b: any) => {
        const na = parseInt(String(a.id).split("-")[1] || "0", 10);
        const nb = parseInt(String(b.id).split("-")[1] || "0", 10);
        return na - nb;
      });

    const winners = cur.map((row: any) => row.winner_id as string | null);
    const upserts: Array<{
      id: string;
      tourney_id: string;
      round: string;
      top_id: string;
      bot_id: string;
    }> = [];

    for (let i = 0; i < winners.length; i += 2) {
      const top = winners[i];
      const bot = winners[i + 1] ?? null;
      if (!top || !bot) continue;
      const matchNum = i / 2 + 1;
      upserts.push({
        id: `${next}-${matchNum}`,
        tourney_id: tourneyId,
        round: next,
        top_id: top,
        bot_id: bot,
      });
    }

    if (upserts.length > 0) {
      const { error: upErr } = await supabase
        .from("draw_matches")
        // @ts-ignore onConflict option is passed to PostgREST
        .upsert(upserts, { onConflict: "tourney_id,id" });

      if (upErr) {
        console.warn(
          "No se pudieron crear/actualizar emparejamientos de la siguiente ronda:",
          upErr.message,
        );
      } else {
        console.log(`Emparejamientos listos para ${next}:`, upserts.length);
      }
    }
  }
}

export async function POST(req: Request) {
  let body: MultipleSimPayload;

  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
    });
  }

  const tourneyId = body.tourney_id?.trim();
  const runs = Number.parseInt(String(body.runs ?? 100), 10);
  const year = Number.parseInt(String(body.year ?? new Date().getFullYear()), 10);

  if (!tourneyId) {
    return new Response(JSON.stringify({ error: "Missing tourney_id" }), {
      status: 400,
    });
  }

  if (!Number.isInteger(runs) || runs <= 0) {
    return new Response(JSON.stringify({ error: "runs must be a positive integer" }), {
      status: 400,
    });
  }

  try {
    await ensureDraw(tourneyId);
  } catch (err) {
    console.error((err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
    });
  }

  const { error: simError } = await supabase.rpc("simulate_multiple_runs", {
    p_tourney_id: tourneyId,
    p_year: year,
    p_runs: runs,
  });

  if (simError) {
    console.error("Error in simulate_multiple_runs:", simError.message);
    return new Response(JSON.stringify({ error: simError.message }), { status: 500 });
  }

  try {
    await promoteWinners(tourneyId);
  } catch (err) {
    console.warn(
      "Post multi-run pairing step failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      tourney_id: tourneyId,
      runs,
      year,
    }),
    { status: 200 },
  );
}
