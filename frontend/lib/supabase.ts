// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Tipos base (ajústalos a tus tablas reales)
export type DbPlayer = { id: string; name: string; country?: string | null; seed?: number | null };
export type DbMatch = { id: string; round: "R16" | "QF" | "SF" | "F"; top_id: string; bot_id: string };
export type DbDraw = { tournament_id: string; event: string; surface: string; draw_size: number };
