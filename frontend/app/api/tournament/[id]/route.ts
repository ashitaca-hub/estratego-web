export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

type Player = {
  id: string;
  name: string;
  seed?: number | null;
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
    new Set(
      list
        .flatMap((r) => [r.top_id, r.bot_id])
        .map((value) => {
          if (typeof value === "number") return value;
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        })
        .filter((value): value is number => value !== null),
    ),
  );

  // Fetch players (names)
  const pPromise =
    ids.length > 0
      ? supabase
          .from("players_min") // <- cambiado de players_official a players_min
          .select("player_id,name")
          .in("player_id", ids)
      : Promise.resolve({ data: [], error: null } as any);

  // Fetch IOC from estratego_v1.players to derive ISO-2 country
    const iocPromise =
      ids.length > 0
        ? supabase
            .from("players_flag")          // vista pública
            .select("player_id,ioc")
            .in("player_id", ids)
        : Promise.resolve({ data: [], error: null } as any);

  // Try to fetch entries including entry_type; if column doesn't exist, fallback without it (TS-safe)
  const entriesAttempt = await supabase
    .from("draw_entries")
    .select("player_id,seed,entry_type,tag")
    .eq("tourney_id", id);

  let entries: Array<{ player_id: string; seed: any; entry_type?: any }> = [];
  let e4: any = null;
  if (entriesAttempt.error) {
    if (entriesAttempt.error.message?.toLowerCase().includes("entry_type")) {
      const fallback = await supabase
        .from("draw_entries")
        .select("player_id,seed,tag")
        .eq("tourney_id", id);
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

  const pmap = new Map<number, (typeof plist)[number]>();
  (plist ?? []).forEach((p: any) => {
    const pid = Number(p?.player_id);
    if (Number.isFinite(pid)) {
      pmap.set(pid, p);
    }
  });
  const emap = new Map<number, (typeof entries)[number]>();
  (entries ?? []).forEach((e: any) => {
    const pid = Number(e?.player_id);
    if (Number.isFinite(pid)) {
      emap.set(pid, e);
    }
  });
  const iocMap = new Map<number, string | null>();
  (iocList ?? []).forEach((r: any) => {
    const pid = Number(r?.player_id);
    if (Number.isFinite(pid)) {
      iocMap.set(pid, r.ioc ?? null);
    }
  });

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

  const isoToFlag = (iso?: string | null): string | null => {
    if (!iso || typeof iso !== "string") return null;
    const code = iso.trim().toUpperCase();
    if (code.length !== 2) return null;
    const A = 0x1f1e6;
    const base = "A".charCodeAt(0);
    const chars = Array.from(code).map((c) => String.fromCodePoint(A + (c.charCodeAt(0) - base)));
    return chars.join("");
  };

  const coerceSeed = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "bigint") {
      const asNumber = Number(value);
      return Number.isFinite(asNumber) ? asNumber : null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return null;
      const direct = Number(trimmed);
      if (Number.isFinite(direct)) return direct;
      const parsedInt = parseInt(trimmed, 10);
      return Number.isFinite(parsedInt) ? parsedInt : null;
    }
    return null;
  };

  const normalizePlayerId = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "TBD";
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? "TBD" : trimmed;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : "TBD";
    }
    if (typeof value === "bigint") {
      return String(value);
    }
    return "TBD";
  };

  const matches: Match[] = list.map((row) => {
    const topIdString = normalizePlayerId(row.top_id);
    const botIdString = normalizePlayerId(row.bot_id);
    const topIdNum = Number(topIdString);
    const botIdNum = Number(botIdString);
    const tp = Number.isFinite(topIdNum) ? pmap.get(topIdNum) : null;
    const bp = Number.isFinite(botIdNum) ? pmap.get(botIdNum) : null;

    const tentry = Number.isFinite(topIdNum) ? emap.get(topIdNum) : null;
    const rawSeedTop = (tentry as any)?.seed;
    const seedTop = coerceSeed(rawSeedTop);
    const rawEntryTop = (tentry as any)?.entry_type ?? (tentry as any)?.tag ?? null;
    const entryTop =
      typeof rawEntryTop === "string"
        ? (() => {
            const clean = rawEntryTop.trim().toUpperCase();
            return clean === "Q" || clean === "WC" ? clean : null;
          })()
        : null;
    const top: Player = {
      id: topIdString,
      name: tp?.name ?? "TBD",
      seed: seedTop,
      entryType: entryTop,
      country: isoToFlag(iocToIso2(Number.isFinite(topIdNum) ? iocMap.get(topIdNum) : null)),
    };

    const bentry = Number.isFinite(botIdNum) ? emap.get(botIdNum) : null;
    const rawSeedBot = (bentry as any)?.seed;
    const seedBot = coerceSeed(rawSeedBot);
    const rawEntryBot = (bentry as any)?.entry_type ?? (bentry as any)?.tag ?? null;
    const entryBot =
      typeof rawEntryBot === "string"
        ? (() => {
            const clean = rawEntryBot.trim().toUpperCase();
            return clean === "Q" || clean === "WC" ? clean : null;
          })()
        : null;
    const bottom: Player = {
      id: botIdString,
      name: bp?.name ?? "TBD",
      seed: seedBot,
      entryType: entryBot,
      country: isoToFlag(iocToIso2(Number.isFinite(botIdNum) ? iocMap.get(botIdNum) : null)),
    };

    return {
      id: row.id,
      round: row.round,
      top,
      bottom,
      winnerId:
        row.winner_id === null || row.winner_id === undefined
          ? undefined
          : normalizePlayerId(row.winner_id),
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
