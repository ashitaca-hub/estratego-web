export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  let tourneyId: string | null = null;

  try {
    const body = await req.json();
    tourneyId =
      typeof body?.tourney_id === "string" && body.tourney_id.trim().length > 0
        ? body.tourney_id.trim()
        : null;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  if (!tourneyId) {
    return new Response(JSON.stringify({ error: "Missing tourney_id" }), {
      status: 400,
    });
  }

  const { data: existing, error: checkError } = await supabase
    .from("draw_matches")
    .select("id")
    .eq("tourney_id", tourneyId)
    .limit(1);

  if (checkError) {
    return new Response(JSON.stringify({ error: checkError.message }), {
      status: 500,
    });
  }

  if (!existing || existing.length === 0) {
    const { error: buildError } = await supabase.rpc("build_draw_matches", {
      p_tournament_id: tourneyId,
    });

    if (buildError) {
      return new Response(JSON.stringify({ error: buildError.message }), {
        status: 500,
      });
    }
  }

  const { error: simError } = await supabase.rpc("simulate_full_tournament", {
    p_tourney_id: tourneyId,
  });

  if (simError) {
    return new Response(JSON.stringify({ error: simError.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
