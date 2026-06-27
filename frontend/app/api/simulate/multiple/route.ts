// app/api/simulate/multiple/route.ts
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

  if (reset) {
    const { error: resetError } = await supabaseAdmin.rpc("simulate_reset_results", {
      p_tourney_id: tourneyId,
    });
    if (resetError) {
      return new Response(JSON.stringify({ error: resetError.message }), {
        status: 500,
      });
    }
  }

  const { data: nextRunNumber, error: nextRunError } = await supabaseAdmin.rpc("simulate_next_run_number", {
    p_tourney_id: tourneyId,
  });

  if (nextRunError) {
    return new Response(JSON.stringify({ error: nextRunError.message }), {
      status: 500,
    });
  }

  const baseRun = (nextRunNumber as number) ?? 1;

  // Cada run completo recorre todas las rondas del cuadro. Para draws grandes
  // (128) un solo run ya puede tardar ~16s, asi que aqui limitamos por tiempo
  // de pared en vez de asumir que el chunk entero cabe siempre en la duracion
  // de la funcion serverless; el numero real de runs completados se devuelve
  // para que el frontend ajuste su progreso y siga pidiendo el resto.
  const TIME_BUDGET_MS = 35_000;
  const startedAt = Date.now();
  let runsCompleted = 0;

  for (let i = 0; i < runs; i++) {
    if (i > 0 && Date.now() - startedAt > TIME_BUDGET_MS) {
      break;
    }

    const runNumber = baseRun + i;

    const { data: rounds, error: prepareError } = await supabaseAdmin.rpc("simulate_prepare_bracket", {
      p_tourney_id: tourneyId,
    });

    if (prepareError) {
      console.error("Error in simulate_prepare_bracket:", prepareError.message);
      return new Response(JSON.stringify({ error: prepareError.message, runsCompleted }), {
        status: 500,
      });
    }

    for (const round of (rounds as string[]) ?? []) {
      const { error: roundError } = await supabaseAdmin.rpc("simulate_one_round", {
        p_tourney_id: tourneyId,
        p_round: round,
      });

      if (roundError) {
        console.error("Error in simulate_one_round:", roundError.message);
        return new Response(JSON.stringify({ error: roundError.message, runsCompleted }), {
          status: 500,
        });
      }
    }

    const { error: recordError } = await supabaseAdmin.rpc("simulate_record_run_result", {
      p_tourney_id: tourneyId,
      p_run_number: runNumber,
    });

    if (recordError) {
      console.error("Error in simulate_record_run_result:", recordError.message);
      return new Response(JSON.stringify({ error: recordError.message, runsCompleted }), {
        status: 500,
      });
    }

    runsCompleted++;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      tourney_id: tourneyId,
      runs,
      runsCompleted,
      year,
    }),
    { status: 200 },
  );
}

