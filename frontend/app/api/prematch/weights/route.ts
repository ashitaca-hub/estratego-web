import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type WeightRow = {
  metric: string;
  weight: number;
};

const METRIC_KEYS = [
  "win_pct_year",
  "win_pct_surface",
  "win_pct_month",
  "win_pct_vs_top10",
  "court_speed_score",
  "rest_score",
  "ranking_score",
  "h2h_score",
  "motivation_score",
] as const;

const DEFAULT_WEIGHTS: Record<(typeof METRIC_KEYS)[number], number> = {
  win_pct_year: 0.15,
  win_pct_surface: 0.15,
  win_pct_month: 0.1,
  win_pct_vs_top10: 0.1,
  court_speed_score: 0,
  rest_score: 0.05,
  ranking_score: 0.3,
  h2h_score: 0.1,
  motivation_score: 0.05,
};

export async function GET() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY no configurada" },
      { status: 500 },
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabaseAdmin.rpc("prematch_metric_weights_get");

  if (error) {
    const message = error.message ?? "";
    if (message.includes("prematch_metric_weights_get")) {
      return NextResponse.json(
        { error: "Ejecuta sql/create_prematch_metric_weights_api.sql en Supabase para exponer los pesos." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: message || "Error inesperado" }, { status: 500 });
  }

  const rows = Array.isArray(data) ? (data as WeightRow[]) : [];
  const merged: Record<string, number> = { ...DEFAULT_WEIGHTS };

  for (const row of rows) {
    const metric = row.metric.trim();
    const numericWeight = Number(row.weight);
    if (!Number.isFinite(numericWeight)) continue;
    merged[metric] = numericWeight;
  }

  const weights = METRIC_KEYS.map((key) => ({
    metric: key,
    weight: merged[key],
  }));

  return NextResponse.json({ weights });
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY no configurada" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const payload = (body as Record<string, unknown>).weights;
  if (!Array.isArray(payload)) {
    return NextResponse.json({ error: "weights debe ser un array" }, { status: 400 });
  }

  const rows: WeightRow[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const metric = typeof (entry as any).metric === "string" ? (entry as any).metric.trim() : "";
    const weight = Number((entry as any).weight);
    if (!metric || !Number.isFinite(weight)) continue;
    rows.push({ metric, weight });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No hay pesos validos" }, { status: 400 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { error } = await supabaseAdmin.rpc("prematch_metric_weights_upsert", {
    p_weights: rows,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("prematch_metric_weights_upsert")) {
      return NextResponse.json(
        { error: "Ejecuta sql/create_prematch_metric_weights_api.sql en Supabase para habilitar el guardado." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: message || "Error inesperado" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: rows.length });
}





