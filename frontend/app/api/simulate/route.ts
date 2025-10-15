// app/api/simulate/route.ts
export const dynamic = "force-dynamic";
import { supabase } from "@/lib/supabase";

//type Bracket = {tourney_id: string; event: string; surface: string; drawSize: number; matches: Match[]; };

//function nextRound(r: Match["round"]): Match["round"] {
//  return r === "R16" ? "QF" : r === "QF" ? "SF" : r === "SF" ? "F" : "F";
//}

export async function POST(req: Request) {
  let tourney_id;
  try {
    const body = await req.json();
    console.log("📦 Received body:", body);
    tourney_id = body.tourney_id;
  } catch (err) {
    console.error("❌ Error parsing JSON body", err);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  if (!tourney_id) {
    console.warn("⚠️ Missing tourney_id in body");
    return new Response(JSON.stringify({ error: "Missing tourney_id" }), {
      status: 400,
    });
  }

  const { data: existing, error: checkError } = await supabase
    .from("draw_matches")
    .select("id")
    .eq("tourney_id", tourney_id)
    .limit(1);

  if (checkError) {
    console.error("❌ Error checking draw_matches:", checkError.message);
    return new Response(JSON.stringify({ error: checkError.message }), {
      status: 500,
    });
  }

  if (!existing || existing.length === 0) {
    const { error: buildError } = await supabase.rpc("build_draw_matches", {
      p_tournament_id: tourney_id,
    });

    if (buildError) {
      console.error("❌ Error in build_draw_matches:", buildError.message);
      return new Response(JSON.stringify({ error: buildError.message }), {
        status: 500,
      });
    }
  }

  const { error: simError } = await supabase.rpc("simulate_full_tournament", {
    p_tourney_id: tourney_id,
  });

  if (simError) {
    console.error("❌ Error in simulate_full_tournament:", simError.message);
    return new Response(JSON.stringify({ error: simError.message }), {
      status: 500,
    });
  }

  // Tras simular, promueve ganadores y crea/actualiza la siguiente ronda.
  try {
    const order = ["R64", "R32", "R16", "QF", "SF", "F"] as const;
    const nextOf: Record<string, string | null> = {
      R64: "R32",
      R32: "R16",
      R16: "QF",
      QF: "SF",
      SF: "F",
      F: null,
    };

    // Leer rondas presentes (incluye ids y ganadores)
    const { data: roundsRows, error: roundsErr } = await supabase
      .from("draw_matches")
      .select("id, round, winner_id")
      .eq("tourney_id", tourney_id);

    if (!roundsErr && roundsRows && roundsRows.length > 0) {
      const present = new Set(roundsRows.map((r: any) => r.round));
      for (const r of order) {
        if (!present.has(r)) continue;
        const next = nextOf[r];
        if (!next) break;

        // Construir siguiente ronda a partir de ganadores de la ronda r
        const cur = roundsRows
          .filter((row: any) => row.round === r)
          .sort((a: any, b: any) => {
            const na = parseInt(String(a.id).split("-")[1] || "0", 10);
            const nb = parseInt(String(b.id).split("-")[1] || "0", 10);
            return na - nb;
          });

        const winners = cur.map((row: any) => row.winner_id as string | null);
        const upserts: Array<{ id: string; tourney_id: string; round: string; top_id: string; bot_id: string }> = [];
        for (let i = 0; i < winners.length; i += 2) {
          const top = winners[i];
          const bot = winners[i + 1] ?? null;
          if (!top || !bot) continue; // solo creamos el cruce si ambos ganadores existen
          const matchNum = i / 2 + 1;
          upserts.push({ id: `${next}-${matchNum}`, tourney_id, round: next, top_id: top, bot_id: bot });
        }

        if (upserts.length > 0) {
          // upsert para crear o actualizar si ya existen placeholders
          const { error: upErr } = await supabase
            .from("draw_matches")
            // @ts-ignore onConflict es pasado a PostgREST
            .upsert(upserts, { onConflict: "tourney_id,id" });
          if (upErr) {
            console.warn("No se pudieron crear/actualizar emparejamientos de la siguiente ronda:", upErr.message);
          } else {
            console.log(`Emparejamientos listos para ${next}:`, upserts.length);
          }
        }
      }
    }
  } catch (e) {
    console.warn("Post-simulate pairing step failed:", (e as Error).message);
  }

  console.log("✅ Simulación completada con éxito");
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
