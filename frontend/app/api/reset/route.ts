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
    // 1) Detectar ronda inicial según el tamaño del cuadro del torneo
    const { data: tinfo, error: terr } = await supabaseAdmin
      .from("tournaments")
      .select("draw_size")
      .eq("tourney_id", tourney_id)
      .single();

    if (terr) {
      console.error("Error leyendo tournaments.draw_size:", terr);
      return NextResponse.json(
        { error: terr.message, stage: "meta" },
        { status: 500 }
      );
    }

    const size = Number(tinfo?.draw_size ?? 0);
    const firstRound =
      size >= 64 ? "R64" : size >= 32 ? "R32" : size >= 16 ? "R16" : size >= 8 ? "QF" : size >= 4 ? "SF" : "F";

    // 2) Limpiar ganadores de la ronda inicial
    const { error: updError } = await supabaseAdmin
      .from("draw_matches")
      .update({ winner_id: null })
      .eq("tourney_id", tourney_id)
      .eq("round", firstRound as any);

    if (updError) {
      console.error("Error limpiando winner_id en ronda inicial:", updError);
      return NextResponse.json(
        { error: updError.message, stage: "update_first_round" },
        { status: 500 }
      );
    }

    // 3) Borrar el resto de rondas (progresiones)
    const { error: delError } = await supabaseAdmin
      .from("draw_matches")
      .delete()
      .eq("tourney_id", tourney_id)
      .neq("round", firstRound as any);

    if (delError) {
      console.error("Error borrando rondas posteriores:", delError);
      return NextResponse.json(
        { error: delError.message, stage: "delete_later_rounds" },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "ok", firstRound }, { status: 200 });
  } catch (err) {
    console.error("Excepción en /api/reset:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
