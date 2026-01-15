import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const roundOrder = ["R128", "R64", "R32", "R16", "QF", "SF", "F"] as const;
const nextRound: Record<(typeof roundOrder)[number], string | null> = {
  R128: "R64",
  R64: "R32",
  R32: "R16",
  R16: "QF",
  QF: "SF",
  SF: "F",
  F: null,
};

type MatchRow = {
  id: string;
  round: string;
  top_id: string | null;
  bot_id: string | null;
  winner_id: string | null;
};

const toStr = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  return String(value);
};

const parseMatchNumber = (id: string): number => {
  const parts = id.split("-");
  const candidate = parts[1] ?? "";
  const parsed = Number.parseInt(candidate, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

type RawMatchRow = {
  id: unknown;
  round: unknown;
  top_id: unknown;
  bot_id: unknown;
  winner_id: unknown;
};

async function promoteWinners(client: SupabaseClient, tourneyId: string) {
  const { data, error } = await client
    .from("draw_matches")
    .select("id, round, top_id, bot_id, winner_id")
    .eq("tourney_id", tourneyId);

  if (error) {
    throw new Error(error.message);
  }

  const source = Array.isArray(data) ? (data as RawMatchRow[]) : [];
  const rows = source
    .map((row) => {
      const id = toStr(row.id);
      const round = toStr(row.round);
      if (!id || !round) {
        return null;
      }
      return {
        id,
        round,
        top_id: toStr(row.top_id),
        bot_id: toStr(row.bot_id),
        winner_id: toStr(row.winner_id),
      } satisfies MatchRow;
    })
    .filter((row): row is MatchRow => row !== null);

  const rowsByRound = new Map<string, MatchRow[]>();
  for (const round of roundOrder) {
    rowsByRound.set(round, []);
  }

  for (const row of rows) {
    if (!rowsByRound.has(row.round)) {
      rowsByRound.set(row.round, []);
    }
    rowsByRound.get(row.round)!.push(row);
  }

  for (const [, list] of rowsByRound) {
    list.sort((a, b) => parseMatchNumber(a.id) - parseMatchNumber(b.id));
  }

  for (const round of roundOrder) {
    const next = nextRound[round];
    if (!next) {
      continue;
    }

    const current = rowsByRound.get(round) ?? [];
    if (!current.length) {
      continue;
    }

    const existingNext = rowsByRound.get(next) ?? [];
    const existingNextMap = new Map(existingNext.map((row) => [row.id, row]));

    const upserts: Array<{
      id: string;
      tourney_id: string;
      round: string;
      top_id: string;
      bot_id: string;
      winner_id: string | null;
    }> = [];

    for (let index = 0; index < current.length; index += 2) {
      const first = current[index];
      const second = current[index + 1];
      if (!first || !second) {
        break;
      }

      if (!first.winner_id || !second.winner_id) {
        continue;
      }

      const matchNumber = Math.floor(index / 2) + 1;
      const nextId = `${next}-${matchNumber}`;
      const previous = existingNextMap.get(nextId);
      const winnerToKeep =
        previous &&
        previous.top_id === first.winner_id &&
        previous.bot_id === second.winner_id
          ? previous.winner_id
          : null;

      upserts.push({
        id: nextId,
        tourney_id: tourneyId,
        round: next,
        top_id: first.winner_id,
        bot_id: second.winner_id,
        winner_id: winnerToKeep,
      });
    }

    if (!upserts.length) {
      continue;
    }

    const { error: upsertError } = await client
      .from("draw_matches")
      // @ts-ignore onConflict es soportado por el cliente PostgREST
      .upsert(upserts, { onConflict: "tourney_id,id" });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    const unaffected = existingNext.filter(
      (row) => !upserts.some((item) => item.id === row.id),
    );
    const nextRows = [
      ...unaffected,
      ...upserts.map(
        ({ id, round: roundName, top_id, bot_id, winner_id }): MatchRow => ({
          id,
          round: roundName,
          top_id,
          bot_id,
          winner_id,
        }),
      ),
    ];
    rowsByRound.set(next, nextRows);
  }
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Supabase service role no configurado" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const tourneyId = typeof body.tourney_id === "string" ? body.tourney_id.trim() : "";
  const matchId = typeof body.match_id === "string" ? body.match_id.trim() : "";
  const winnerIdRaw = body.winner_id;
  const winnerId = typeof winnerIdRaw === "string" ? winnerIdRaw.trim() : toStr(winnerIdRaw);

  if (!tourneyId || !matchId || !winnerId) {
    return NextResponse.json(
      { error: "Parametros incompletos" },
      { status: 400 },
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: matchRow, error: matchError } = await supabaseAdmin
    .from("draw_matches")
    .select("id, round, top_id, bot_id")
    .eq("tourney_id", tourneyId)
    .eq("id", matchId)
    .maybeSingle();

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }

  if (!matchRow) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  const topId = toStr(matchRow.top_id);
  const botId = toStr(matchRow.bot_id);

  if (winnerId !== topId && winnerId !== botId) {
    return NextResponse.json(
      { error: "El ganador no corresponde al partido" },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("draw_matches")
    .update({ winner_id: winnerId })
    .eq("tourney_id", tourneyId)
    .eq("id", matchId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  try {
    await promoteWinners(supabaseAdmin, tourneyId);
  } catch (err) {
    console.warn("Fallo al propagar ganadores:", err);
  }

  return NextResponse.json({ status: "ok" });
}
