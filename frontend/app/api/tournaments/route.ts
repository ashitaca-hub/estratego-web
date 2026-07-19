// app/api/tournaments/route.ts
export const dynamic = "force-dynamic";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 500);
  const today = new Date();

  // tourney_date valido: entre 1900 y 2100. Filtra basura como el placeholder
  // "202601" (year+month sin dia, 6 digitos) que new Date() interpreta como
  // un año extendido (202600) en vez de rechazarlo.
  const isSaneYear = (year: number) => year >= 1900 && year <= 2100;

  const parseDate = (value: unknown): Date | null => {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    // YYYYMMDD (ej: 20250824)
    const yyyymmdd = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (yyyymmdd) {
      const iso = `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime()) || !isSaneYear(parsed.getUTCFullYear())) return null;
      return parsed;
    }

    // Numero puro que no sea YYYYMMDD (p.ej. "202601"): no es un formato de
    // fecha reconocido, no intentar adivinar.
    if (/^\d+$/.test(raw)) return null;

    // ISO parcial YYYY-MM-DD...
    const isoCandidate = raw.length >= 10 ? raw.slice(0, 10) : raw;
    const parsed = new Date(isoCandidate);
    if (Number.isNaN(parsed.getTime()) || !isSaneYear(parsed.getUTCFullYear())) return null;
    return parsed;
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
  const prizeFields = "category,prize_money_local,prize_money_currency,prize_money_usd";
  const dateFields = "tourney_date,start_date,end_date";

  // Intentar con el select mas completo y ir recortando columnas si fallan
  // (start_date/end_date no existen hoy; prize_money_* son nuevas y pueden no
  // existir aun si no se ha corrido la migracion en Supabase).
  const fieldTiers = [
    `${baseFields},${prizeFields},${dateFields}`,
    `${baseFields},${prizeFields},tourney_date`,
    `${baseFields},tourney_date`,
    baseFields,
  ];

  let tmeta: any[] | null = null;
  let tErr: any = null;

  for (const fields of fieldTiers) {
    const res = await supabase.from("tournaments").select(fields).in("tourney_id", ids);
    if (!res.error) {
      tmeta = res.data as any[] | null;
      tErr = null;
      break;
    }
    tErr = res.error;
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

      const category = typeof m?.category === "string" && m.category.trim() ? m.category.trim() : null;
      const prizeMoneyLocal =
        typeof m?.prize_money_local === "number" ? m.prize_money_local : null;
      const prizeMoneyCurrency =
        typeof m?.prize_money_currency === "string" && m.prize_money_currency.trim()
          ? m.prize_money_currency.trim()
          : null;
      const prizeMoneyUsd = typeof m?.prize_money_usd === "number" ? m.prize_money_usd : null;

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
        category,
        prize_money_local: prizeMoneyLocal,
        prize_money_currency: prizeMoneyCurrency,
        prize_money_usd: prizeMoneyUsd,
        category_rank: null as number | null,
        category_total: null as number | null,
      };
    })
    // Orden por fecha desc y luego id desc
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      if (db !== da) return db - da;
      return a.tourney_id < b.tourney_id ? 1 : a.tourney_id > b.tourney_id ? -1 : 0;
    });

  // Rank dentro de la categoria (misma temporada): entre los torneos que
  // tengan category + prize_money_usd, ordenar desc por prize_money_usd y
  // asignar la posicion. Se hace en memoria (no en BD) porque el dataset ya
  // esta cargado completo en cada request y es pequeño (~decenas de filas).
  {
    const groups = new Map<string, typeof enriched>();
    for (const t of enriched) {
      if (!t.category || t.prize_money_usd == null || t.year == null) continue;
      const key = `${t.year}|${t.category}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => (b.prize_money_usd ?? 0) - (a.prize_money_usd ?? 0));
      group.forEach((t, i) => {
        t.category_rank = i + 1;
        t.category_total = group.length;
      });
    }
  }

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
