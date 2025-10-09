import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const tourney_id = body.tourney_id ?? "2025-329";

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    // 1. Borrar partidos
    const delRes = await fetch(
      `${SUPABASE_URL}/rest/v1/draw_matches?tourney_id=eq.${tourney_id}`,
      {
        method: "DELETE",
        headers: {
          ...headers,
          Prefer: "return=representation",
        },
      }
    );
    const delText = await delRes.text();
    if (!delRes.ok) {
      console.error("Error borrando draw_matches:", delRes.status, delText);
      return NextResponse.json({ error: delText, stage: "delete" }, { status: 500 });
    }

    // 2. Llamar RPC
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/build_draw_matches`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_tournament_id: tourney_id }),
    });
    const rpcText = await rpcRes.text();
    console.log("🔧 build_draw_matches RPC response:", rpcRes.status, rpcText);
    if (!rpcRes.ok) {
      console.error("Error en RPC build_draw_matches:", rpcRes.status, rpcText);
      return NextResponse.json({ error: rpcText, stage: "rpc" }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    console.error("Excepción en /api/reset:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
