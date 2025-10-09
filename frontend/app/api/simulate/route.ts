// app/api/simulate/route.ts
export const dynamic = "force-dynamic";
import { supabase } from "@/lib/supabase";

type Player = { id: string; name: string; seed?: number; country?: string };

type Match = {
  id: string;
  round: "R64" | "R32" | "R16" | "QF" | "SF" | "F";
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

export async function POST(req: Request) {
  let tourney_id;
  try {
    const body = await req.json();
    console.log("📦 Received body:", body);
    tourney_id = body.tourney_id;
  } catch (err) {
    console.error("❌ Error parsing JSON body", err);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  if (!tourney_id) {
    console.warn("⚠️ Missing tourney_id in body");
    return new Response(JSON.stringify({ error: "Missing tourney_id" }), {
      status: 400,
    });
  }

  const { data: existing, error: checkError } = await supabase
    .from("draw_matches")
    .select("id")
    .eq("tourney_id", tourney_id)
    .limit(1);

  if (checkError) {
    console.error("❌ Error checking draw_matches:", checkError.message);
    return new Response(JSON.stringify({ error: checkError.message }), {
      status: 500,
    });
  }

  if (!existing || existing.length === 0) {
    const { error: buildError } = await supabase.rpc("build_draw_matches", {
      p_tournament_id: tourney_id,
    });

    if (buildError) {
      console.error("❌ Error in build_draw_matches:", buildError.message);
      return new Response(JSON.stringify({ error: buildError.message }), {
        status: 500,
      });
    }
  }

  const { error: simError } = await supabase.rpc("simulate_full_tournament", {
    p_tourney_id: tourney_id,
  });

  if (simError) {
    console.error("❌ Error in simulate_full_tournament:", simError.message);
    return new Response(JSON.stringify({ error: simError.message }), {
      status: 500,
    });
  }

  console.log("✅ Simulación completada con éxito");
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
