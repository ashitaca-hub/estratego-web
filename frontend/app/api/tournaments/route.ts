// app/api/tournaments/route.ts
export const dynamic = "force-dynamic";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);
  const today = new Date();

  const parseDate = (value: unknown): Date | null => {
    if (!value || (typeof value !== "string" && typeof value !== "number")) return null;
    const dateStr = String(value).slice(0, 10);
    const parsed = new Date(dateStr);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

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
  const baseFields = "tourney_id,name,surface,draw_size";
  const dateFields = "tourney_date,start_date,end_date";

  const tmetaRes = await supabase
    .from("tournaments")
    .select(`${baseFields},${dateFields}`)
    .in("tourney_id", ids);

  // Fallback si alguna columna de fecha no existe
  let tmeta = tmetaRes.data;
  let tErr = tmetaRes.error;
  if (tErr) {
    const fallback = await supabase.from("tournaments").select(baseFields).in("tourney_id", ids);
    tmeta = fallback.data;
    tErr = fallback.error;
  }

  if (tErr) {
    return new Response(JSON.stringify({ error: tErr.message, stage: "tournaments" }), { status: 500 });
  }

  const metaMap = new Map<string, any>();
  (tmeta ?? []).forEach((t) => metaMap.set(t.tourney_id, t));

  // 3) Construir lista enriquecida y filtrar por q si aplica
  const enriched = ids
    .map((id) => {
      const m = metaMap.get(id);
      const rawStart = (m as any)?.start_date ?? (m as any)?.tourney_date ?? null;
      const rawEnd = (m as any)?.end_date ?? null;

      const startDate = parseDate(rawStart);
      const endDate = parseDate(rawEnd);

      const year = startDate?.getFullYear() ?? null;
      const month = startDate ? startDate.getMonth() + 1 : null;

      const isLive = (() => {
        if (!startDate) return false;
        const start = startDate.getTime();
        const end = endDate?.getTime() ?? start + 7 * 24 * 60 * 60 * 1000; // ventana de 7 días
        const now = today.getTime();
        return now >= start && now <= end;
      })();

      const dateStr = startDate ? startDate.toISOString().slice(0, 10) : null;

      return {
        tourney_id: id,
        name: m?.name ?? null,
        surface: m?.surface ?? null,
        draw_size: m?.draw_size ?? null,
        date: dateStr,
        year,
        month,
        is_live: isLive,
      };
    })
    // Orden por fecha desc y luego id desc
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      if (db !== da) return db - da;
      return a.tourney_id < b.tourney_id ? 1 : a.tourney_id > b.tourney_id ? -1 : 0;
    });

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
