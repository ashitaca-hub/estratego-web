import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ tourneyId: string }> },
) {
  let tourneyId = "";

  try {
    const resolved = await context.params;
    tourneyId =
      typeof resolved?.tourneyId === "string" ? resolved.tourneyId.trim() : "";
  } catch {
    tourneyId = "";
  }

  if (!tourneyId) {
    return NextResponse.json({ error: "Missing tourneyId" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("simulation_results_run_count", {
    p_tourney_id: tourneyId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const runCount =
    typeof data === "number" && Number.isFinite(data) ? data : 0;

  return NextResponse.json({
    tourney_id: tourneyId,
    run_count: runCount,
    has_results: runCount > 0,
  });
}
