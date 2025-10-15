// app/api/tournaments/route.ts
export const dynamic = "force-dynamic";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);

  // 1) Obtener todos los tourney_id presentes en draw_matches
  const { data: dmRows, error: dmErr } = await supabase
    .from("draw_matches")
    .select("tourney_id");

  if (dmErr) {
    return new Response(JSON.stringify({ error: dmErr.message, stage: "draw_matches" }), { status: 500 });
  }

  const ids = Array.from(new Set((dmRows ?? []).map((r: any) => r.tourney_id).filter(Boolean)));

  if (ids.length === 0) {
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // 2) Cargar metadatos desde tournaments para esos ids
  const { data: tmeta, error: tErr } = await supabase
    .from("tournaments")
    .select("tourney_id,name,surface,draw_size")
    .in("tourney_id", ids);

  if (tErr) {
    return new Response(JSON.stringify({ error: tErr.message, stage: "tournaments" }), { status: 500 });
  }

  const metaMap = new Map<string, any>();
  (tmeta ?? []).forEach((t) => metaMap.set(t.tourney_id, t));

  // 3) Construir lista enriquecida y filtrar por q si aplica
  const enriched = ids
    .map((id) => {
      const m = metaMap.get(id);
      return {
        tourney_id: id,
        name: m?.name ?? null,
        surface: m?.surface ?? null,
        draw_size: m?.draw_size ?? null,
      };
    })
    // Orden por id descendente (YYYY-XXX)
    .sort((a, b) => (a.tourney_id < b.tourney_id ? 1 : a.tourney_id > b.tourney_id ? -1 : 0));

  const needle = (q || "").trim().toLowerCase();
  const filtered = needle
    ? enriched.filter((t) =>
        t.tourney_id.toLowerCase().includes(needle) || (t.name ? String(t.name).toLowerCase().includes(needle) : false),
      )
    : enriched;

  const limited = filtered.slice(0, limit);

  return new Response(JSON.stringify({ items: limited }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
