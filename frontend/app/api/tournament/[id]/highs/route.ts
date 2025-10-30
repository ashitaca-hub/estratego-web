import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const tourneyId = typeof id === "string" ? id.trim() : "";

  if (!tourneyId) {
    return NextResponse.json({ error: "tourney_id requerido" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("tournament_highs_summary", { p_tourney_id: tourneyId })
    .catch((err) => ({ data: null, error: err as Error }));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
  return NextResponse.json(row);
}
