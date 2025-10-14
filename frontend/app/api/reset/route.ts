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
  const mode = (body.mode as string | undefined)?.toLowerCase() === "hard" ? "hard" : "soft";

  if (!supabaseAdmin) {
    console.error("/api/reset requiere SUPABASE_SERVICE_ROLE_KEY configurada en el entorno");
    return NextResponse.json(
      { error: "Configuración inválida del servidor Supabase" },
      { status: 500 }
    );
  }

  try {
    if (mode === "hard") {
      // Borrar todo y reconstruir a partir de draw_entries (garantiza la ronda correcta)
      const { error: deleteError } = await supabaseAdmin
        .from("draw_matches")
        .delete()
        .eq("tourney_id", tourney_id);

      if (deleteError) {
        console.error("Error borrando draw_matches:", deleteError);
        return NextResponse.json(
          { error: deleteError.message, stage: "delete_all" },
          { status: 500 }
        );
      }

      const { error: rpcError } = await supabaseAdmin.rpc("build_draw_matches", {
        p_tournament_id: tourney_id,
      });

      if (rpcError) {
        console.error("Error en RPC build_draw_matches:", rpcError);
        return NextResponse.json(
          { error: rpcError.message, stage: "rpc_build" },
          { status: 500 }
        );
      }

      return NextResponse.json({ status: "ok", mode }, { status: 200 });
    }

    // Modo soft: usa rondas presentes, pero valida contra draw_size para evitar quedarnos en R16 si debe ser R32
    const order = ["R64", "R32", "R16", "QF", "SF", "F"] as const;

    const [{ data: roundsData, error: roundsErr }, { data: tinfo, error: terr }] = await Promise.all([
      supabaseAdmin.from("draw_matches").select("round").eq("tourney_id", tourney_id),
      supabaseAdmin.from("tournaments").select("draw_size").eq("tourney_id", tourney_id).single(),
    ]);

    if (roundsErr) {
      console.error("Error leyendo draw_matches(round):", roundsErr);
      return NextResponse.json(
        { error: roundsErr.message, stage: "read_rounds" },
        { status: 500 }
      );
    }

    const present = new Set((roundsData ?? []).map((r: any) => r.round));
    let detectedFirst = order.find((r) => present.has(r));

    let expectedFirst: (typeof order)[number] | null = null;
    const size = Number(tinfo?.draw_size ?? 0);
    if (!Number.isNaN(size) && size > 0) {
      expectedFirst = size >= 64 ? "R64" : size >= 32 ? "R32" : size >= 16 ? "R16" : size >= 8 ? "QF" : size >= 4 ? "SF" : "F";
    }

    // Si la ronda detectada no coincide con la esperada, hacemos hard rebuild automáticamente
    if (expectedFirst && detectedFirst && expectedFirst !== detectedFirst) {
      console.warn("Reset soft->hard por desajuste de ronda inicial", { expectedFirst, detectedFirst });

      const { error: deleteError } = await supabaseAdmin
        .from("draw_matches")
        .delete()
        .eq("tourney_id", tourney_id);
      if (deleteError) {
        return NextResponse.json(
          { error: deleteError.message, stage: "delete_all" },
          { status: 500 }
        );
      }
      const { error: rpcError } = await supabaseAdmin.rpc("build_draw_matches", {
        p_tournament_id: tourney_id,
      });
      if (rpcError) {
        return NextResponse.json(
          { error: rpcError.message, stage: "rpc_build" },
          { status: 500 }
        );
      }
      return NextResponse.json({ status: "ok", mode: "auto-hard", expectedFirst }, { status: 200 });
    }

    const firstRound = detectedFirst ?? expectedFirst ?? "R32"; // fallback

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

    return NextResponse.json({ status: "ok", firstRound, mode }, { status: 200 });
  } catch (err) {
    console.error("Excepción en /api/reset:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
