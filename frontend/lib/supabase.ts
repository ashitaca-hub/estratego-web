// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tipos base (ajustalos a tus tablas reales)
export type DbPlayer = { id: string; name: string; country?: string | null; seed?: number | null };
export type DbMatch = {
  id: string;
  round: "R128" | "R64" | "R32" | "R16" | "QF" | "SF" | "F";
  top_id: string;
  bot_id: string;
};
export type DbDraw = { tournament_id: string; event: string; surface: string; draw_size: number };
