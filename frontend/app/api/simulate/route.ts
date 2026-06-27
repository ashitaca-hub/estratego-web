export const dynamic = "force-dynamic";
export const maxDuration = 60; // un solo run en 7 llamadas de ronda cabe sobrado

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL &&
  SERVICE_ROLE_KEY &&
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

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

  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY no configurada" }), {
      status: 500,
    });
  }

  const { data: existing, error: checkError } = await supabaseAdmin
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
    const { error: buildError } = await supabaseAdmin.rpc("build_draw_matches", {
      p_tournament_id: tourneyId,
    });

    if (buildError) {
      return new Response(JSON.stringify({ error: buildError.message }), {
        status: 500,
      });
    }
  }

  const { data: rounds, error: prepareError } = await supabaseAdmin.rpc("simulate_prepare_bracket", {
    p_tourney_id: tourneyId,
  });

  if (prepareError) {
    return new Response(JSON.stringify({ error: prepareError.message }), {
      status: 500,
    });
  }

  for (const round of (rounds as string[]) ?? []) {
    const { error: roundError } = await supabaseAdmin.rpc("simulate_one_round", {
      p_tourney_id: tourneyId,
      p_round: round,
    });

    if (roundError) {
      return new Response(JSON.stringify({ error: roundError.message }), {
        status: 500,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
