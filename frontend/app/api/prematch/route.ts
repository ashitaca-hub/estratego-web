// app/api/prematch/route.ts
export const dynamic = "force-dynamic";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();
  const { playerA_id, playerB_id, tourney_id, year } = body;

  if (!playerA_id || !playerB_id || !tourney_id || !year) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), {
      status: 400,
    });
  }

  console.log("🪵 Llamando get_prematch_summary con:", {
  player_a_id: playerA_id,
  player_b_id: playerB_id,
  p_tourney_id: tourney_id,
  p_year: year,
});

  const { data, error } = await supabase.rpc("get_prematch_summary", {
    player_a_id: playerA_id,
    player_b_id: playerB_id,
    p_tourney_id: String(tourney_id),
    p_year: year,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
