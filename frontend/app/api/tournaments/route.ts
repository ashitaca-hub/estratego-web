// app/api/tournaments/route.ts
export const dynamic = "force-dynamic";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 500);
  const today = new Date();

  const parseDate = (value: unknown): Date | null => {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    // YYYYMMDD (ej: 20250824)
    const yyyymmdd = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (yyyymmdd) {
      const iso = `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
      const parsed = new Date(iso);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    // ISO parcial YYYY-MM-DD...
    const isoCandidate = raw.length >= 10 ? raw.slice(0, 10) : raw;
    const parsed = new Date(isoCandidate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  // 1) Obtener todos los tourney_id presentes en draw_matches.
  // draw_matches tiene miles de filas (todos los partidos de todos los
  // torneos), muy por encima del limite de pagina por defecto de
  // PostgREST (1000), asi que hay que paginar o se pierden torneos
  // (p.ej. los que caigan despues del corte quedan invisibles en la app).
  const dmIds = new Set<string>();
  {
    const pageSize = 1000;
    let start = 0;
    while (true) {
      const { data: page, error: dmErr } = await supabase
        .from("draw_matches")
        .select("tourney_id")
        .range(start, start + pageSize - 1);

      if (dmErr) {
        return new Response(JSON.stringify({ error: dmErr.message, stage: "draw_matches" }), { status: 500 });
      }

      const rows = page ?? [];
      for (const r of rows as any[]) {
        if (r.tourney_id) dmIds.add(r.tourney_id);
      }

      if (rows.length < pageSize) break;
      start += rows.length;
    }
  }

  const ids = Array.from(dmIds);

  if (ids.length === 0) {
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // 2) Cargar metadatos desde tournaments para esos ids
  const baseFields = "tourney_id,name,surface,draw_size";
  const dateFields = "tourney_date,start_date,end_date";

  // Intentar con todas las columnas de fecha; si falla, probar con tourney_date; luego sin fechas.
  let tmeta: any[] | null = null;
  let tErr: any = null;

  const resFull = await supabase
    .from("tournaments")
    .select(`${baseFields},${dateFields}`)
    .in("tourney_id", ids);

  if (!resFull.error) {
    tmeta = resFull.data as any[] | null;
    tErr = null;
  } else {
    const resDateOnly = await supabase
      .from("tournaments")
      .select(`${baseFields},tourney_date`)
      .in("tourney_id", ids);

    if (!resDateOnly.error) {
      tmeta = resDateOnly.data as any[] | null;
      tErr = null;
    } else {
      const fallback = await supabase.from("tournaments").select(baseFields).in("tourney_id", ids);
      tmeta = fallback.data as any[] | null;
      tErr = fallback.error;
    }
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

      const parsedStart = parseDate(rawStart);
      const startDate = parsedStart ?? (() => {
        // Fallback: derivar year desde tourney_id (prefijo YYYY)
        const match = String(id).match(/^(\d{4})/);
        if (match) {
          return parseDate(`${match[1]}0101`);
        }
        return null;
      })();
      const endDate = parseDate(rawEnd);

      const year = startDate?.getFullYear() ?? (() => {
        const match = String(id).match(/^(\d{4})/);
        return match ? Number(match[1]) : null;
      })();
      const month = startDate ? startDate.getMonth() + 1 : null;

      const isLive = (() => {
        if (!parsedStart) return false; // solo consideramos live si tenemos fecha real
        const start = parsedStart.getTime();
        const end = endDate?.getTime() ?? start + 7 * 24 * 60 * 60 * 1000; // ventana de 7 dias
        const now = today.getTime();
        return now >= start && now <= end;
      })();

      const isUpcoming = (() => {
        if (!parsedStart || isLive) return false; // solo consideramos proximo si tenemos fecha real y no esta ya en juego
        const start = parsedStart.getTime();
        const now = today.getTime();
        const window = 7 * 24 * 60 * 60 * 1000; // ventana de 7 dias antes del inicio
        return start > now && start <= now + window;
      })();

      const dateStr = startDate ? startDate.toISOString().slice(0, 10) : null;
      const endDateStr = endDate ? endDate.toISOString().slice(0, 10) : null;

      return {
        tourney_id: id,
        name: m?.name ?? null,
        surface: m?.surface ?? null,
        draw_size: m?.draw_size ?? null,
        date: dateStr,
        end_date: endDateStr,
        year,
        month,
        is_live: isLive,
        is_upcoming: isUpcoming,
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
