import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SERVICE_ROLE_KEY &&
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const tourney_id = body.tourney_id ?? "2025-329";

  if (!supabaseAdmin) {
    console.error("/api/reset requiere SUPABASE_SERVICE_ROLE_KEY configurada en el entorno");
    return NextResponse.json(
      { error: "Configuración inválida del servidor Supabase" },
      { status: 500 }
    );
  }

  try {
    const { error: deleteError } = await supabaseAdmin
      .from("draw_matches")
      .delete()
      .eq("tourney_id", tourney_id);

    if (deleteError) {
      console.error("Error borrando draw_matches:", deleteError);
      return NextResponse.json(
        { error: deleteError.message, stage: "delete" },
        { status: 500 }
      );
    }

    const { error: rpcError } = await supabaseAdmin.rpc("build_draw_matches", {
      p_tournament_id: tourney_id,
    });

    if (rpcError) {
      console.error("Error en RPC build_draw_matches:", rpcError);
      return NextResponse.json(
        { error: rpcError.message, stage: "rpc" },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    console.error("Excepción en /api/reset:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
