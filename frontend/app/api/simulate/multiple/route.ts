// app/api/simulate/multiple/route.ts
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL &&
  SERVICE_ROLE_KEY &&
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

type MultipleSimPayload = {
  tourney_id?: string;
  runs?: number;
  year?: number;
  reset?: boolean;
};

async function ensureDraw(tourneyId: string) {
  if (!supabaseAdmin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
  }

  const { data: existing, error: checkError } = await supabaseAdmin
    .from("draw_matches")
    .select("id")
    .eq("tourney_id", tourneyId)
    .limit(1);

  if (checkError) {
    throw new Error(`Error checking draw_matches: ${checkError.message}`);
  }

  if (!existing || existing.length === 0) {
    const { error: buildError } = await supabaseAdmin.rpc("build_draw_matches", {
      p_tournament_id: tourneyId,
    });

    if (buildError) {
      throw new Error(`Error in build_draw_matches: ${buildError.message}`);
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
  const runs = Number.parseInt(String(body.runs ?? 1), 10);
  const year = Number.parseInt(String(body.year ?? new Date().getFullYear()), 10);
  const reset = Boolean(body.reset);

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

  if (runs > 20) {
    return new Response(JSON.stringify({ error: "runs chunk too large (max 20)" }), {
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

  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY no configurada" }), {
      status: 500,
    });
  }

  const { error: simError } = await supabaseAdmin.rpc("simulate_multiple_runs", {
    p_tourney_id: tourneyId,
    p_year: year,
    p_runs: runs,
    p_reset: reset,
  });

  if (simError) {
    console.error("Error in simulate_multiple_runs:", simError.message);
    return new Response(JSON.stringify({ error: simError.message }), {
      status: 500,
    });
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

