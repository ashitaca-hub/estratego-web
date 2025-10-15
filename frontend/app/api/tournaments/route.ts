// app/api/tournaments/route.ts
export const dynamic = "force-dynamic";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);

  let query = supabase
    .from("tournaments")
    .select("tourney_id,name,surface,draw_size")
    .limit(limit);

  if (q && q.trim()) {
    // Busuqeda simple por nombre o tourney_id (ilike)
    const like = `%${q.trim()}%`;
    query = query.or(
      `name.ilike.${like},tourney_id.ilike.${like}`
    );
  } else {
    // Por defecto, ordenar por tourney_id descendente (YYYY-XXX)
    query = query.order("tourney_id", { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ items: data ?? [] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

