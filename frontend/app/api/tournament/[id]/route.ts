export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

type Player = {
  id: string;
  name: string;
  seed?: number;
  country?: string;
};

type Match = {
  id: string;
  round: "R16" | "QF" | "SF" | "F" | "R32" | "R64";
  top: Player;
  bottom: Player;
  winnerId?: string;
};

type Bracket = {
  tournamentId: string;
  event: string;
  surface: string;
  drawSize: number;
  matches: Match[];
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const { data: hdr, error: e1 } = await supabase
    .from("tournaments")
    .select("tourney_id,name,surface,draw_size")
    .eq("tourney_id", id)
    .single();

  if (e1 || !hdr) {
    return new Response(
      JSON.stringify({ error: e1?.message || "Torneo no encontrado" }),
      { status: 404 }
    );
  }

  const { data: rows, error: e2 } = await supabase
    .from("draw_matches")
    .select("id,round,top_id,bot_id,winner_id")
    .eq("tourney_id", id)
    .order("id", { ascending: true });

  if (e2) {
    return new Response(JSON.stringify({ error: e2.message }), {
      status: 500,
    });
  }

  const list = rows ?? [];

  const ids = Array.from(
    new Set(list.flatMap((r) => [r.top_id, r.bot_id]).filter(Boolean))
  );

  const { data: plist, error: e3 } = await supabase
    .from("players_min") // <- cambiado de players_official a players_min
    .select("player_id,name")
    .in("player_id", ids);

  if (e3) {
    return new Response(JSON.stringify({ error: e3.message }), {
      status: 500,
    });
  }

  const pmap = new Map<string, (typeof plist)[number]>();
  (plist ?? []).forEach((p) => pmap.set(p.player_id, p));

  const matches: Match[] = list.map((row) => {
    const tp = row.top_id ? pmap.get(row.top_id) : null;
    const bp = row.bot_id ? pmap.get(row.bot_id) : null;

    const top: Player = {
      id: row.top_id ?? "TBD",
      name: tp?.name ?? "TBD",
    };

    const bottom: Player = {
      id: row.bot_id ?? "TBD",
      name: bp?.name ?? "TBD",
    };

    return {
      id: row.id,
      round: row.round,
      top,
      bottom,
      winnerId: row.winner_id ?? undefined,
    };
  });

  const bracket: Bracket = {
    tournamentId: hdr.tourney_id,
    event: hdr.name,
    surface: hdr.surface,
    drawSize: hdr.draw_size,
    matches,
  };

  return new Response(JSON.stringify(bracket), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
