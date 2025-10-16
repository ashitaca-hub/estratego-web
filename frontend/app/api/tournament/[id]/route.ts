export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

type Player = {
  id: string;
  name: string;
  seed?: number;
  entryType?: string | null;
  country?: string | null;
};

type Match = {
  id: string;
  round: "R16" | "QF" | "SF" | "F" | "R32" | "R64";
  top: Player;
  bottom: Player;
  winnerId?: string;
};

type Bracket = {
  tourney_id: string;
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

  const { data: rawRows, error: e2 } = await supabase
    .from("draw_matches")
    .select("id,round,top_id,bot_id,winner_id")
    .eq("tourney_id", id);

  if (e2) {
    return new Response(JSON.stringify({ error: e2.message }), {
      status: 500,
    });
  }

const list = [...(rawRows ?? [])].sort((a, b) => {
  const getNumericId = (id: string) => parseInt(id.split("-")[1], 10);
  return getNumericId(a.id) - getNumericId(b.id);
});

  const ids = Array.from(
    new Set(list.flatMap((r) => [r.top_id, r.bot_id]).filter(Boolean))
  );

  // Fetch players (names)
  const pPromise = supabase
    .from("players_min") // <- cambiado de players_official a players_min
    .select("player_id,name")
    .in("player_id", ids);

  // Fetch IOC from estratego_v1.players to derive ISO-2 country
  const iocPromise = supabase
    .schema("estratego_v1")
    .from("players")
    .select("player_id,ioc")
    .in("player_id", ids);

  // Try to fetch entries including entry_type; if column doesn't exist, fallback without it (TS-safe)
  const entriesAttempt = await supabase
    .from("draw_entries")
    .select("player_id,seed,entry_type")
    .eq("tourney_id", id)
    .in("player_id", ids);

  let entries: Array<{ player_id: string; seed: any; entry_type?: any }> = [];
  let e4: any = null;
  if (entriesAttempt.error) {
    if (entriesAttempt.error.message?.toLowerCase().includes("entry_type")) {
      const fallback = await supabase
        .from("draw_entries")
        .select("player_id,seed,tag")
        .eq("tourney_id", id)
        .in("player_id", ids);
      e4 = fallback.error;
      entries = Array.isArray(fallback.data) ? (fallback.data as any[]) : [];
    } else {
      e4 = entriesAttempt.error;
      entries = Array.isArray(entriesAttempt.data) ? (entriesAttempt.data as any[]) : [];
    }
  } else {
    entries = Array.isArray(entriesAttempt.data) ? (entriesAttempt.data as any[]) : [];
  }

  const [{ data: plist, error: e3 }, { data: iocList, error: e5 }] = await Promise.all([
    pPromise,
    iocPromise,
  ]);

  if (e3 || e4) {
    return new Response(JSON.stringify({ error: e3?.message || e4?.message }), {
      status: 500,
    });
  }

  const pmap = new Map<string, (typeof plist)[number]>();
  (plist ?? []).forEach((p) => pmap.set(p.player_id, p));
  const emap = new Map<string, (typeof entries)[number]>();
  (entries ?? []).forEach((e: any) => emap.set(e.player_id, e));
  const iocMap = new Map<string, string | null>();
  (iocList ?? []).forEach((r: any) => iocMap.set(r.player_id, r.ioc ?? null));

  const iocToIso2 = (ioc?: string | null): string | null => {
    if (!ioc || typeof ioc !== "string") return null;
    const code = ioc.trim().toUpperCase();
    const map: Record<string, string> = {
      ESP: "ES", ARG: "AR", USA: "US", GBR: "GB", UKR: "UA", GER: "DE", FRA: "FR", ITA: "IT",
      SUI: "CH", NED: "NL", BEL: "BE", SWE: "SE", NOR: "NO", DEN: "DK", CRO: "HR", SRB: "RS",
      BIH: "BA", POR: "PT", POL: "PL", CZE: "CZ", SVK: "SK", SLO: "SI", HUN: "HU", AUT: "AT",
      AUS: "AU", NZL: "NZ", CAN: "CA", MEX: "MX", COL: "CO", CHI: "CL", PER: "PE", ECU: "EC",
      URU: "UY", BOL: "BO", VEN: "VE", BRA: "BR", JPN: "JP", KOR: "KR", CHN: "CN", HKG: "HK",
      TPE: "TW", THA: "TH", VIE: "VN", IND: "IN", PAK: "PK", QAT: "QA", UAE: "AE", KAZ: "KZ",
      UZB: "UZ", GEO: "GE", ARM: "AM", TUR: "TR", GRE: "GR", CYP: "CY", ROU: "RO", BUL: "BG",
      LTU: "LT", LAT: "LV", EST: "EE", FIN: "FI", IRL: "IE", SCO: "GB", WAL: "GB",
    };
    return map[code] || null;
  };

  const matches: Match[] = list.map((row) => {
    const tp = row.top_id ? pmap.get(row.top_id) : null;
    const bp = row.bot_id ? pmap.get(row.bot_id) : null;

    const tentry = row.top_id ? emap.get(row.top_id) : null;
    const top: Player = {
      id: row.top_id ?? "TBD",
      name: tp?.name ?? "TBD",
      seed: tentry?.seed ?? undefined,
      entryType:
        ((tentry as any)?.entry_type ?? (tentry as any)?.tag) &&
        (((tentry as any)?.entry_type ?? (tentry as any)?.tag) === "Q" ||
          ((tentry as any)?.entry_type ?? (tentry as any)?.tag) === "WC")
          ? ((tentry as any)?.entry_type ?? (tentry as any)?.tag)
          : null,
      country: iocToIso2(iocMap.get(row.top_id)),
    };

    const bentry = row.bot_id ? emap.get(row.bot_id) : null;
    const bottom: Player = {
      id: row.bot_id ?? "TBD",
      name: bp?.name ?? "TBD",
      seed: bentry?.seed ?? undefined,
      entryType:
        ((bentry as any)?.entry_type ?? (bentry as any)?.tag) &&
        (((bentry as any)?.entry_type ?? (bentry as any)?.tag) === "Q" ||
          ((bentry as any)?.entry_type ?? (bentry as any)?.tag) === "WC")
          ? ((bentry as any)?.entry_type ?? (bentry as any)?.tag)
          : null,
      country: iocToIso2(iocMap.get(row.bot_id)),
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
    tourney_id: hdr.tourney_id,
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


