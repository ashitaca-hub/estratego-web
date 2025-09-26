// app/api/simulate/route.ts
export const dynamic = "force-dynamic";
import { supabase } from "@/lib/supabase";

type Player = { id: string; name: string; seed?: number; country?: string };

type Match = {
  id: string;
  round: "R16" | "QF" | "SF" | "F";
  top: Player;
  bottom: Player;
  winnerId?: string;
};

type Bracket = {
  tourney_id: string;
  event: string;
  surface: string;
  drawSize: number;
  matches: Match[];
};

function nextRound(r: Match["round"]): Match["round"] {
  return r === "R16" ? "QF" : r === "QF" ? "SF" : r === "SF" ? "F" : "F";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function simulate(bracket: Bracket): Bracket {
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const copy: Bracket = JSON.parse(JSON.stringify(bracket));
  const rounds: Match["round"][] = ["R16", "QF", "SF", "F"];

  for (const round of rounds) {
    const ms = copy.matches
      .filter((m) => m.round === round)
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const m of ms) {
      const favBias =
        (m.top.seed ?? 99) < (m.bottom.seed ?? 99) ? 58 : 42;
      const coin = rnd(100);
      const win = coin < favBias ? m.top : m.bottom;
      m.winnerId = win.id;
    }

    if (round !== "F") {
      const winners = ms.map((m) =>
        m.winnerId === m.top.id ? m.top : m.bottom
      );
      const next: Match[] = [];
      for (let i = 0; i < winners.length; i += 2) {
        next.push({
          id: `${nextRound(round)}-${Math.floor(i / 2) + 1}`,
          round: nextRound(round),
          top: winners[i],
          bottom: winners[i + 1],
        });
      }
      copy.matches = copy.matches
        .filter((m) => m.round !== nextRound(round))
        .concat(next);
    }
  }

  return copy;
}

export async function POST(req: Request) {
  const { tourney_id } = await req.json();

  if (!tourney_id) {
    return new Response(
      JSON.stringify({ error: "Missing tourney_id" }),
      { status: 400 }
    );
  }

  const { error } = await supabase.rpc("simulate_next_round", {
    tourney_id,
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
