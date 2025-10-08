import { NextResponse } from "next/server";

export async function POST() {
  const tourney_id = "2025-747"; // Cambiar según test
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    // 1. Borrar draw_matches existentes
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/draw_matches?tourney_id=eq.${tourney_id}`, {
      method: "DELETE",
      headers,
    });

    if (!delRes.ok) {
      const error = await delRes.text();
      return NextResponse.json({ error, stage: "delete" }, { status: 500 });
    }

    // 2. Ejecutar build_draw_matches
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/build_draw_matches`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_tournament_id: tourney_id }),
    });

    if (!rpcRes.ok) {
      const error = await rpcRes.text();
      return NextResponse.json({ error, stage: "rpc" }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
