import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: { tourneyId: string } },
) {
  const tourneyId = params?.tourneyId?.trim();

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
